// Writes public/derived/backtest_days.json, then public/derived/sensitivity.json (ff_sensitivity): each
// input varied one at a time over the backtest, break-evens and the RTE x spread grid.
// Usage: npx tsx engine/cli/sensitivity.ts [--hist file] [--torus file] [--backtest backtest.json]
//   [--response-tables file] (the marginal CO2 estimate for the CO2 basis axis, #47)
// W and the seed come from backtest.json, and the base run must reproduce it byte for byte (else exit 1).
// Exit 2 names a missing input; no partial file. Run time is MEASURED and printed, never stored.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type {
  BacktestResult,
  HistDay,
  TorusPublished,
} from "../../contracts/types";
import { stableJson } from "../src/json";
import { buildSensitivity, runBase } from "../src/sensitivity";
import type { MarginalCo2, SensCtx } from "../src/sensitivity";
import { defaultSite } from "../src/site";
import { argValue } from "./args";

const histFile =
  argValue("--hist") ?? "public/data/hist_2026-05-01_2026-10-27.json";
const torusFile = argValue("--torus") ?? "public/data/torus_published.json";
const backtestFile = argValue("--backtest") ?? "public/derived/backtest.json";
const responseFile =
  argValue("--response-tables") ?? "public/data/response_tables.json";

for (const f of [histFile, torusFile, backtestFile, responseFile]) {
  if (!existsSync(f)) {
    console.error(`input not found: ${f}`);
    process.exit(2);
  }
}
const hist = JSON.parse(readFileSync(histFile, "utf8")) as HistDay[];
const torus = JSON.parse(readFileSync(torusFile, "utf8")) as TorusPublished;
const backtestText = readFileSync(backtestFile, "utf8");
const backtest = JSON.parse(backtestText) as BacktestResult;
const response = JSON.parse(readFileSync(responseFile, "utf8")) as {
  tables: { marginal_co2: MarginalCo2 };
};

const ctx: SensCtx = {
  hist,
  site: defaultSite(),
  wear_usd_mwh: backtest.wear_usd_mwh,
  seed: backtest.seed,
  by_hour: torus.events_2025_by_hour.value,
  by_weekday: torus.events_2025_by_weekday.value,
  marginal_co2: response.tables.marginal_co2,
};

const t0 = performance.now();
const base = runBase(ctx);
if (stableJson(base.result) !== backtestText) {
  console.error(
    `the base case does not reproduce ${backtestFile}; nothing written`,
  );
  process.exit(1);
}
const outDir = dirname(backtestFile);
const daysOut = join(outDir, "backtest_days.json");
const sensOut = join(outDir, "sensitivity.json");
mkdirSync(outDir, { recursive: true });
writeFileSync(daysOut, stableJson(base.days));
console.log(
  `wrote ${daysOut}: ${base.days.length} rows (base case equals ${backtestFile})`,
);

const s = buildSensitivity(ctx, base, { backtest: backtestFile });
writeFileSync(sensOut, stableJson(s));
const ms = performance.now() - t0;

const f2 = (x: number | null) => (x === null ? "n/a" : x.toFixed(2));
const g = s.base.gap;
console.log(
  `wrote ${sensOut}. Base gap (Clearlane minus the off-peak rule): $${f2(g.usd_per_mw_day)}/MW-day, ` +
    `${f2(g.co2_t_per_mw_day)} t CO2/MW-day, ${f2(g.calls_unanswerable_pct_points)} pp calls unanswerable`,
);
for (const a of s.axes) {
  if (a.status === "pending") {
    console.log(`  ${a.key}: pending on ${a.pending_on}`);
    continue;
  }
  console.log(
    `  ${a.key} ${a.low} to ${a.high}: $/MW-day ${f2(a.delta_low.usd_per_mw_day)} / ${f2(a.delta_high.usd_per_mw_day)}, ` +
      `t CO2 ${f2(a.delta_low.co2_t_per_mw_day)} / ${f2(a.delta_high.co2_t_per_mw_day)}, ` +
      `calls pp ${f2(a.delta_low.calls_unanswerable_pct_points)} / ${f2(a.delta_high.calls_unanswerable_pct_points)}`,
  );
}
const be = s.break_even;
for (const x of [be.rte, be.daily_spread, be.wear_usd_mwh, be.by_day_spread])
  console.log(x.statement);
console.log(`MEASURED (not stored): ${(ms / 1000).toFixed(1)} s`);
