import { existsSync, readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { FLAGS } from "@contracts/flags";
import type {
  BacktestResult,
  HistDay,
  Plan,
  TorusPublished,
} from "@contracts/types";
import {
  histBundle,
  runBacktest,
  usableDay,
  windowDays,
} from "@engine/backtest";
import { simulateCall } from "@engine/crash";
import { stableJson } from "@engine/json";
import { solve } from "@engine/policies";
import {
  AXES,
  backtestGap,
  findBreakEven,
  gapOf,
  runAxis,
  scalePrices,
  siteWith,
  solveAtLevels,
  valueGap,
} from "@engine/sensitivity";
import type { Sensitivity, SensCtx } from "@engine/sensitivity";
import { defaultSite } from "@engine/site";
import { loadFixture, repoPath } from "./helpers/fixture";

const read = (p: string) => readFileSync(repoPath(p), "utf8");
const hist = JSON.parse(
  read("public/data/hist_2026-05-01_2026-10-27.json"),
) as HistDay[];
const torus = JSON.parse(
  read("public/data/torus_published.json"),
) as TorusPublished;
const backtest = JSON.parse(
  read("public/derived/backtest.json"),
) as BacktestResult;
const site = defaultSite();
const ctx: SensCtx = {
  hist,
  site,
  wear_usd_mwh: backtest.wear_usd_mwh,
  seed: backtest.seed,
  by_hour: torus.events_2025_by_hour.value,
  by_weekday: torus.events_2025_by_weekday.value,
};
// July alone keeps the per-axis runs quick.
const july: SensCtx = { ...ctx, start_mt: "2026-07-01", end_mt: "2026-07-31" };
const byDay = new Map(hist.map((d) => [d.operating_day_mt, d]));
const days = windowDays("2026-05-01", "2026-10-27")
  .map((d) => byDay.get(d))
  .filter(usableDay);
const noMs = (p: Plan) => stableJson({ ...p, solve_ms: 0 });
const stat = (r: BacktestResult, p: string) =>
  r.policies.find((x) => x.policy === p)!;

describe("the base case reproduces backtest.json exactly", () => {
  const run = runBacktest(hist, site, {
    wear_usd_mwh: ctx.wear_usd_mwh,
    seed: ctx.seed,
    by_hour: ctx.by_hour,
    by_weekday: ctx.by_weekday,
  });

  it("backtest.json and backtest_days.json, byte for byte", () => {
    expect(stableJson(run.result)).toBe(read("public/derived/backtest.json"));
    expect(stableJson(run.days)).toBe(
      read("public/derived/backtest_days.json"),
    );
  }, 60_000);

  it("the base gap is Clearlane minus the off-peak rule in backtest.json", () => {
    const g = gapOf(backtest);
    const c = stat(backtest, "clearlane");
    const f = stat(backtest, "fixed_overnight");
    expect(g.usd_per_mw_day).toBe(
      c.usd_per_mw_day.mean - f.usd_per_mw_day.mean,
    );
    expect(g.co2_t_per_mw_day).toBe(
      c.co2_t_per_mw_day.mean - f.co2_t_per_mw_day.mean,
    );
    expect(g.calls_unanswerable_pct_points).toBe(
      c.calls_unanswerable_pct.heatmap_as_mt -
        f.calls_unanswerable_pct.heatmap_as_mt,
    );
    expect(gapOf(run.result)).toEqual(g);
  });

  it("the values-only path (no calls) gives the same $ and CO2 gaps exactly", () => {
    const v = valueGap(ctx, site, ctx.wear_usd_mwh, {});
    expect(v.usd_per_mw_day).toBe(gapOf(backtest).usd_per_mw_day);
    expect(v.co2_t_per_mw_day).toBe(gapOf(backtest).co2_t_per_mw_day);
  });
});

describe("one input at a time", () => {
  it("covers every axis the issue names; pending ones say what they wait on", () => {
    expect(AXES.map((a) => a.key)).toEqual([
      "rte",
      "wear_usd_mwh",
      "host_ceiling_slack_kw",
      "host_load_archetype",
      "enrolled_kw",
      "export_limit_kw",
      "spin_refill_min",
      "heatmap_reading",
      "co2_basis",
      "dp_soc_states",
    ]);
    const rte = AXES.find((a) => a.key === "rte")!;
    expect([rte.low, rte.base, rte.high]).toEqual([0.8, 0.88, 0.92]);
    expect(AXES.find((a) => a.key === "spin_refill_min")!.high).toBe(12);
    expect(AXES.find((a) => a.key === "dp_soc_states")!.points).toEqual([
      41, 81, 161,
    ]);
    for (const a of AXES.filter((x) => x.kind === "pending"))
      expect(a.pending_on).toMatch(/#\d+/);
  });

  for (const spec of AXES.filter((a) => a.kind !== "pending"))
    it(`${spec.key}: a zero-width range gives zero delta`, () => {
      const r = runAxis(july, { ...spec, low: spec.base, high: spec.base });
      if (r.status !== "ok") throw new Error("expected an ok axis");
      for (const d of [r.delta_low, r.delta_high]) {
        expect(d.usd_per_mw_day).toBe(0);
        expect(d.co2_t_per_mw_day).toBe(0);
        expect(d.calls_unanswerable_pct_points ?? 0).toBe(0);
      }
    }, 60_000);

  it("a real range moves the gap (RTE on July)", () => {
    const r = runAxis(
      july,
      AXES.find((a) => a.key === "rte")!,
    );
    if (r.status !== "ok") throw new Error("expected an ok axis");
    expect(r.delta_low.usd_per_mw_day).not.toBe(0);
    expect(r.delta_high.usd_per_mw_day).not.toBe(0);
  }, 60_000);
});

describe("site changes", () => {
  it("siteWith changes only the named field", () => {
    expect(siteWith(site, {})).toEqual(site);
    expect(siteWith(site, { rte: 0.8 }).station.rte.value).toBe(0.8);
    expect(siteWith(site, { ceiling_slack_kw: 100 }).host_ceiling_kw).toBe(
      site.host_ceiling_kw + 100,
    );
    expect(siteWith(site, { enrolled_kw: 125 }).station.enrolled_kw).toBe(125);
    expect(siteWith(site, { export_limit_kw: 250 }).export_limit_kw.value).toBe(
      250,
    );
    expect(
      siteWith(site, { spin_recharge_min: 12 }).station.spin_recharge_min,
    ).toBe(12);
    // the default site is not touched
    expect(site.station.rte.value).toBe(0.88);
  });

  it("a 12-minute Spin refill takes twice as long as the 6-minute default when uncapped", () => {
    const b = loadFixture();
    const plan = solve(b, site, "clearlane");
    const ev = {
      id: "t",
      start_utc: b.hours[2]!.ts_utc, // 2am: the host ceiling leaves room for a full-power refill
      duration_s: 330,
      requested_kw: 250,
      prov: "SIMULATED" as const,
    };
    const six = simulateCall(plan, site, ev);
    const twelve = simulateCall(
      plan,
      siteWith(site, { spin_recharge_min: 12 }),
      ev,
    );
    const refillS = (r: typeof six) => r.trace.length - ev.duration_s;
    expect(six.delivered_pct).toBe(twelve.delivered_pct);
    expect(refillS(twelve)).toBeGreaterThanOrEqual(2 * refillS(six) - 1);
    expect(refillS(twelve)).toBeLessThanOrEqual(2 * refillS(six) + 1);
    // the 6-minute site is the default site, so the default trace is unchanged
    expect(
      simulateCall(plan, siteWith(site, { spin_recharge_min: 6 }), ev),
    ).toEqual(six);
  });
});

describe("the DP SoC grid", () => {
  it("41 states reproduce the policy solve exactly", () => {
    for (const d of days.filter((_, i) => i % 30 === 0)) {
      const b = histBundle(d);
      for (const p of ["price_only", "clearlane"] as const) {
        const o = {
          wear_usd_mwh: ctx.wear_usd_mwh,
          sch_mode: "price_proxy" as const,
        };
        expect(noMs(solveAtLevels(b, site, p, o, 40))).toBe(
          noMs(solve(b, site, p, o)),
        );
      }
    }
  });

  it("DP value never decreases across the nested grids (41 within 81 within 161) to 1e-9", () => {
    for (const d of days.filter((_, i) => i % 10 === 0)) {
      const b = histBundle(d);
      for (const p of ["price_only", "clearlane"] as const) {
        const o = {
          wear_usd_mwh: ctx.wear_usd_mwh,
          sch_mode: "price_proxy" as const,
        };
        const obj = [40, 80, 160].map((n) => {
          const plan = solveAtLevels(b, site, p, o, n);
          const W = plan.wear_usd_mwh;
          const discharged = plan.intervals.reduce(
            (a, iv) => a + Math.max(0, -iv.pulse_kw) * 0.25,
            0,
          );
          return plan.value_usd - (W * discharged) / 1000;
        });
        expect(obj[1]!).toBeGreaterThanOrEqual(obj[0]! - 1e-9);
        expect(obj[2]!).toBeGreaterThanOrEqual(obj[1]! - 1e-9);
      }
    }
  }, 60_000);
});

describe("break-even helpers", () => {
  it("scalePrices: 1 is the day, 0 is flat at its mean, the spread scales", () => {
    const d = days[0]!;
    expect(scalePrices(d, 1).lmp_usd_mwh).toEqual(d.lmp_usd_mwh);
    const m = d.lmp_usd_mwh.reduce((a, x) => a + x, 0) / 24;
    for (const p of scalePrices(d, 0).lmp_usd_mwh) expect(p).toBeCloseTo(m, 9);
    const spread = (x: number[]) => Math.max(...x) - Math.min(...x);
    expect(spread(scalePrices(d, 0.5).lmp_usd_mwh)).toBeCloseTo(
      spread(d.lmp_usd_mwh) / 2,
      9,
    );
  });

  it("findBreakEven finds a sign change by bisection, or reports none", () => {
    const xs = [0, 0.25, 0.5, 0.75, 1];
    const hit = findBreakEven((x) => 0.3 - x, xs, 1e-6);
    expect(hit.found).toBe(true);
    expect(hit.value!).toBeCloseTo(0.3, 5);
    const miss = findBreakEven((x) => 1 + x, xs, 1e-6);
    expect(miss.found).toBe(false);
    expect(miss.value).toBeNull();
    expect(miss.min_gap).toEqual({ x: 0, gap_usd_per_mw_day: 1 });
  });

  it("backtestGap equals gapOf(runBacktest) for the same inputs", () => {
    const g = backtestGap(july, site, july.wear_usd_mwh);
    const r = runBacktest(hist, site, {
      wear_usd_mwh: july.wear_usd_mwh,
      seed: july.seed,
      by_hour: july.by_hour,
      by_weekday: july.by_weekday,
      start_mt: july.start_mt,
      end_mt: july.end_mt,
    });
    expect(g).toEqual(gapOf(r.result));
  }, 60_000);
});

const SENS = "public/derived/sensitivity.json";
describe.skipIf(!existsSync(repoPath(SENS)))(
  "public/derived/sensitivity.json",
  () => {
    let cached: Sensitivity | undefined;
    const sens = () => (cached ??= JSON.parse(read(SENS)) as Sensitivity);

    it("names the flag and reproduces the base gap from backtest.json", () => {
      expect(sens().schema).toBe("clearlane.sensitivity/v1");
      expect(sens().flag).toBe("ff_sensitivity");
      expect(sens().base.gap).toEqual(gapOf(backtest));
      expect(sens().wear_usd_mwh).toBe(backtest.wear_usd_mwh);
      expect(sens().seed).toBe(backtest.seed);
    });

    it("every ok axis has low and high gaps and deltas; pending axes say why", () => {
      expect(sens().axes.map((a) => a.key)).toEqual(AXES.map((a) => a.key));
      for (const a of sens().axes) {
        if (a.status === "pending") {
          expect(a.pending_on).toMatch(/#\d+/);
          continue;
        }
        for (const g of [a.gap_low, a.gap_high, a.delta_low, a.delta_high])
          expect(Number.isFinite(g.usd_per_mw_day)).toBe(true);
        expect(a.range_prov).toBe("ASSUMPTION");
      }
    });

    it("spot checks: the RTE low end and the 81-state grid recompute exactly", () => {
      const rte = sens().axes.find((a) => a.key === "rte")!;
      if (rte.status !== "ok") throw new Error("rte should be ok");
      expect(
        backtestGap(ctx, siteWith(site, { rte: 0.8 }), ctx.wear_usd_mwh),
      ).toEqual(rte.gap_low);
      const grid = sens().axes.find((a) => a.key === "dp_soc_states")!;
      if (grid.status !== "ok") throw new Error("grid should be ok");
      const p81 = grid.points!.find((p) => p.value === 81)!;
      expect({
        ...valueGap(ctx, site, ctx.wear_usd_mwh, { levels: 80 }),
        calls_unanswerable_pct_points: null,
      }).toEqual(p81.gap);
    }, 60_000);

    it("break-evens are consistent with their scans", () => {
      for (const be of [
        sens().break_even.rte,
        sens().break_even.daily_spread,
        sens().break_even.wear_usd_mwh,
      ]) {
        const signs = new Set(
          be.scanned.map((x) => Math.sign(x.gap_usd_per_mw_day)),
        );
        if (be.found) {
          expect(be.value).not.toBeNull();
          expect(signs.size).toBeGreaterThan(1);
        } else {
          expect(be.value).toBeNull();
          expect(signs.size).toBe(1);
        }
        expect(be.statement.length).toBeGreaterThan(20);
      }
      const bd = sens().break_even.by_day_spread;
      expect(bd.bands.reduce((a, b) => a + b.days, 0)).toBe(sens().window.days);
    });

    it("the two-way grid holds the base case at RTE 0.88 and scale 1", () => {
      const i = sens().two_way.rte.indexOf(0.88);
      const j = sens().two_way.price_scale.indexOf(1);
      expect(sens().two_way.usd_gap[i]![j]).toBe(
        sens().base.gap.usd_per_mw_day,
      );
    });

    it("has no em dash or en dash", () => {
      const text = read(SENS);
      expect(text).not.toContain(String.fromCharCode(0x2014));
      expect(text).not.toContain(String.fromCharCode(0x2013));
    });
  },
);

describe("flag off (ff_sensitivity): core outputs are byte-identical", () => {
  it("is registered and off by default", () =>
    expect(FLAGS.ff_sensitivity.default).toBe(false));

  it("no core module or core CLI imports the sensitivity sweep", () => {
    const core = [
      ...readdirSync(repoPath("engine/src"))
        .filter((f) => f !== "sensitivity.ts")
        .map((f) => `engine/src/${f}`),
      ...readdirSync(repoPath("engine/cli"))
        .filter((f) => f !== "sensitivity.ts")
        .map((f) => `engine/cli/${f}`),
    ];
    for (const f of core)
      expect(read(f)).not.toMatch(/from\s+["'][./]*(src\/)?sensitivity["']/);
  });

  it("numbers.json has no sensitivity key", () => {
    const n = JSON.parse(read("public/derived/numbers.json")) as {
      key: string;
    }[];
    expect(n.some((x) => /sensitiv/.test(x.key))).toBe(false);
  });
});
