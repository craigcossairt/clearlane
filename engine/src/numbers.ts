// Every stage number as a StageNumber: FACTS key, value, display, provenance, source and day.
// MEASURED values (solve_ms, replan_ms) are never built here.
import type {
  BacktestResult,
  Bundle,
  HistDay,
  Policy,
  Provenance,
  Site,
  StageNumber,
  TorusPublished,
} from "@contracts/types";
import { POLICIES } from "./backtest";
import { scriptedCalls } from "./crash";
import { hourLabel, num, pct, times, usd } from "./format";
import {
  callShare,
  dpHourly,
  hourlyUnanswerable,
  snapshotHour,
} from "./hourly";
import { laneThresholds, lanes, systemCriticalHours } from "./lanes";
import { NEW_KEYS } from "./newKeys";
import { solve } from "./policies";
import { option2Shift, referenceRace, scaleUsdPerDay } from "./reference";
import { crash } from "./replan";
import { mean, percentile } from "./stats";

export const PROVENANCES: Provenance[] = [
  "REAL",
  "DERIVED",
  "SIMULATED",
  "TORUS_PUBLISHED",
  "ASSUMPTION",
  "MEASURED",
];
// A multi-valued FACTS row splits into keys with these suffixes (at most two, e.g. _clearlane_mt).
export const SUFFIXES = [
  "_mt",
  "_utc_mdt",
  "_utc_mst",
  "_fixed_overnight",
  "_price_only",
  "_clearlane",
  "_4pm",
  "_6pm",
  "_n",
];
export const FIXPY_AS_OF = "2026-10-27";
const READING_SUFFIX = ["_mt", "_utc_mdt", "_utc_mst"] as const;
const SHIFTS = [0, 6, 7]; // heatmap read as MT, as UTC under MDT, as UTC under MST

// Key -> provenance class from the FACTS key column (first row with a valid class wins).
export function factsRegistry(md: string): Map<string, Provenance> {
  const out = new Map<string, Provenance>();
  for (const line of md.split(/\r?\n/)) {
    if (!line.startsWith("| ")) continue;
    const cells = line.split("|").map((c) => c.trim());
    const key = cells[1] ?? "";
    const cls = cells[4] as Provenance;
    if (
      /^[a-z][a-z0-9_]*$/.test(key) &&
      PROVENANCES.includes(cls) &&
      !out.has(key)
    )
      out.set(key, cls);
  }
  return out;
}

export function registryWithNewKeys(
  facts: Map<string, Provenance>,
): Map<string, Provenance> {
  const r = new Map(facts);
  for (const [k, v] of Object.entries(NEW_KEYS))
    if (!r.has(k)) r.set(k, v.prov);
  return r;
}

// The registry key a numbers.json key belongs to: itself, or itself less one or two suffixes.
export function baseKey(
  key: string,
  reg: Map<string, Provenance>,
): string | null {
  if (reg.has(key)) return key;
  for (const s1 of SUFFIXES) {
    if (!key.endsWith(s1)) continue;
    const k1 = key.slice(0, -s1.length);
    if (reg.has(k1)) return k1;
    for (const s2 of SUFFIXES) {
      if (k1.endsWith(s2) && reg.has(k1.slice(0, -s2.length)))
        return k1.slice(0, -s2.length);
    }
  }
  return null;
}

// "da_lmp_elap_pace" from the research snapshot CSV, in file order (HB 1 of the day to HB 0 of the next).
export function snapshotPricesFromCsv(text: string): number[] {
  const [head, ...lines] = text.trim().split(/\r?\n/);
  const col = head!.split(",").indexOf("da_lmp_elap_pace");
  if (col < 0) throw new Error("snapshot CSV has no da_lmp_elap_pace column");
  return lines.map((l) => Number(l.split(",")[col]));
}

// Each day's largest upward hour-to-hour step (ties go to the earlier hour): the hour it lands in, and its size.
export function largestStep(p: number[]): { hour: number; usd: number } {
  let best = 0;
  for (let i = 1; i < p.length - 1; i++)
    if (p[i + 1]! - p[i]! > p[best + 1]! - p[best]!) best = i;
  return { hour: best + 1, usd: p[best + 1]! - p[best]! };
}

