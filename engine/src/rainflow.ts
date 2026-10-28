// Rainflow wear, dwell and a cycle-life estimate for Pulse (stretch #70, flag ff_wear_rainflow). No core
// module or CLI imports this file: nothing here feeds numbers.json, backtest.json or the calibrated wear
// price, which stays the linear one in wear.ts.
//  - 3-point rainflow on the Pulse SoC trace, counted as research/analysis/depth/bandsplit.py counts it,
//    except that a flat run is one turning point (bandsplit keeps both ends of a plateau and loses the swing).
//  - Miner damage under N(DoD) = N_rated x DoD^-k, anchored to the 7,500 cycles Torus publishes at a rated
//    DoD of 100% (ASSUMPTION: the rating's basis is not advertised), k swept at 1, 1.5 and 2.
//  - Hours at SoC above 80% and at full, linear inside each 15-minute interval.
//  - A depth-aware DP (segment approximation): the wear price split over the 40 SoC segments, each priced by
//    the increment of DoD^k across it with depth measured down from full. At k = 1 every multiplier is
//    exactly 1, so the plan is the linear one.
import type {
  Bundle,
  HistDay,
  Pctl,
  Plan,
  Policy,
  Provenance,
  Site,
} from "@contracts/types";
import { INTERVAL_S, INTERVALS, prices } from "./bundle";
import {
  BACKTEST_WINDOW,
  POLICIES,
  histBundle,
  usableDay,
  windowDays,
} from "./backtest";
import { solveDp } from "./dp";
import type { DpResult } from "./dp";
import type { SchMode } from "./lanes";
import {
  DP_FLOOR_LEVEL,
  PULSE_LEVELS,
  eta,
  hold4,
  pulseDz,
  spinAvailKw,
  stepLimits,
} from "./limits";
import { buildPlan, schFlags } from "./plan";
import type { Schedule } from "./plan";
import { POLICY_LABEL, solve, startSocKwh } from "./policies";
import { referenceRace } from "./reference";
import type { ReferenceRace } from "./reference";
import { mean, pctl } from "./stats";

const STEP_H = INTERVAL_S / 3600;
const SCH_MODE = "price_proxy" as const; // as the backtest: HistDay has no net load
const FULL = 1 - 1e-9;

export const RAINFLOW_K = [1, 1.5, 2];
export const RATED_DOD = 1; // ASSUMPTION: the depth the 7,500 cycles are rated at
export const DWELL_FRAC = 0.8;

export interface Cycle {
  range: number; // same units as the trace
  count: number; // 1 full, 0.5 half
}

// First and last points and every reversal, after merging runs of equal values.
export function turningPoints(x: number[]): number[] {
  const v = x.filter((y, i) => i === 0 || y !== x[i - 1]);
  if (v.length <= 2) return v;
  const out = [v[0]!];
  for (let i = 1; i < v.length - 1; i++)
    if (Math.sign(v[i]! - v[i - 1]!) !== Math.sign(v[i + 1]! - v[i]!))
      out.push(v[i]!);
  out.push(v[v.length - 1]!);
  return out;
}

// ASTM-style 3-point rainflow, in bandsplit.py's output order: a range that holds the first point is a
// half cycle, any other closed range a full one, and what is left on the stack is halves.
export function rainflow(x: number[]): Cycle[] {
  const stack: number[] = [];
  const out: Cycle[] = [];
  for (const v of turningPoints(x)) {
    stack.push(v);
    while (stack.length >= 3) {
      const n = stack.length;
      const X = Math.abs(stack[n - 1]! - stack[n - 2]!);
      const Y = Math.abs(stack[n - 2]! - stack[n - 3]!);
      if (X < Y) break;
      if (n === 3) {
        out.push({ range: Y, count: 0.5 });
        stack.shift();
      } else {
        out.push({ range: Y, count: 1 });
        const last = stack.pop()!;
        stack.pop();
        stack.pop();
        stack.push(last);
      }
    }
  }
  for (let i = 0; i < stack.length - 1; i++)
    out.push({ range: Math.abs(stack[i + 1]! - stack[i]!), count: 0.5 });
  return out;
}

// Miner's rule with N(DoD) = N_rated x DoD^-k: a cycle of depth d counts as (d / rated DoD)^k rated cycles.
export const equivalentCycles = (
  cycles: Cycle[],
  capacity: number,
  k: number,
): number =>
  cycles.reduce(
    (a, c) => a + c.count * (c.range / capacity / RATED_DOD) ** k,
    0,
  );

