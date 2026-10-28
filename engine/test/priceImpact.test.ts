// Price impact at fleet scale (#73, ff_price_impact). Slopes here come from the SIMULATED fixture
// engine/test/fixtures/response_tables.fixture.json, never from data.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readdirSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { Bundle } from "@contracts/types";
import { solveDp } from "@engine/dp";
import { dpHourly } from "@engine/hourly";
import { REF_E_MWH, REF_RTE, referenceRace } from "@engine/reference";
import {
  SCALE_FLEET_MW,
  dpAtFleet,
  legAtFleet,
  prepareSlopes,
  readPriceResponse,
  scaleCurve,
} from "@engine/scale";
import type { PriceResponse, ScaleCurve } from "@engine/scale";
import { repoPath } from "./helpers/fixture";
import { snapshotPrices } from "./helpers/oasis";

const FIXTURE = "engine/test/fixtures/response_tables.fixture.json";
const read = (p: string) => readFileSync(repoPath(p), "utf8");
const fixtureRaw = () => JSON.parse(read(FIXTURE)) as Record<string, unknown>;
const fixture = (): PriceResponse => readPriceResponse(fixtureRaw(), FIXTURE);
const zeroSlopes = (): PriceResponse => {
  const r = fixture();
  return {
    ...r,
    bins: r.bins.map((b) => ({ ...b, slope: 0, lo: 0, hi: 0 })),
  };
};

// The stage bundle, named by the committed numbers.json (as numbers.test.ts reads it).
const numbersText = read("public/derived/numbers.json");
const stageBundlePath = (() => {
  const days = new Set(
    [
      ...numbersText.matchAll(
        /public\/data\/bundle_(\d{4}-\d{2}-\d{2})\.json/g,
      ),
    ].map((m) => m[1]),
  );
  expect(days.size).toBe(1);
  return `public/data/bundle_${[...days][0]}.json`;
})();
const bundle = JSON.parse(read(stageBundlePath)) as Bundle;
const committed = (key: string) =>
  (JSON.parse(numbersText) as { key: string; value: number }[]).find(
    (x) => x.key === key,
  )!.value;
const snap = snapshotPrices();

const curveWith = (response: PriceResponse): ScaleCurve =>
  scaleCurve({
    bundle,
    bundle_path: stageBundlePath,
    snapshot: snap,
    snapshot_path: "research/data/pace_snapshot_2026-10-27.csv",
    response,
    generated_utc: "2026-10-28T08:00:00Z",
  });
const point = (c: ScaleCurve, id: string, mw: number) =>
  c.series.find((s) => s.id === id)!.points.find((p) => p.fleet_mw === mw)!;
const cents = (x: number) => x.toFixed(2);

describe("the DP with a price-response term", () => {
  it("moves each step's price by impact x that step's injection", () => {
    // 2 units of storage, lossless. Charge 2 at $10, discharge 2 at $50: $80 as a price taker.
    const base = {
      price: [10, 10, 50, 50],
      levels: 2,
      dz: 1,
      eta: 1,
      charge_max: [1, 1, 1, 1],
      discharge_max: [1, 1, 1, 1],
      W: 0,
      soc_min: 0,
      start_level: 0,
      end_level: 0,
      to_mwh: 1,
    };
    expect(solveDp(base).objective).toBe(80);
    // impact 10: charging at -1 pays $20 a step, discharging at +1 earns $40 a step
    const r = solveDp({ ...base, impact: [10, 10, 10, 10] });
    expect(r.acts).toEqual([-1, -1, 1, 1]);
    expect(r.objective).toBe(40);
    expect(r.gross).toBe(40);
  });

  it("stays exact: the solved value equals the plan priced at the moved prices", () => {
    const s = prepareSlopes(fixture()).map((h) => h.used);
    for (const mw of SCALE_FLEET_MW) {
      const r = dpAtFleet(snap, s, mw, 10);
      const discharged = r.acts.filter((g) => g > 0).reduce((a, g) => a + g, 0);
      expect(r.objective).toBeCloseTo(r.gross - 10 * discharged, 9);
    }
  });
});

