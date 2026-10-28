// Sensitivity (ff_sensitivity): each input varied one at a time over the backtest, with the gap of
// Clearlane over the off-peak rule in $/MW-day, t CO2/MW-day and calls unanswerable; break-evens
// for RTE, the daily price spread and the wear price; one two-way RTE x spread grid; and the DP SoC
// grid at 41, 81 and 161 states. Ranges are our choices (ASSUMPTION). One input at a time ignores
// interactions, hence the two-way grid.
import type {
  BacktestResult,
  HistDay,
  Plan,
  Policy,
  Site,
} from "@contracts/types";
import { INTERVAL_S, INTERVALS, prices } from "./bundle";
import {
  BACKTEST_WINDOW,
  co2Usable,
  histBundle,
  runBacktest,
  usableDay,
  windowDays,
} from "./backtest";
import type { BacktestRun } from "./backtest";
import { solveDp } from "./dp";
import {
  DP_FLOOR_LEVEL,
  PULSE_LEVELS,
  eta,
  hold4,
  spinAvailKw,
  stepLimits,
} from "./limits";
import { buildPlan, schFlags } from "./plan";
import type { Schedule } from "./plan";
import { DEFAULT_WEAR_USD_MWH, solve } from "./policies";
import type { SolveOpts } from "./policies";
import { mean } from "./stats";

const STEP_H = INTERVAL_S / 3600;
const SCH_MODE = "price_proxy" as const; // as the backtest: HistDay has no net load

export type CallsReading =
  keyof BacktestResult["policies"][number]["calls_unanswerable_pct"];

// Clearlane minus the off-peak rule. Calls are percentage points of calls unanswerable (negative:
// Clearlane misses fewer); null where the variant is solved without calls.
export interface Gap {
  usd_per_mw_day: number;
  co2_t_per_mw_day: number;
  calls_unanswerable_pct_points: number | null;
}

export interface SensCtx {
  hist: HistDay[];
  site: Site;
  wear_usd_mwh: number;
  seed: number;
  by_hour: number[];
  by_weekday: number[];
  start_mt?: string;
  end_mt?: string;
}

export interface SiteChange {
  rte?: number;
  ceiling_slack_kw?: number;
  enrolled_kw?: number;
  export_limit_kw?: number;
  spin_recharge_min?: number;
}

export function siteWith(site: Site, c: SiteChange): Site {
  return {
    ...site,
    host_ceiling_kw: site.host_ceiling_kw + (c.ceiling_slack_kw ?? 0),
    export_limit_kw:
      c.export_limit_kw === undefined
        ? site.export_limit_kw
        : { ...site.export_limit_kw, value: c.export_limit_kw },
    station: {
      ...site.station,
      rte:
        c.rte === undefined
          ? site.station.rte
          : { ...site.station.rte, value: c.rte },
      enrolled_kw: c.enrolled_kw ?? site.station.enrolled_kw,
      spin_recharge_min: c.spin_recharge_min ?? site.station.spin_recharge_min,
    },
  };
}

export function gapOf(
  r: BacktestResult,
  reading: CallsReading = "heatmap_as_mt",
): Gap {
  const c = r.policies.find((p) => p.policy === "clearlane")!;
  const f = r.policies.find((p) => p.policy === "fixed_overnight")!;
  return {
    usd_per_mw_day: c.usd_per_mw_day.mean - f.usd_per_mw_day.mean,
    co2_t_per_mw_day: c.co2_t_per_mw_day.mean - f.co2_t_per_mw_day.mean,
    calls_unanswerable_pct_points:
      c.calls_unanswerable_pct[reading] - f.calls_unanswerable_pct[reading],
  };
}

export function runBase(
  ctx: SensCtx,
  site = ctx.site,
  W = ctx.wear_usd_mwh,
): BacktestRun {
  return runBacktest(ctx.hist, site, {
    wear_usd_mwh: W,
    seed: ctx.seed,
    by_hour: ctx.by_hour,
    by_weekday: ctx.by_weekday,
    start_mt: ctx.start_mt,
    end_mt: ctx.end_mt,
  });
}

// The whole backtest, calls included, for one variant.
export const backtestGap = (
  ctx: SensCtx,
  site: Site,
  W: number,
  reading: CallsReading = "heatmap_as_mt",
): Gap => gapOf(runBase(ctx, site, W).result, reading);

