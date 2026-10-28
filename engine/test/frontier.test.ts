import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  statSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FLAGS } from "@contracts/flags";
import type { BacktestResult, HistDay, TorusPublished } from "@contracts/types";
import { runBacktest } from "@engine/backtest";
import { hold4 } from "@engine/limits";
import { weekdayIndex } from "@engine/events";
import {
  ARCHETYPES,
  BLOCK_HOURS_MT,
  START_SOC_KWH,
  blockMask,
  buildFrontier,
  dayScales,
  hostDay,
  minCeiling,
  peakShavingMonth,
  planDay,
  runMonth,
} from "@engine/frontier";
import type { HostFrontier } from "@engine/frontier";
import { stableJson } from "@engine/json";
import { defaultSite } from "@engine/site";
import { repoPath } from "./helpers/fixture";

const read = (p: string) => readFileSync(repoPath(p), "utf8");
const HIST = "public/data/hist_2026-05-01_2026-10-27.json";
const hist = JSON.parse(read(HIST)) as HistDay[];
const site = defaultSite();
const SEED = 20261027;
const OCT = { start_mt: "2026-10-01", end_mt: "2026-10-27" };
const octDays = hist.filter(
  (d) => d.operating_day_mt >= OCT.start_mt && d.operating_day_mt <= OCT.end_mt,
);
const TOL = 1e-6;

let built: HostFrontier | undefined;
const frontier = () =>
  (built ??= buildFrontier(hist, site, {
    seed: SEED,
    ...OCT,
    hist_path: HIST,
  }));

describe("SIMULATED host archetypes", () => {
  it("three archetypes, each SIMULATED; the machining shop is the stage host", () => {
    expect(ARCHETYPES.map((a) => a.key)).toEqual([
      "machining_shop",
      "school",
      "grocery_refrigeration",
    ]);
    for (const a of ARCHETYPES) {
      expect(a.prov).toBe("SIMULATED");
      expect(a.label).toMatch(/SIMULATED/);
      expect(a.shape_kw_15m).toHaveLength(96);
    }
    expect(ARCHETYPES[0]!.shape_kw_15m).toEqual(site.host_load_kw_15m);
    // the stage host itself is untouched
    expect(defaultSite()).toEqual(site);
  });

  it("day scales are seeded, and every weekend sits below every weekday", () => {
    const days = octDays.map((d) => d.operating_day_mt);
    ARCHETYPES.forEach((a, i) => {
      const s = dayScales(days, a, i, SEED);
      expect(s).toEqual(dayScales(days, a, i, SEED));
      expect(s).not.toEqual(dayScales(days, a, i, SEED + 1));
      const wkend = s.filter((_, k) => weekdayIndex(days[k]!) >= 5);
      const wkday = s.filter((_, k) => weekdayIndex(days[k]!) < 5);
      expect(wkend.length).toBeGreaterThan(0);
      expect(Math.max(...wkend)).toBeLessThan(Math.min(...wkday));
    });
  });

  it("hostDay scales the whole shape", () => {
    const a = ARCHETYPES[1]!;
    expect(hostDay(a, 0.5)).toEqual(a.shape_kw_15m.map((kw) => kw * 0.5));
  });
});

