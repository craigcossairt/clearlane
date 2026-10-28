// Writes public/derived/host_frontier.json (ff_host_frontier): the evening block a SIMULATED host can
// give RMP before its month-to-date peak moves, Oct 1 to 27 at REAL day-ahead prices.
// Usage: npx tsx engine/cli/frontier.ts [--seed N] [--hist file] [--out host_frontier.json]
// Exit 2 names a missing input. Run time is MEASURED and printed, never stored.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { HistDay } from "../../contracts/types";
import { DEFAULT_SEED } from "../src/backtest";
import { buildFrontier } from "../src/frontier";
import { stableJson } from "../src/json";
import { defaultSite } from "../src/site";
import { argValue } from "./args";

const histFile =
  argValue("--hist") ?? "public/data/hist_2026-05-01_2026-10-27.json";
const out = argValue("--out") ?? "public/derived/host_frontier.json";
const seed = Number(argValue("--seed") ?? DEFAULT_SEED);

if (!existsSync(histFile)) {
  console.error(`input not found: ${histFile}`);
  process.exit(2);
}
const hist = JSON.parse(readFileSync(histFile, "utf8")) as HistDay[];

const t0 = performance.now();
const f = buildFrontier(hist, defaultSite(), {
  seed,
  start_mt: "2026-10-01",
  end_mt: "2026-10-27",
  hist_path: histFile.replace(/\\/g, "/"),
});
const ms = performance.now() - t0;
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, stableJson(f));

console.log(
  `wrote ${out}: ${f.archetypes.length} SIMULATED archetypes, ${f.window.days} days, seed ${seed}`,
);
for (const a of f.archetypes) {
  console.log(`  ${a.statement}`);
  for (const s of a.steps)
    console.log(
      `    ${String(s.block_kw).padStart(5)} kW: ` +
        (s.deliverable
          ? `peak ${s.monthly_peak_kw!.toFixed(1)} kW (+${s.peak_increase_kw!.toFixed(1)}), ${s.days_above_own_shaving_peak} days above their own shaving peak, grid value $${s.grid_value_usd_per_mw_day!.toFixed(2)}/MW-day`
          : `not deliverable (${s.not_deliverable_reason})`),
    );
}
console.log(`MEASURED (not stored): ${(ms / 1000).toFixed(1)} s`);
