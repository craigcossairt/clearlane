import { describe, expect, it } from "vitest";
import type { HistDay } from "@contracts/types";
import {
  histBundle,
  runBacktest,
  validateBacktest,
  windowDays,
} from "@engine/backtest";
import { percentile, pctl } from "@engine/stats";
import { solve } from "@engine/policies";
import { defaultSite } from "@engine/site";
import { loadFixture } from "./helpers/fixture";
import { loadDam } from "./helpers/oasis";
import { torusFixture } from "./helpers/torus";

// Research CSV days (REAL prices) with the Oct 27 fixture's CO2 profile (tests only).
const co2 = loadFixture().hours.map((h) => h.co2_g_kwh);
const hist: HistDay[] = [
  ...loadDam("research/data/oasis/dam_jul"),
  ...loadDam("research/data/oasis/dam_oct"),
].map(([d, p]) => ({
  operating_day_mt: d,
  lmp_usd_mwh: p,
  co2_g_kwh: [...co2],
}));
const days = hist.map((d) => d.operating_day_mt).sort();
const t = torusFixture();
const opts = {
  wear_usd_mwh: 10,
  seed: 7,
  by_hour: t.events_2025_by_hour.value,
  by_weekday: t.events_2025_by_weekday.value,
  start_mt: days[0]!,
  end_mt: days.at(-1)!,
};
const site = defaultSite();
const run = runBacktest(hist, site, opts);
const stats = (p: string) => run.result.policies.find((x) => x.policy === p)!;

describe("stats", () => {
  it("interpolates percentiles like numpy", () => {
    expect(percentile([1, 2, 3, 4], 0.1)).toBeCloseTo(1.3, 12);
    expect(percentile([4, 1, 3, 2], 0.5)).toBeCloseTo(2.5, 12);
    expect(percentile([5], 0.9)).toBe(5);
    expect(pctl([1, 2, 3, 4]).mean).toBe(2.5);
  });
});

describe("backtest on the July and October research days", () => {
  it("covers every window day once, present or missing", () => {
    const w = run.result.window;
    expect(w.days).toBe(hist.length);
    expect(w.days + w.missing_days.length).toBe(
      windowDays(opts.start_mt, opts.end_mt).length,
    );
    expect(run.days).toHaveLength(3 * hist.length);
    expect(validateBacktest(run.result)).toEqual([]);
  });

  it("clearlane never breaches the host ceiling; price_only does", () => {
    expect(stats("clearlane").host_ceiling_breaches).toBe(0);
    expect(
      run.days.some(
        (r) => r.policy === "price_only" && r.host_ceiling_breaches > 0,
      ),
    ).toBe(true);
  });

  it("the off-peak rule never beats itself", () => {
    expect(stats("fixed_overnight").days_beating_fixed_overnight_pct).toBe(0);
  });

  it("reports every heatmap reading, and they differ", () => {
    for (const p of run.result.policies) {
      const c = p.calls_unanswerable_pct;
      for (const v of [c.heatmap_as_mt, c.heatmap_as_utc, c.heatmap_as_utc_mst])
        expect(v).toBeGreaterThanOrEqual(0);
    }
    expect(
      run.result.policies.some(
        (p) =>
          p.calls_unanswerable_pct.heatmap_as_mt !==
          p.calls_unanswerable_pct.heatmap_as_utc,
      ),
    ).toBe(true);
  });

  it("is deterministic for a seed", () => {
    const again = runBacktest(hist, site, opts);
    expect(again.result).toEqual(run.result);
    expect(again.days).toEqual(run.days);
  });

  it("cycles a year are mean daily cycles x 365", () => {
    const cl = run.days.filter((r) => r.policy === "clearlane");
    const m = cl.reduce((a, r) => a + r.pulse_cycles, 0) / cl.length;
    expect(stats("clearlane").pulse_cycles_per_yr).toBeCloseTo(m * 365, 9);
  });

  it("fixed_overnight counts one full cycle a day, 365 a year (stored energy, #45)", () => {
    expect(stats("fixed_overnight").pulse_cycles_per_yr).toBeCloseTo(365, 9);
  });
});

describe("missing days and CO2", () => {
  const d0 = hist[0]!;
  const d1 = hist[1]!;
  const small = (h: HistDay[]) =>
    runBacktest(h, site, {
      ...opts,
      start_mt: d0.operating_day_mt,
      end_mt: d1.operating_day_mt,
    });

  it("lists short and non-finite days as missing, never filled", () => {
    const short = { ...d0, lmp_usd_mwh: d0.lmp_usd_mwh.slice(1) };
    const nan = {
      ...d1,
      lmp_usd_mwh: d1.lmp_usd_mwh.map((x, h) => (h === 3 ? Number.NaN : x)),
    };
    const r = small([short, nan]).result;
    expect(r.window.days).toBe(0);
    expect(r.window.missing_days).toEqual([
      d0.operating_day_mt,
      d1.operating_day_mt,
    ]);
  });

  it("leaves a day out of CO2 when it trades in a null-CO2 hour", () => {
    const plan = solve(histBundle(d0), site, "fixed_overnight", {
      sch_mode: "price_proxy",
    });
    const traded = plan.intervals.find((iv) => iv.pulse_kw !== 0)!;
    const h = Math.floor(traded.i / 4);
    const nulled = {
      ...d0,
      co2_g_kwh: d0.co2_g_kwh.map((x, k) => (k === h ? null : x)),
    };
    const r = small([nulled, d1]);
    expect(r.co2_excluded_days.fixed_overnight).toBe(1);
    const row = r.days.find(
      (x) =>
        x.policy === "fixed_overnight" &&
        x.operating_day_mt === d0.operating_day_mt,
    )!;
    expect(row.co2_t_per_mw_day).toBeNull();
    expect(row.usd_per_mw_day).toBeGreaterThan(-Infinity);
  });

  it("builds bundles on the Mountain day", () => {
    const b = histBundle(d0);
    expect(b.hours[0]!.ts_utc).toBe(`${d0.operating_day_mt}T06:00:00Z`);
    expect(b.hours).toHaveLength(24);
  });
});

describe("validateBacktest", () => {
  it("rejects bad shapes", () => {
    const r = run.result;
    expect(validateBacktest({ ...r, schema: "x" }).length).toBeGreaterThan(0);
    expect(
      validateBacktest({ ...r, policies: r.policies.slice(1) }).length,
    ).toBeGreaterThan(0);
    expect(
      validateBacktest({
        ...r,
        window: { ...r.window, missing_days: ["2026-09-02", "2026-09-01"] },
      }).length,
    ).toBeGreaterThan(0);
    const bad = structuredClone(r);
    bad.policies[0]!.usd_per_mw_day.p50 = Number.NaN;
    expect(validateBacktest(bad).length).toBeGreaterThan(0);
  });
});
