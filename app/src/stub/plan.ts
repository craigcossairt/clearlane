import type {
  HourSignal,
  Plan,
  PlanInterval,
  Policy,
  Site,
} from "@contracts/types";
import { lanesFor } from "./lanes";
import {
  DISCHARGE_HOURS,
  FIXED_CHARGE_HOURS,
  RTE,
  referenceRace,
  TIMETABLE_CHARGE_HOURS,
} from "./reference";
import { hostLoadKw } from "./site";

const ONE_WAY = Math.sqrt(RTE);

export interface BuiltPlan {
  plan: Plan;
  solveMs: number;
}

function chargeHours(policy: Policy): number[] {
  if (policy === "fixed_overnight") return FIXED_CHARGE_HOURS;
  if (policy === "clearlane") return TIMETABLE_CHARGE_HOURS;
  return [];
}

/** Price-only stub: no Spin, full Pulse discharge on the reference discharge hours. */
function pulseGridKw(policy: Policy, hour: number, site: Site): number {
  const station = site.station;
  if (policy === "price_only") {
    return DISCHARGE_HOURS.includes(hour) ? -station.pulse_kw : 0;
  }
  const charging = chargeHours(policy);
  const discharging = DISCHARGE_HOURS;
  if (charging.includes(hour)) {
    const gridKwh = station.pulse_kwh / ONE_WAY;
    return gridKwh / charging.length;
  }
  if (discharging.includes(hour)) {
    const gridKwh = station.pulse_kwh * ONE_WAY;
    return -gridKwh / discharging.length;
  }
  return 0;
}

export function buildPlan(
  hours: HourSignal[],
  site: Site,
  policy: Policy,
): BuiltPlan {
  const started = performance.now();
  const lanes = lanesFor(hours);
  const race =
    policy === "price_only"
      ? null
      : referenceRace(hours, chargeHours(policy), DISCHARGE_HOURS);
  const keepSpin = policy === "clearlane";
  const intervals: PlanInterval[] = [];
  let pulseSoc = 0;
  const pulseStepIn =
    site.station.pulse_kwh / (chargeHours(policy).length * 4 || 1);
  const pulseStepOut = site.station.pulse_kwh / (DISCHARGE_HOURS.length * 4);

  for (let i = 0; i < 96; i += 1) {
    const hour = Math.floor(i / 4);
    const row = hours[hour];
    if (!row) throw new Error(`missing hour ${hour}`);
    const pulseKw = pulseGridKw(policy, hour, site);
    if (policy !== "price_only" && chargeHours(policy).includes(hour))
      pulseSoc += pulseStepIn;
    if (policy !== "price_only" && DISCHARGE_HOURS.includes(hour))
      pulseSoc -= pulseStepOut;
    if (policy === "price_only" && pulseKw < 0) {
      pulseSoc = Math.max(
        0,
        pulseSoc - (site.station.pulse_kw * 0.25) / ONE_WAY,
      );
    }
    const spinKw = 0;
    const meter = hostLoadKw(hour) + pulseKw + spinKw;
    intervals.push({
      i,
      ts_utc: new Date(Date.parse(row.ts_utc) + (i % 4) * 15 * 60 * 1000)
        .toISOString()
        .replace(".000Z", "Z"),
      lane: lanes[hour] ?? "shoulder",
      system_critical: false,
      price_usd_mwh: row.lmp_usd_mwh,
      pulse_kw: pulseKw,
      spin_kw: spinKw,
      pulse_soc_kwh: Math.max(0, pulseSoc),
      spin_soc_kwh: keepSpin ? site.station.spin_kwh : 0,
      meter_kw: meter,
      spare_kw: keepSpin
        ? site.station.spin_kw +
          Math.max(0, site.station.pulse_kw - Math.abs(pulseKw))
        : Math.max(0, site.station.pulse_kw - Math.abs(pulseKw)),
    });
  }

  const solveMs = performance.now() - started;
  const perMw = race?.usdPerMwDay ?? 0;
  const plan: Plan = {
    policy,
    site_id: site.id,
    operating_day_mt: hours[0]?.local_mt.slice(0, 10) ?? "",
    intervals,
    value_usd: perMw * (site.station.pulse_kw / 1000),
    value_usd_per_mw_day: perMw,
    co2_avoided_kg: (race?.co2TPerMwDay ?? 0) * 1000,
    pulse_cycles: policy === "price_only" ? 0 : 1,
    host_peak_kw: Math.max(...intervals.map((row) => row.meter_kw)),
    wear_usd_mwh: 0,
    solve_ms: solveMs,
  };
  return { plan, solveMs };
}