describe("one day's plan", () => {
  const d = octDays.find((x) => x.operating_day_mt === "2026-10-15")!;
  const prices = hold4(d.lmp_usd_mwh);
  const mask = blockMask();

  it("the block is HB 6pm to 9pm", () => {
    expect(BLOCK_HOURS_MT).toEqual([18, 19, 20, 21]);
    expect(mask.filter(Boolean)).toHaveLength(16);
    expect(mask[72]).toBe(true);
    expect(mask[87]).toBe(true);
    expect(mask[88]).toBe(false);
  });

  for (const a of ARCHETYPES)
    it(`${a.key}: holds the ceiling, the block, the SoC bounds and the export limit`, () => {
      const host = hostDay(a, 1);
      for (const block of [0, 50, 100]) {
        const c = minCeiling(prices, host, site, block, mask)!;
        expect(c).not.toBeNull();
        const p = planDay(prices, host, site, c, block, mask);
        expect(p.feasible).toBe(true);
        const E = site.station.pulse_kwh;
        for (let t = 0; t < 96; t++) {
          expect(p.meter_kw[t]!).toBeLessThanOrEqual(c + TOL);
          expect(p.discharge_kw[t]!).toBeLessThanOrEqual(host[t]! + TOL);
          expect(p.discharge_kw[t]!).toBeLessThanOrEqual(
            site.station.pulse_kw + TOL,
          );
          expect(p.charge_kw[t]!).toBeLessThanOrEqual(
            site.station.pulse_kw + TOL,
          );
          expect(p.charge_kw[t]! * p.discharge_kw[t]!).toBe(0);
          if (mask[t])
            expect(p.discharge_kw[t]!).toBeGreaterThanOrEqual(block - TOL);
        }
        for (const s of p.soc_kwh) {
          expect(s).toBeGreaterThanOrEqual(-TOL);
          expect(s).toBeLessThanOrEqual(E + TOL);
        }
        expect(p.soc_kwh[0]).toBe(START_SOC_KWH);
        expect(p.soc_kwh[96]!).toBeGreaterThanOrEqual(START_SOC_KWH - TOL);
        // minimal: a hair lower is not feasible
        expect(
          planDay(prices, host, site, c - 0.01, block, mask).feasible,
        ).toBe(false);
      }
    });

  it("a block Pulse cannot hold for 4 hours is not deliverable at any ceiling", () => {
    const host = hostDay(ARCHETYPES[0]!, 1);
    expect(minCeiling(prices, host, site, 250, mask)).toBeNull();
  });
});

describe("the month-to-date billing simulation", () => {
  const a = ARCHETYPES[0]!;
  const days = octDays.map((d) => d.operating_day_mt);
  const hosts = dayScales(days, a, 0, SEED).map((s) => hostDay(a, s));

  it("with the ratchet, each day's ceiling is at least the month-to-date peak before it", () => {
    const m = runMonth(octDays, hosts, site, 50, { ratchet: true });
    expect(m.deliverable).toBe(true);
    let mtd = 0;
    for (const r of m.days) {
      expect(r.ceiling_kw).toBeGreaterThanOrEqual(mtd - TOL);
      expect(r.meter_peak_kw).toBeLessThanOrEqual(r.ceiling_kw + TOL);
      mtd = Math.max(mtd, r.meter_peak_kw);
      expect(r.mtd_peak_kw).toBe(mtd);
    }
    expect(m.monthly_peak_kw).toBe(mtd);
  }, 60_000);

  // the first frontier() call pays for the whole build
  it("block 0 reproduces the peak-shaving-only plan", () => {
    const shave = peakShavingMonth(octDays, hosts, site);
    expect(
      stableJson(runMonth(octDays, hosts, site, 0, { ratchet: true })),
    ).toBe(stableJson(shave));
    const f = frontier().archetypes[0]!;
    expect(f.steps[0]!.block_kw).toBe(0);
    expect(f.steps[0]!.monthly_peak_kw).toBe(shave.monthly_peak_kw);
    expect(f.steps[0]!.grid_value_usd_per_mw_day).toBe(
      shave.grid_value_usd_per_mw_day,
    );
    expect(f.peak_shaving_only.monthly_peak_kw).toBe(shave.monthly_peak_kw);
    // storage shaves: the month's peak with storage is below the host's own
    expect(shave.monthly_peak_kw).toBeLessThan(f.host_peak_without_storage_kw);
  }, 120_000);
});

