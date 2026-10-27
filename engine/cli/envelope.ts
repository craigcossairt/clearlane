// Writes public/derived/envelope_<operating_day_mt>.json for the clearlane plan.
// Usage: npx tsx engine/cli/envelope.ts <bundle.json> [--fleet-kw N] [--now ISO] [--out dir]
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildEnvelope, validateEnvelope } from "../src/envelope";
import { stableJson } from "../src/json";
import { solve } from "../src/policies";
import { defaultSite } from "../src/site";
import { argValue } from "./args";
import { nowUtc, readBundle, wearUsdMwh } from "./common";

const b = readBundle(process.argv[2]);
const site = defaultSite();
const fleet = argValue("--fleet-kw");
const outDir = argValue("--out") ?? "public/derived";
const plan = solve(b, site, "clearlane", { wear_usd_mwh: wearUsdMwh() });
const env = buildEnvelope(plan, site, b, {
  fleet_kw: fleet === undefined ? undefined : Number(fleet),
  generated_utc: nowUtc(argValue("--now")),
});
const errors = validateEnvelope(env);
if (errors.length) {
  console.error(`envelope failed validation:\n  ${errors.join("\n  ")}`);
  process.exit(1);
}
mkdirSync(outDir, { recursive: true });
const out = join(outDir, `envelope_${b.operating_day_mt}.json`);
writeFileSync(out, stableJson(env));
console.log(
  `wrote ${out} (fleet ${env.fleet_kw} kW, W ${plan.wear_usd_mwh} $/MWh)`,
);
