// 15-minute limits at the meter and the site DP. Power limits are grid-side kW per interval.
import type { Site } from "@contracts/types";
import { INTERVAL_S, INTERVALS } from "./bundle";
import { CALL_DURATION_S } from "./inputs";
import { solveDp } from "./dp";
import type { DpResult } from "./dp";

export const PULSE_LEVELS = 40;
export const DP_FLOOR_LEVEL = 2; // 25 kWh of 500: mirrors fix.py's 0.1 of 2 MWh (ASSUMPTION)
const STEP_H = INTERVAL_S / 3600;

export const pulseDz = (site: Site) => site.station.pulse_kwh / PULSE_LEVELS;
export const eta = (site: Site) => site.station.rte.value ** 0.5;

// Power Spin can hold for a whole call from its stored energy.
export function spinAvailKw(
  site: Site,
  spinSocKwh: number,
  durationS = CALL_DURATION_S,
): number {
  return Math.min(site.station.spin_kw, (spinSocKwh * 3600) / durationS);
}

// System Critical Hours rule: Pulse keeps enough spare power to cover the part of the enrolled kW
// Spin cannot.
export function schCapKw(site: Site, spinAvail: number): number {
  return (
    site.station.pulse_kw - Math.max(0, site.station.enrolled_kw - spinAvail)
  );
}

export interface LimitOpts {
  ceiling: boolean; // respect the host ceiling (clearlane)
  sch: boolean[] | null; // SCH flag per interval, null = no SCH rule
  spin_avail_kw: number[]; // per interval
  other_load_kw: number[]; // Spin refill, per interval
}

export interface StepLimits {
  charge_kw: number[];
  discharge_kw: number[];
  sch_cap_kw: (number | null)[];
}

export function stepLimits(site: Site, o: LimitOpts): StepLimits {
  const P = site.station.pulse_kw;
  const exp = site.export_limit_kw.value;
  const charge_kw: number[] = [];
  const discharge_kw: number[] = [];
  const sch_cap_kw: (number | null)[] = [];
  for (let t = 0; t < INTERVALS; t++) {
    const host = site.host_load_kw_15m[t]!;
    const other = o.other_load_kw[t]!;
    charge_kw.push(
      o.ceiling
        ? Math.max(0, Math.min(P, site.host_ceiling_kw - host - other))
        : P,
    );
    const cap = o.sch?.[t] ? schCapKw(site, o.spin_avail_kw[t]!) : null;
    sch_cap_kw.push(cap);
    discharge_kw.push(Math.min(P, host + other + exp, cap ?? P));
  }
  return { charge_kw, discharge_kw, sch_cap_kw };
}

// Largest level change per step at full Pulse power: [up, down].
export function reachLevels(site: Site): [number, number] {
  const dz = pulseDz(site);
  const e = eta(site);
  const grid = site.station.pulse_kw * STEP_H;
  return [Math.floor((grid * e) / dz + 1e-9), Math.floor(grid / e / dz + 1e-9)];
}

export interface SiteDpOpts {
  W: number;
  limits: StepLimits;
  start_level?: number;
  end_level?: number;
}

// 96-step DP on 41 Pulse levels; prices96 holds each hourly price for 4 steps.
export function solveSiteDP(
  prices96: number[],
  site: Site,
  o: SiteDpOpts,
): DpResult {
  return solveDp({
    price: prices96,
    levels: PULSE_LEVELS,
    dz: pulseDz(site),
    eta: eta(site),
    charge_max: o.limits.charge_kw.map((kw) => kw * STEP_H),
    discharge_max: o.limits.discharge_kw.map((kw) => kw * STEP_H),
    W: o.W,
    soc_min: 0,
    start_level: o.start_level ?? DP_FLOOR_LEVEL,
    end_level: o.end_level ?? DP_FLOOR_LEVEL,
    to_mwh: 1 / 1000,
  });
}

export const hold4 = (hourly: number[]) => hourly.flatMap((x) => [x, x, x, x]);
