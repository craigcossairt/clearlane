// Moonshot rt-replay (ff_rt_replay): the day-ahead plan settled against real-time prices, three ways.
// Nothing in the six beats calls this module and no core module imports it.
//
// Settlement, per 15-minute interval: DA price x DA schedule + RT price x (actual - DA schedule).
// That EDAM structure is UNVERIFIED against CAISO's EDAM business practice manual. A behind-the-meter
// station is not itself a market participant, so every value is value to RMP's system at CAISO
// prices, never Torus revenue.
//
// The station is the clearlane policy on the simulated site (wear W, host ceiling, export limit,
// System Critical Hours by the price proxy because the history has no net load, Spin full). No RMP
// calls are replayed. All three policies share the DA schedule as the financial position:
// - hold: run the DA plan all day;
// - replan: at the top of every hour, re-solve the rest of the day from the actual SoC, with the DA
//   prices as the forecast and the last observed hour's mean RT minus DA gap carried over the next
//   hour (ASSUMPTION);
// - foresight: the plan solved on the day's RT prices; not achievable, the yardstick for regret.
// Regret is foresight minus the policy, net of wear: the objective all three DP plans maximize, so
// foresight is never below the other two.
import type { HistDay, Pctl, Provenance, Site } from "@contracts/types";
import { histBundle, usableDay, windowDays } from "./backtest";
import { HOURS, INTERVAL_S, INTERVALS, STEPS_PER_HOUR, isoUtc } from "./bundle";
import { checkPlan } from "./checkPlan";
import { dayStartMs } from "./events";
import {
  DP_FLOOR_LEVEL,
  eta,
  hold4,
  solveSiteDP,
  spinAvailKw,
  stepLimits,
} from "./limits";
import type { StepLimits } from "./limits";
import { buildPlan, schFlags } from "./plan";
import type { Schedule } from "./plan";
import { mean, pctl } from "./stats";

const STEP_H = INTERVAL_S / 3600;
const SCH_MODE = "price_proxy" as const;
const TOL_USD = 1e-6;

export const MIDDAY_HB = [9, 10, 11, 12, 13, 14, 15, 16]; // FACTS midday_avg: 9am to 5pm
export const EVENING_HB = [18, 19, 20, 21]; // FACTS evening_avg: 6pm to 10pm
export const GAP_CARRY_INTERVALS = STEPS_PER_HOUR; // the RT minus DA gap persists one hour (ASSUMPTION)

// public/data/rt_<start>_<end>.json (data lane, #46)
export interface RtDay {
  operating_day_mt: string;
  ts_utc: string[]; // 96 interval starts
  lmp_usd_mwh: (number | null)[]; // 96; null = missing, never filled
}

export interface RtHistory {
  schema: "clearlane.rt/v1";
  node: string;
  interval_min: number;
  days: RtDay[];
  missing?: unknown[];
  sources?: unknown[];
  notes?: string[];
}

export type ReplayPolicy = "hold" | "replan" | "foresight";
export const REPLAY_POLICIES: ReplayPolicy[] = ["hold", "replan", "foresight"];

export interface ReplayLeg {
  settled_usd: number; // DA x DA schedule + RT x (actual - DA schedule), gross of wear
  wear_usd: number; // W x grid-side discharged MWh
  net_usd: number; // settled - wear
  deviation_mwh: number; // sum of |actual - DA schedule| grid MWh
}

export interface ReplayDayResult {
  operating_day_mt: string;
  legs: Record<ReplayPolicy, ReplayLeg>;
  regret_usd: { hold: number; replan: number }; // foresight net minus the policy's net
  pulse_kw: Record<ReplayPolicy, number[]>; // executed, + charging at the meter
  rt_midday_usd_mwh: number;
  rt_evening_usd_mwh: number;
  da_midday_usd_mwh: number;
  da_evening_usd_mwh: number;
  rt_evening_below_midday: boolean;
  plans_checked: number; // 24 hourly re-plans plus the three executed plans
  violations: string[]; // checkPlan findings; empty when clean
  replan_ms: number[]; // MEASURED, one per hourly re-solve; never stored
}

