// Turns per-interval Pulse and Spin schedules into a contract Plan.
import type {
  Bundle,
  Plan,
  PlanInterval,
  Policy,
  Site,
} from "@contracts/types";
import { INTERVAL_S, intervalStartsUtc } from "./bundle";
import { lanes, systemCriticalHours } from "./lanes";
import type { SchMode } from "./lanes";
import { eta, spinAvailKw } from "./limits";

const STEP_H = INTERVAL_S / 3600;

export interface Schedule {
  pulse_kw: number[]; // + charging at the meter
  pulse_soc_kwh: number[]; // at interval end
  spin_kw: number[];
  spin_soc_kwh: number[]; // at interval end
  spin_start_kwh: number; // Spin SoC before interval 0
}

export interface PlanMeta {
  policy: Policy;
  wear_usd_mwh: number;
  solve_ms: number;
  sch_mode?: SchMode;
}

export function schFlags(b: Bundle, mode: SchMode = "net_load"): boolean[] {
  const sch = new Set(systemCriticalHours(b, mode).hours);
  return Array.from({ length: 96 }, (_, t) => sch.has(Math.floor(t / 4)));
}

export function buildPlan(
  b: Bundle,
  site: Site,
  s: Schedule,
  m: PlanMeta,
): Plan {
  const ts = intervalStartsUtc(b);
  const ls = lanes(b);
  const sch = schFlags(b, m.sch_mode);
  const P = site.station.pulse_kw;
  const exp = site.export_limit_kw.value;
  let value = 0;
  let co2Kg = 0;
  let dischargedKwh = 0;
  const intervals: PlanInterval[] = ts.map((ts_utc, i) => {
    const h = Math.floor(i / 4);
    const price = b.hours[h]!.lmp_usd_mwh;
    const pulse = s.pulse_kw[i]!;
    const gridKwh = -pulse * STEP_H; // + delivered to the grid
    value += (price * gridKwh) / 1000;
    co2Kg += (gridKwh * b.hours[h]!.co2_g_kwh) / 1000;
    if (gridKwh > 0) dischargedKwh += gridKwh;
    const meter = site.host_load_kw_15m[i]! + pulse + s.spin_kw[i]!;
    const spinBefore = i === 0 ? s.spin_start_kwh : s.spin_soc_kwh[i - 1]!;
    return {
      i,
      ts_utc,
      lane: ls[h]!,
      system_critical: sch[i]!,
      price_usd_mwh: price,
      pulse_kw: pulse,
      spin_kw: s.spin_kw[i]!,
      pulse_soc_kwh: s.pulse_soc_kwh[i]!,
      spin_soc_kwh: s.spin_soc_kwh[i]!,
      meter_kw: meter,
      spare_kw: Math.min(
        spinAvailKw(site, spinBefore) + (P - Math.abs(pulse)),
        meter + exp,
      ),
    };
  });
  return {
    policy: m.policy,
    site_id: site.id,
    operating_day_mt: b.operating_day_mt,
    intervals,
    value_usd: value,
    value_usd_per_mw_day: value / (P / 1000),
    co2_avoided_kg: co2Kg,
    // Equivalent full cycles on stored energy (#45): grid-side kWh / eta is what left the battery.
    pulse_cycles: dischargedKwh / eta(site) / site.station.pulse_kwh,
    host_peak_kw: Math.max(...intervals.map((x) => x.meter_kw)),
    wear_usd_mwh: m.wear_usd_mwh,
    solve_ms: m.solve_ms,
  };
}