describe("flag off: slope 0 is the price taker", () => {
  it("dpHourly with a zero impact is identical to the price-taker DP", () => {
    const zero = snap.map(() => 0);
    for (const o of [
      { W: 0 },
      { W: 10 },
      { W: 15 },
      { W: 10, soc_min: 0.1, dis_cap: 0.75 },
    ])
      expect(dpHourly(snap, { ...o, impact: zero })).toEqual(dpHourly(snap, o));
  });

  it("reproduces the fix.py DP pins", () => {
    const z = snap.map(() => 0);
    expect(dpAtFleet(snap, z, 500, 0).objective).toBeCloseTo(65.791609, 6);
    const w10 = dpAtFleet(snap, z, 500, 10);
    expect(w10.gross).toBeCloseTo(57.537074, 6);
    expect(w10.objective).toBeCloseTo(38.775411, 6);
  });

  it("reproduces fixed_70, clearlane_70, fixed_500 and clearlane_500 to the cent", () => {
    const c = curveWith(zeroSlopes());
    const pins: [string, number, string][] = [
      ["fixed_overnight", 70, "1404.53"],
      ["clearlane", 70, "4088.37"],
      ["fixed_overnight", 500, "10032.37"],
      ["clearlane", 500, "29202.67"],
    ];
    for (const [id, mw, pin] of pins) {
      const p = point(c, id, mw);
      expect(cents(p.usd_per_day)).toBe(pin);
      expect(p.usd_per_day).toBe(p.price_taker_usd_per_day);
      expect(p.pct_of_price_taker).toBe(100);
    }
    expect(cents(point(c, "fixed_overnight", 70).usd_per_day)).toBe(
      cents(committed("fixed_70")),
    );
    expect(cents(point(c, "clearlane", 70).usd_per_day)).toBe(
      cents(committed("clearlane_70")),
    );
    expect(cents(point(c, "fixed_overnight", 500).usd_per_day)).toBe(
      cents(committed("fixed_500")),
    );
    expect(cents(point(c, "clearlane", 500).usd_per_day)).toBe(
      cents(committed("clearlane_500")),
    );
    for (const mw of SCALE_FLEET_MW) {
      expect(point(c, "dp_price_only", mw).usd_per_mw_day).toBeCloseTo(
        committed("price_only_usd_mw_day"),
        9,
      );
      expect(point(c, "dp_wear10", mw).usd_per_mw_day).toBeCloseTo(
        committed("wear10_usd_mw_day"),
        9,
      );
    }
  });

  it("no core module imports the price-impact code", () => {
    const files = (dir: string): string[] =>
      readdirSync(dir).flatMap((f) => {
        const p = join(dir, f);
        return statSync(p).isDirectory() ? files(p) : [p];
      });
    const hits = [
      ...files(repoPath("engine/src")),
      ...files(repoPath("engine/cli")),
    ].filter(
      (f) =>
        !/[\\/]scale\.ts$/.test(f) &&
        /from ["'][^"']*\/scale["']/.test(readFileSync(f, "utf8")),
    );
    expect(hits).toEqual([]);
  });
});

describe("slopes from the response table", () => {
  it("clamps negative slopes to zero and flags them", () => {
    const h = prepareSlopes(fixture());
    expect(h).toHaveLength(24);
    expect(h[4]).toMatchObject({
      slope: -0.002,
      used: 0,
      used_lo: 0,
      clamped: true,
    });
    expect(h.filter((x) => x.clamped).map((x) => x.hb)).toEqual([4]);
    expect(
      h.every((x) => x.used >= 0 && x.used_lo >= 0 && x.used_hi >= 0),
    ).toBe(true);
  });

  it("marks hours whose interval spans zero inconclusive", () => {
    const h = prepareSlopes(fixture());
    expect(h.filter((x) => x.inconclusive).map((x) => x.hb)).toEqual([4, 19]);
    expect(h[19]).toMatchObject({
      used: 0.006,
      clamped: false,
      inconclusive: true,
    });
  });

  it.each([
    ["23 bins", (r: any) => r.price_response.bins.pop(), /24/],
    [
      "a repeated hour",
      (r: any) => (r.price_response.bins[1].hour_mt = 0),
      /hour/,
    ],
    [
      "a NaN slope",
      (r: any) => (r.price_response.bins[3].slope = "x"),
      /slope/,
    ],
    [
      "an interval that misses the slope",
      (r: any) => (r.price_response.bins[5].ci_hi = 0.001),
      /interval/,
    ],
    [
      "an unknown unit",
      (r: any) => (r.price_response.unit = "$/MWh per kW"),
      /unit/,
    ],
    [
      "no price_response table",
      (r: any) => delete r.price_response,
      /price_response/,
    ],
  ])("rejects %s", (_, mutate, re) => {
    const raw = fixtureRaw();
    mutate(raw);
    expect(() => readPriceResponse(raw, FIXTURE)).toThrow(re);
  });
});

