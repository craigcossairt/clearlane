// Writes public/derived/site_default.json. Usage: npx tsx engine/cli/site.ts [--out <path>]
import { writeFileSync } from "node:fs";
import { stableJson } from "../src/json";
import { siteDefaultExport } from "../src/siteExport";
import { argValue } from "./args";

const out = argValue("--out") ?? "public/derived/site_default.json";
writeFileSync(out, stableJson(siteDefaultExport()));
console.log(`wrote ${out}`);
