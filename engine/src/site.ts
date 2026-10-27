// The simulated site. Everything here is SIMULATED unless tagged ASSUMPTION.
import type { Site } from "@contracts/types";
import {
  PULSE_C_RATE,
  PULSE_CYCLES_PER_YR,
  RTE,
  SPIN_C_RATE,
  SPIN_RECHARGE_MIN,
} from "./inputs";

// Host load by Mountain hour beginning, kW: overnight base, morning ramp, an 800 kW peak at HB 14-15,
// a second shift to HB 20, back to base by HB 23.
const HOST_BY_HOUR_KW = [
  300, 300, 300, 300, 300, 340, 440, 540, 600, 620, 650, 680, 720, 760, 800,
  800, 720, 640, 620, 600, 580, 460, 360, 300,
];

export const SITE_DEFAULT_ID = "sim-utah-manufacturer";

export function defaultSite(): Site {
  const host = HOST_BY_HOUR_KW.flatMap((kw) => [kw, kw, kw, kw]);
  const spin_kw = 250;
  const pulse_kw = 250;
  return {
    id: SITE_DEFAULT_ID,
    label: "Simulated Utah manufacturer",
    host_load_kw_15m: host,
    host_ceiling_kw: Math.max(...host), // month-to-date 15-minute peak; here today's maximum
    export_limit_kw: {
      value: 0,
      prov: "ASSUMPTION",
      source_id: "engine/src/site.ts",
    },
    demand_charge_usd_kw_month: null,
    station: {
      id: "sim-station-1",
      label: "Simulated Torus-style station on Clearlane",
      spin_kw,
      spin_kwh: spin_kw / SPIN_C_RATE,
      pulse_kw,
      pulse_kwh: pulse_kw / PULSE_C_RATE,
      rte: {
        value: RTE,
        prov: "ASSUMPTION",
        source_id: "engine/src/inputs.ts",
      },
      pulse_cycles_per_yr_budget: PULSE_CYCLES_PER_YR,
      spin_recharge_min: SPIN_RECHARGE_MIN,
      enrolled_kw: 250,
    },
  };
}
