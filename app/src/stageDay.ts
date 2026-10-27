import type { StageNumber } from "@contracts/types";
import { NUMBERS_FILE, type BundleEntry, type StageData } from "./data";

/**
 * Day-level keys: the race keys, which the engine CLI regenerates for whichever bundle goes on
 * stage. Their shared as_of_mt is the stage day. Backtest keys describe a window and are exempt.
 */
export const DAY_LEVEL_KEYS = [
  "fixed_usd_mw_day",
  "clearlane_usd_mw_day",
  "race_ratio",
  "fixed_70",
  "clearlane_70",
] as const;

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

export type DayFromNumbers =
  | { kind: "none" }
  | { kind: "day"; day: string }
  | { kind: "disagree"; days: string[] };

export function dayFromNumbers(numbers: StageNumber[] | null): DayFromNumbers {
  if (!numbers) return { kind: "none" };
  const days = new Set<string>();
  for (const key of DAY_LEVEL_KEYS) {
    const row = numbers.find((n) => n.key === key);
    if (row) days.add(row.as_of_mt);
  }
  if (days.size === 0) return { kind: "none" };
  if (days.size > 1) return { kind: "disagree", days: [...days].sort() };
  return { kind: "day", day: [...days][0] as string };
}

export type StageDay =
  | { state: "ready"; day: string; entry: BundleEntry }
  | { state: "failed"; reason: string };

/**
 * The stage day: ?day= wins, then numbers.json's day-level as_of_mt, then the latest bundle.
 * A bundle that describes another day than numbers.json is a failed state naming both files.
 */
export function resolveStageDay(data: StageData, search: string): StageDay {
  const param = new URLSearchParams(search).get("day");
  const fromNumbers = dayFromNumbers(data.numbers);
  if (fromNumbers.kind === "disagree") {
    return {
      state: "failed",
      reason: `${NUMBERS_FILE} describes more than one day: ${fromNumbers.days.join(", ")}`,
    };
  }
  const bundleDays = Object.keys(data.bundles).sort();
  const latest = bundleDays[bundleDays.length - 1];
  const day =
    param && DAY_RE.test(param)
      ? param
      : fromNumbers.kind === "day"
        ? fromNumbers.day
        : latest;
  if (!day) return { state: "failed", reason: "no bundle file is present" };
  const entry = data.bundles[day];
  if (!entry) {
    const source = fromNumbers.kind === "day" && !param ? NUMBERS_FILE : "?day=";
    return {
      state: "failed",
      reason: `${source} asks for ${day}, but no bundle file describes it (found: ${bundleDays.join(", ") || "none"})`,
    };
  }
  if (fromNumbers.kind === "day" && fromNumbers.day !== day) {
    return {
      state: "failed",
      reason: `${entry.file} is ${day} but ${NUMBERS_FILE} is ${fromNumbers.day}`,
    };
  }
  return { state: "ready", day, entry };
}

/** The current America/Denver calendar date as YYYY-MM-DD. */
export function mountainDate(now: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Denver",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export type DayLabel = "today" | "tomorrow" | "cached";

export function dayLabel(day: string, now: Date): DayLabel {
  const today = mountainDate(now);
  if (day === today) return "today";
  const next = mountainDate(new Date(now.getTime() + 24 * 3600 * 1000));
  if (day === next) return "tomorrow";
  return "cached";
}
