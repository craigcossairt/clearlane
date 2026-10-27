/**
 * Stub timetable hours only. The race math that lived here is gone: race values come from
 * public/derived/numbers.json (StageNumber[]) and, for live plans, from the engine's
 * referenceRace through app/src/engineClient.ts. These hours only shape the stub plan.
 */
export const RTE = 0.88;

export const FIXED_CHARGE_HOURS = [1, 2, 3, 4];
export const TIMETABLE_CHARGE_HOURS = [13, 14, 15];
export const DISCHARGE_HOURS = [18, 19];
