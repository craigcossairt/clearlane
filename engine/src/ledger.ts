// Call ledger (ff_call_ledger): the 2025 heatmap's 359 calls replayed on the backtest days under the
// Mountain and UTC readings. Every call is SIMULATED; its hour and weekday labels equal the published
// counts exactly. Each policy meets each call the way the backtest meets its sampled calls.
import type {
  CrashEvent,
  HistDay,
  Plan,
  Policy,
  Site,
} from "@contracts/types";
import { isoUtc } from "./bundle";
import {
  BACKTEST_WINDOW,
  DELIVERED_FLOOR_PCT,
  POLICIES,
  clearlaneCalls,
  histBundle,
  usableDay,
  windowDays,
} from "./backtest";
import { simulateCall } from "./crash";
import type { CallResult } from "./crash";
import { dayStartMs, mountainOffsetH, weekdayIndex } from "./events";
import type { Reading } from "./events";
import { CALL_DURATION_S, RAMP_S } from "./inputs";
import { solve } from "./policies";
import { mulberry32 } from "./rng";

// Torus confirmed the heatmap is Mountain time (FACTS heatmap_readings): "mt" is the stage reading and
// "utc" (6-hour MDT shift) is kept as a sensitivity check only, never shown on stage.
export const LEDGER_READINGS: Reading[] = ["mt", "utc"];
export const SHORTFALL_TOL_KWH = 1e-6; // below this a call counts as fully served (float noise)
const SCH_MODE = "price_proxy" as const; // as the backtest: HistDay has no net load
const DAYS_2025 = 365;

export interface LedgerCallOpts {
  seed: number;
  by_hour: number[]; // 24 counts, index 0 = 12am label
  by_weekday: number[]; // Mon..Sun
  requested_kw: number;
  duration_s?: number;
}

export type LedgerCall = CrashEvent & {
  operating_day_mt: string;
  heatmap_hour: number; // label on the reading's clock
  heatmap_weekday: number; // Mon = 0, on the reading's clock
};

export interface LedgerRow {
  call_id: string;
  reading: Reading;
  operating_day_mt: string;
  heatmap_hour: number;
  heatmap_weekday: number;
  start_utc: string;
  requested_kw: number;
  ramp_s: number;
  policy: Policy;
  delivered_pct: number;
  spin_kwh: number;
  pulse_kwh: number;
  shortfall_kwh: number;
  refill_source: "grid" | "pulse";
  prov: "SIMULATED";
}

export interface LedgerSummary {
  reading: Reading;
  for_stage: boolean; // false: a sensitivity check only
  policy: Policy;
  calls: number;
  delivered_at_or_above_90_pct_share: number; // percent of calls
  unanswerable_calls: number; // delivered below 90%
  shortfall_calls: number; // any shortfall at all
  shortfall_kwh: number;
}

export interface LedgerReading {
  reading: Reading;
  for_stage: boolean; // false: a sensitivity check only
  label: string;
  calls: number;
  days_with_calls: number;
  max_calls_one_day: number;
  calls_inside_prior_refill_window: number; // started before the station's Spin was full again
}

export interface CallLedger {
  schema: "clearlane.call_ledger/v1";
  flag: "ff_call_ledger";
  prov: "SIMULATED";
  seed: number;
  wear_usd_mwh: number;
  window: {
    start_mt: string;
    end_mt: string;
    days: number;
    missing_days: string[];
  };
  replay_density: {
    calls_per_reading: number;
    backtest_days: number;
    calls_per_day: number;
    rate_2025_per_day: number;
    ratio_to_2025_rate: number;
    statement: string;
  };
  inputs: Record<string, { value?: unknown; prov: string; source: string }>;
  notes: string[];
  per_reading: LedgerReading[];
  summary: LedgerSummary[];
  rows: LedgerRow[];
}

export interface LedgerOpts {
  seed: number;
  wear_usd_mwh: number;
  by_hour: number[];
  by_weekday: number[];
  sources: { hist: string; torus: string };
  start_mt?: string;
  end_mt?: string;
}

const READING_LABEL: Record<Reading, string> = {
  mt: "heatmap in Mountain time, as Torus confirmed: the stage reading",
  utc: "heatmap read as UTC (Mountain hour h takes the label for h + 6 under MDT): a sensitivity check only, not for stage",
  utc_mst: "heatmap read as UTC shifted at UTC-7: a sensitivity check only, not for stage",
};

const sum = (xs: number[]) => xs.reduce((a, x) => a + x, 0);

// Hours the reading's clock runs ahead of Mountain time on a Mountain day.
const aheadH = (day: string, reading: Reading) =>
  reading === "mt" ? 0 : reading === "utc" ? mountainOffsetH(day) : 7;

// Weekday label (Mon = 0) of label hour `hour` placed on Mountain day `day`: the label falls on the
// next calendar day when the reading's clock has already passed midnight.
const labelWeekday = (day: string, hour: number, reading: Reading) =>
  (weekdayIndex(day) + (hour < aheadH(day, reading) ? 1 : 0)) % 7;