// Grid kWh per interval: + delivered to the grid. Returns dollars.
export function settle(
  daPrice: number[],
  rtPrice: number[],
  daGridKwh: number[],
  actGridKwh: number[],
): number {
  let usd = 0;
  for (let t = 0; t < daPrice.length; t++) {
    usd +=
      (daPrice[t]! * daGridKwh[t]! +
        rtPrice[t]! * (actGridKwh[t]! - daGridKwh[t]!)) /
      1000;
  }
  return usd;
}

// Prices the re-plan at interval r sees for r..95: DA, plus the mean RT minus DA gap of the last
// observed hour over the next GAP_CARRY_INTERVALS.
export function replanForecast(
  da96: number[],
  rt96: number[],
  r: number,
): number[] {
  const fc = da96.slice(r);
  if (r === 0) return fc;
  const from = Math.max(0, r - STEPS_PER_HOUR);
  let gap = 0;
  for (let k = from; k < r; k++) gap += rt96[k]! - da96[k]!;
  gap /= r - from;
  for (let k = 0; k < GAP_CARRY_INTERVALS && k < fc.length; k++) fc[k]! += gap;
  return fc;
}

const zeros = () => Array<number>(INTERVALS).fill(0);

function schedule(site: Site, acts: number[], socs: number[]): Schedule {
  const spin = site.station.spin_kwh;
  return {
    pulse_kw: acts.map((g) => -g / STEP_H),
    pulse_soc_kwh: socs,
    spin_kw: zeros(),
    spin_soc_kwh: Array<number>(INTERVALS).fill(spin),
    spin_start_kwh: spin,
  };
}

const slice = (l: StepLimits, r: number): StepLimits => ({
  charge_kw: l.charge_kw.slice(r),
  discharge_kw: l.discharge_kw.slice(r),
  sch_cap_kw: l.sch_cap_kw.slice(r),
});

function leg(
  da96: number[],
  rt96: number[],
  gDa: number[],
  g: number[],
  W: number,
): ReplayLeg {
  let dis = 0;
  let dev = 0;
  for (let t = 0; t < g.length; t++) {
    if (g[t]! > 0) dis += g[t]!;
    dev += Math.abs(g[t]! - gDa[t]!);
  }
  const settled = settle(da96, rt96, gDa, g);
  const wear = (W * dis) / 1000;
  return {
    settled_usd: settled,
    wear_usd: wear,
    net_usd: settled - wear,
    deviation_mwh: dev / 1000,
  };
}

const windowMean = (p96: number[], hours: number[]) =>
  mean(
    hours.flatMap((h) =>
      p96.slice(h * STEPS_PER_HOUR, (h + 1) * STEPS_PER_HOUR),
    ),
  );