export function stepHourDays(days: number[][], hours = [17, 18]) {
  const steps = days.filter((p) => p.length === 24).map(largestStep);
  return {
    days: steps.filter((s) => hours.includes(s.hour)).length,
    n: steps.length,
    median_usd: percentile(
      steps.map((s) => s.usd),
      0.5,
    ),
  };
}

export interface NumberInputs {
  bundle: Bundle;
  bundle_path: string;
  site: Site;
  wear_usd_mwh: number;
  snapshot?: { prices: number[]; path: string };
  torus?: { data: TorusPublished; path: string };
  backtest?: { data: BacktestResult; path: string };
  hist?: { data: HistDay[]; path: string };
}

type Draft = Omit<StageNumber, "prov"> & { prov?: Provenance };

export function buildNumbers(
  inp: NumberInputs,
  reg: Map<string, Provenance>,
): StageNumber[] {
  const b = inp.bundle;
  const day = b.operating_day_mt;
  const site = inp.site;
  const out: Draft[] = [];
  const add = (
    key: string,
    value: number,
    unit: string,
    display: string,
    source: string,
    as_of_mt = day,
  ) => out.push({ key, value, unit, display, source, as_of_mt });
  const src = (mod: string, file: string) => `engine/src/${mod}.ts + ${file}`;

  // Stage day, from the bundle
  const bsrc = src("numbers", inp.bundle_path);
  const p = b.hours.map((h) => h.lmp_usd_mwh);
  const hourMean = (xs: number[], a: number, z: number) =>
    mean(xs.slice(a, z + 1));
  const lo = Math.min(...p);
  const hi = Math.max(...p);
  add("price_min_oct27", lo, "$/MWh", usd(lo), bsrc);
  add("peak_price", hi, "$/MWh", usd(hi), bsrc);
  // a ratio over a zero or negative trough means nothing: leave the key out
  if (lo > 0) add("peak_over_trough", hi / lo, "x", times(hi / lo), bsrc);
  add(
    "peak_hour_mt",
    p.indexOf(hi),
    "hour beginning MT",
    hourLabel(p.indexOf(hi)),
    bsrc,
  );
  add(
    "trough_hour_mt",
    p.indexOf(lo),
    "hour beginning MT",
    hourLabel(p.indexOf(lo)),
    bsrc,
  );
  add(
    "overnight_avg",
    hourMean(p, 1, 5),
    "$/MWh",
    usd(hourMean(p, 1, 5)),
    bsrc,
  );
  add("midday_avg", hourMean(p, 9, 16), "$/MWh", usd(hourMean(p, 9, 16)), bsrc);
  add(
    "evening_avg",
    hourMean(p, 18, 21),
    "$/MWh",
    usd(hourMean(p, 18, 21)),
    bsrc,
  );
  const t = laneThresholds(p);
  const lsrc = src("lanes", inp.bundle_path);
  add(
    "lane_clear_max_usd",
    t.clear_max_usd,
    "$/MWh",
    usd(t.clear_max_usd),
    lsrc,
  );
  add("lane_jam_min_usd", t.jam_min_usd, "$/MWh", usd(t.jam_min_usd), lsrc);
  const ls = lanes(b);
  const count = (lane: string) => ls.filter((l) => l === lane).length;
  add("lane_hours_oct27_clear", count("clear"), "h", num(count("clear")), lsrc);
  add("lane_hours_oct27_jam", count("jam"), "h", num(count("jam")), lsrc);
  const solar = (h: number) => b.hours[h]!.solar_fcst_mw;
  add("solar_4pm_to_6pm_mw_4pm", solar(16), "MW", num(solar(16)), bsrc);
  add("solar_4pm_to_6pm_mw_6pm", solar(18), "MW", num(solar(18)), bsrc);
  const nl = b.hours.map((h) => h.net_load_mw);
  const climb = nl[18]! - nl[15]!; // HB 3pm to HB 6pm
  add("net_load_climb_mw", climb, "MW", num(climb), bsrc);
  add("net_load_max_oct27", Math.max(...nl), "MW", num(Math.max(...nl)), bsrc);
  const load = Math.max(...b.hours.map((h) => h.load_fcst_mw));
  add("load_peak_oct27_mw", load, "MW", num(load), bsrc);

  // Reference race (habit.py), fleet scale and CO2
  const rsrc = src("reference", inp.bundle_path);
  const race = referenceRace(b);
  const f = race.fixed;
  const tt = race.timetable;
  add(
    "fixed_usd_mw_day",
    f.usd_per_mw_day,
    "$/MW-day",
    usd(f.usd_per_mw_day),
    rsrc,
  );
  add(
    "clearlane_usd_mw_day",
    tt.usd_per_mw_day,
    "$/MW-day",
    usd(tt.usd_per_mw_day),
    rsrc,
  );
  add("race_ratio", race.ratio, "x", times(race.ratio), rsrc);
  for (const mw of [70, 500]) {
    const fu = scaleUsdPerDay(f.usd_per_mw_day, mw);
    const cu = scaleUsdPerDay(tt.usd_per_mw_day, mw);
    add(`fixed_${mw}`, fu, "$/day", usd(fu, 0), rsrc);
    add(`clearlane_${mw}`, cu, "$/day", usd(cu, 0), rsrc);
  }
  add(
    "fixed_rule_charge_usd_mwh",
    f.charge_mean_usd_mwh,
    "$/MWh",
    usd(f.charge_mean_usd_mwh),
    rsrc,
  );
  add(
    "timetable_charge_usd_mwh",
    tt.charge_mean_usd_mwh,
    "$/MWh",
    usd(tt.charge_mean_usd_mwh),
    rsrc,
  );
  add(
    "race_discharge_usd_mwh",
    f.discharge_mean_usd_mwh,
    "$/MWh",
    usd(f.discharge_mean_usd_mwh),
    rsrc,
  );
  const ci = (hs: number[]) => mean(hs.map((h) => b.hours[h]!.co2_g_kwh));
  add(
    "charge_co2_race_fixed_overnight",
    ci(f.charge_hb),
    "g/kWh",
    num(ci(f.charge_hb)),
    rsrc,
  );
  add(
    "charge_co2_race_clearlane",
    ci(tt.charge_hb),
    "g/kWh",
    num(ci(tt.charge_hb)),
    rsrc,
  );
  add(
    "discharge_co2_race",
    ci(f.discharge_hb),
    "g/kWh",
    num(ci(f.discharge_hb)),
    rsrc,
  );
  add(
    "co2_fixed_t_per_mw_day",
    f.co2_t_per_mw_day,
    "t/MW-day (+ avoided)",
    num(f.co2_t_per_mw_day, 2),
    rsrc,
  );
  add(
    "co2_timetable_t_per_mw_day",
    tt.co2_t_per_mw_day,
    "t/MW-day (+ avoided)",
    num(tt.co2_t_per_mw_day, 2),
    rsrc,
  );
  add(
    "co2_added_70",
    -f.co2_t_per_mw_day * 70,
    "t/day added",
    num(-f.co2_t_per_mw_day * 70, 1),
    rsrc,
  );
  add(
    "co2_avoided_70",
    tt.co2_t_per_mw_day * 70,
    "t/day avoided",
    num(tt.co2_t_per_mw_day * 70, 1),
    rsrc,
  );
  add(
    "co2_500_fixed_overnight",
    -f.co2_t_per_mw_day * 500,
    "t/day added",
    num(-f.co2_t_per_mw_day * 500, 1),
    rsrc,
  );
  add(
    "co2_500_clearlane",
    tt.co2_t_per_mw_day * 500,
    "t/day avoided",
    num(tt.co2_t_per_mw_day * 500, 1),
    rsrc,
  );

  // Option 2: a SIMULATED flexible campus
  const o2 = option2Shift(b);
  add("campus_usd", o2.usd, "$/day", usd(o2.usd, 0), rsrc);
  add("campus_mwh", o2.mwh, "MWh", num(o2.mwh), rsrc);

  // The 15-minute site plan and the scripted calls
  const psrc = src("policies", inp.bundle_path);
  const plan = solve(b, site, "clearlane", { wear_usd_mwh: inp.wear_usd_mwh });
  add(
    "clearlane_dp_usd_mw_day",
    plan.value_usd_per_mw_day,
    "$/MW-day",
    usd(plan.value_usd_per_mw_day),
    psrc,
  );
  const dpRatio = plan.value_usd_per_mw_day / f.usd_per_mw_day;
  add("dp_race_ratio", dpRatio, "x", times(dpRatio), psrc);
  add(
    "cycles_today",
    plan.pulse_cycles,
    "cycles",
    num(plan.pulse_cycles, 2),
    psrc,
  );
  add(
    "enrolled_kw",
    site.station.enrolled_kw,
    "kW",
    num(site.station.enrolled_kw),
    src("site", inp.bundle_path),
  );
  add(
    "host_ceiling_kw",
    site.host_ceiling_kw,
    "kW",
    num(site.host_ceiling_kw),
    src("site", inp.bundle_path),
  );
  const sch = systemCriticalHours(b);
  add(
    "sch_hours_today",
    sch.hours.length,
    "h",
    num(sch.hours.length),
    src("lanes", inp.bundle_path),
  );
  const csrc = src("replan", inp.bundle_path);
  const [c1, c2] = scriptedCalls(b, site);
  const first = crash(plan, site, b, c1);
  const second = crash(plan, site, b, c2, first);
  add(
    "meter_peak_refill_kw",
    first.meter_peak_during_refill_kw,
    "kW",
    num(first.meter_peak_during_refill_kw),
    csrc,
  );
  const shortKw = (second.shortfall_kwh * 3600) / c2.duration_s;
  add(
    "second_call_shortfall_kw",
    shortKw,
    "kW (mean over the call)",
    num(shortKw),
    csrc,
  );
  add(
    "second_call_shortfall_kwh",
    second.shortfall_kwh,
    "kWh",
    num(second.shortfall_kwh, 1),
    csrc,
  );
  add(
    "second_call_delivered_pct",
    second.delivered_pct,
    "%",
    pct(second.delivered_pct),
    csrc,
  );
  add(
    "call_duration_s",
    c1.duration_s,
    "s",
    num(c1.duration_s),
    src("crash", inp.bundle_path),
  );

  // fix.py reproductions on the snapshot's order (as of 2026-10-27)
  if (inp.snapshot) {
    const ssrc = src("hourly", inp.snapshot.path);
    const snap = inp.snapshot.prices;
    const w0 = dpHourly(snap, { W: 0 });
    const w10 = dpHourly(snap, { W: 10 });
    const res = dpHourly(snap, { W: 10, soc_min: 0.1, dis_cap: 0.75 });
    const cost = ((w10.gross - res.gross) / w10.gross) * 100;
    add(
      "price_only_usd_mw_day",
      w0.objective,
      "$/MW-day",
      usd(w0.objective),
      ssrc,
      FIXPY_AS_OF,
    );
    add(
      "wear10_usd_mw_day",
      w10.gross,
      "$/MW-day",
      usd(w10.gross),
      ssrc,
      FIXPY_AS_OF,
    );
    add(
      "battery_only_reserve_usd",
      res.gross,
      "$/MW-day",
      usd(res.gross),
      ssrc,
      FIXPY_AS_OF,
    );
    add("reserve_cost_pct", cost, "%", pct(cost, 1), ssrc, FIXPY_AS_OF);
    if (inp.torus) {
      const byHour = inp.torus.data.events_2025_by_hour.value;
      const total = byHour.reduce((a, x) => a + x, 0);
      for (const [key, r] of [
        ["calls_unanswerable_price_only", w0],
        ["calls_unanswerable_wear10", w10],
      ] as const) {
        const bad = hourlyUnanswerable(r.socs, r.acts).map(snapshotHour);
        SHIFTS.forEach((s, k) => {
          const share = (callShare(bad, byHour, s) / total) * 100;
          add(
            `${key}${READING_SUFFIX[k]}`,
            share,
            "% of 2025 calls",
            pct(share),
            `${ssrc} + ${inp.torus!.path}`,
            FIXPY_AS_OF,
          );
        });
      }
    }
  }

  // Torus-published facts, sourced to their URLs
  if (inp.torus) {
    const tp = inp.torus.data;
    const url = (id: string) =>
      tp.sources?.find((s) => s.id === id)?.url ?? inp.torus!.path;
    const tag = (
      key: string,
      v: { value: number; source_id: string },
      unit: string,
      display: string,
    ) => add(key, v.value, unit, display, url(v.source_id));
    tag(
      "rmp_events_2025",
      tp.events_2025_total,
      "events",
      num(tp.events_2025_total.value),
    );
    tag("rmp_event_ramp_s", tp.ramp_s, "s", num(tp.ramp_s.value));
    tag(
      "rmp_event_ramp_target_s",
      tp.ramp_target_s,
      "s",
      num(tp.ramp_target_s.value),
    );
    tag(
      "rmp_event_target_pct",
      tp.delivered_pct,
      "%",
      pct(tp.delivered_pct.value),
    );
    const band = tp.delivered_band_pct;
    add(
      "rmp_event_band_min_pct",
      band.value[0],
      "%",
      pct(band.value[0]),
      url(band.source_id),
    );
    add(
      "rmp_event_band_max_pct",
      band.value[1],
      "%",
      pct(band.value[1]),
      url(band.source_id),
    );
    tag("mou_70mw", tp.mou_mw, "MW", num(tp.mou_mw.value));
    tag("torus_500mw", tp.mou_ceiling_mw, "MW", num(tp.mou_ceiling_mw.value));
    tag(
      "torus_pulse_cycles",
      tp.pulse_cycle_life,
      "cycles",
      num(tp.pulse_cycle_life.value),
    );
    tag(
      "torus_spin_cycles",
      tp.spin_cycle_life,
      "cycles",
      num(tp.spin_cycle_life.value),
    );
    const budget = tp.pulse_cycle_life.value / tp.pulse_life_yr.value;
    add(
      "pulse_cycle_budget",
      budget,
      "cycles/yr",
      num(budget),
      `${url(tp.pulse_cycle_life.source_id)} + ${url(tp.pulse_life_yr.source_id)}`,
    );
    const kwhPerKw = 1 / tp.spin_c_rate.value;
    add(
      "spin_kwh_per_kw",
      kwhPerKw,
      "kWh/kW",
      num(kwhPerKw, 1),
      url(tp.spin_c_rate.source_id),
    );
    const recharge = tp.spin_discharge_recharge_min.value / 2;
    add(
      "spin_recharge_min",
      recharge,
      "min",
      num(recharge),
      url(tp.spin_discharge_recharge_min.source_id),
    );
  }

  // Backtest (as of the window end)
  if (inp.backtest) {
    const bt = inp.backtest.data;
    const bsrc2 = `engine/src/backtest.ts + ${inp.backtest.path}`;
    const { window: span } = bt;
    const end = span.end_mt;
    const stat = (pol: Policy) => bt.policies.find((x) => x.policy === pol)!;
    const cl = stat("clearlane");
    add(
      "share_days_beating",
      cl.days_beating_fixed_overnight_pct,
      "% of days",
      pct(cl.days_beating_fixed_overnight_pct),
      bsrc2,
      end,
    );
    for (const q of ["p10", "p50", "p90"] as const)
      add(
        `clearlane_${q}`,
        cl.usd_per_mw_day[q],
        "$/MW-day",
        usd(cl.usd_per_mw_day[q]),
        bsrc2,
        end,
      );
    add("backtest_days", span.days, "days", num(span.days), bsrc2, end);
    add(
      "wear_usd_mwh",
      bt.wear_usd_mwh,
      "$/MWh",
      usd(bt.wear_usd_mwh),
      bsrc2,
      end,
    );
    const readings = [
      "heatmap_as_mt",
      "heatmap_as_utc",
      "heatmap_as_utc_mst",
    ] as const;
    for (const pol of POLICIES) {
      const s = stat(pol);
      add(
        `cycles_per_year_by_policy_${pol}`,
        s.pulse_cycles_per_yr,
        "cycles/yr",
        num(s.pulse_cycles_per_yr),
        bsrc2,
        end,
      );
      readings.forEach((r, k) =>
        add(
          `calls_missed_by_policy_${pol}${READING_SUFFIX[k]}`,
          s.calls_unanswerable_pct[r],
          "% of calls",
          pct(s.calls_unanswerable_pct[r]),
          bsrc2,
          end,
        ),
      );
    }
    readings.forEach((r, k) => {
      const v = 100 - cl.calls_unanswerable_pct[r];
      add(
        `calls_answered_pct${READING_SUFFIX[k]}`,
        v,
        "% of calls",
        pct(v),
        bsrc2,
        end,
      );
    });
  }

  // History: where each October day's largest price step lands
  if (inp.hist) {
    const oct = inp.hist.data.filter(
      (d) =>
        d.operating_day_mt >= "2026-10-01" &&
        d.operating_day_mt <= "2026-10-27",
    );
    const s = stepHourDays(oct.map((d) => d.lmp_usd_mwh));
    const hsrc = src("numbers", inp.hist.path);
    // no full October day: no median to take, so the keys are left out like a missing input
    if (s.n > 0) {
      add(
        "oct_step_hour_days",
        s.days,
        "days",
        `${num(s.days)} of ${num(s.n)}`,
        hsrc,
        "2026-10-27",
      );
      add("oct_step_hour_days_n", s.n, "days", num(s.n), hsrc, "2026-10-27");
      add(
        "oct_step_median_usd",
        s.median_usd,
        "$/MWh",
        usd(s.median_usd, 1),
        hsrc,
        "2026-10-27",
      );
    }
  }

  return out
    .map((d) => {
      const base = baseKey(d.key, reg);
      if (base === null)
        throw new Error(`key ${d.key} is not in FACTS or newKeys.ts`);
      return {
        key: d.key,
        value: d.value,
        unit: d.unit,
        display: d.display,
        prov: reg.get(base)!,
        source: d.source,
        as_of_mt: d.as_of_mt,
      };
    })
    .sort((a, z) => (a.key < z.key ? -1 : a.key > z.key ? 1 : 0));
}