// Exactly sum(by_hour) calls whose labels on the reading's clock reproduce both arrays. The heatmap
// gives only the two totals, so hour labels are paired with shuffled weekday labels (seeded), and each
// pair goes on a random window day with that weekday, at a random minute. Sorted by start.
export function ledgerCalls(
  days: string[],
  reading: Reading,
  o: LedgerCallOpts,
): LedgerCall[] {
  const total = sum(o.by_hour);
  if (total !== sum(o.by_weekday))
    throw new Error(
      `by-hour and by-weekday totals differ: ${total} vs ${sum(o.by_weekday)}`,
    );
  const rng = mulberry32(o.seed);
  const hours = o.by_hour.flatMap((n, h) => new Array<number>(n).fill(h));
  const weekdays = o.by_weekday.flatMap((n, w) => new Array<number>(n).fill(w));
  for (let i = weekdays.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [weekdays[i], weekdays[j]] = [weekdays[j]!, weekdays[i]!];
  }
  const placed = hours.map((hour, k) => {
    const weekday = weekdays[k]!;
    const fits = days.filter((d) => labelWeekday(d, hour, reading) === weekday);
    if (fits.length === 0)
      throw new Error(
        `no ${reading} day in the window has weekday ${weekday} at label hour ${hour}`,
      );
    const day = fits[Math.floor(rng() * fits.length)]!;
    const h = (hour - aheadH(day, reading) + 24) % 24;
    const minute = Math.floor(rng() * 60);
    return {
      day,
      hour,
      weekday,
      ms: dayStartMs(day) + (h * 60 + minute) * 60_000,
    };
  });
  placed.sort((a, b) => a.ms - b.ms);
  return placed.map((p, k) => ({
    id: `ledger-${reading}-${String(k + 1).padStart(3, "0")}`,
    start_utc: isoUtc(p.ms),
    duration_s: o.duration_s ?? CALL_DURATION_S,
    requested_kw: o.requested_kw,
    prov: "SIMULATED",
    operating_day_mt: p.day,
    heatmap_hour: p.hour,
    heatmap_weekday: p.weekday,
  }));
}

const fmt2 = (x: number) => x.toFixed(2);

