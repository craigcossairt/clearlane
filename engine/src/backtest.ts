// Backtest: every Mountain day since EDAM began, all three policies on the simulated site, with
// SIMULATED calls under every heatmap reading. SCH is the price proxy (HistDay has no net load).
import type {
  BacktestDay,
  BacktestResult,
  Bundle,
  CrashEvent,
  HistDay,
  Plan,
  Policy,
  PolicyStats,
  Site,
} from "@contracts/types";
import { HOURS, isoUtc } from "./bundle";
import { simulateCall } from "./crash";
import { dayStartMs, mountainOffsetH, READINGS, sampleCalls } from "./events";
import type { Reading } from "./events";
import { crash } from "./replan";
import type { CrashOutcome } from "./replan";
import { solve } from "./policies";
import { mean, pctl } from "./stats";

export const BACKTEST_WINDOW = { start_mt: "2026-05-01", end_mt: "2026-10-27" };
export const DEFAULT_SEED = 20261027;
export const DELIVERED_FLOOR_PCT = 90; // floor of Torus's published band: below it a call is unanswerable
export const POLICIES: Policy[] = [
  "fixed_overnight",
  "price_only",
  "clearlane",
];
const SCH_MODE = "price_proxy" as const;

export interface BacktestOpts {
  wear_usd_mwh: number;
  seed: number;
  by_hour: number[];
  by_weekday: number[];
  start_mt?: string;
  end_mt?: string;
}

// A BacktestDay whose CO2 is null when the day is left out of the CO2 statistics.
export type BacktestDayRow = Omit<BacktestDay, "co2_t_per_mw_day"> & {
  co2_t_per_mw_day: number | null;
};

export interface BacktestRun {
  result: BacktestResult;
  days: BacktestDayRow[];
  co2_excluded_days: Record<Policy, number>;
  solve_ms: number[]; // MEASURED, printed by the CLI, never stored
}

export function windowDays(start: string, end: string): string[] {
  const out: string[] = [];
  for (
    let t = Date.parse(`${start}T00:00:00Z`);
    t <= Date.parse(`${end}T00:00:00Z`);
    t += 86_400_000
  ) {
    out.push(isoUtc(t).slice(0, 10));
  }
  return out;
}

export const usableDay = (d: HistDay | undefined): d is HistDay =>
  d !== undefined &&
  d.lmp_usd_mwh.length === HOURS &&
  d.lmp_usd_mwh.every(Number.isFinite);

// A HistDay as a bundle: REAL prices and CO2 (null read as 0 here, masked by `co2Usable`), no net load.
export function histBundle(d: HistDay): Bundle {
  const start = dayStartMs(d.operating_day_mt);
  const off = mountainOffsetH(d.operating_day_mt);
  return {
    schema: "clearlane.bundle/v1",
    operating_day_mt: d.operating_day_mt,
    node: "ELAP_PACE-APND",
    data_mode: "snapshot",
    fetched_utc: isoUtc(start),
    hours: d.lmp_usd_mwh.map((lmp, h) => ({
      ts_utc: isoUtc(start + h * 3_600_000),
      local_mt: `${d.operating_day_mt}T${String(h).padStart(2, "0")}:00-0${off}:00`,
      hour_mt: h,
      lmp_usd_mwh: lmp,
      mcc_usd_mwh: 0,
      load_fcst_mw: 0,
      solar_fcst_mw: 0,
      wind_fcst_mw: 0,
      net_load_mw: 0,
      co2_g_kwh: d.co2_g_kwh[h] ?? 0,
      co2_kind: "eia_observed_avg",
      prov: {
        lmp: "REAL",
        load: "REAL",
        solar: "REAL",
        wind: "REAL",
        co2: "REAL",
      },
    })),
    peers: [],
    sources: [],
    notes: ["backtest day built from HistDay; SCH is the price proxy"],
  };
}

// False when the plan trades in an hour whose CO2 is null.
export function co2Usable(d: HistDay, plan: Plan): boolean {
  return plan.intervals.every(
    (iv) =>
      Math.abs(iv.pulse_kw) < 1e-9 ||
      d.co2_g_kwh[Math.floor(iv.i / 4)] !== null,
  );
}

const breaches = (plan: Plan, site: Site) =>
  plan.intervals.filter((iv) => iv.meter_kw > site.host_ceiling_kw + 1e-6)
    .length;

