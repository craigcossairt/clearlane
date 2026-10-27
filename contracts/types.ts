// contracts/types.ts
// Clearlane shared contracts v1. Frozen at Train 1 (Tue Oct 27 2026, 1:45am MT).
// After the freeze, only the Integration lane changes this file.
// Units are in field names. Times are ISO 8601. *_utc fields end in "Z".
// Every interval is identified by its START time in UTC. Mountain time is for display only.
// MDT = UTC-6 until Nov 1 2026, so the whole backtest window (May 1 to Oct 27) is UTC-6.

export type Provenance =
  | "REAL"            // public data as published (CAISO OASIS, EIA)
  | "DERIVED"         // computed by our code from REAL inputs
  | "SIMULATED"       // synthetic: host load, call times, stations on screen
  | "TORUS_PUBLISHED" // a number Torus published (site, case study, FAQ, filings)
  | "ASSUMPTION"      // a value we chose (RTE, call size, export limit); always shown with a chip
  | "MEASURED";       // timed live on the machine running the demo (solve_ms); never stored as a constant

export interface SourceRef {
  id: string;            // e.g. "caiso_prc_lmp_dam"
  url: string;
  license: string;       // e.g. "public", "CC BY 4.0"
  retrieved_utc: string;
}

export interface Tagged<T> {
  value: T;
  prov: Provenance;
  source_id: string;     // a SourceRef.id, or a repo path such as "engine/src/dp.ts"
}

// ---------- prep (Data lane) -> engine ----------

export interface HourSignal {
  ts_utc: string;          // interval start, e.g. "2026-10-28T06:00:00Z"
  local_mt: string;        // display, e.g. "2026-10-28T00:00-06:00"
  hour_mt: number;         // 0..23, hour beginning in Mountain time
  lmp_usd_mwh: number;     // CAISO DAM PRC_LMP, LMP_TYPE LMP, ELAP_PACE-APND (REAL)
  mcc_usd_mwh: number;     // congestion component of the same LMP (REAL)
  load_fcst_mw: number;    // CAISO SLD_FCST DAM, PACE (REAL)
  solar_fcst_mw: number;   // EDAM_WND_SLR_FORECAST_GRP, PACE, clamped >= 0 (REAL)
  wind_fcst_mw: number;    // same source (REAL)
  net_load_mw: number;     // load - solar - wind (DERIVED)
  co2_g_kwh: number;       // PACE generated-basis average CO2 (lb/kWh x 453.592)
  co2_kind: "eia_observed_avg" | "eia_profile_avg_30d"; // observed hour, or trailing 30-day hour-of-day mean
  prov: { lmp: Provenance; load: Provenance; solar: Provenance; wind: Provenance; co2: Provenance };
}

export interface PeerNodeSeries {
  node: string;            // "ELAP_PACW-APND" | "ELAP_PGE-APND" | the SP15 id used in research
  lmp_usd_mwh: number[];   // 24, aligned to Bundle.hours
}

export interface Bundle {
  schema: "clearlane.bundle/v1";
  operating_day_mt: string;  // "2026-10-28": Mountain calendar day, 24 hours starting 06:00Z
  node: "ELAP_PACE-APND";
  data_mode: "snapshot" | "live";
  fetched_utc: string;
  hours: HourSignal[];       // length 24, ordered by ts_utc
  peers: PeerNodeSeries[];   // may be empty
  sources: SourceRef[];
  notes: string[];           // e.g. "hour 0 price is from CAISO OPR_DT 2026-10-27"
}

export interface HistDay {   // public/data/hist_2026-05-01_2026-10-27.json is HistDay[]
  operating_day_mt: string;
  lmp_usd_mwh: number[];           // 24, by hour beginning MT (REAL)
  co2_g_kwh: (number | null)[];    // 24, EIA observed average (REAL); null if missing
}

export interface TorusPublished {  // public/data/torus_published.json
  events_2025_total: Tagged<number>;               // 359
  events_2025_by_hour: Tagged<number[]>;           // 24 counts, index 0 = 12am; source states no time zone
  events_2025_by_weekday: Tagged<number[]>;        // Mon..Sun
  ramp_s: Tagged<number>;                          // 19
  ramp_target_s: Tagged<number>;                   // 30
  delivered_pct: Tagged<number>;                   // 102
  delivered_band_pct: Tagged<[number, number]>;    // [90, 100]
  spin_c_rate: Tagged<number>;                     // 10
  spin_cycle_life: Tagged<number>;                 // 25000
  spin_discharge_recharge_min: Tagged<number>;     // 12
  pulse_c_rate: Tagged<number>;                    // 0.5
  pulse_cycle_life: Tagged<number>;                // 7500
  pulse_life_yr: Tagged<number>;                   // 25
  mou_mw: Tagged<number>;                          // 70
  mou_ceiling_mw: Tagged<number>;                  // 500
}

// ---------- engine inputs ----------

export interface StationSpec {
  id: string;
  label: string;                        // "Simulated Torus-style station on Clearlane" | "Battery on the off-peak rule"
  spin_kw: number;  spin_kwh: number;   // spin_kwh = spin_kw / 10 (10C)
  pulse_kw: number; pulse_kwh: number;  // pulse_kwh = pulse_kw * 2 (0.5C)
  rte: Tagged<number>;                  // 0.88 ASSUMPTION
  pulse_cycles_per_yr_budget: number;   // 300 = 7500 / 25
  spin_recharge_min: number;            // 6 = half of the published 12-minute discharge and recharge
  enrolled_kw: number;                  // RMP Wattsmart commitment; Spin is sized to it
}