export function buildLedger(
  hist: HistDay[],
  site: Site,
  o: LedgerOpts,
): CallLedger {
  const start = o.start_mt ?? BACKTEST_WINDOW.start_mt;
  const end = o.end_mt ?? BACKTEST_WINDOW.end_mt;
  const byDay = new Map(hist.map((d) => [d.operating_day_mt, d]));
  const all = windowDays(start, end);
  const days = all.filter((d) => usableDay(byDay.get(d)));
  const missing = all.filter((d) => !usableDay(byDay.get(d)));

  // day-ahead plans, solved once per day and shared by both readings
  const plans = new Map<string, Map<Policy, Plan>>();
  const dayPlans = (day: string) => {
    let m = plans.get(day);
    if (!m) {
      const b = histBundle(byDay.get(day)!);
      m = new Map(
        POLICIES.map((p) => [
          p,
          solve(b, site, p, {
            wear_usd_mwh: o.wear_usd_mwh,
            sch_mode: SCH_MODE,
          }),
        ]),
      );
      plans.set(day, m);
    }
    return m;
  };

  const rows: LedgerRow[] = [];
  const perReading: LedgerReading[] = [];
  const summary: LedgerSummary[] = [];
  for (const reading of LEDGER_READINGS) {
    const calls = ledgerCalls(days, reading, {
      seed: o.seed,
      by_hour: o.by_hour,
      by_weekday: o.by_weekday,
      requested_kw: site.station.enrolled_kw,
    });
    const groups = new Map<string, LedgerCall[]>();
    for (const c of calls)
      groups.set(c.operating_day_mt, [
        ...(groups.get(c.operating_day_mt) ?? []),
        c,
      ]);
    const results = new Map<string, Map<Policy, CallResult>>();
    let inside = 0;
    for (const [day, evs] of groups) {
      const dp = dayPlans(day);
      const b = histBundle(byDay.get(day)!);
      for (const p of POLICIES) {
        let outs: CallResult[];
        if (p === "clearlane") {
          const done = clearlaneCalls(dp.get(p)!, site, b, evs).outcomes;
          inside += done.filter(
            (_, k) =>
              k > 0 &&
              Date.parse(evs[k]!.start_utc) <
                Date.parse(done[k - 1]!.spin_full_again_utc),
          ).length;
          outs = done;
        } else {
          // baselines meet each call against their day-ahead plan, Spin-free and undrawn (generous)
          outs = evs.map((ev) => simulateCall(dp.get(p)!, site, ev));
        }
        evs.forEach((ev, k) => {
          const m = results.get(ev.id) ?? new Map<Policy, CallResult>();
          m.set(p, outs[k]!);
          results.set(ev.id, m);
        });
      }
    }
    for (const c of calls)
      for (const p of POLICIES) {
        const r = results.get(c.id)!.get(p)!;
        rows.push({
          call_id: c.id,
          reading,
          operating_day_mt: c.operating_day_mt,
          heatmap_hour: c.heatmap_hour,
          heatmap_weekday: c.heatmap_weekday,
          start_utc: c.start_utc,
          requested_kw: c.requested_kw,
          ramp_s: r.ramp_s,
          policy: p,
          delivered_pct: r.delivered_pct,
          spin_kwh: r.spin_kwh,
          pulse_kwh: r.pulse_kwh,
          shortfall_kwh: r.shortfall_kwh,
          refill_source: r.refill_source ?? "grid",
          prov: "SIMULATED",
        });
      }
    perReading.push({
      reading,
      for_stage: reading === "mt",
      label: READING_LABEL[reading],
      calls: calls.length,
      days_with_calls: groups.size,
      max_calls_one_day: Math.max(...[...groups.values()].map((g) => g.length)),
      calls_inside_prior_refill_window: inside,
    });
    for (const p of POLICIES) {
      const rs = rows.filter((r) => r.reading === reading && r.policy === p);
      const ok = rs.filter(
        (r) => r.delivered_pct >= DELIVERED_FLOOR_PCT,
      ).length;
      const short = rs.filter((r) => r.shortfall_kwh > SHORTFALL_TOL_KWH);
      summary.push({
        reading,
        for_stage: reading === "mt",
        policy: p,
        calls: rs.length,
        delivered_at_or_above_90_pct_share:
          rs.length === 0 ? 0 : (100 * ok) / rs.length,
        unanswerable_calls: rs.length - ok,
        shortfall_calls: short.length,
        shortfall_kwh: sum(short.map((r) => r.shortfall_kwh)),
      });
    }
  }

  const n = sum(o.by_hour);
  const perDay = days.length === 0 ? 0 : n / days.length;
  const rate2025 = n / DAYS_2025;
  const ratio = rate2025 === 0 ? 0 : perDay / rate2025;
  const times =
    Math.abs(ratio - 2) < 0.25 ? "roughly twice" : `${ratio.toFixed(1)} times`;
  return {
    schema: "clearlane.call_ledger/v1",
    flag: "ff_call_ledger",
    prov: "SIMULATED",
    seed: o.seed,
    wear_usd_mwh: o.wear_usd_mwh,
    window: {
      start_mt: start,
      end_mt: end,
      days: days.length,
      missing_days: missing,
    },
    replay_density: {
      calls_per_reading: n,
      backtest_days: days.length,
      calls_per_day: perDay,
      rate_2025_per_day: rate2025,
      ratio_to_2025_rate: ratio,
      statement:
        `${n} calls on ${days.length} backtest days is ${fmt2(perDay)} a day, ${times} the 2025 ` +
        `daily rate of ${fmt2(rate2025)} (${n} calls in ${DAYS_2025} days). This is a stress replay, not a forecast.`,
    },
    inputs: {
      heatmap_by_hour: {
        value: o.by_hour,
        prov: "TORUS_PUBLISHED",
        source: o.sources.torus,
      },
      heatmap_by_weekday: {
        value: o.by_weekday,
        prov: "TORUS_PUBLISHED",
        source: o.sources.torus,
      },
      ramp_s: {
        value: RAMP_S,
        prov: "TORUS_PUBLISHED",
        source: "engine/src/inputs.ts (rmp_event_ramp_s)",
      },
      call_duration_s: {
        value: CALL_DURATION_S,
        prov: "ASSUMPTION",
        source: "engine/src/inputs.ts (call_duration_s)",
      },
      requested_kw: {
        value: site.station.enrolled_kw,
        prov: "SIMULATED",
        source: "engine/src/site.ts (enrolled_kw)",
      },
      prices_and_co2: { prov: "REAL", source: o.sources.hist },
    },
    notes: [
      "Every row is a SIMULATED call, not an RMP event record. Placing the calls on 2026 backtest days is our choice, not data.",
      "Torus confirmed the 2025 heatmap is in Mountain time, so the Mountain reading is the stage value. The UTC reading (6-hour MDT shift) is a sensitivity check only and is never shown on stage.",
      "Each reading's hour and weekday labels equal the published by-hour and by-weekday counts exactly. The heatmap gives only those two totals, so each hour label is paired with a weekday label at random (seeded), and each call goes on a random backtest day with that weekday, at a random minute.",
      "Each policy meets the calls the way the backtest does: the simulated Torus-style station on Clearlane answers them in time order and re-plans after each; the two baselines meet each call against their day-ahead plan, without Spin (generous to them).",
      "Delivered below 90%, the floor of Torus's published band, is unanswerable. A shortfall is any undelivered energy at all.",
      "refill_source is grid: Spin refills from the grid under the host ceiling.",
      "A call that runs past midnight is simulated to the end of its Mountain day.",
    ],
    per_reading: perReading,
    summary,
    rows,
  };
}