describe("the frontier (Oct 1 to 27)", () => {
  it("sweeps the block from 0 to pulse_kw in 10 steps; steps Pulse cannot hold say why", () => {
    for (const a of frontier().archetypes) {
      expect(a.steps.map((s) => s.block_kw)).toEqual([
        0, 25, 50, 75, 100, 125, 150, 175, 200, 225, 250,
      ]);
      const ok = a.steps.map((s) => s.deliverable);
      expect(ok[0]).toBe(true);
      // deliverable steps come first, then only not-deliverable ones
      expect(
        ok.indexOf(false) === -1 ||
          ok.slice(ok.indexOf(false)).every((x) => !x),
      ).toBe(true);
      for (const s of a.steps)
        if (!s.deliverable) {
          expect(s.not_deliverable_reason).toMatch(/energy|export/);
          expect(s.monthly_peak_kw).toBeNull();
          expect(s.grid_value_usd_per_mw_day).toBeNull();
        }
    }
  }, 60_000);

  it("grid value is non-decreasing in block size", () => {
    for (const a of frontier().archetypes) {
      const v = a.steps
        .filter((s) => s.deliverable)
        .map((s) => s.grid_value_usd_per_mw_day!);
      for (let i = 1; i < v.length; i++)
        expect(v[i]!).toBeGreaterThanOrEqual(v[i - 1]! - 1e-9);
    }
  }, 60_000);

  it("the break point is the largest block with zero increase in the monthly peak", () => {
    for (const a of frontier().archetypes) {
      const base = a.steps[0]!.monthly_peak_kw!;
      let bp = 0;
      for (const s of a.steps) {
        if (!s.deliverable || s.monthly_peak_kw! > base + TOL) break;
        bp = s.block_kw;
      }
      expect(a.break_point_kw).toBe(bp);
      for (const s of a.steps)
        if (s.deliverable)
          expect(s.peak_increase_kw).toBe(s.monthly_peak_kw! - base);
    }
  }, 60_000);

  it("a mutation that ignores the ratchet moves the break point", () => {
    const off = buildFrontier(hist, site, {
      seed: SEED,
      ...OCT,
      hist_path: HIST,
      ratchet: false,
    });
    const on = frontier();
    const moved = on.archetypes.filter(
      (a, i) => a.break_point_kw !== off.archetypes[i]!.break_point_kw,
    );
    expect(moved.length).toBeGreaterThan(0);
    // the published value is the ratchet's, so ignoring the ratchet fails the pin below
    on.archetypes.forEach((a, i) =>
      expect(a.break_point_without_ratchet_kw).toBe(
        off.archetypes[i]!.break_point_kw,
      ),
    );
  }, 120_000);

  it("same seed, same bytes", () => {
    expect(
      stableJson(
        buildFrontier(hist, site, { seed: SEED, ...OCT, hist_path: HIST }),
      ),
    ).toBe(stableJson(frontier()));
  }, 120_000);
});

const FILE = "public/derived/host_frontier.json";
describe.skipIf(!existsSync(repoPath(FILE)))(
  "public/derived/host_frontier.json",
  () => {
    it("equals a fresh build: the break points are pinned", () => {
      expect(read(FILE)).toBe(stableJson(frontier()));
    }, 60_000);

    it("host results are in kW only; the one $ figure is grid value, never Torus revenue", () => {
      const keys: string[] = [];
      const walk = (x: unknown) => {
        if (Array.isArray(x)) x.forEach(walk);
        else if (x && typeof x === "object")
          for (const [k, v] of Object.entries(x)) {
            keys.push(k);
            walk(v);
          }
      };
      walk(JSON.parse(read(FILE)));
      const money = [
        ...new Set(
          keys.filter((k) => /usd|dollar|revenue|bill|saving/i.test(k)),
        ),
      ];
      expect(money).toEqual(["grid_value_usd_per_mw_day"]);
      const text = read(FILE);
      // every mention of Torus revenue says the value is not it
      expect(text).toMatch(/not Torus revenue/);
      expect(text.match(/Torus revenue/g)!.length).toBe(
        text.match(/not Torus revenue/g)!.length,
      );
      expect(text).toMatch(/#66/);
      expect(text).not.toContain(String.fromCharCode(0x2014));
      expect(text).not.toContain(String.fromCharCode(0x2013));
    });

    it("every archetype and scale is labeled SIMULATED", () => {
      const f = JSON.parse(read(FILE)) as HostFrontier;
      expect(f.prov).toBe("SIMULATED");
      for (const a of f.archetypes) {
        expect(a.prov).toBe("SIMULATED");
        expect(a.label).toMatch(/SIMULATED/);
        expect(a.day_scale.prov).toBe("SIMULATED");
      }
      expect(f.prices.prov).toBe("REAL");
      // a break point shown on its own takes its chip from the archetype
      expect(
        f.notes.some(
          (n) =>
            n.includes("break point") &&
            n.includes("archetype's prov") &&
            n.includes("SIMULATED"),
        ),
      ).toBe(true);
    });

    it("statements name a ratchet difference only where there is one", () => {
      const f = JSON.parse(read(FILE)) as HostFrontier;
      for (const a of f.archetypes) {
        const bp = a.break_point_kw;
        const off = a.break_point_without_ratchet_kw;
        if (bp === off) {
          expect(a.statement).toContain(
            `The break point is ${off} kW with or without the month-to-date ratchet.`,
          );
          expect(a.statement).not.toMatch(/would be/);
        } else
          expect(a.statement).toContain(
            `Ignoring the month-to-date ratchet, the break point would be ${off} kW.`,
          );
      }
      // both cases occur in the committed file
      expect(
        f.archetypes.some(
          (a) => a.break_point_kw !== a.break_point_without_ratchet_kw,
        ),
      ).toBe(true);
      expect(
        f.archetypes.some(
          (a) => a.break_point_kw === a.break_point_without_ratchet_kw,
        ),
      ).toBe(true);
    });
  },
);

// Flag off: nothing on stage reads the frontier, and its CLI leaves every core file's bytes alone.
function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : [p];
  });
}