// Hours the trace (SoC / capacity at interval boundaries) spends above `frac`, linear inside each step.
export function dwellHours(x: number[], frac: number, stepH: number): number {
  let h = 0;
  for (let i = 0; i + 1 < x.length; i++) {
    const a = x[i]! - frac;
    const b = x[i + 1]! - frac;
    if (a > 0 && b > 0) h += stepH;
    else if (a > 0 || b > 0) h += (stepH * Math.max(a, b)) / Math.abs(a - b);
  }
  return h;
}

// Hours at full: steps that start and end full.
export function fullHours(x: number[], stepH: number): number {
  let h = 0;
  for (let i = 0; i + 1 < x.length; i++)
    if (x[i]! >= FULL && x[i + 1]! >= FULL) h += stepH;
  return h;
}

// Pulse SoC in kWh at every interval boundary: the plan's start, then each interval's end.
export const socTrace = (plan: Plan, site: Site): number[] => [
  startSocKwh(site, plan.policy),
  ...plan.intervals.map((iv) => iv.pulse_soc_kwh),
];

// habit.py's legs hold the battery full from the end of the last charge hour to the start of the first
// discharge hour.
export function raceFullHours(r: ReferenceRace): {
  fixed_overnight: number;
  timetable: number;
} {
  const full = (l: ReferenceRace["fixed"]) =>
    Math.min(...l.discharge_hb) - (Math.max(...l.charge_hb) + 1);
  return { fixed_overnight: full(r.fixed), timetable: full(r.timetable) };
}

// Segment i spans levels i to i + 1, depths (N - i - 1) / N to (N - i) / N below full. Its multiplier is the
// increment of DoD^k across it over the increment of DoD, so a discharge from full to depth d pays d^k of a
// full-depth discharge and the multipliers average 1. Integer powers keep k = 1 and k = 2 exact.
export const depthSegMult = (N: number, k: number): number[] =>
  Array.from(
    { length: N },
    (_, i) => ((N - i) ** k - (N - i - 1) ** k) / N ** (k - 1),
  );

// Clearlane's DP with the depth-aware wear price. Limits and the DP mirror dpSchedule; only the wear
// term differs.
export function depthAwareDp(
  b: Bundle,
  site: Site,
  W: number,
  k: number,
  schMode?: SchMode,
): DpResult {
  const spinSoc = site.station.spin_kwh;
  const limits = stepLimits(site, {
    ceiling: true,
    sch: schFlags(b, schMode),
    spin_avail_kw: Array<number>(INTERVALS).fill(spinAvailKw(site, spinSoc)),
    other_load_kw: Array<number>(INTERVALS).fill(0),
  });
  return solveDp({
    price: hold4(prices(b)),
    levels: PULSE_LEVELS,
    dz: pulseDz(site),
    eta: eta(site),
    charge_max: limits.charge_kw.map((kw) => kw * STEP_H),
    discharge_max: limits.discharge_kw.map((kw) => kw * STEP_H),
    W,
    soc_min: 0,
    start_level: DP_FLOOR_LEVEL,
    end_level: DP_FLOOR_LEVEL,
    to_mwh: 1 / 1000,
    seg_mult: depthSegMult(PULSE_LEVELS, k),
  });
}

export function depthAwarePlan(
  b: Bundle,
  site: Site,
  W: number,
  k: number,
  schMode?: SchMode,
): Plan {
  const t0 = performance.now();
  const spinSoc = site.station.spin_kwh;
  const zeros = () => Array<number>(INTERVALS).fill(0);
  const r = depthAwareDp(b, site, W, k, schMode);
  const s: Schedule = {
    pulse_kw: r.acts.map((g) => -g / STEP_H),
    pulse_soc_kwh: r.socs.slice(1),
    spin_kw: zeros(),
    spin_soc_kwh: Array<number>(INTERVALS).fill(spinSoc),
    spin_start_kwh: spinSoc,
  };
  return buildPlan(b, site, s, {
    policy: "clearlane",
    wear_usd_mwh: W,
    solve_ms: performance.now() - t0,
    sch_mode: schMode,
  });
}

