// Shared CLI helpers: read a bundle (exit 2 when missing or invalid), the wear price, timestamps.
import { existsSync, readFileSync } from "node:fs";
import type { Bundle } from "../../contracts/types";
import { validateBundle } from "../src/bundle";
import { DEFAULT_WEAR_USD_MWH } from "../src/policies";

export function readBundle(file: string | undefined): Bundle {
  if (!file || !existsSync(file)) {
    console.error(`bundle not found: ${file ?? "(none given)"}`);
    process.exit(2);
  }
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(file, "utf8"));
  } catch (err) {
    console.error(`bundle is not JSON: ${file}: ${String(err)}`);
    process.exit(2);
  }
  const b = raw as Bundle;
  const errors = (() => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw))
      return ["not an object"];
    if (b.schema !== "clearlane.bundle/v1")
      return [`schema is ${String(b.schema)}`];
    if (!Array.isArray(b.hours)) return ["hours is not an array"];
    if (!b.hours.every((h) => h && typeof h === "object"))
      return ["an hour is not an object"];
    return validateBundle(b);
  })();
  if (errors.length) {
    console.error(`invalid bundle ${file}:\n  ${errors.join("\n  ")}`);
    process.exit(2);
  }
  return b;
}

// The calibrated wear price from backtest.json when it exists; else the research start (ASSUMPTION).
export function wearUsdMwh(
  backtestFile = "public/derived/backtest.json",
): number {
  if (!existsSync(backtestFile)) return DEFAULT_WEAR_USD_MWH;
  const w = (
    JSON.parse(readFileSync(backtestFile, "utf8")) as { wear_usd_mwh?: number }
  ).wear_usd_mwh;
  return typeof w === "number" && Number.isFinite(w) ? w : DEFAULT_WEAR_USD_MWH;
}

// --now when given (deterministic output), else the wall clock.
export function nowUtc(given: string | undefined): string {
  return given ?? new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}