describe("flag off (ff_host_frontier): core outputs are byte-identical", () => {
  it("is registered and off by default", () =>
    expect(FLAGS.ff_host_frontier.default).toBe(false));

  it("no core module, core CLI or app file imports the frontier", () => {
    const hits = [
      ...files(repoPath("engine/src")),
      ...files(repoPath("engine/cli")),
      ...files(repoPath("app/src")),
    ].filter(
      (f) =>
        !/[\\/]frontier\.ts$/.test(f) &&
        /from\s+["'][^"']*\/frontier["']/.test(readFileSync(f, "utf8")),
    );
    expect(hits).toEqual([]);
    expect(read("engine/src/index.ts")).not.toMatch(/frontier/);
    const n = JSON.parse(read("public/derived/numbers.json")) as {
      key: string;
    }[];
    expect(n.some((x) => /frontier/.test(x.key))).toBe(false);
  });

  it("backtest.json and backtest_days.json rebuild byte for byte", () => {
    const backtest = JSON.parse(
      read("public/derived/backtest.json"),
    ) as BacktestResult;
    const torus = JSON.parse(
      read("public/data/torus_published.json"),
    ) as TorusPublished;
    const run = runBacktest(hist, site, {
      wear_usd_mwh: backtest.wear_usd_mwh,
      seed: backtest.seed,
      by_hour: torus.events_2025_by_hour.value,
      by_weekday: torus.events_2025_by_weekday.value,
    });
    expect(stableJson(run.result)).toBe(read("public/derived/backtest.json"));
    expect(stableJson(run.days)).toBe(
      read("public/derived/backtest_days.json"),
    );
  }, 60_000);

  it("the CLI writes only its --out file, and numbers.json rebuilds byte for byte", () => {
    const watched = [
      ...files(repoPath("public/derived")),
      ...files(repoPath("public/data")),
      ...files(repoPath("contracts")),
    ];
    const hash = () =>
      watched.map(
        (f) =>
          `${f} ${createHash("sha256").update(readFileSync(f)).digest("hex")}`,
      );
    const before = hash();
    const dir = mkdtempSync(join(tmpdir(), "frontier-off-"));
    const run = (cli: string, ...args: string[]) =>
      execFileSync(
        process.execPath,
        ["--import", "tsx", repoPath(cli), ...args],
        {
          cwd: repoPath("."),
          encoding: "utf8",
        },
      );
    run("engine/cli/frontier.ts", "--out", join(dir, "host_frontier.json"));
    expect(hash()).toEqual(before);
    run(
      "engine/cli/numbers.ts",
      "public/data/bundle_2026-10-27.json",
      "--out",
      join(dir, "numbers.json"),
    );
    expect(
      readFileSync(join(dir, "numbers.json"), "utf8").replace(/\r\n/g, "\n"),
    ).toBe(read("public/derived/numbers.json").replace(/\r\n/g, "\n"));
  }, 120_000);
});
