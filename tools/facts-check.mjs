// Usage: node tools/facts-check.mjs [--allow-pending] [--root <dir>] [--numbers <file>]
// Keeps docs/FACTS.md, public/derived/numbers.json and the judge copy in step
// (integration.md section 6.9). Exit 0 PASS, 1 FAIL, 2 could not run.
// --allow-pending: while numbers.json is not built, a PENDING-ENGINE key in judge
// copy is a WARN instead of a FAIL. Nothing else changes.
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { CouldNotRun, formatReport, runFactsCheck } from "./lib/facts.mjs";

const args = process.argv.slice(2);
let root = join(dirname(fileURLToPath(import.meta.url)), "..");
let numbersFile;
let allowPending = false;
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === "--allow-pending") allowPending = true;
  else if (a === "--root" && args[i + 1]) root = resolve(args[++i]);
  else if (a === "--numbers" && args[i + 1]) numbersFile = resolve(args[++i]);
  else {
    console.error(`facts-check: unknown argument ${a}`);
    process.exit(2);
  }
}

try {
  const { findings } = runFactsCheck({ root, numbersFile, allowPending });
  const { lines, exitCode } = formatReport(findings);
  console.log(lines.join("\n"));
  process.exit(exitCode);
} catch (e) {
  if (e instanceof CouldNotRun) {
    console.error(`facts-check could not run: ${e.message}`);
    process.exit(2);
  }
  console.error(e);
  process.exit(2);
}