// A DP policy solved on `levels + 1` Pulse SoC states. Levels must be a multiple of 40 so the grids
// nest and the 25 kWh floor stays on a level; 40 reproduces solve() exactly.
export function solveAtLevels(
  b: ReturnType<typeof histBundle>,
  site: Site,
  policy: Policy,
  o: SolveOpts,
  levels: number,
): Plan {
  if (policy === "fixed_overnight") return solve(b, site, policy, o);
  if (levels % PULSE_LEVELS !== 0)
    throw new Error(`levels must be a multiple of ${PULSE_LEVELS}`);
  const t0 = performance.now();
  const clear = policy === "clearlane";
  const W = clear ? (o.wear_usd_mwh ?? DEFAULT_WEAR_USD_MWH) : 0;
  const spinSoc = clear ? site.station.spin_kwh : 0;
  const zeros = () => Array<number>(INTERVALS).fill(0);
  const limits = stepLimits(site, {
    ceiling: clear,
    sch: clear ? schFlags(b, o.sch_mode) : null,
    spin_avail_kw: Array<number>(INTERVALS).fill(spinAvailKw(site, spinSoc)),
    other_load_kw: zeros(),
  });
  const floor = DP_FLOOR_LEVEL * (levels / PULSE_LEVELS);
  const r = solveDp({
    price: hold4(prices(b)),
    levels,
    dz: site.station.pulse_kwh / levels,
    eta: eta(site),
    charge_max: limits.charge_kw.map((kw) => kw * STEP_H),
    discharge_max: limits.discharge_kw.map((kw) => kw * STEP_H),
    W,
    soc_min: 0,
    start_level: floor,
    end_level: floor,
    to_mwh: 1 / 1000,
  });
  const s: Schedule = {
    pulse_kw: r.acts.map((g) => -g / STEP_H),
    pulse_soc_kwh: r.socs.slice(1),
    spin_kw: zeros(),
    spin_soc_kwh: Array<number>(INTERVALS).fill(spinSoc),
    spin_start_kwh: spinSoc,
  };
  return buildPlan(b, site, s, {
    policy,
    wear_usd_mwh: W,
    solve_ms: performance.now() - t0,
    sch_mode: o.sch_mode,
  });
}

// Every hour's price moved toward (k < 1) or away from (k > 1) the day's mean: the daily spread
// scales by k. k = 1 is the day itself.
export function scalePrices(d: HistDay, k: number): HistDay {
  if (k === 1) return d;
  const m = mean(d.lmp_usd_mwh);
  return { ...d, lmp_usd_mwh: d.lmp_usd_mwh.map((p) => m + k * (p - m)) };
}

const windowOf = (ctx: SensCtx) => {
  const byDay = new Map(ctx.hist.map((d) => [d.operating_day_mt, d]));
  return windowDays(
    ctx.start_mt ?? BACKTEST_WINDOW.start_mt,
    ctx.end_mt ?? BACKTEST_WINDOW.end_mt,
  )
    .map((d) => byDay.get(d))
    .filter(usableDay);
};

// The $ and CO2 gaps from day-ahead plans only (no calls), computed exactly as the backtest does.
export function valueGap(
  ctx: SensCtx,
  site: Site,
  W: number,
  o: { levels?: number; price_scale?: number },
): { usd_per_mw_day: number; co2_t_per_mw_day: number } {
  const usd: Record<"c" | "f", number[]> = { c: [], f: [] };
  const co2: Record<"c" | "f", number[]> = { c: [], f: [] };
  const opts = { wear_usd_mwh: W, sch_mode: SCH_MODE };
  for (const h of windowOf(ctx)) {
    const b = histBundle(scalePrices(h, o.price_scale ?? 1));
    const plans = {
      f: solve(b, site, "fixed_overnight", opts),
      c:
        o.levels === undefined
          ? solve(b, site, "clearlane", opts)
          : solveAtLevels(b, site, "clearlane", opts, o.levels),
    };
    for (const k of ["c", "f"] as const) {
      usd[k].push(plans[k].value_usd_per_mw_day);
      if (co2Usable(h, plans[k]))
        co2[k].push(
          plans[k].co2_avoided_kg / 1000 / (site.station.pulse_kw / 1000),
        );
    }
  }
  return {
    usd_per_mw_day: mean(usd.c) - mean(usd.f),
    co2_t_per_mw_day: mean(co2.c) - mean(co2.f),
  };
}

