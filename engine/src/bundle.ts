// Bundle helpers. Every time comes from hours[].ts_utc, never from the machine time zone.
import type { Bundle } from "@contracts/types";

export const HOURS = 24;
export const STEPS_PER_HOUR = 4;
export const INTERVALS = HOURS * STEPS_PER_HOUR;
export const INTERVAL_S = 900;

const HOUR_MS = 3_600_000;

export function isoUtc(ms: number): string {
  return new Date(ms).toISOString().replace(".000Z", "Z");
}

export function addSeconds(iso: string, s: number): string {
  return isoUtc(Date.parse(iso) + s * 1000);
}

// 96 interval start times: each hour's ts_utc plus 0, 15, 30 and 45 minutes.
export function intervalStartsUtc(b: Bundle): string[] {
  return b.hours.flatMap((h) =>
    [0, 1, 2, 3].map((q) => addSeconds(h.ts_utc, q * INTERVAL_S)),
  );
}

export function prices(b: Bundle): number[] {
  return b.hours.map((h) => h.lmp_usd_mwh);
}

export function validateBundle(b: Bundle): string[] {
  const errors: string[] = [];
  if (b.hours.length !== HOURS)
    errors.push(`expected ${HOURS} hours, got ${b.hours.length}`);
  b.hours.forEach((h, i) => {
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(h.ts_utc)) {
      errors.push(
        `hour ${i}: ts_utc ${h.ts_utc} is not UTC ISO 8601 ending in Z`,
      );
    }
    if (!Number.isFinite(h.lmp_usd_mwh))
      errors.push(`hour ${i}: lmp_usd_mwh is not finite`);
    if (!Number.isFinite(h.co2_g_kwh))
      errors.push(`hour ${i}: co2_g_kwh is not finite`);
    if (
      i > 0 &&
      Date.parse(h.ts_utc) - Date.parse(b.hours[i - 1]!.ts_utc) !== HOUR_MS
    ) {
      errors.push(`hour ${i}: ts_utc ${h.ts_utc} is not consecutive`);
    }
  });
  return errors;
}
