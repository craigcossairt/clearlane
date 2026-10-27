// numbers.json keys that are not (yet) rows in docs/FACTS.md. Each is listed in the PR body for
// Integration to add to FACTS; remove it here once FACTS has the row.
import type { Provenance } from "@contracts/types";

export const NEW_KEYS: Record<string, { prov: Provenance; claim: string }> = {
  lane_hours_oct27_clear: {
    prov: "DERIVED",
    claim: "Hours in the clear lane on the stage day.",
  },
  lane_hours_oct27_jam: {
    prov: "DERIVED",
    claim: "Hours in the jam lane on the stage day.",
  },
  race_discharge_usd_mwh: {
    prov: "DERIVED",
    claim:
      "Mean price of the reference race's discharge hours (HB 6pm and 7pm).",
  },
  discharge_co2_race: {
    prov: "DERIVED",
    claim:
      "Mean grid CO2 intensity of the reference race's discharge hours, g/kWh.",
  },
  dp_race_ratio: {
    prov: "DERIVED",
    claim:
      "Clearlane's 15-minute site plan value over the off-peak rule's, same day.",
  },
  second_call_shortfall_kwh: {
    prov: "SIMULATED",
    claim: "Energy short on the second press while Spin is still refilling.",
  },
  second_call_delivered_pct: {
    prov: "SIMULATED",
    claim: "Share of the second press delivered while Spin is still refilling.",
  },
  rmp_event_ramp_target_s: {
    prov: "TORUS_PUBLISHED",
    claim:
      "RMP's ramp target for an event, seconds (Torus ramped in rmp_event_ramp_s).",
  },
  rmp_event_band_min_pct: {
    prov: "TORUS_PUBLISHED",
    claim: "Lower edge of the delivered band Torus publishes for an RMP event.",
  },
  rmp_event_band_max_pct: {
    prov: "TORUS_PUBLISHED",
    claim: "Upper edge of the delivered band Torus publishes for an RMP event.",
  },
  oct_step_median_usd: {
    prov: "DERIVED",
    claim:
      "Median size of each October day's largest upward hour-to-hour PACE DA price step.",
  },
};