// One day, three policies. `rt` must be complete (96 finite values); see skipReason.
export function replayDay(
  da: HistDay,
  rt: RtDay,
  site: Site,
  opts: { wear_usd_mwh: number },
): ReplayDayResult {
  const W = opts.wear_usd_mwh;
  const b = histBundle(da);
  const da96 = hold4(da.lmp_usd_mwh);
  const rt96 = rt.lmp_usd_mwh.map((p) => p as number);
  // the clearlane limits, as in dpSchedule: Spin full, no refill load, SCH by the price proxy
  const limits = stepLimits(site, {
    ceiling: true,
    sch: schFlags(b, SCH_MODE),
    spin_avail_kw: Array<number>(INTERVALS).fill(
      spinAvailKw(site, site.station.spin_kwh),
    ),
    other_load_kw: zeros(),
  });
  const violations: string[] = [];
  let checked = 0;
  const check = (acts: number[], socs: number[], what: string, ms = 0) => {
    const plan = buildPlan(b, site, schedule(site, acts, socs), {
      policy: "clearlane",
      wear_usd_mwh: W,
      solve_ms: ms,
      sch_mode: SCH_MODE,
    });
    checked++;
    for (const v of checkPlan(plan, site)) violations.push(`${what}: ${v}`);
  };

  const hold = solveSiteDP(da96, site, { W, limits });
  const fore = solveSiteDP(rt96, site, { W, limits });
  if (!hold.feasible) violations.push("hold: no feasible day-ahead plan");
  if (!fore.feasible) violations.push("foresight: no feasible plan");

  const acts: number[] = [];
  const socs: number[] = [];
  const replan_ms: number[] = [];
  let level = DP_FLOOR_LEVEL;
  for (let h = 0; h < HOURS; h++) {
    const r = h * STEPS_PER_HOUR;
    const fc = replanForecast(da96, rt96, r);
    const t0 = performance.now();
    const res = solveSiteDP(fc, site, {
      W,
      limits: slice(limits, r),
      start_level: level,
      end_level: DP_FLOOR_LEVEL,
    });
    const ms = performance.now() - t0;
    replan_ms.push(ms);
    if (!res.feasible) violations.push(`re-plan at HB ${h}: no feasible plan`);
    // the plan as known at this hour: executed so far, then this re-plan
    check(
      [...acts, ...res.acts],
      [...socs, ...res.socs.slice(1)],
      `re-plan at HB ${h}`,
      ms,
    );
    for (let k = 0; k < STEPS_PER_HOUR; k++) {
      acts.push(res.acts[k]!);
      socs.push(res.socs[k + 1]!);
    }
    level = res.level_path[STEPS_PER_HOUR]!;
  }
  check(hold.acts, hold.socs.slice(1), "hold");
  check(acts, socs, "replan");
  check(fore.acts, fore.socs.slice(1), "foresight");

  const legs = {
    hold: leg(da96, rt96, hold.acts, hold.acts, W),
    replan: leg(da96, rt96, hold.acts, acts, W),
    foresight: leg(da96, rt96, hold.acts, fore.acts, W),
  };
  const kw = (g: number[]) => g.map((x) => -x / STEP_H);
  const rtMid = windowMean(rt96, MIDDAY_HB);
  const rtEve = windowMean(rt96, EVENING_HB);
  return {
    operating_day_mt: da.operating_day_mt,
    legs,
    regret_usd: {
      hold: legs.foresight.net_usd - legs.hold.net_usd,
      replan: legs.foresight.net_usd - legs.replan.net_usd,
    },
    pulse_kw: {
      hold: kw(hold.acts),
      replan: kw(acts),
      foresight: kw(fore.acts),
    },
    rt_midday_usd_mwh: rtMid,
    rt_evening_usd_mwh: rtEve,
    da_midday_usd_mwh: windowMean(da96, MIDDAY_HB),
    da_evening_usd_mwh: windowMean(da96, EVENING_HB),
    rt_evening_below_midday: rtEve < rtMid,
    plans_checked: checked,
    violations,
    replan_ms,
  };
}

// Why a day cannot be replayed, or null when it can. Missing data is listed, never filled.
export function skipReason(
  day: string,
  da: HistDay | undefined,
  rt: RtDay | undefined,
): string | null {
  if (!rt) return "no RT day in the RT file";
  if (!usableDay(da)) return "no usable DA day in the history file";
  const n = rt.lmp_usd_mwh.length;
  if (n !== INTERVALS || rt.ts_utc.length !== INTERVALS)
    return `RT has ${n} intervals, expected ${INTERVALS}`;
  const nulls = rt.lmp_usd_mwh.filter((p) => p === null).length;
  if (nulls > 0)
    return `${nulls} RT interval${nulls === 1 ? "" : "s"} missing (null); never filled`;
  if (!rt.lmp_usd_mwh.every((p) => Number.isFinite(p)))
    return "an RT price is not finite";
  const start = dayStartMs(day);
  if (rt.ts_utc.some((ts, i) => ts !== isoUtc(start + i * INTERVAL_S * 1000)))
    return "RT ts_utc does not match the Mountain day's 96 interval starts";
  return null;
}

type ByPolicy = Record<ReplayPolicy, number>;
type ByRegret = { hold: number; replan: number };

