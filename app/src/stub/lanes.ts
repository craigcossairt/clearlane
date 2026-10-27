import type { HourSignal, Lane } from "@contracts/types";

/** Clear at or under min + 25% of the day's range. Jam at or over max - 25%. Else shoulder. */
export function laneThresholds(hours: HourSignal[]): {
  clearMax: number;
  jamMin: number;
} {
  let min = Infinity;
  let max = -Infinity;
  for (const hour of hours) {
    min = Math.min(min, hour.lmp_usd_mwh);
    max = Math.max(max, hour.lmp_usd_mwh);
  }
  const span = max - min;
  return { clearMax: min + 0.25 * span, jamMin: max - 0.25 * span };
}

export function lanesFor(hours: HourSignal[]): Lane[] {
  const { clearMax, jamMin } = laneThresholds(hours);
  return hours.map((hour) => {
    if (hour.lmp_usd_mwh <= clearMax) return "clear";
    if (hour.lmp_usd_mwh >= jamMin) return "jam";
    return "shoulder";
  });
}

/** Our proposal: the 4 highest net-load hours, plus every jam hour. */
export function systemCritical(hours: HourSignal[], lanes: Lane[]): boolean[] {
  const ranked = hours
    .map((hour, index) => ({ index, net: hour.net_load_mw }))
    .sort((a, b) => b.net - a.net || a.index - b.index);
  const top = new Set(ranked.slice(0, 4).map((row) => row.index));
  return hours.map((_, index) => top.has(index) || lanes[index] === "jam");
}

export function criticalReason(
  hour: number,
  hours: HourSignal[],
  lanes: Lane[],
  critical: boolean[],
): string {
  if (!critical[hour]) return "outside our proposed System Critical Hours";
  const ranked = hours
    .map((row, index) => ({ index, net: row.net_load_mw }))
    .sort((a, b) => b.net - a.net || a.index - b.index);
  const top = new Set(ranked.slice(0, 4).map((row) => row.index));
  const jam = lanes[hour] === "jam";
  if (jam && top.has(hour)) return "jam hour and a top net-load hour";
  if (jam) return "jam hour";
  return "top 4 net-load hour";
}
