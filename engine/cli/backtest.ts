// Writes public/derived/backtest.json and backtest_days.json: all three policies on every day of the window.
// Usage: npx tsx engine/cli/backtest.ts [--hist file] [--torus file] [--wear W] [--seed N]
//          [--start YYYY-MM-DD] [--end YYYY-MM-DD] [--out backtest.json]
// The per-day rows go next to --out: backtest_pge.json -> backtest_pge_days.json.
// Without --wear, W is calibrated: the smallest W keeping clearlane within 300 Pulse cycles a year.
// A price-only history (every co2_g_kwh null, the PACW and PGE files) runs at the stage W from
// backtest.json instead, with null CO2 statistics and the history's meta notes carried over.
// Solve times are MEASURED and printed, never stored. Exit 2 names a missing input; no partial file.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { HistDay, TorusPublished } from "../../contracts/types";
import {
  BACKTEST_WINDOW,
  backtestDaysPath,
  DEFAULT_SEED,
  isPriceOnly,
  runBacktest,
  validateBacktest,
} from "../src/backtest";
import { stableJson } from "../src/json";
import { percentile } from "../src/stats";
import { defaultSite } from "../src/site";
import { calibrateWear } from "../src/wear";
import { argValue } from "./args";
import { wearUsdMwh } from "./common";

const histFile =
  argValue("--hist") ?? "public/data/hist_2026-05-01_2026-10-27.json";
const torusFile = argValue("--torus") ?? "public/data/torus_published.json";
const out = argValue("--out") ?? "public/derived/backtest.json";
const wearArg = argValue("--wear");
const seed = Number(argValue("--seed") ?? DEFAULT_SEED);
const start = argValue("--start") ?? BACKTEST_WINDOW.start_mt;
const end = argValue("--end") ?? BACKTEST_WINDOW.end_mt;

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
const isDay = (d: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(`${d}T00:00:00Z`));
if (!isDay(start) || !isDay(end) || start > end) {
  console.error(
    "--start and --end must be YYYY-MM-DD days, start not after end",
  );
  process.exit(2);
}
const hist = JSON.parse(readFileSync(histFile, "utf8")) as HistDay[];
const torus = JSON.parse(readFileSync(torusFile, "utf8")) as TorusPublished;

const site = defaultSite();
const priceOnly = isPriceOnly(hist, start, end);
const t0 = performance.now();
let wear: number;
const notes: string[] = [];
if (wearArg !== undefined) {
  wear = Number(wearArg);
  console.log(`W ${wear} $/MWh from --wear (not calibrated)`);
  notes.push(`W ${wear} $/MWh from --wear, not calibrated on this history.`);
} else if (priceOnly) {
  const stage = existsSync("public/derived/backtest.json");
  wear = wearUsdMwh();
  console.log(
    `W ${wear} $/MWh: ${stage ? "the stage W from backtest.json" : "the research start (ASSUMPTION), no backtest.json"} ` +
      "(price-only history, not calibrated)",
  );
  notes.push(
    stage
      ? `W ${wear} $/MWh is the stage wear price, calibrated on the PACE history (backtest.json), not on this node.`
      : `W ${wear} $/MWh is the research start (ASSUMPTION): there is no backtest.json to take the stage W from.`,
  );
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
  start_mt: start,
  end_mt: end,
  allow_price_only: true,
});
const totalMs = performance.now() - t0;

// A price-only result carries the W used and the history's own meta notes (node, scope, window).
if (run.result.price_only) {
  const metaFile = histFile.replace(/\.json$/, ".meta.json");
  const meta = existsSync(metaFile)
    ? (JSON.parse(readFileSync(metaFile, "utf8")) as { notes?: unknown })
    : undefined;
  const metaNotes = Array.isArray(meta?.notes)
    ? meta.notes.filter((n): n is string => typeof n === "string")
    : [];
  if (!meta)
    console.log(`no ${metaFile}: the history's notes are not carried over`);
  run.result.notes = [...run.result.notes!, ...notes, ...metaNotes];
}

const errors = validateBacktest(run.result);
if (errors.length) {
  console.error(`backtest failed validation:\n  ${errors.join("\n  ")}`);
  process.exit(1);
}
mkdirSync(dirname(out), { recursive: true });
const daysOut = backtestDaysPath(out);
writeFileSync(out, stableJson(run.result));
writeFileSync(daysOut, stableJson(run.days));

const w = run.result.window;
console.log(
  `wrote ${out} and ${daysOut}: ${w.days} days, ${w.missing_days.length} missing, W ${wear} $/MWh, seed ${seed}`,
);
console.log(
  run.result.price_only
    ? "price only: every co2_g_kwh in the window is null, so every CO2 statistic is null"
    : `CO2 statistics leave out days trading in a null-CO2 hour: ${JSON.stringify(run.co2_excluded_days)}`,
);
console.log(
  `MEASURED (not stored): ${run.solve_ms.length} solves, median ${percentile(run.solve_ms, 0.5).toFixed(2)} ms, ` +
    `p90 ${percentile(run.solve_ms, 0.9).toFixed(2)} ms; whole backtest ${(totalMs / 1000).toFixed(1)} s`,
);