// The depth-aware wear in $ on a plan that sits on the DP's SoC grid: each discharge step pays W x the grid
// MWh x the mean multiplier of the segments it crosses, as the DP's wear term does.
export function depthWearUsd(
  plan: Plan,
  site: Site,
  W: number,
  k: number,
): number {
  const dz = pulseDz(site);
  const e = eta(site);
  const pre = depthSegMult(PULSE_LEVELS, k).reduce(
    (a, m, i) => [...a, a[i]! + m],
    [0],
  );
  const lv = socTrace(plan, site).map((soc) => {
    const l = Math.round(soc / dz);
    if (Math.abs(soc / dz - l) > 1e-6)
      throw new Error(`SoC ${soc} kWh is off the DP grid of ${dz} kWh`);
    return l;
  });
  let usd = 0;
  for (let t = 0; t + 1 < lv.length; t++) {
    const j = lv[t]!;
    const kk = lv[t + 1]!;
    if (kk >= j) continue;
    const g = (j - kk) * dz * e; // grid kWh delivered
    usd += (W * g * ((pre[j]! - pre[kk]!) / (j - kk))) / 1000;
  }
  return usd;
}

export interface ByK {
  k: number;
  equivalent_cycles_per_yr: number;
  life_yr: number; // rated cycles / equivalent cycles a year
  life_prov: Provenance; // ASSUMPTION
}

export interface PolicyWear {
  policy: Policy;
  label: string;
  prov: Provenance; // DERIVED
  throughput_cycles_per_yr: number; // equals backtest.json's pulse_cycles_per_yr
  rainflow_cycles_per_yr: number; // cycles of any depth, halves as 0.5
  mean_depth_pct: number; // count-weighted
  by_k: ByK[];
  dwell_h_above_80pct: Pctl; // per day
  full_h: Pctl; // per day
}

export interface DepthAware {
  k: number;
  prov: Provenance; // DERIVED
  usd_per_mw_day: Pctl; // gross arbitrage, before wear
  usd_per_mw_day_vs_linear: number; // mean of (depth-aware minus linear) per day, gross
  days_plan_changed: number;
  throughput_cycles_per_yr: number;
  equivalent_cycles_per_yr: number; // at this k
  life_yr: number;
  life_prov: Provenance; // ASSUMPTION
  dwell_h_above_80pct_mean: number;
  usd_basis: string; // what usd_per_mw_day and usd_per_mw_day_vs_linear measure
  wear_usd_per_mw_day: number; // mean depth-aware wear at this k
  net_usd_per_mw_day: number; // mean of gross minus that wear
  net_usd_per_mw_day_vs_linear: number; // mean of net minus the linear plan's net at the same wear
}

export interface StageDayWear {
  policy: Policy;
  cycles: Cycle[]; // range in % of capacity
  by_k: { k: number; equivalent_cycles: number }[];
  dwell_h_above_80pct: number;
  full_h: number;
}

export interface WearRainflow {
  schema: "clearlane.wear_rainflow/v1";
  flag: "ff_wear_rainflow";
  generated_utc: string;
  window: { start_mt: string; end_mt: string; days: number };
  wear_usd_mwh: number;
  rating: {
    pulse_cycle_life: number;
    pulse_cycle_life_prov: Provenance;
    rated_dod: number;
    rated_dod_prov: Provenance;
    station_life_yr: number;
    station_life_prov: Provenance;
  };
  k: number[];
  policies: PolicyWear[];
  ranking_by_k: { k: number; least_wear_first: Policy[] }[];
  depth_aware_clearlane: DepthAware[];
  stage_day: {
    operating_day_mt: string;
    policies: StageDayWear[];
    race_full_h: {
      fixed_overnight: number;
      timetable: number;
      prov: Provenance;
    };
  };
  sources: Record<string, string>;
  notes: string[];
}

export interface WearInput {
  hist: HistDay[];
  site: Site;
  wear_usd_mwh: number;
  bundle: Bundle; // the stage day
  rated_cycles: number; // TORUS_PUBLISHED
  station_life_yr: number; // TORUS_PUBLISHED, the Station's lifespan
  sources: { hist: string; torus: string; backtest: string; bundle: string };
  generated_utc: string;
  window?: { start_mt: string; end_mt: string };
}

interface DayWear {
  usd: number;
  throughput: number;
  count: number;
  depthSum: number; // count-weighted depth, fraction
  eq: number[]; // by RAINFLOW_K
  dwell: number;
  full: number;
  pulse: number[];
}

