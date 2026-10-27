// Writes public/derived/numbers.json: every stage number, with its provenance, sorted by key.
// Usage: npx tsx engine/cli/numbers.ts <bundle.json> [--backtest file] [--torus file] [--hist file]
//          [--snapshot file] [--facts docs/FACTS.md] [--out public/derived/numbers.json]
// A missing optional input omits its keys and says which (exit 0). A missing bundle exits 2.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type {
  BacktestResult,
  HistDay,
  TorusPublished,
} from "../../contracts/types";
import { validateBacktest } from "../src/backtest";
import { stableJson } from "../src/json";
import {
  buildNumbers,
  factsRegistry,
  registryWithNewKeys,
  snapshotPricesFromCsv,
  validateNumbers,
} from "../src/numbers";
import { DEFAULT_WEAR_USD_MWH } from "../src/policies";
import { defaultSite } from "../src/site";
import { argValue } from "./args";
import { readBundle } from "./common";

const rel = (p: string) => p.replace(/\\/g, "/");
const bundlePath = process.argv[2];
const b = readBundle(bundlePath);
const files = {
  backtest: argValue("--backtest") ?? "public/derived/backtest.json",
  torus: argValue("--torus") ?? "public/data/torus_published.json",
  hist: argValue("--hist") ?? "public/data/hist_2026-05-01_2026-10-27.json",
  snapshot:
    argValue("--snapshot") ?? "research/data/pace_snapshot_2026-10-27.csv",
};
const factsPath = argValue("--facts") ?? "docs/FACTS.md";
const out = argValue("--out") ?? "public/derived/numbers.json";

const omitted: string[] = [];
function optional<T>(name: keyof typeof files, parse: (text: string) => T) {
  const f = files[name];
  if (!existsSync(f)) {
    omitted.push(`${name} (${f})`);
    return undefined;
  }
  return { data: parse(readFileSync(f, "utf8")), path: rel(f) };
}

const backtest = optional("backtest", (t) => JSON.parse(t) as BacktestResult);
if (backtest && validateBacktest(backtest.data).length) {
  console.error(
    `invalid backtest ${backtest.path}: ${validateBacktest(backtest.data).join("; ")}`,
  );
  process.exit(1);
}
const torus = optional("torus", (t) => JSON.parse(t) as TorusPublished);
const hist = optional("hist", (t) => JSON.parse(t) as HistDay[]);
const snap = optional("snapshot", snapshotPricesFromCsv);

const reg = registryWithNewKeys(factsRegistry(readFileSync(factsPath, "utf8")));
const numbers = buildNumbers(
  {
    bundle: b,
    bundle_path: rel(bundlePath!),
    site: defaultSite(),
    wear_usd_mwh: backtest?.data.wear_usd_mwh ?? DEFAULT_WEAR_USD_MWH,
    snapshot: snap && { prices: snap.data, path: snap.path },
    torus,
    backtest,
    hist,
  },
  reg,
);
const errors = validateNumbers(numbers, reg);
if (errors.length) {
  console.error(`numbers failed validation:\n  ${errors.join("\n  ")}`);
  process.exit(1);
}
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, stableJson(numbers));
console.log(`wrote ${out}: ${numbers.length} keys for ${b.operating_day_mt}`);
if (omitted.length)
  console.log(`inputs missing, their keys left out: ${omitted.join(", ")}`);
if (!backtest)
  console.log(
    `no backtest: the site plan uses W ${DEFAULT_WEAR_USD_MWH} $/MWh (research start)`,
  );