export interface RtReplayDay {
  operating_day_mt: string;
  settled_usd_per_mw_day: ByPolicy; // gross of wear
  net_usd_per_mw_day: ByPolicy; // after wear at W
  regret_usd_per_mw_day: ByRegret; // foresight net minus the policy's net
  deviation_mwh_per_mw: ByPolicy; // |actual - DA schedule|
  rt_midday_usd_mwh: number;
  rt_evening_usd_mwh: number;
  da_midday_usd_mwh: number;
  da_evening_usd_mwh: number;
  rt_evening_below_midday: boolean;
}

export interface RtReplay {
  schema: "clearlane.rt_replay/v1";
  flag: "ff_rt_replay";
  inputs: { rt: string; da: string };
  node: string;
  window: {
    start_mt: string;
    end_mt: string;
    days: number;
    skipped_days: { day: string; reason: string }[];
  };
  site_id: string;
  station: string;
  wear_usd_mwh: number;
  sch_mode: typeof SCH_MODE;
  settlement: {
    rule: string;
    prov: Provenance;
    status: "UNVERIFIED";
    note: string;
  };
  policies: Record<ReplayPolicy, string>;
  regret: string;
  windows_mt: { midday_hb: number[]; evening_hb: number[] };
  prov: {
    da_prices: Provenance;
    rt_prices: Provenance;
    site: Provenance;
    values: Provenance;
    forecast: Provenance;
  };
  summary: {
    days: number;
    settled_usd_per_mw_day: Record<ReplayPolicy, Pctl>;
    net_usd_per_mw_day: Record<ReplayPolicy, Pctl>;
    regret_usd_per_mw_day: { hold: Pctl; replan: Pctl };
    regret_sum_usd_per_mw: ByRegret;
    replan_recovers_pct: number | null; // share of hold's regret the hourly re-plans win back
    days_replan_above_hold: number;
    days_replan_below_hold: number;
    days_replan_equal_hold: number;
    rt_evening_below_midday_days: number;
    da_evening_below_midday_days: number;
  };
  measured: {
    prov: "MEASURED";
    stored: false;
    replans_per_day: number;
    replans: number;
    note: string;
  };
  days: RtReplayDay[];
}

export interface ReplayOpts {
  wear_usd_mwh: number;
  rt_path: string;
  da_path: string;
}

// The RT file's class: SIMULATED when its notes say so (the test fixtures), else REAL.
export const rtProv = (rt: RtHistory): Provenance =>
  (rt.notes ?? []).some((n) => n.includes("SIMULATED")) ? "SIMULATED" : "REAL";

export interface ReplayRun {
  result: RtReplay;
  replan_ms: number[]; // MEASURED, printed by the CLI, never stored
  violations: string[];
}

const byPolicy = (f: (p: ReplayPolicy) => number): ByPolicy => ({
  hold: f("hold"),
  replan: f("replan"),
  foresight: f("foresight"),
});