function dayWear(plan: Plan, site: Site): DayWear {
  const E = site.station.pulse_kwh;
  const trace = socTrace(plan, site);
  const x = trace.map((s) => s / E);
  const cs = rainflow(trace).filter((c) => c.range > 1e-9);
  return {
    usd: plan.value_usd_per_mw_day,
    throughput: plan.pulse_cycles,
    count: cs.reduce((a, c) => a + c.count, 0),
    depthSum: cs.reduce((a, c) => a + (c.count * c.range) / E, 0),
    eq: RAINFLOW_K.map((k) => equivalentCycles(cs, E, k)),
    dwell: dwellHours(x, DWELL_FRAC, STEP_H),
    full: fullHours(x, STEP_H),
    pulse: plan.intervals.map((iv) => iv.pulse_kw),
  };
}

const perYr = (xs: number[]) => mean(xs) * 365;
const samePlan = (a: number[], b: number[]) => a.every((x, i) => x === b[i]);

export function wearRainflow(input: WearInput): WearRainflow {
  const { site, wear_usd_mwh: W } = input;
  const span = input.window ?? BACKTEST_WINDOW;
  const rated = input.rated_cycles;
  const byDay = new Map(input.hist.map((d) => [d.operating_day_mt, d]));
  const days = windowDays(span.start_mt, span.end_mt)
    .map((d) => byDay.get(d))
    .filter(usableDay);

  const rows = new Map<Policy, DayWear[]>(POLICIES.map((p) => [p, []]));
  const depth = new Map<number, DayWear[]>(RAINFLOW_K.map((k) => [k, []]));
  // depth-aware wear in $ on the depth-aware plan (own) and on the linear Clearlane plan (lin)
  const wear = new Map<number, { own: number; lin: number }[]>(
    RAINFLOW_K.map((k) => [k, []]),
  );
  for (const d of days) {
    const b = histBundle(d);
    const plans = POLICIES.map((p) =>
      solve(b, site, p, { wear_usd_mwh: W, sch_mode: SCH_MODE }),
    );
    plans.forEach((plan, i) =>
      rows.get(POLICIES[i]!)!.push(dayWear(plan, site)),
    );
    const lin = plans[POLICIES.indexOf("clearlane")]!;
    for (const k of RAINFLOW_K) {
      const plan = depthAwarePlan(b, site, W, k, SCH_MODE);
      depth.get(k)!.push(dayWear(plan, site));
      wear.get(k)!.push({
        own: depthWearUsd(plan, site, W, k),
        lin: depthWearUsd(lin, site, W, k),
      });
    }
  }

  const policies: PolicyWear[] = POLICIES.map((p) => {
    const rs = rows.get(p)!;
    const count = rs.reduce((a, r) => a + r.count, 0);
    return {
      policy: p,
      label: POLICY_LABEL[p],
      prov: "DERIVED",
      throughput_cycles_per_yr: perYr(rs.map((r) => r.throughput)),
      rainflow_cycles_per_yr: perYr(rs.map((r) => r.count)),
      mean_depth_pct:
        count === 0
          ? 0
          : (100 * rs.reduce((a, r) => a + r.depthSum, 0)) / count,
      by_k: RAINFLOW_K.map((k, i) => {
        const eq = perYr(rs.map((r) => r.eq[i]!));
        return {
          k,
          equivalent_cycles_per_yr: eq,
          life_yr: rated / eq,
          life_prov: "ASSUMPTION",
        };
      }),
      dwell_h_above_80pct: pctl(rs.map((r) => r.dwell)),
      full_h: pctl(rs.map((r) => r.full)),
    };
  });

  const linear = rows.get("clearlane")!;
  const perMw = site.station.pulse_kw / 1000;
  const depth_aware_clearlane: DepthAware[] = RAINFLOW_K.map((k, i) => {
    const rs = depth.get(k)!;
    const ws = wear.get(k)!;
    const net = rs.map((r, j) => r.usd - ws[j]!.own / perMw);
    const eq = perYr(rs.map((r) => r.eq[i]!));
    return {
      k,
      prov: "DERIVED",
      usd_per_mw_day: pctl(rs.map((r) => r.usd)),
      usd_per_mw_day_vs_linear: mean(rs.map((r, j) => r.usd - linear[j]!.usd)),
      days_plan_changed: rs.filter(
        (r, j) => !samePlan(r.pulse, linear[j]!.pulse),
      ).length,
      throughput_cycles_per_yr: perYr(rs.map((r) => r.throughput)),
      equivalent_cycles_per_yr: eq,
      life_yr: rated / eq,
      life_prov: "ASSUMPTION",
      dwell_h_above_80pct_mean: mean(rs.map((r) => r.dwell)),
      usd_basis: "gross arbitrage, before wear",
      wear_usd_per_mw_day: mean(ws.map((w) => w.own / perMw)),
      net_usd_per_mw_day: mean(net),
      net_usd_per_mw_day_vs_linear: mean(
        net.map((x, j) => x - (linear[j]!.usd - ws[j]!.lin / perMw)),
      ),
    };
  });

  const E = site.station.pulse_kwh;
  const stage: StageDayWear[] = POLICIES.map((p) => {
    const plan = solve(input.bundle, site, p, { wear_usd_mwh: W });
    const trace = socTrace(plan, site);
    const cs = rainflow(trace).filter((c) => c.range > 1e-9);
    const x = trace.map((s) => s / E);
    return {
      policy: p,
      cycles: cs.map((c) => ({ range: (100 * c.range) / E, count: c.count })),
      by_k: RAINFLOW_K.map((k) => ({
        k,
        equivalent_cycles: equivalentCycles(cs, E, k),
      })),
      dwell_h_above_80pct: dwellHours(x, DWELL_FRAC, STEP_H),
      full_h: fullHours(x, STEP_H),
    };
  });

  return {
    schema: "clearlane.wear_rainflow/v1",
    flag: "ff_wear_rainflow",
    generated_utc: input.generated_utc,
    window: { start_mt: span.start_mt, end_mt: span.end_mt, days: days.length },
    wear_usd_mwh: W,
    rating: {
      pulse_cycle_life: rated,
      pulse_cycle_life_prov: "TORUS_PUBLISHED",
      rated_dod: RATED_DOD,
      rated_dod_prov: "ASSUMPTION",
      station_life_yr: input.station_life_yr,
      station_life_prov: "TORUS_PUBLISHED",
    },
    k: RAINFLOW_K,
    policies,
    ranking_by_k: RAINFLOW_K.map((k, i) => ({
      k,
      least_wear_first: [...policies]
        .sort(
          (a, b) =>
            a.by_k[i]!.equivalent_cycles_per_yr -
            b.by_k[i]!.equivalent_cycles_per_yr,
        )
        .map((p) => p.policy),
    })),
    depth_aware_clearlane,
    stage_day: {
      operating_day_mt: input.bundle.operating_day_mt,
      policies: stage,
      race_full_h: {
        ...raceFullHours(referenceRace(input.bundle)),
        prov: "DERIVED",
      },
    },
    sources: { ...input.sources, code: "engine/src/rainflow.ts" },
    notes: [
      "Flag ff_wear_rainflow. Nothing on stage reads this file; numbers.json, backtest.json and the calibrated wear price are unchanged.",
      "Backtest rows are the day-ahead plans backtest.json scores (SCH by the price proxy, calls not replayed), so throughput_cycles_per_yr equals its pulse_cycles_per_yr.",
      "Rainflow: 3-point count on the Pulse SoC at every 15-minute boundary, as research/analysis/depth/bandsplit.py counts it, except that a flat run is one turning point.",
      "Equivalent cycles: Miner's rule with N(DoD) = 7,500 x DoD^-k, so a cycle of depth d counts as d^k rated cycles. The basis of the 7,500-cycle rating (DoD, temperature, end-of-life capacity) is not advertised; a 100% rated DoD is our ASSUMPTION, and so is k.",
      "Life is cycle life only: 7,500 over equivalent cycles a year. Calendar aging and repowering are not modeled, so a life past the Station's published 25-year lifespan means cycling is not the limit, not that Pulse lasts longer. Lead with the ranking and the dwell hours, which need no rating assumption.",
      "Depth-aware DP (segment approximation): the wear price split over 40 SoC segments, each priced by the increment of DoD^k across it with depth measured down from full; at k = 1 every multiplier is 1 and the plans are the linear ones. The piecewise-segment method follows Xu et al. 2018 (citation UNVERIFIED: the paper was not opened).",
      "Dwell: hours a day with SoC above 80% of capacity and at full, linear inside each 15-minute interval. Whether high-SoC dwell speeds Pulse aging is not modeled (UNVERIFIED).",
      "race_full_h: habit.py's hour lists on the stage day hold the battery full from the end of the last charge hour to the start of the first discharge hour.",
      "depth_aware_clearlane: usd_per_mw_day and usd_per_mw_day_vs_linear are gross arbitrage, before wear. wear_usd_per_mw_day is the depth-aware wear at that k (the DP's own wear term), net_usd_per_mw_day is gross minus it, and net_usd_per_mw_day_vs_linear compares with the linear Clearlane plan priced by the same depth-aware wear.",
    ],
  };
}
