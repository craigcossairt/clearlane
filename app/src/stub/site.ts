import type { Site, Tagged } from "@contracts/types";

const assumption = (value: number, source_id: string): Tagged<number> => ({
  value,
  prov: "ASSUMPTION",
  source_id,
});

/** SIMULATED weekday manufacturer. Peaks at 1.0 in the early afternoon. Not a metered site. */
const HOST_SHAPE = [
  0.35, 0.32, 0.3, 0.3, 0.33, 0.45, 0.6, 0.75, 0.82, 0.88, 0.92, 0.96, 1, 1,
  0.98, 0.96, 0.9, 0.78, 0.68, 0.58, 0.5, 0.46, 0.42, 0.38,
];

const HOST_PEAK_KW = 480;

export function hostLoadKw(hourMt: number): number {
  const shape = HOST_SHAPE[hourMt];
  if (shape === undefined)
    throw new Error(`missing host shape for hour ${hourMt}`);
  return Math.round(shape * HOST_PEAK_KW);
}

export const HOST_CEILING_KW = 700;

/** Simulated site used until the engine's site.ts lands. Spin is sized at 0.1 kWh per kW. */
export function simulatedSite(): Site {
  const pulseKw = 250;
  const enrolledKw = pulseKw;
  const spinKw = enrolledKw;
  const load: number[] = [];
  for (let hour = 0; hour < 24; hour += 1) {
    const kw = hostLoadKw(hour);
    for (let quarter = 0; quarter < 4; quarter += 1) load.push(kw);
  }
  return {
    id: "sim-utah-manufacturer",
    label: "Simulated Utah manufacturer",
    host_load_kw_15m: load,
    host_ceiling_kw: HOST_CEILING_KW,
    export_limit_kw: assumption(0, "app/src/stub/site.ts"),
    demand_charge_usd_kw_month: null,
    station: {
      id: "sim-torus-style",
      label: "Simulated Torus-style station on Clearlane",
      spin_kw: spinKw,
      spin_kwh: spinKw / 10,
      pulse_kw: pulseKw,
      pulse_kwh: pulseKw * 2,
      rte: assumption(0.88, "research/analysis/demo-story/habit.py"),
      pulse_cycles_per_yr_budget: 300,
      spin_recharge_min: 6,
      enrolled_kw: enrolledKw,
    },
  };
}
