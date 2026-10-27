// SIMULATED RMP calls shaped like the published 2025 heatmap. The heatmap states no time zone, so
// every result is computed under each reading: Mountain ("mt"), UTC shifted by the day's own offset
// ("utc", MT hour h takes the label for h + 6 under MDT) and UTC shifted at UTC-7 ("utc_mst").
import type { CrashEvent } from "@contracts/types";
import { isoUtc } from "./bundle";
const CALL_DURATION_S = 330; // call_duration_s (ASSUMPTION); same value as engine/src/inputs.ts
import { mulberry32, poisson, weighted } from "./rng";

export type Reading = "mt" | "utc" | "utc_mst";
export const READINGS: Reading[] = ["mt", "utc", "utc_mst"];

export interface SampleOpts {
  seed: number;
  reading: Reading;
  by_hour: number[]; // 24 counts, index 0 = 12am label
  by_weekday: number[]; // Mon..Sun
  requested_kw: number;
  rate_per_day?: number;
  duration_s?: number;
}

export const CALLS_PER_YEAR = 359; // events_2025_total; the sampler takes counts from the caller

// Hours west of UTC for a Mountain calendar day: 6 under daylight time, else 7 (US rule:
// second Sunday of March to first Sunday of November).
export function mountainOffsetH(day: string): number {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  const nthSunday = (month: number, n: number) => {
    const first = new Date(Date.UTC(y, month - 1, 1)).getUTCDay();
    return 1 + ((7 - first) % 7) + 7 * (n - 1);
  };
  const t = Date.UTC(y, m - 1, d);
  const start = Date.UTC(y, 2, nthSunday(3, 2));
  const end = Date.UTC(y, 10, nthSunday(11, 1));
  return t >= start && t < end ? 6 : 7;
}

export function dayStartMs(day: string): number {
  return Date.parse(`${day}T00:00:00Z`) + mountainOffsetH(day) * 3_600_000;
}

// Mon = 0 .. Sun = 6
export const weekdayIndex = (day: string) =>
  (new Date(Date.parse(`${day}T12:00:00Z`)).getUTCDay() + 6) % 7;

export function hourWeights(
  byHour: number[],
  reading: Reading,
  offsetH = 6,
): number[] {
  return Array.from(
    { length: 24 },
    (_, h) => byHour[reading === "mt" ? h : (h + offsetH) % 24]!,
  );
}

export function sampleCalls(days: string[], o: SampleOpts): CrashEvent[] {
  const rng = mulberry32(o.seed);
  const rate = o.rate_per_day ?? CALLS_PER_YEAR / 365;
  const meanW = o.by_weekday.reduce((a, w) => a + w, 0) / o.by_weekday.length;
  const out: CrashEvent[] = [];
  for (const day of days) {
    const offset = o.reading === "utc_mst" ? 7 : mountainOffsetH(day);
    const weights = hourWeights(o.by_hour, o.reading, offset);
    const n = poisson(rng, (rate * o.by_weekday[weekdayIndex(day)]!) / meanW);
    const starts: number[] = [];
    for (let k = 0; k < n; k++) {
      const h = weighted(rng, weights);
      const minute = Math.floor(rng() * 60);
      starts.push(dayStartMs(day) + (h * 60 + minute) * 60_000);
    }
    starts.sort((a, b) => a - b);
    starts.forEach((ms, k) =>
      out.push({
        id: `${day}-${o.reading}-${k + 1}`,
        start_utc: isoUtc(ms),
        duration_s: o.duration_s ?? CALL_DURATION_S,
        requested_kw: o.requested_kw,
        prov: "SIMULATED",
      }),
    );
  }
  return out;
}
