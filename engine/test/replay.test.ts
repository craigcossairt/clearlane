// Moonshot rt-replay (#72, ff_rt_replay): day-ahead plans settled against real-time prices.
// The fixture days are SIMULATED (engine/test/fixtures/rt_replay.*.fixture.json); the RT-equals-DA
// and seeded-noise checks run on the REAL day-ahead history with synthetic RT.
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { HistDay } from "@contracts/types";
import { histBundle } from "@engine/backtest";
import { isoUtc } from "@engine/bundle";
import { dayStartMs } from "@engine/events";
import { stableJson } from "@engine/json";
import { solve } from "@engine/policies";
import { mulberry32 } from "@engine/rng";
import { defaultSite } from "@engine/site";
import {
  EVENING_HB,
  MIDDAY_HB,
  REPLAY_POLICIES,
  buildReplay,
  replanForecast,
  replayDay,
  settle,
  validateReplay,
} from "@engine/replay";
import type { RtDay, RtHistory, RtReplay } from "@engine/replay";
import { wearUsdMwh } from "../cli/common";
import { repoPath } from "./helpers/fixture";

const read = (p: string) => readFileSync(repoPath(p), "utf8");
const RT_FIX = "engine/test/fixtures/rt_replay.rt.fixture.json";
const DA_FIX = "engine/test/fixtures/rt_replay.hist.fixture.json";
const HIST = "public/data/hist_2026-05-01_2026-10-27.json";
const rtFix = JSON.parse(read(RT_FIX)) as RtHistory;
const daFix = JSON.parse(read(DA_FIX)) as HistDay[];
const site = defaultSite();
const W = wearUsdMwh(repoPath("public/derived/backtest.json"));
const opts = { wear_usd_mwh: W, rt_path: RT_FIX, da_path: DA_FIX };

const daOf = (day: string) => daFix.find((d) => d.operating_day_mt === day)!;
const rtOf = (day: string) =>
  rtFix.days.find((d) => d.operating_day_mt === day)!;
const cents = (x: number) => x.toFixed(2);

// An RT day built from a DA day: each hourly price held for four intervals, then `f` applied.
function rtFrom(
  d: HistDay,
  f: (p: number, i: number) => number = (p) => p,
): RtDay {
  const start = dayStartMs(d.operating_day_mt);
  return {
    operating_day_mt: d.operating_day_mt,
    ts_utc: Array.from({ length: 96 }, (_, i) => isoUtc(start + i * 900_000)),
    lmp_usd_mwh: d.lmp_usd_mwh.flatMap((p) => [p, p, p, p]).map(f),
  };
}

describe("settlement (EDAM structure UNVERIFIED)", () => {
  it("is DA price x DA schedule plus RT price x (actual minus DA schedule)", () => {
    // DA: export 1 MWh at $10, charge 0.5 MWh at $20. Actual: export only 0.5 MWh in interval 0.
    // 10 x 1 + 20 x -0.5 + 30 x (0.5 - 1) + 5 x 0 = -15
    expect(settle([10, 20], [30, 5], [1000, -500], [500, -500])).toBeCloseTo(
      -15,
      12,
    );
  });

  it("holding the DA schedule settles at DA prices, whatever RT does", () => {
    const g = [250, -300, 0, 125];
    expect(settle([40, 20, 30, 60], [400, -20, 0, 1], g, g)).toBeCloseTo(
      (40 * 250 - 20 * 300 + 60 * 125) / 1000,
      12,
    );
  });
});

describe("re-plan forecast", () => {
  const da = Array.from({ length: 96 }, (_, i) => 20 + (i % 7));
  it("is the DA prices at the start of the day", () =>
    expect(
      replanForecast(
        da,
        da.map((p) => p + 50),
        0,
      ),
    ).toEqual(da));

  it("carries the last hour's mean RT minus DA gap over the next hour only", () => {
    const rt = da.map((p, i) =>
      i >= 36 && i < 40 ? p + [8, 4, 0, 12][i - 36]! : p,
    );
    const fc = replanForecast(da, rt, 40);
    expect(fc).toHaveLength(56);
    expect(fc.slice(0, 4)).toEqual(da.slice(40, 44).map((p) => p + 6));
    expect(fc.slice(4)).toEqual(da.slice(44));
  });

  it("is exactly the DA prices when RT equals DA", () =>
    expect(replanForecast(da, [...da], 52)).toEqual(da.slice(52)));
});

