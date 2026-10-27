// Times the live solves on this machine. Prints only; never writes a time to a file.
// Usage: npx tsx engine/cli/bench.ts [bundle.json] [--runs 20]
import { readFileSync } from "node:fs";
import type { Bundle } from "../../contracts/types";
import { crash, defaultSite, scriptedCalls, solve } from "../src/index";
import { argValue } from "./args";

const file = process.argv[2]?.endsWith(".json") ? process.argv[2] : "contracts/fixtures/bundle_2026-10-27.json";
const b = JSON.parse(readFileSync(file, "utf8")) as Bundle;
const runs = Number(argValue("--runs") ?? 20);
const site = defaultSite();
const stat = (xs: number[]) => {
  const s = [...xs].sort((a, z) => a - z);
  return `median ${s[Math.floor(s.length / 2)]!.toFixed(1)} ms, max ${s[s.length - 1]!.toFixed(1)} ms`;
};
for (const policy of ["price_only", "clearlane"] as const) {
  const ms = Array.from({ length: runs }, () => solve(b, site, policy).solve_ms);
  console.log(`${policy} solve over ${runs} runs: ${stat(ms)}`);
}
const plan = solve(b, site, "clearlane");
const [first, second] = scriptedCalls(b, site);
const c1ms = Array.from({ length: runs }, () => crash(plan, site, b, first).replan.solve_ms);
console.log(`re-plan after call 1 over ${runs} runs: ${stat(c1ms)}`);
const c1 = crash(plan, site, b, first);
const c2ms = Array.from({ length: runs }, () => crash(plan, site, b, second, c1).replan.solve_ms);
console.log(`re-plan after call 2 over ${runs} runs: ${stat(c2ms)}`);