const DASHES = [String.fromCharCode(0x2014), String.fromCharCode(0x2013)];

export function validateNumbers(
  x: unknown,
  reg: Map<string, Provenance>,
): string[] {
  if (!Array.isArray(x)) return ["numbers.json must be an array"];
  const e: string[] = [];
  const seen = new Set<string>();
  x.forEach((n: StageNumber, i) => {
    const k = n?.key;
    if (typeof k !== "string") {
      e.push(`row ${i}: key is not a string`);
      return;
    }
    if (seen.has(k)) e.push(`${k}: duplicate key`);
    seen.add(k);
    if (i > 0 && (x[i - 1] as StageNumber).key >= k)
      e.push(`${k}: not sorted by key`);
    const base = baseKey(k, reg);
    if (base === null) e.push(`${k}: not in FACTS or newKeys.ts`);
    if (typeof n.value !== "number" || !Number.isFinite(n.value))
      e.push(`${k}: value is not finite`);
    if (!PROVENANCES.includes(n.prov))
      e.push(`${k}: bad prov ${String(n.prov)}`);
    if (n.prov === "MEASURED") e.push(`${k}: MEASURED values are never stored`);
    if (base !== null && reg.get(base) !== n.prov)
      e.push(`${k}: prov ${n.prov} but FACTS says ${reg.get(base)}`);
    for (const f of ["display", "unit", "source", "as_of_mt"] as const) {
      const v = n[f];
      if (typeof v !== "string" || v.length === 0)
        e.push(`${k}: ${f} must be a non-empty string`);
      else if (DASHES.some((d) => v.includes(d)))
        e.push(`${k}: ${f} has an em or en dash`);
    }
    if (
      typeof n.as_of_mt === "string" &&
      !/^\d{4}-\d{2}-\d{2}$/.test(n.as_of_mt)
    )
      e.push(`${k}: as_of_mt is not a day`);
  });
  return e;
}