describe("replayDay on the SIMULATED fixture", () => {
  const days = ["2026-06-01", "2026-06-02", "2026-06-03"];
  const runs = days.map((d) =>
    replayDay(daOf(d), rtOf(d), site, { wear_usd_mwh: W }),
  );

  it("the hold leg is the core clearlane plan at DA prices, settled at its DA value", () => {
    for (const d of days) {
      const plan = solve(histBundle(daOf(d)), site, "clearlane", {
        wear_usd_mwh: W,
        sch_mode: "price_proxy",
      });
      const r = replayDay(daOf(d), rtOf(d), site, { wear_usd_mwh: W });
      expect(r.pulse_kw.hold).toEqual(plan.intervals.map((iv) => iv.pulse_kw));
      expect(r.legs.hold.settled_usd).toBeCloseTo(plan.value_usd, 9);
      expect(r.legs.hold.deviation_mwh).toBe(0);
    }
  });

  it("RT equal to DA (2026-06-01): hold, re-plan and foresight equal to the cent", () => {
    const r = runs[0]!;
    for (const p of REPLAY_POLICIES) {
      expect(cents(r.legs[p].settled_usd)).toBe(cents(r.legs.hold.settled_usd));
      expect(cents(r.legs[p].net_usd)).toBe(cents(r.legs.hold.net_usd));
      expect(r.pulse_kw[p]).toEqual(r.pulse_kw.hold);
    }
    expect(cents(r.regret_usd.hold)).toBe("0.00");
    expect(cents(r.regret_usd.replan)).toBe("0.00");
  });

  it("perfect foresight is never below hold or re-plan on any day, net of wear", () => {
    for (const r of runs) {
      expect(r.legs.foresight.net_usd).toBeGreaterThanOrEqual(
        r.legs.hold.net_usd - 1e-9,
      );
      expect(r.legs.foresight.net_usd).toBeGreaterThanOrEqual(
        r.legs.replan.net_usd - 1e-9,
      );
      expect(r.regret_usd.hold).toBeCloseTo(
        r.legs.foresight.net_usd - r.legs.hold.net_usd,
        9,
      );
      expect(r.regret_usd.replan).toBeCloseTo(
        r.legs.foresight.net_usd - r.legs.replan.net_usd,
        9,
      );
    }
  });

  it("the RT days move value: foresight beats hold on the days RT left DA", () => {
    expect(runs[1]!.regret_usd.hold).toBeGreaterThan(0.01);
    expect(runs[2]!.regret_usd.hold).toBeGreaterThan(0.01);
  });

  it("the hourly re-plan acts on observed RT: it leaves the DA schedule on some day", () =>
    expect(runs.some((r) => r.legs.replan.deviation_mwh > 0)).toBe(true));

  it("checkPlan is empty for all 24 hourly re-plans and the three executed plans", () => {
    for (const r of runs) {
      expect(r.plans_checked).toBe(24 + REPLAY_POLICIES.length);
      expect(r.violations).toEqual([]);
    }
  });

  it("a violation is reported, not swallowed (a ceiling under the site's own host load)", () => {
    const low = {
      ...site,
      host_ceiling_kw: Math.min(...site.host_load_kw_15m) - 1,
    };
    const r = replayDay(daOf("2026-06-01"), rtOf("2026-06-01"), low, {
      wear_usd_mwh: W,
    });
    expect(r.violations.length).toBeGreaterThan(0);
    expect(r.violations.join("\n")).toMatch(/host ceiling/);
  });

  it("flags RT evening under RT midday on 2026-06-02 only, on the FACTS windows", () => {
    expect(MIDDAY_HB).toEqual([9, 10, 11, 12, 13, 14, 15, 16]);
    expect(EVENING_HB).toEqual([18, 19, 20, 21]);
    expect(runs.map((r) => r.rt_evening_below_midday)).toEqual([
      false,
      true,
      false,
    ]);
    expect(runs[1]!.rt_evening_usd_mwh).toBeLessThan(
      runs[1]!.rt_midday_usd_mwh,
    );
    expect(runs[1]!.da_evening_usd_mwh).toBeGreaterThan(
      runs[1]!.da_midday_usd_mwh,
    );
  });

  it("MEASURED re-plan times: one per hour, each a performance.now() difference", () => {
    for (const r of runs) {
      expect(r.replan_ms).toHaveLength(24);
      for (const ms of r.replan_ms) {
        expect(Number.isFinite(ms)).toBe(true);
        expect(ms).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

describe("buildReplay on the SIMULATED fixture", () => {
  const run = buildReplay(daFix, rtFix, site, opts);
  const out = run.result;

  it("replays the three usable days and lists the others, never filled", () => {
    expect(out.days.map((d) => d.operating_day_mt)).toEqual([
      "2026-06-01",
      "2026-06-02",
      "2026-06-03",
    ]);
    expect(out.window).toEqual({
      start_mt: "2026-06-01",
      end_mt: "2026-06-05",
      days: 3,
      skipped_days: [
        {
          day: "2026-06-04",
          reason: "1 RT interval missing (null); never filled",
        },
        { day: "2026-06-05", reason: "no usable DA day in the history file" },
      ],
    });
  });

  it("counts the days whose RT evening fell below RT midday", () => {
    expect(out.summary.rt_evening_below_midday_days).toBe(1);
    expect(out.summary.da_evening_below_midday_days).toBe(0);
  });

  it("rows are per MW-day and regret is foresight minus the policy, net of wear", () => {
    const mw = site.station.pulse_kw / 1000;
    const d2 = replayDay(daOf("2026-06-02"), rtOf("2026-06-02"), site, {
      wear_usd_mwh: W,
    });
    const row = out.days[1]!;
    expect(row.net_usd_per_mw_day.hold).toBe(d2.legs.hold.net_usd / mw);
    expect(row.regret_usd_per_mw_day.hold).toBe(d2.regret_usd.hold / mw);
    expect(row.settled_usd_per_mw_day.foresight).toBe(
      d2.legs.foresight.settled_usd / mw,
    );
  });

  it("labels the EDAM settlement structure UNVERIFIED and names the guardrail", () => {
    expect(out.settlement.status).toBe("UNVERIFIED");
    expect(out.settlement.note).toMatch(/UNVERIFIED/);
    expect(out.settlement.note).toMatch(/not Torus revenue/);
    expect(out.prov.rt_prices).toBe("SIMULATED");
    expect(out.flag).toBe("ff_rt_replay");
  });

  it("stores no MEASURED time; the run returns them for the CLI to print", () => {
    expect(stableJson(out)).not.toMatch(/_ms"/);
    expect(out.measured).toMatchObject({
      prov: "MEASURED",
      stored: false,
      replans: 72,
    });
    expect(run.replan_ms).toHaveLength(72);
  });

  it("is deterministic, validates, and has no em or en dash", () => {
    const again = buildReplay(daFix, rtFix, site, opts).result;
    expect(stableJson(again)).toBe(stableJson(out));
    expect(validateReplay(out)).toEqual([]);
    expect(run.violations).toEqual([]);
    for (const c of [0x2013, 0x2014])
      expect(stableJson(out)).not.toContain(String.fromCharCode(c));
  });
});

describe("validateReplay rejects", () => {
  const good = buildReplay(daFix, rtFix, site, opts).result;
  const bad = (f: (x: RtReplay) => unknown) =>
    validateReplay(f(JSON.parse(JSON.stringify(good)) as RtReplay)).join("\n");

  it.each<[string, (x: RtReplay) => unknown, RegExp]>([
    ["a wrong schema", (x) => ({ ...x, schema: "x" }), /schema/],
    [
      "foresight below hold",
      (x) => {
        x.days[1]!.net_usd_per_mw_day.foresight =
          x.days[1]!.net_usd_per_mw_day.hold - 1;
        return x;
      },
      /foresight below/,
    ],
    [
      "an unsorted day list",
      (x) => ({ ...x, days: [...x.days].reverse() }),
      /sorted/,
    ],
    [
      "a stored time",
      (x) => ({ ...x, measured: { ...x.measured, replan_ms: 3.1 } }),
      /MEASURED/,
    ],
    [
      "an em dash",
      (x) => ({
        ...x,
        settlement: {
          ...x.settlement,
          note: `a ${String.fromCharCode(0x2014)} b`,
        },
      }),
      /dash/,
    ],
    [
      "a settlement not labeled UNVERIFIED",
      (x) => ({ ...x, settlement: { ...x.settlement, status: "VERIFIED" } }),
      /UNVERIFIED/,
    ],
    [
      "a wrong day count",
      (x) => ({ ...x, summary: { ...x.summary, days: 9 } }),
      /days/,
    ],
    ["not an object", () => null, /object/],
  ])("%s", (_, f, re) => expect(bad(f)).toMatch(re));
});

describe("on the REAL day-ahead history with synthetic RT", () => {
  const hist = JSON.parse(read(HIST)) as HistDay[];
  const sample = hist.filter((_, k) => k % 9 === 0);

  it("RT equal to DA: the three policies equal to the cent on every sampled day", () => {
    expect(sample.length).toBeGreaterThanOrEqual(19);
    for (const d of sample) {
      const r = replayDay(d, rtFrom(d), site, { wear_usd_mwh: W });
      expect([
        cents(r.legs.replan.net_usd),
        cents(r.legs.foresight.net_usd),
      ]).toEqual([cents(r.legs.hold.net_usd), cents(r.legs.hold.net_usd)]);
      expect(cents(r.legs.foresight.settled_usd)).toBe(
        cents(r.legs.hold.settled_usd),
      );
      expect(r.violations).toEqual([]);
    }
  });

  it("seeded RT noise and spikes: foresight never below, and every re-plan passes checkPlan", () => {
    const rng = mulberry32(72);
    for (const d of sample.slice(0, 12)) {
      const rt = rtFrom(d, (p) => {
        const spike = rng() < 0.03 ? 150 * rng() : 0;
        return Math.round((p * (0.6 + 0.8 * rng()) + spike - 5) * 100) / 100;
      });
      const r = replayDay(d, rt, site, { wear_usd_mwh: W });
      expect(r.violations).toEqual([]);
      expect(r.regret_usd.hold).toBeGreaterThanOrEqual(-1e-9);
      expect(r.regret_usd.replan).toBeGreaterThanOrEqual(-1e-9);
    }
  });
});

describe("engine/cli/replay.ts", () => {
  const cli = (args: string[]) =>
    execFileSync(
      process.execPath,
      ["--import", "tsx", repoPath("engine/cli/replay.ts"), ...args],
      {
        cwd: repoPath("."),
        encoding: "utf8",
      },
    );

  it("writes the same file as buildReplay and prints the MEASURED re-plan times", () => {
    const out = join(mkdtempSync(join(tmpdir(), "rtr-")), "rt_replay.json");
    const stdout = cli(["--rt", RT_FIX, "--hist", DA_FIX, "--out", out]);
    expect(readFileSync(out, "utf8")).toBe(
      stableJson(buildReplay(daFix, rtFix, site, opts).result),
    );
    expect(stdout).toMatch(
      /MEASURED \(not stored\): 72 hourly re-plans, median [\d.]+ ms/,
    );
    expect(stdout).toMatch(/UNVERIFIED/);
  });

  it("exits 2 naming a missing input", () => {
    expect(() =>
      cli(["--rt", "public/data/rt_none.json", "--hist", DA_FIX]),
    ).toThrow(/input not found: public\/data\/rt_none.json/);
  });
});

const COMMITTED = "public/derived/rt_replay.json";
describe.skipIf(!existsSync(repoPath(COMMITTED)))(
  "committed public/derived/rt_replay.json",
  () => {
    // read inside each test: a skipped describe still runs this body
    const load = () => JSON.parse(read(COMMITTED)) as RtReplay;

    it("validates and names inputs that exist", () => {
      const committed = load();
      expect(validateReplay(committed)).toEqual([]);
      expect(existsSync(repoPath(committed.inputs.rt))).toBe(true);
      expect(existsSync(repoPath(committed.inputs.da))).toBe(true);
    });

    it("three sampled days equal a fresh replay of the same inputs", () => {
      const committed = load();
      const rt = JSON.parse(read(committed.inputs.rt)) as RtHistory;
      const hist = JSON.parse(read(committed.inputs.da)) as HistDay[];
      const n = committed.days.length;
      for (const row of [
        committed.days[0]!,
        committed.days[n >> 1]!,
        committed.days[n - 1]!,
      ]) {
        const day = row.operating_day_mt;
        const one = buildReplay(
          hist.filter((d) => d.operating_day_mt === day),
          { ...rt, days: rt.days.filter((d) => d.operating_day_mt === day) },
          site,
          {
            wear_usd_mwh: committed.wear_usd_mwh,
            rt_path: committed.inputs.rt,
            da_path: committed.inputs.da,
          },
        );
        expect(stableJson(one.result.days[0])).toBe(stableJson(row));
      }
    });
  },
);
