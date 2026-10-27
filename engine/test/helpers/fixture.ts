import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Bundle } from "@contracts/types";

export const repoPath = (p: string) =>
  fileURLToPath(new URL(`../../../${p}`, import.meta.url));

export function loadFixture(): Bundle {
  return JSON.parse(
    readFileSync(repoPath("contracts/fixtures/bundle_2026-10-27.json"), "utf8"),
  ) as Bundle;
}

const addHours = (iso: string, h: number) => {
  const d = new Date(iso);
  d.setUTCHours(d.getUTCHours() + h);
  return d.toISOString().replace(".000Z", "Z");
};

// The fixture moved forward by `days`, with prices taken from `prices` when given.
export function redated(b: Bundle, days: number, prices?: number[]): Bundle {
  const day = addHours(`${b.operating_day_mt}T12:00:00Z`, 24 * days).slice(
    0,
    10,
  );
  return {
    ...b,
    operating_day_mt: day,
    hours: b.hours.map((h, i) => ({
      ...h,
      ts_utc: addHours(h.ts_utc, 24 * days),
      local_mt: `${day}T${String(h.hour_mt).padStart(2, "0")}:00-06:00`,
      lmp_usd_mwh: prices ? prices[i]! : h.lmp_usd_mwh,
    })),
    notes: [],
  };
}
