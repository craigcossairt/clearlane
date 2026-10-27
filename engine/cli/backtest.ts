// Writes public/derived/backtest.json and backtest_days.json: all three policies on every day of the window.
// Usage: npx tsx engine/cli/backtest.ts [--hist file] [--torus file] [--wear W] [--seed N] [--out backtest.json]
// Without --wear, W is calibrated: the smallest W keeping clearlane within 300 Pulse cycles a year.
// Solve times are MEASURED and printed, never stored. Exit 2 names a missing input; no partial file.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { HistDay, TorusPublished } from "../../contracts/types";
import { DEFAULT_SEED, runBacktest, validateBacktest } from "../src/backtest";
import { stableJson } from "../src/json";
import { percentile } from "../src/stats";
import { defaultSite } from "../src/site";
import { calibrateWear } from "../src/wear";
import { argValue } from "./args";

const histFile =
  argValue("--hist") ?? "public/data/hist_2026-05-01_2026-10-27.json";
const torusFile = argValue("--torus") ?? "public/data/torus_published.json";
const out = argValue("--out") ?? "public/derived/backtest.json";
const wearArg = argValue("--wear");
const seed = Number(argValue("--seed") ?? DEFAULT_SEED);

for (const f of [histFile, torusFile]) {
  if (!existsSync(f)) {
    console.error(`input not found: ${f}`);
    process.exit(2);
  }
}
if (
  (wearArg !== undefined && !Number.isFinite(Number(wearArg))) ||
  !Number.isInteger(seed)
) {
  console.error("--wear must be a number and --seed an integer");
  process.exit(2);
}
const hist = JSON.parse(readFileSync(histFile, "utf8")) as HistDay[];
const torus = JSON.parse(readFileSync(torusFile, "utf8")) as TorusPublished;

const site = defaultSite();
const t0 = performance.now();
let wear: number;
if (wearArg !== undefined) {
  wear = Number(wearArg);
  console.log(`W ${wear} $/MWh from --wear (not calibrated)`);
} else {
  const cal = calibrateWear(hist, site);
  wear = cal.wear_usd_mwh;
  console.log(
    `calibrated W ${wear.toFixed(2)} $/MWh: clearlane ${cal.cycles_per_yr.toFixed(1)} cycles a year ` +
      `(budget ${cal.budget}); at W 10: ${cal.cycles_at_10.toFixed(1)}; ` +
      `${cal.monotone ? "monotone" : "NOT monotone, refined inside the first feasible $0.50 step"}; ` +
      `${cal.evaluations} evaluations${cal.feasible ? "" : "; INFEASIBLE at the top of the bracket"}`,
  );
}
const run = runBacktest(hist, site, {
  wear_usd_mwh: wear,
  seed,
  by_hour: torus.events_2025_by_hour.value,
  by_weekday: torus.events_2025_by_weekday.value,
});
const totalMs = performance.now() - t0;

const errors = validateBacktest(run.result);
if (errors.length) {
  console.error(`backtest failed validation:\n  ${errors.join("\n  ")}`);
  process.exit(1);
}
mkdirSync(dirname(out), { recursive: true });
const daysOut = join(dirname(out), "backtest_days.json");
writeFileSync(out, stableJson(run.result));
writeFileSync(daysOut, stableJson(run.days));

const w = run.result.window;
console.log(
  `wrote ${out} and ${daysOut}: ${w.days} days, ${w.missing_days.length} missing, W ${wear} $/MWh, seed ${seed}`,
);
console.log(
  `CO2 statistics leave out days trading in a null-CO2 hour: ${JSON.stringify(run.co2_excluded_days)}`,
);
console.log(
  `MEASURED (not stored): ${run.solve_ms.length} solves, median ${percentile(run.solve_ms, 0.5).toFixed(2)} ms, ` +
    `p90 ${percentile(run.solve_ms, 0.9).toFixed(2)} ms; whole backtest ${(totalMs / 1000).toFixed(1)} s`,
);