// Clearlane answers the day's calls in time order and re-plans after each. A call that starts while
// Spin is still refilling from the previous one is met with that call as its prior, against the plan
// the previous call saw. Returns the delivered percentages and the executed plan.
function clearlaneCalls(
  da: Plan,
  site: Site,
  b: Bundle,
  events: CrashEvent[],
): { delivered: number[]; executed: Plan } {
  let plan = da;
  let last: { result: CrashOutcome; start: string; plan: Plan } | null = null;
  const delivered: number[] = [];
  for (const ev of events) {
    const prior: { result: CrashOutcome; plan: Plan } | null =
      last !== null &&
      Date.parse(ev.start_utc) <
        Date.parse(last.start) + last.result.trace.length * 1000
        ? last
        : null;
    const base: Plan = prior ? prior.plan : plan;
    const out = crash(base, site, b, ev, prior?.result, { sch_mode: SCH_MODE });
    delivered.push(out.delivered_pct);
    last = { result: out, start: ev.start_utc, plan: base };
    plan = out.replan;
  }
  return { delivered, executed: plan };
}

export function runBacktest(
  hist: HistDay[],
  site: Site,
  o: BacktestOpts,
): BacktestRun {
  const start = o.start_mt ?? BACKTEST_WINDOW.start_mt;
  const end = o.end_mt ?? BACKTEST_WINDOW.end_mt;
  const byDay = new Map(hist.map((d) => [d.operating_day_mt, d]));
  const all = windowDays(start, end);
  const days = all.filter((d) => usableDay(byDay.get(d)));
  const missing = all.filter((d) => !usableDay(byDay.get(d)));

  const callsByReading = new Map<Reading, Map<string, CrashEvent[]>>();
  for (const reading of READINGS) {
    const m = new Map<string, CrashEvent[]>();
    for (const ev of sampleCalls(days, {
      seed: o.seed,
      reading,
      by_hour: o.by_hour,
      by_weekday: o.by_weekday,
      requested_kw: site.station.enrolled_kw,
    })) {
      const d = ev.id.slice(0, 10);
      m.set(d, [...(m.get(d) ?? []), ev]);
    }
    callsByReading.set(reading, m);
  }

  const rows: BacktestDayRow[] = [];
  const solveMs: number[] = [];
  const calls = new Map<Policy, Record<Reading, { n: number; miss: number }>>(
    POLICIES.map((p) => [
      p,
      {
        mt: { n: 0, miss: 0 },
        utc: { n: 0, miss: 0 },
        utc_mst: { n: 0, miss: 0 },
      },
    ]),
  );
  const co2Excluded = { fixed_overnight: 0, price_only: 0, clearlane: 0 };

  for (const day of days) {
    const h = byDay.get(day)!;
    const b = histBundle(h);
    const plans = new Map<Policy, Plan>();
    for (const p of POLICIES) {
      const plan = solve(b, site, p, {
        wear_usd_mwh: o.wear_usd_mwh,
        sch_mode: SCH_MODE,
      });
      solveMs.push(plan.solve_ms);
      plans.set(p, plan);
    }
    let clearExecuted = plans.get("clearlane")!;
    for (const reading of READINGS) {
      const evs = callsByReading.get(reading)!.get(day) ?? [];
      if (evs.length === 0) continue;
      for (const p of POLICIES) {
        const da = plans.get(p)!;
        let delivered: number[];
        if (p === "clearlane") {
          const r = clearlaneCalls(da, site, b, evs);
          delivered = r.delivered;
          if (reading === "mt") clearExecuted = r.executed;
        } else {
          // baselines meet each call against their day-ahead plan, Spin-free and undrawn (generous)
          delivered = evs.map((ev) => simulateCall(da, site, ev).delivered_pct);
        }
        const c = calls.get(p)![reading];
        c.n += delivered.length;
        c.miss += delivered.filter((x) => x < DELIVERED_FLOOR_PCT).length;
      }
    }
    const fixedUsd = plans.get("fixed_overnight")!.value_usd_per_mw_day;
    for (const p of POLICIES) {
      const plan = plans.get(p)!;
      const ok = co2Usable(h, plan);
      if (!ok) co2Excluded[p]++;
      rows.push({
        operating_day_mt: day,
        policy: p,
        usd_per_mw_day: plan.value_usd_per_mw_day,
        co2_t_per_mw_day: ok
          ? plan.co2_avoided_kg / 1000 / (site.station.pulse_kw / 1000)
          : null,
        pulse_cycles: plan.pulse_cycles,
        host_ceiling_breaches: breaches(
          p === "clearlane" ? clearExecuted : plan,
          site,
        ),
        beats_fixed_overnight: plan.value_usd_per_mw_day > fixedUsd,
      });
    }
  }

  const pct = (c: { n: number; miss: number }) =>
    c.n === 0 ? 0 : (100 * c.miss) / c.n;
  const policies: PolicyStats[] = POLICIES.map((p) => {
    const rs = rows.filter((r) => r.policy === p);
    const c = calls.get(p)!;
    return {
      policy: p,
      usd_per_mw_day: pctl(rs.map((r) => r.usd_per_mw_day)),
      co2_t_per_mw_day: pctl(
        rs.flatMap((r) =>
          r.co2_t_per_mw_day === null ? [] : [r.co2_t_per_mw_day],
        ),
      ),
      pulse_cycles_per_yr: mean(rs.map((r) => r.pulse_cycles)) * 365,
      calls_unanswerable_pct: {
        heatmap_as_mt: pct(c.mt),
        heatmap_as_utc: pct(c.utc),
        heatmap_as_utc_mst: pct(c.utc_mst),
      },
      host_ceiling_breaches: rs.reduce(
        (a, r) => a + r.host_ceiling_breaches,
        0,
      ),
      days_beating_fixed_overnight_pct:
        rs.length === 0
          ? 0
          : (100 * rs.filter((r) => r.beats_fixed_overnight).length) /
            rs.length,
    };
  });

  return {
    result: {
      schema: "clearlane.backtest/v1",
      window: {
        start_mt: start,
        end_mt: end,
        days: days.length,
        missing_days: missing,
      },
      wear_usd_mwh: o.wear_usd_mwh,
      seed: o.seed,
      policies,
    },
    days: rows,
    co2_excluded_days: co2Excluded,
    solve_ms: solveMs,
  };
}