export interface BreakEven {
  found: boolean;
  value: number | null;
  scanned: { x: number; gap_usd_per_mw_day: number }[];
  min_gap: { x: number; gap_usd_per_mw_day: number };
}

// Scans f over xs and bisects the first sign change to `tol` in x. No sign change: not found.
export function findBreakEven(
  f: (x: number) => number,
  xs: number[],
  tol: number,
): BreakEven {
  const scanned = xs.map((x) => ({ x, gap_usd_per_mw_day: f(x) }));
  const min_gap = scanned.reduce((a, s) =>
    Math.abs(s.gap_usd_per_mw_day) < Math.abs(a.gap_usd_per_mw_day) ? s : a,
  );
  for (let i = 0; i < scanned.length; i++) {
    const a = scanned[i]!;
    if (a.gap_usd_per_mw_day === 0)
      return { found: true, value: a.x, scanned, min_gap };
    const b = scanned[i + 1];
    if (
      !b ||
      Math.sign(a.gap_usd_per_mw_day) === Math.sign(b.gap_usd_per_mw_day)
    )
      continue;
    if (b.gap_usd_per_mw_day === 0)
      return { found: true, value: b.x, scanned, min_gap };
    let lo = a.x;
    let hi = b.x;
    const sLo = Math.sign(a.gap_usd_per_mw_day);
    while (hi - lo > tol) {
      const mid = (lo + hi) / 2;
      if (Math.sign(f(mid)) === sLo) lo = mid;
      else hi = mid;
    }
    return { found: true, value: (lo + hi) / 2, scanned, min_gap };
  }
  return { found: false, value: null, scanned, min_gap };
}

export interface AxisSpec {
  key: string;
  label: string;
  unit: string;
  kind: "site" | "wear" | "reading" | "grid" | "pending";
  change?: keyof SiteChange;
  base?: number | string;
  low?: number | string;
  high?: number | string;
  points?: (number | string)[];
  range_note: string;
  pending_on?: string;
}

export type AxisResult =
  | {
      key: string;
      label: string;
      status: "pending";
      pending_on: string;
      note: string;
    }
  | {
      key: string;
      label: string;
      status: "ok";
      unit: string;
      base: number | string;
      low: number | string;
      high: number | string;
      resolved_usd_mwh?: { base: number; low: number; high: number };
      range_prov: "ASSUMPTION";
      range_note: string;
      gap_base: Gap;
      gap_low: Gap;
      gap_high: Gap;
      delta_low: Gap;
      delta_high: Gap;
      points?: { value: number | string; gap: Gap; delta: Gap }[];
    };