export function buildReplay(
  hist: HistDay[],
  rt: RtHistory,
  site: Site,
  opts: ReplayOpts,
): ReplayRun {
  const mw = site.station.pulse_kw / 1000;
  const rtByDay = new Map(rt.days.map((d) => [d.operating_day_mt, d]));
  const daByDay = new Map(hist.map((d) => [d.operating_day_mt, d]));
  const all = [...rtByDay.keys()].sort();
  const start = all[0] ?? "";
  const end = all[all.length - 1] ?? "";
  const skipped: { day: string; reason: string }[] = [];
  const rows: RtReplayDay[] = [];
  const replan_ms: number[] = [];
  const violations: string[] = [];
  for (const day of all.length ? windowDays(start, end) : []) {
    const da = daByDay.get(day);
    const r = rtByDay.get(day);
    const why = skipReason(day, da, r);
    if (why) {
      skipped.push({ day, reason: why });
      continue;
    }
    const x = replayDay(da!, r!, site, { wear_usd_mwh: opts.wear_usd_mwh });
    replan_ms.push(...x.replan_ms);
    violations.push(...x.violations.map((v) => `${day} ${v}`));
    rows.push({
      operating_day_mt: day,
      settled_usd_per_mw_day: byPolicy((p) => x.legs[p].settled_usd / mw),
      net_usd_per_mw_day: byPolicy((p) => x.legs[p].net_usd / mw),
      regret_usd_per_mw_day: {
        hold: x.regret_usd.hold / mw,
        replan: x.regret_usd.replan / mw,
      },
      deviation_mwh_per_mw: byPolicy((p) => x.legs[p].deviation_mwh / mw),
      rt_midday_usd_mwh: x.rt_midday_usd_mwh,
      rt_evening_usd_mwh: x.rt_evening_usd_mwh,
      da_midday_usd_mwh: x.da_midday_usd_mwh,
      da_evening_usd_mwh: x.da_evening_usd_mwh,
      rt_evening_below_midday: x.rt_evening_below_midday,
    });
  }
  const col = (f: (d: RtReplayDay) => number) => rows.map(f);
  const sum = (xs: number[]) => xs.reduce((a, x) => a + x, 0);
  const regretSum = {
    hold: sum(col((d) => d.regret_usd_per_mw_day.hold)),
    replan: sum(col((d) => d.regret_usd_per_mw_day.replan)),
  };
  const diff = col(
    (d) => d.net_usd_per_mw_day.replan - d.net_usd_per_mw_day.hold,
  );
  const result: RtReplay = {
    schema: "clearlane.rt_replay/v1",
    flag: "ff_rt_replay",
    inputs: { rt: opts.rt_path, da: opts.da_path },
    node: rt.node,
    window: {
      start_mt: start,
      end_mt: end,
      days: rows.length,
      skipped_days: skipped,
    },
    site_id: site.id,
    station:
      "Simulated Torus-style station on Clearlane: wear W, host ceiling, export limit, System Critical Hours by the price proxy (jam hours plus the 4 highest-price hours; the history has no net load), Spin full. No RMP calls are replayed.",
    wear_usd_mwh: opts.wear_usd_mwh,
    sch_mode: SCH_MODE,
    settlement: {
      rule: "DA price x DA schedule + RT price x (actual - DA schedule), per 15-minute interval",
      prov: "ASSUMPTION",
      status: "UNVERIFIED",
      note: "EDAM settlement structure UNVERIFIED against CAISO's EDAM business practice manual. A behind-the-meter station is not itself a market participant, so these are values to RMP's system at CAISO prices, not Torus revenue.",
    },
    policies: {
      hold: "Hold the day-ahead plan all day.",
      replan:
        "Re-plan at the top of every hour from the actual state of charge over the rest of the day. Forecast: day-ahead prices, with the last observed hour's mean RT minus DA gap carried over the next hour (ASSUMPTION).",
      foresight:
        "Perfect foresight: the plan solved on the day's real-time prices. Not achievable; it is the yardstick for regret.",
    },
    regret:
      "Regret is the foresight value minus the policy's value, net of wear at W: the objective all three plans maximize, so it is never below zero.",
    windows_mt: { midday_hb: MIDDAY_HB, evening_hb: EVENING_HB },
    prov: {
      da_prices: "REAL",
      rt_prices: rtProv(rt),
      site: "SIMULATED",
      values: "DERIVED",
      forecast: "ASSUMPTION",
    },
    summary: {
      days: rows.length,
      settled_usd_per_mw_day: {
        hold: pctl(col((d) => d.settled_usd_per_mw_day.hold)),
        replan: pctl(col((d) => d.settled_usd_per_mw_day.replan)),
        foresight: pctl(col((d) => d.settled_usd_per_mw_day.foresight)),
      },
      net_usd_per_mw_day: {
        hold: pctl(col((d) => d.net_usd_per_mw_day.hold)),
        replan: pctl(col((d) => d.net_usd_per_mw_day.replan)),
        foresight: pctl(col((d) => d.net_usd_per_mw_day.foresight)),
      },
      regret_usd_per_mw_day: {
        hold: pctl(col((d) => d.regret_usd_per_mw_day.hold)),
        replan: pctl(col((d) => d.regret_usd_per_mw_day.replan)),
      },
      regret_sum_usd_per_mw: regretSum,
      replan_recovers_pct:
        regretSum.hold > TOL_USD
          ? ((regretSum.hold - regretSum.replan) / regretSum.hold) * 100
          : null,
      days_replan_above_hold: diff.filter((x) => x > TOL_USD).length,
      days_replan_below_hold: diff.filter((x) => x < -TOL_USD).length,
      days_replan_equal_hold: diff.filter((x) => Math.abs(x) <= TOL_USD).length,
      rt_evening_below_midday_days: rows.filter(
        (d) => d.rt_evening_below_midday,
      ).length,
      da_evening_below_midday_days: rows.filter(
        (d) => d.da_evening_usd_mwh < d.da_midday_usd_mwh,
      ).length,
    },
    measured: {
      prov: "MEASURED",
      stored: false,
      replans_per_day: HOURS,
      replans: rows.length * HOURS,
      note: "Re-plan times are timed with performance.now() around each hourly re-solve and printed by engine/cli/replay.ts (median, p90, max). They are never written to this file.",
    },
    days: rows,
  };
  return { result, replan_ms, violations };
}

