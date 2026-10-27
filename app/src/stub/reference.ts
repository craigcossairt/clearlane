import type { HourSignal } from "@contracts/types";
import { mean } from "./hours";

/** Reference race from research/analysis/demo-story/habit.py. 1 MW / 2 MWh, RTE 0.88. */
export const RTE = 0.88;
export const STORED_MWH_PER_MW = 2;

export const FIXED_CHARGE_HOURS = [1, 2, 3, 4];
export const TIMETABLE_CHARGE_HOURS = [13, 14, 15];
export const DISCHARGE_HOURS = [18, 19];

const gridChargeMwh = STORED_MWH_PER_MW / Math.sqrt(RTE);
const gridDischargeMwh = STORED_MWH_PER_MW * Math.sqrt(RTE);

export interface ReferenceRace {
  usdPerMwDay: number;
  co2TPerMwDay: number;
  chargeHours: number[];
  dischargeHours: number[];
}

export function referenceRace(
  hours: HourSignal[],
  chargeHours: number[],
  dischargeHours: number[],
): ReferenceRace {
  const price = (hour: number) => {
    const row = hours[hour];
    if (!row) throw new Error(`missing hour ${hour}`);
    return row.lmp_usd_mwh;
  };
  const carbon = (hour: number) => {
    const row = hours[hour];
    if (!row) throw new Error(`missing hour ${hour}`);
    return row.co2_g_kwh;
  };
  const usdPerMwDay =
    mean(dischargeHours, price) * gridDischargeMwh -
    mean(chargeHours, price) * gridChargeMwh;
  const co2TPerMwDay =
    (mean(dischargeHours, carbon) * gridDischargeMwh -
      mean(chargeHours, carbon) * gridChargeMwh) /
    1000;
  return { usdPerMwDay, co2TPerMwDay, chargeHours, dischargeHours };
}

/** Simulated campus: 25 MW for 3 hours, from HB 6pm-8pm to HB 1pm-3pm. No storage losses. */
export const CAMPUS_MW = 25;
export const CAMPUS_HOURS = 3;
export const CAMPUS_MWH = CAMPUS_MW * CAMPUS_HOURS;
export const CAMPUS_FROM = [18, 19, 20];
export const CAMPUS_TO = [13, 14, 15];

export function campusShiftUsd(hours: HourSignal[]): number {
  const price = (hour: number) => {
    const row = hours[hour];
    if (!row) throw new Error(`missing hour ${hour}`);
    return row.lmp_usd_mwh;
  };
  return (mean(CAMPUS_FROM, price) - mean(CAMPUS_TO, price)) * CAMPUS_MWH;
}