// The issue's axes, in its order. Ranges are our choices (ASSUMPTION).
export const AXES: AxisSpec[] = [
  {
    key: "rte",
    label: "Round-trip efficiency",
    unit: "fraction",
    kind: "site",
    change: "rte",
    base: 0.88,
    low: 0.8,
    high: 0.92,
    range_note: "0.80 to 0.92 around the 0.88 reference station",
  },
  {
    key: "wear_usd_mwh",
    label: "Wear price",
    unit: "multiple of the calibrated wear price",
    kind: "wear",
    base: 1,
    low: 0.5,
    high: 2,
    range_note: "half to double the calibrated wear price",
  },
  {
    key: "host_ceiling_slack_kw",
    label: "Host ceiling slack above the day's own peak",
    unit: "kW",
    kind: "site",
    change: "ceiling_slack_kw",
    base: 0,
    low: 0,
    high: 160,
    range_note:
      "0 to 160 kW (20% of the 800 kW host peak): the month-to-date peak can sit above today's; it cannot sit below",
  },
  {
    key: "host_load_archetype",
    label: "Host load archetype",
    unit: "archetype",
    kind: "pending",
    pending_on: "fleet roll-up #66 (closed as not planned)",
    range_note: "needs the fleet roll-up's three host archetypes",
  },
  {
    key: "enrolled_kw",
    label: "Enrolled kW",
    unit: "kW",
    kind: "site",
    change: "enrolled_kw",
    base: 250,
    low: 125,
    high: 375,
    range_note:
      "half to one and a half times the 250 kW enrolled; calls ask for the enrolled kW",
  },
  {
    key: "export_limit_kw",
    label: "Export limit",
    unit: "kW",
    kind: "site",
    change: "export_limit_kw",
    base: 0,
    low: 0,
    high: 250,
    range_note: "no export to Pulse's full 250 kW",
  },
  {
    key: "spin_refill_min",
    label: "Spin refill time from empty",
    unit: "minutes",
    kind: "site",
    change: "spin_recharge_min",
    base: 6,
    low: 6,
    high: 12,
    range_note:
      "6 minutes (the published 12-minute discharge and recharge less a 6-minute discharge) vs the whole 12 minutes",
  },
  {
    key: "heatmap_reading",
    label: "Heatmap reading (calls only)",
    unit: "reading",
    kind: "reading",
    base: "heatmap_as_mt",
    low: "heatmap_as_utc",
    high: "heatmap_as_utc_mst",
    points: ["heatmap_as_mt", "heatmap_as_utc", "heatmap_as_utc_mst"],
    range_note:
      "Mountain time is the stage reading (Torus confirmed); the two UTC readings are a sensitivity check only, not for stage",
  },
  {
    key: "co2_basis",
    label: "CO2 basis: EIA average vs marginal estimate",
    unit: "basis",
    kind: "pending",
    pending_on:
      "response tables #47 (public/data/response_tables.json is not on main)",
    range_note: "needs the response_tables marginal estimate and its interval",
  },
  {
    key: "dp_soc_states",
    label: "DP Pulse SoC grid",
    unit: "states",
    kind: "grid",
    base: 41,
    low: 41,
    high: 161,
    points: [41, 81, 161],
    range_note:
      "41 states (the engine's grid), 81 and 161: nested grids, solved without calls; the re-plan after a call stays on 41",
  },
];

const ZERO_CALLS = (g: Gap, base: Gap): Gap => ({
  usd_per_mw_day: g.usd_per_mw_day - base.usd_per_mw_day,
  co2_t_per_mw_day: g.co2_t_per_mw_day - base.co2_t_per_mw_day,
  calls_unanswerable_pct_points:
    g.calls_unanswerable_pct_points === null ||
    base.calls_unanswerable_pct_points === null
      ? null
      : g.calls_unanswerable_pct_points - base.calls_unanswerable_pct_points,
});

// One axis at its low, base and high (and any extra points). `base` is the base run when the caller
// already has it.
export function runAxis(
  ctx: SensCtx,
  spec: AxisSpec,
  base?: BacktestResult,
): AxisResult {
  if (spec.kind === "pending")
    return {
      key: spec.key,
      label: spec.label,
      status: "pending",
      pending_on: spec.pending_on!,
      note: `Not run: ${spec.range_note}.`,
    };
  const baseResult = () => (base ??= runBase(ctx).result);
  // the variant itself, always rerun: a variant at its base value must reproduce the base exactly
  const gapAt = (v: number | string): Gap => {
    switch (spec.kind) {
      case "site":
        return backtestGap(
          ctx,
          siteWith(ctx.site, { [spec.change!]: v }),
          ctx.wear_usd_mwh,
        );
      case "wear":
        return backtestGap(ctx, ctx.site, ctx.wear_usd_mwh * (v as number));
      case "reading":
        return gapOf(baseResult(), v as CallsReading);
      default: // grid
        return {
          ...valueGap(ctx, ctx.site, ctx.wear_usd_mwh, {
            levels: (v as number) - 1,
          }),
          calls_unanswerable_pct_points: null,
        };
    }
  };
  // the base: the base run, except on the grid axis, which has no calls (41 states, same path)
  const gBase = spec.kind === "grid" ? gapAt(spec.base!) : gapOf(baseResult());
  const gLow = gapAt(spec.low!);
  const gHigh = gapAt(spec.high!);
  const points = spec.points?.map((value) => {
    const gap =
      value === spec.base
        ? gBase
        : value === spec.low
          ? gLow
          : value === spec.high
            ? gHigh
            : gapAt(value);
    return { value, gap, delta: ZERO_CALLS(gap, gBase) };
  });
  return {
    key: spec.key,
    label: spec.label,
    status: "ok",
    unit: spec.unit,
    base: spec.base!,
    low: spec.low!,
    high: spec.high!,
    ...(spec.kind === "wear"
      ? {
          resolved_usd_mwh: {
            base: ctx.wear_usd_mwh * (spec.base as number),
            low: ctx.wear_usd_mwh * (spec.low as number),
            high: ctx.wear_usd_mwh * (spec.high as number),
          },
        }
      : {}),
    range_prov: "ASSUMPTION",
    range_note: spec.range_note,
    gap_base: gBase,
    gap_low: gLow,
    gap_high: gHigh,
    delta_low: ZERO_CALLS(gLow, gBase),
    delta_high: ZERO_CALLS(gHigh, gBase),
    ...(points ? { points } : {}),
  };
}