const DASHES = [String.fromCharCode(0x2014), String.fromCharCode(0x2013)];

// Errors in an rt_replay.json; empty when it is sound.
export function validateReplay(x: unknown): string[] {
  if (!x || typeof x !== "object" || Array.isArray(x)) return ["not an object"];
  const r = x as RtReplay;
  const e: string[] = [];
  if (r.schema !== "clearlane.rt_replay/v1")
    e.push(`schema is ${String(r.schema)}`);
  if (r.settlement?.status !== "UNVERIFIED")
    e.push("the EDAM settlement structure must be labeled UNVERIFIED");
  const text = JSON.stringify(x);
  if (DASHES.some((d) => text.includes(d))) e.push("contains an em or en dash");
  if (/_ms"\s*:/.test(text)) e.push("a MEASURED time is stored (a *_ms field)");
  if (!Array.isArray(r.days)) return [...e, "days is not an array"];
  r.days.forEach((d, k) => {
    const at = `day ${d?.operating_day_mt ?? k}`;
    if (k > 0 && !(d.operating_day_mt > r.days[k - 1]!.operating_day_mt))
      e.push(`${at}: days are not sorted and unique`);
    const nums = [
      ...Object.values(d.settled_usd_per_mw_day ?? {}),
      ...Object.values(d.net_usd_per_mw_day ?? {}),
      ...Object.values(d.regret_usd_per_mw_day ?? {}),
      d.rt_midday_usd_mwh,
      d.rt_evening_usd_mwh,
    ];
    if (nums.length !== 10 || !nums.every(Number.isFinite))
      e.push(`${at}: a value is missing or not finite`);
    const net = d.net_usd_per_mw_day;
    if (!net) return;
    for (const p of ["hold", "replan"] as const) {
      if (net.foresight < net[p] - TOL_USD)
        e.push(`${at}: foresight below ${p}`);
      if (
        Math.abs(d.regret_usd_per_mw_day[p] - (net.foresight - net[p])) >
        TOL_USD
      )
        e.push(`${at}: ${p} regret is not foresight minus ${p}`);
    }
    if (
      d.rt_evening_below_midday !==
      d.rt_evening_usd_mwh < d.rt_midday_usd_mwh
    )
      e.push(`${at}: rt_evening_below_midday disagrees with the window means`);
  });
  const s = r.summary;
  if (s?.days !== r.days.length || r.window?.days !== r.days.length)
    e.push(`summary and window days must equal the ${r.days.length} day rows`);
  if (
    s?.rt_evening_below_midday_days !==
    r.days.filter((d) => d.rt_evening_below_midday).length
  )
    e.push("rt_evening_below_midday_days does not match the day rows");
  return e;
}
