// Torus-derived model inputs, one place. Each carries its FACTS key. These feed the model only;
// stage Torus numbers come from public/data/torus_published.json.
export const RAMP_S = 19; // rmp_event_ramp_s (TORUS_PUBLISHED)
export const SPIN_C_RATE = 10; // torus_spin_c_rating (TORUS_PUBLISHED); spin_kwh_per_kw = 0.1
export const PULSE_C_RATE = 0.5; // torus_pulse_c_rating (TORUS_PUBLISHED)
export const SPIN_RECHARGE_MIN = 6; // spin_recharge_min (DERIVED from torus_spin_cycle_min)
export const PULSE_CYCLE_LIFE = 7500; // torus_pulse_cycles (TORUS_PUBLISHED)
export const STATION_LIFE_YR = 25; // torus_lifespan_yr (TORUS_PUBLISHED)
export const PULSE_CYCLES_PER_YR = PULSE_CYCLE_LIFE / STATION_LIFE_YR; // pulse_cycle_budget: 300
export const CALL_DURATION_S = 330; // call_duration_s (ASSUMPTION; 340 s would match the chart better)
export const DELIVERED_FLOOR_PCT = 90; // floor of the published 90 to 100% band (TORUS_PUBLISHED)
export const RTE = 0.88; // ref_station (ASSUMPTION)