export interface Sensitivity {
  schema: "clearlane.sensitivity/v1";
  flag: "ff_sensitivity";
  prov: "DERIVED";
  window: { start_mt: string; end_mt: string; days: number };
  wear_usd_mwh: number;
  seed: number;
  metric: string;
  base: { gap: Gap; source: string };
  axes: AxisResult[];
  break_even: {
    rte: BreakEven & { statement: string };
    daily_spread: BreakEven & {
      base_mean_daily_spread_usd_mwh: number;
      value_spread_usd_mwh: number | null;
      statement: string;
    };
    wear_usd_mwh: BreakEven & { statement: string };
    by_day_spread: {
      days: number;
      rule_ties_or_wins: number;
      bands: {
        from_usd_mwh: number;
        to_usd_mwh: number | null;
        days: number;
        rule_ties_or_wins: number;
      }[];
      statement: string;
    };
  };
  two_way: {
    rte: number[];
    price_scale: number[];
    mean_daily_spread_usd_mwh: number[];
    usd_gap: number[][]; // [rte][price_scale], Clearlane minus the rule, $/MW-day
  };
  notes: string[];
}

const usd = (x: number) => `$${x.toFixed(2)}`;
const steps = (from: number, to: number, n: number) =>
  Array.from({ length: n + 1 }, (_, i) =>
    Number((from + ((to - from) * i) / n).toFixed(10)),
  );