describe("value per MW at fleet scale", () => {
  const s = prepareSlopes(fixture());
  const used = s.map((h) => h.used);
  const race = referenceRace(bundle);
  const fleets = Array.from({ length: 101 }, (_, i) => i * 10);

  it("a fixed schedule loses fleet MW x sum of slope x injection squared", () => {
    const cg = REF_E_MWH / REF_RTE ** 0.5;
    const dg = REF_E_MWH * REF_RTE ** 0.5;
    const flat = used.map(() => 0.01);
    const loss = 0.01 * (4 * (cg / 4) ** 2 + 2 * (dg / 2) ** 2);
    expect(legAtFleet(race.fixed, flat, 100)).toBeCloseTo(
      race.fixed.usd_per_mw_day - 100 * loss,
      9,
    );
  });

  it.each([
    ["fixed_overnight", (mw: number) => legAtFleet(race.fixed, used, mw)],
    ["clearlane", (mw: number) => legAtFleet(race.timetable, used, mw)],
    ["dp_price_only", (mw: number) => dpAtFleet(snap, used, mw, 0).gross],
    ["dp_wear10", (mw: number) => dpAtFleet(snap, used, mw, 10).gross],
  ])("%s never rises with fleet size, 0 to 1,000 MW", (_, value) => {
    const v = fleets.map(value);
    for (let i = 1; i < v.length; i++)
      expect(v[i]!).toBeLessThanOrEqual(v[i - 1]! + 1e-9);
    expect(v.at(-1)!).toBeLessThan(v[0]!);
  });

  it("every curve point sits inside its band and below the price taker", () => {
    const c = curveWith(fixture());
    expect(c.series.map((x) => x.id)).toEqual([
      "fixed_overnight",
      "clearlane",
      "dp_price_only",
      "dp_wear10",
    ]);
    for (const x of c.series) {
      expect(x.points.map((p) => p.fleet_mw)).toEqual(SCALE_FLEET_MW);
      for (const p of x.points) {
        expect(p.band_low_usd_per_mw_day).toBeLessThanOrEqual(
          p.usd_per_mw_day + 1e-9,
        );
        expect(p.usd_per_mw_day).toBeLessThanOrEqual(
          p.band_high_usd_per_mw_day + 1e-9,
        );
        expect(p.usd_per_mw_day).toBeLessThan(x.price_taker_usd_per_mw_day);
        expect(p.usd_per_day).toBeCloseTo(p.usd_per_mw_day * p.fleet_mw, 6);
      }
      const v = x.points.map((p) => p.usd_per_mw_day);
      for (let i = 1; i < v.length; i++)
        expect(v[i]!).toBeLessThanOrEqual(v[i - 1]!);
    }
  });

  it("labels 500 MW as the MOU ceiling and carries the slopes' provenance", () => {
    const c = curveWith(fixture());
    expect(c.fleet_mw).toEqual([70, 140, 250, 500]);
    const l500 = c.fleet.find((f) => f.mw === 500)!.label;
    expect(l500).toMatch(/MOU ceiling/);
    expect(l500).toMatch(/not installed capacity/);
    expect(c.prov).toBe("SIMULATED");
    expect(c.slopes.prov).toBe("SIMULATED");
    expect(c.slopes.clamped_hb).toEqual([4]);
    expect(c.slopes.inconclusive_hb).toEqual([4, 19]);
    expect(c.caveat).toMatch(/does not move prices/);
    const traded = c.series.find((x) => x.id === "fixed_overnight")!;
    expect(traded.inconclusive_traded_hb).toEqual([4, 19]);
    expect(JSON.stringify(c)).not.toContain(String.fromCharCode(0x2014));
  });
});

describe("engine/cli/scale.ts", () => {
  const derivedHashes = () => {
    const dir = repoPath("public/derived");
    return Object.fromEntries(
      readdirSync(dir)
        .sort()
        .map((f) => [
          f,
          createHash("sha256")
            .update(readFileSync(join(dir, f)))
            .digest("hex"),
        ]),
    );
  };
  const run = (out: string) =>
    execFileSync(
      process.execPath,
      [
        "--import",
        "tsx",
        repoPath("engine/cli/scale.ts"),
        "--response",
        FIXTURE,
        "--out",
        out,
        "--now",
        "2026-10-28T08:00:00Z",
      ],
      { cwd: repoPath("."), encoding: "utf8" },
    );

  it("writes only its own file, deterministically, and leaves every core output byte-identical", () => {
    const before = derivedHashes();
    const dir = mkdtempSync(join(tmpdir(), "scale-"));
    const a = join(dir, "a.json");
    const b = join(dir, "b.json");
    run(a);
    run(b);
    expect(derivedHashes()).toEqual(before);
    expect(readFileSync(a, "utf8")).toBe(readFileSync(b, "utf8"));
    const c = JSON.parse(readFileSync(a, "utf8")) as ScaleCurve;
    expect(c.schema).toBe("clearlane.scale_curve/v1");
    expect(c.flag).toBe("ff_price_impact");
    expect(c.sources.bundle).toBe(stageBundlePath);
    expect(c.sources.response).toBe(FIXTURE);
    expect(readFileSync(a, "utf8").endsWith("}\n")).toBe(true);
  });
});
