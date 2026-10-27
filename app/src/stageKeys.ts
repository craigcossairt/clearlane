/**
 * Every numbers.json key each beat reads, by docs/FACTS.md name. Where FACTS holds a pair the
 * stage shows as two numbers, the split names follow the engine's numbers writer (suffix _4pm,
 * _6pm, and the rmp_event_* band keys). numbers.json is the authority: follow what it writes.
 * Keys marked NEW have no FACTS row yet and render "not computed" until the engine adds them.
 */
export const STAGE_KEYS: Record<number, readonly string[]> = {
  1: [
    "price_min_oct27",
    "peak_price",
    "peak_over_trough",
    "net_load_climb_mw",
    "solar_4pm_to_6pm_mw_4pm",
    "solar_4pm_to_6pm_mw_6pm",
    "lane_clear_max_usd",
    "lane_jam_min_usd",
    "peak_hour_mt",
    "oct_step_hour_days_at_5_or_6",
    "oct_step_hour_days_total",
  ],
  // Reference set only, so one card never mixes two plans.
  2: [
    "fixed_usd_mw_day",
    "clearlane_usd_mw_day",
    "race_ratio",
    "fixed_70",
    "clearlane_70",
    "fixed_rule_charge_usd_mwh",
    "timetable_charge_usd_mwh",
  ],
  3: [
    "enrolled_kw",
    "call_duration_s",
    "rmp_events_2025",
    "rmp_event_ramp_s",
    "rmp_event_ramp_target_s",
    "rmp_event_target_pct",
    "rmp_event_band_min_pct",
    "rmp_event_band_max_pct",
  ],
  4: ["pulse_cycle_budget", "cycles_today"],
  5: ["share_days_beating", "backtest_days", "sch_hours_today"],
  6: [
    "mou_70mw",
    "torus_500mw",
    "co2_fixed_t_per_mw_day",
    "co2_timetable_t_per_mw_day",
    "co2_added_70",
    "co2_avoided_70",
    "campus_usd",
    "campus_mwh",
  ],
};

export const ALL_STAGE_KEYS = [...new Set(Object.values(STAGE_KEYS).flat())];