export function buildSensitivity(
  ctx: SensCtx,
  base: BacktestRun,
  sources: { backtest: string },
): Sensitivity {
  const gBase = gapOf(base.result);
  const span = base.result["window"];
  const axes = AXES.map((a) => runAxis(ctx, a, base.result));
  const days = windowOf(ctx);
  const meanSpread = mean(
    days.map((d) => Math.max(...d.lmp_usd_mwh) - Math.min(...d.lmp_usd_mwh)),
  );

  const rteGap = (rte: number, k = 1) =>
    valueGap(ctx, siteWith(ctx.site, { rte }), ctx.wear_usd_mwh, {
      price_scale: k,
    }).usd_per_mw_day;
  const rteBe = findBreakEven((x) => rteGap(x), steps(0.5, 0.99, 7), 1e-4);
  const spreadBe = findBreakEven(
    (k) =>
      valueGap(ctx, ctx.site, ctx.wear_usd_mwh, { price_scale: k })
        .usd_per_mw_day,
    steps(0, 2, 20),
    1e-4,
  );
  const wearBe = findBreakEven(
    (w) => valueGap(ctx, ctx.site, w, {}).usd_per_mw_day,
    [ctx.wear_usd_mwh, 20, 40, 60, 100, 150, 200, 300],
    0.01,
  );
  const lo = (b: BreakEven) => `${usd(b.min_gap.gap_usd_per_mw_day)}/MW-day`;

  // By day: where the rule ties or beats Clearlane, against the day's spread (DERIVED, backtest_days.json)
  const spreadOf = new Map(
    days.map((d) => [
      d.operating_day_mt,
      Math.max(...d.lmp_usd_mwh) - Math.min(...d.lmp_usd_mwh),
    ]),
  );
  const clear = base.days.filter((r) => r.policy === "clearlane");
  const edges: [number, number | null][] = [
    [0, 15],
    [15, 25],
    [25, 50],
    [50, null],
  ];
  const bands = edges.map(([from, to]) => {
    const inBand = clear.filter((r) => {
      const s = spreadOf.get(r.operating_day_mt)!;
      return s >= from && (to === null || s < to);
    });
    return {
      from_usd_mwh: from,
      to_usd_mwh: to,
      days: inBand.length,
      rule_ties_or_wins: inBand.filter((r) => !r.beats_fixed_overnight).length,
    };
  });
  const ties = clear.filter((r) => !r.beats_fixed_overnight);
  const tiesLow = ties.filter(
    (r) => spreadOf.get(r.operating_day_mt)! < 25,
  ).length;

  const rteAxis = [0.8, 0.84, 0.88, 0.92];
  const scaleAxis = [0.25, 0.5, 0.75, 1, 1.25, 1.5];
  return {
    schema: "clearlane.sensitivity/v1",
    flag: "ff_sensitivity",
    prov: "DERIVED",
    window: {
      start_mt: span.start_mt,
      end_mt: span.end_mt,
      days: span.days,
    },
    wear_usd_mwh: ctx.wear_usd_mwh,
    seed: ctx.seed,
    metric:
      "Clearlane minus the off-peak rule over the backtest days: mean $/MW-day (gross of wear), mean t CO2/MW-day (average emissions) and percentage points of calls unanswerable (heatmap in Mountain time; negative means Clearlane misses fewer).",
    base: { gap: gBase, source: sources.backtest },
    axes,
    break_even: {
      rte: {
        ...rteBe,
        statement: rteBe.found
          ? `Clearlane equals the off-peak rule at a round-trip efficiency of ${rteBe.value!.toFixed(3)}.`
          : `No break-even: Clearlane stays above the off-peak rule at every round-trip efficiency from 0.50 to 0.99. The narrowest gap is ${lo(rteBe)} at ${rteBe.min_gap.x.toFixed(2)}.`,
      },
      daily_spread: {
        ...spreadBe,
        base_mean_daily_spread_usd_mwh: meanSpread,
        value_spread_usd_mwh: spreadBe.found
          ? spreadBe.value! * meanSpread
          : null,
        statement: spreadBe.found
          ? `Clearlane equals the off-peak rule when every day's price spread is scaled by ${spreadBe.value!.toFixed(3)}, a mean daily spread of ${usd(spreadBe.value! * meanSpread)}/MWh.`
          : `No break-even: with every day's spread scaled from 0 to 2 times (mean daily spread $0 to ${usd(2 * meanSpread)}/MWh), Clearlane stays above the off-peak rule. At flat prices the rule still pays its round-trip losses while Clearlane sits idle. The narrowest gap is ${lo(spreadBe)} at ${spreadBe.min_gap.x.toFixed(2)} times today's spreads.`,
      },
      wear_usd_mwh: {
        ...wearBe,
        statement: wearBe.found
          ? `Clearlane's gross value falls to the off-peak rule's only at a wear price of ${usd(wearBe.value!)}/MWh, ${(wearBe.value! / ctx.wear_usd_mwh).toFixed(1)} times the calibrated ${usd(ctx.wear_usd_mwh)}.`
          : `No break-even for wear prices from ${usd(ctx.wear_usd_mwh)} to $300/MWh.`,
      },
      by_day_spread: {
        days: clear.length,
        rule_ties_or_wins: ties.length,
        bands,
        statement: `Day by day, the off-peak rule ties or beats Clearlane on ${ties.length} of ${clear.length} backtest days; ${tiesLow} of them have a daily price spread under $25/MWh.`,
      },
    },
    two_way: {
      rte: rteAxis,
      price_scale: scaleAxis,
      mean_daily_spread_usd_mwh: scaleAxis.map((k) => k * meanSpread),
      usd_gap: rteAxis.map((r) => scaleAxis.map((k) => rteGap(r, k))),
    },
    notes: [
      "Each input moves one at a time with the others at base; the ranges are our choices (ASSUMPTION). One-at-a-time ranges ignore interactions, hence the RTE x spread grid.",
      "Variants with calls rerun the whole backtest: the same SIMULATED calls (same seed), each policy's day-ahead plan and Clearlane's re-plans.",
      "Break-evens, the two-way grid and the DP SoC grid use day-ahead plans only (no calls), which is exactly how the backtest's $ and CO2 are computed.",
      "The heatmap reading moves only the calls column. Mountain time is the stage reading; the UTC readings are a sensitivity check only.",
      "Two axes wait on work that has not landed: the host load archetype (fleet roll-up) and the CO2 basis (response tables).",
    ],
  };
}
