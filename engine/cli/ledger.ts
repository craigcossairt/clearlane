// Writes public/derived/call_ledger.json (ff_call_ledger): the 2025 heatmap's 359 SIMULATED calls
// replayed on every backtest day under the Mountain and UTC readings, met by all three policies.
// Usage: npx tsx engine/cli/ledger.ts [--seed N] [--hist file] [--torus file] [--out call_ledger.json]
// W is the calibrated wear from backtest.json. Run times are MEASURED and printed, never stored.
// Exit 2 names a missing input; no partial file.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { HistDay, TorusPublished } from "../../contracts/types";
import { DEFAULT_SEED } from "../src/backtest";
import { stableJson } from "../src/json";
import { buildLedger } from "../src/ledger";
import { defaultSite } from "../src/site";
import { argValue } from "./args";
import { wearUsdMwh } from "./common";

const histFile =
  argValue("--hist") ?? "public/data/hist_2026-05-01_2026-10-27.json";
const torusFile = argValue("--torus") ?? "public/data/torus_published.json";
const out = argValue("--out") ?? "public/derived/call_ledger.json";
const seed = Number(argValue("--seed") ?? DEFAULT_SEED);

for (const f of [histFile, torusFile]) {
  if (!existsSync(f)) {
    console.error(`input not found: ${f}`);
    process.exit(2);
  }
}
if (!Number.isInteger(seed)) {
  console.error("--seed must be an integer");
  process.exit(2);
}
const hist = JSON.parse(readFileSync(histFile, "utf8")) as HistDay[];
const torus = JSON.parse(readFileSync(torusFile, "utf8")) as TorusPublished;

const t0 = performance.now();
const ledger = buildLedger(hist, defaultSite(), {
  seed,
  wear_usd_mwh: wearUsdMwh(),
  by_hour: torus.events_2025_by_hour.value,
  by_weekday: torus.events_2025_by_weekday.value,
  sources: { hist: histFile, torus: torusFile },
});
const ms = performance.now() - t0;

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, stableJson(ledger));
console.log(
  `wrote ${out}: ${ledger.rows.length} rows, seed ${seed}, W ${ledger.wear_usd_mwh} $/MWh`,
);
console.log(ledger.replay_density.statement);
for (const r of ledger.per_reading)
  console.log(
    `${r.reading}: ${r.calls} calls on ${r.days_with_calls} days (at most ${r.max_calls_one_day} in a day), ` +
      `${r.calls_inside_prior_refill_window} inside an earlier call's refill window`,
  );
for (const s of ledger.summary)
  console.log(
    `${s.reading} ${s.policy}: ${s.delivered_at_or_above_90_pct_share.toFixed(1)}% at or above 90% delivered, ` +
      `${s.unanswerable_calls} unanswerable, ${s.shortfall_calls} with a shortfall (${s.shortfall_kwh.toFixed(2)} kWh)`,
  );
console.log(
  `MEASURED (not stored): ledger built in ${(ms / 1000).toFixed(1)} s`,
);
