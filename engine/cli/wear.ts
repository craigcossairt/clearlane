// Writes public/derived/wear_rainflow.json (stretch #70, flag ff_wear_rainflow): rainflow cycle counts,
// Miner equivalent cycles at k = 1, 1.5 and 2 with a cycle-life estimate (ASSUMPTION), and hours above 80%
// and at full, for all three policies over the backtest; the depth-aware DP; and the stage day.
// Nothing in the six beats runs this; running it is the flag. No core file is written.
// Usage: npx tsx engine/cli/wear.ts [--hist file] [--torus file] [--backtest backtest.json] [--bundle file]
//          [--out public/derived/wear_rainflow.json] [--now iso]
// W is the calibrated wear price in backtest.json. The bundle defaults to the one public/derived/numbers.json
// was built from. A missing input exits 2. Run time is MEASURED and printed, never stored.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type {
  BacktestResult,
  HistDay,
  TorusPublished,
} from "../../contracts/types";
import { stableJson } from "../src/json";
import { wearRainflow } from "../src/rainflow";
import { defaultSite } from "../src/site";
import { argValue } from "./args";
import { nowUtc, readBundle } from "./common";

const rel = (p: string) => p.replace(/\\/g, "/");
const fail = (msg: string): never => {
  console.error(msg);
  process.exit(2);
};
const readText = (f: string, what: string) =>
  existsSync(f) ? readFileSync(f, "utf8") : fail(`${what} not found: ${f}`);

// The bundle named in numbers.json's sources (exactly one public/data/bundle_<day>.json).
function stageBundle(numbersFile: string): string {
  const days = new Set(
    [
      ...readText(numbersFile, "numbers.json").matchAll(
        /public\/data\/bundle_(\d{4}-\d{2}-\d{2})\.json/g,
      ),
    ].map((m) => m[1]),
  );
  if (days.size !== 1)
    fail(
      `${numbersFile} names ${days.size} bundles; pass --bundle public/data/bundle_<day>.json`,
    );
  return `public/data/bundle_${[...days][0]}.json`;
}

const histPath = rel(
  argValue("--hist") ?? "public/data/hist_2026-05-01_2026-10-27.json",
);
const torusPath = rel(
  argValue("--torus") ?? "public/data/torus_published.json",
);
const backtestPath = rel(
  argValue("--backtest") ?? "public/derived/backtest.json",
);
const bundlePath = rel(
  argValue("--bundle") ?? stageBundle("public/derived/numbers.json"),
);
const out = argValue("--out") ?? "public/derived/wear_rainflow.json";

const hist = JSON.parse(readText(histPath, "hist")) as HistDay[];
const torus = JSON.parse(
  readText(torusPath, "torus_published"),
) as TorusPublished;
const backtest = JSON.parse(
  readText(backtestPath, "backtest.json"),
) as BacktestResult;
const bundle = readBundle(bundlePath);

const t0 = performance.now();
const w = wearRainflow({
  hist,
  site: defaultSite(),
  wear_usd_mwh: backtest.wear_usd_mwh,
  bundle,
  rated_cycles: torus.pulse_cycle_life.value,
  station_life_yr: torus.pulse_life_yr.value,
  sources: {
    hist: histPath,
    torus: torusPath,
    backtest: backtestPath,
    bundle: bundlePath,
  },
  generated_utc: nowUtc(argValue("--now")),
});
const ms = performance.now() - t0;
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, stableJson(w));

const f = (x: number, d = 1) => x.toFixed(d);
console.log(
  `wrote ${out}: ${w.window.days} days, W $${w.wear_usd_mwh}/MWh, rated ${w.rating.pulse_cycle_life} cycles at DoD ${w.rating.rated_dod} (ASSUMPTION)`,
);
for (const p of w.policies)
  console.log(
    `  ${p.policy}: throughput ${f(p.throughput_cycles_per_yr)}/yr, ` +
      p.by_k
        .map(
          (x) =>
            `k ${x.k}: ${f(x.equivalent_cycles_per_yr)}/yr, life ${f(x.life_yr)} yr`,
        )
        .join("; ") +
      `; above 80% ${f(p.dwell_h_above_80pct.mean, 2)} h/day, full ${f(p.full_h.mean, 2)} h/day`,
  );
for (const d of w.depth_aware_clearlane)
  console.log(
    `  depth-aware clearlane k ${d.k}: gross $${f(d.usd_per_mw_day.mean, 2)}/MW-day ` +
      `(${f(d.usd_per_mw_day_vs_linear, 2)} vs linear), wear $${f(d.wear_usd_per_mw_day, 2)}, ` +
      `net $${f(d.net_usd_per_mw_day, 2)} (${f(d.net_usd_per_mw_day_vs_linear, 2)} vs linear at the same wear), ` +
      `plan changed on ${d.days_plan_changed} days, ${f(d.equivalent_cycles_per_yr)} eq cycles/yr`,
  );
const r = w.stage_day.race_full_h;
console.log(
  `  ${w.stage_day.operating_day_mt} race: full ${r.fixed_overnight} h on the off-peak rule, ${r.timetable} h on the timetable`,
);
console.log(`MEASURED (not stored): ${(ms / 1000).toFixed(1)} s`);