export interface Site {
  id: string;
  label: string;                        // "Simulated Utah manufacturer"
  host_load_kw_15m: number[];           // 96 values, SIMULATED
  host_ceiling_kw: number;              // month-to-date 15-minute peak the plan must not exceed
  export_limit_kw: Tagged<number>;      // ASSUMPTION until Torus answers; 0 = no export
  demand_charge_usd_kw_month: Tagged<number> | null; // null until the RMP tariff is verified
  station: StationSpec;
}

export type Lane = "clear" | "shoulder" | "jam";
export type Policy = "fixed_overnight" | "price_only" | "clearlane";

// ---------- engine outputs ----------

export interface PlanInterval {
  i: number;                 // 0..95
  ts_utc: string;
  lane: Lane;
  system_critical: boolean;
  price_usd_mwh: number;
  pulse_kw: number;          // + charging, - discharging, at the meter
  spin_kw: number;           // + recharging, - discharging
  pulse_soc_kwh: number;     // at interval end
  spin_soc_kwh: number;      // at interval end
  meter_kw: number;          // host load + pulse_kw + spin_kw (what the host's 15-minute meter sees)
  spare_kw: number;          // power available for an RMP call now (Spin plus Pulse headroom)
}

export interface Plan {
  policy: Policy;
  site_id: string;
  operating_day_mt: string;
  intervals: PlanInterval[];     // 96
  value_usd: number;             // grid value at DA prices = sum(-price x grid MWh): system value, not revenue
  value_usd_per_mw_day: number;  // value_usd / (pulse_kw / 1000)
  co2_avoided_kg: number;        // + avoided, - added; average-emissions estimate
  pulse_cycles: number;          // full-equivalent = discharged kWh / pulse_kwh
  host_peak_kw: number;
  wear_usd_mwh: number;
  solve_ms: number;              // measured with performance.now(); never hard-coded
}

export interface CrashEvent {
  id: string;
  start_utc: string;
  duration_s: number;            // default 330 (5.5 min)
  requested_kw: number;          // default = enrolled_kw
  prov: Provenance;              // "SIMULATED"
}

export interface CrashTracePoint { t_s: number; requested_kw: number; spin_kw: number; pulse_kw: number; spin_soc_kwh: number; meter_kw: number; }

export interface CrashResult {
  event_id: string;
  policy: Policy;
  delivered_pct: number;         // delivered kWh / requested kWh x 100 (SIMULATED)
  ramp_s: number;                // modeled ramp; uses the TORUS_PUBLISHED 19 s
  spin_kwh: number;
  pulse_kwh: number;
  shortfall_kwh: number;         // 0 unless a second call lands inside Spin's refill window
  spin_full_again_utc: string;
  meter_peak_during_refill_kw: number; // must be <= host_ceiling_kw
  trace: CrashTracePoint[];      // 1 s resolution, from call start until Spin is full again
  replan: Plan;                  // rest of the day, re-solved from the actual SoC
}

export interface EnvelopeHour {
  ts_utc: string;
  system_critical: boolean;
  reserve_kw: number;            // fleet power held for RMP calls
  max_charge_kw: number;         // fleet charge limit after host ceilings
  max_discharge_kw: number;
  planned_kw: number;            // fleet planned net (+ charge, - discharge)
  reason: string;                // plain words, e.g. "top 4 net-load hour"
}

export interface Envelope {
  schema: "clearlane.envelope/v1";
  operating_day_mt: string;
  fleet_kw: number;
  sch_rule: string;              // our proposed System Critical Hours rule, stated in words
  hours: EnvelopeHour[];         // 24
  generated_utc: string;
}

export interface Pctl { p10: number; p50: number; p90: number; mean: number; }

export interface PolicyStats {
  policy: Policy;
  usd_per_mw_day: Pctl;
  co2_t_per_mw_day: Pctl;          // + avoided, average emissions
  pulse_cycles_per_yr: number;
  calls_unanswerable_pct: { heatmap_as_mt: number; heatmap_as_utc: number };
  host_ceiling_breaches: number;   // count of 15-minute intervals over the ceiling
  days_beating_fixed_overnight_pct: number;
}

export interface BacktestResult {
  schema: "clearlane.backtest/v1";
  window: { start_mt: string; end_mt: string; days: number; missing_days: string[] };
  wear_usd_mwh: number;            // calibrated so clearlane uses <= 300 cycles/yr
  seed: number;                    // call-sampler seed
  policies: PolicyStats[];
}

export interface StageNumber {
  key: string;                     // e.g. "race_clearlane_usd_per_mw_day"
  value: number;
  unit: string;                    // e.g. "$/MW-day"
  display: string;                 // formatted, e.g. "$58.41"; no em dashes
  prov: Provenance;
  source: string;                  // repo path or URL
  as_of_mt: string;                // operating day it describes
}
// public/derived/numbers.json is StageNumber[]. The UI and the deck read every on-stage number from it.