// Clearlane's full-equivalent Pulse cycles a year from day-ahead plans only (no calls): the
// quantity the wear calibration bounds.
export function clearlaneCyclesPerYr(
  hist: HistDay[],
  site: Site,
  wear: number,
  span = BACKTEST_WINDOW,
): number {
  const byDay = new Map(hist.map((d) => [d.operating_day_mt, d]));
  const cycles = windowDays(span.start_mt, span.end_mt)
    .map((d) => byDay.get(d))
    .filter(usableDay)
    .map(
      (d) =>
        solve(histBundle(d), site, "clearlane", {
          wear_usd_mwh: wear,
          sch_mode: SCH_MODE,
        }).pulse_cycles,
    );
  return mean(cycles) * 365;
}

export function validateBacktest(x: unknown): string[] {
  const e: string[] = [];
  const r = x as BacktestResult;
  if (!r || typeof r !== "object") return ["not an object"];
  if (r.schema !== "clearlane.backtest/v1")
    e.push(`schema is ${String(r.schema)}`);
  const w = r.window;
  if (!w || typeof w.start_mt !== "string" || typeof w.end_mt !== "string")
    e.push("window start_mt and end_mt must be strings");
  else {
    const md = w.missing_days;
    if (!Array.isArray(md)) e.push("missing_days must be an array");
    else if (md.some((d, i) => i > 0 && md[i - 1]! >= d))
      e.push("missing_days must be sorted and unique");
    if (!Number.isInteger(w.days) || w.days < 0)
      e.push("days must be a non-negative integer");
  }
  for (const k of ["wear_usd_mwh", "seed"] as const)
    if (!Number.isFinite(r[k])) e.push(`${k} must be finite`);
  const ps = Array.isArray(r.policies) ? r.policies : [];
  const names = ps.map((p) => p.policy).sort();
  if (names.join() !== [...POLICIES].sort().join())
    e.push(`policies must be ${POLICIES.join(", ")} once each`);
  for (const p of ps) {
    const nums: [string, unknown][] = [
      ...Object.entries(p.usd_per_mw_day ?? {}).map(
        ([k, v]) => [`usd_per_mw_day.${k}`, v] as [string, unknown],
      ),
      ...Object.entries(p.co2_t_per_mw_day ?? {}).map(
        ([k, v]) => [`co2_t_per_mw_day.${k}`, v] as [string, unknown],
      ),
      ...Object.entries(p.calls_unanswerable_pct ?? {}).map(
        ([k, v]) => [`calls_unanswerable_pct.${k}`, v] as [string, unknown],
      ),
      ["pulse_cycles_per_yr", p.pulse_cycles_per_yr],
      ["host_ceiling_breaches", p.host_ceiling_breaches],
      ["days_beating_fixed_overnight_pct", p.days_beating_fixed_overnight_pct],
    ];
    if (nums.length !== 4 + 4 + 3 + 3)
      e.push(`${p.policy}: missing statistics`);
    for (const [k, v] of nums)
      if (typeof v !== "number" || !Number.isFinite(v))
        e.push(`${p.policy}: ${k} is not finite`);
  }
  return e;
}
