import type { Bundle, HourSignal } from "@contracts/types";

export function hoursByMt(bundle: Bundle): HourSignal[] {
  const out: (HourSignal | undefined)[] = new Array(24);
  for (const hour of bundle.hours) {
    if (hour.hour_mt < 0 || hour.hour_mt > 23) {
      throw new Error(`hour_mt out of range: ${hour.hour_mt}`);
    }
    out[hour.hour_mt] = hour;
  }
  if (out.some((hour) => hour === undefined)) {
    throw new Error("bundle is missing an hour");
  }
  return out as HourSignal[];
}

export function mean(hours: number[], pick: (hour: number) => number): number {
  if (hours.length === 0) throw new Error("mean of an empty hour list");
  let sum = 0;
  for (const hour of hours) sum += pick(hour);
  return sum / hours.length;
}
