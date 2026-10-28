/**
 * Check judge-facing pitch copy and optionally write resolved files.
 *
 * Exit 0: clean. Exit 1: findings. Exit 2: could not run.
 * Draft mode (no --strict) allows a numbers key to keep its placeholder and
 * prints how many keys are unresolved. --strict fails those keys. Once
 * public/derived/numbers.json exists the run is always strict, so check:all
 * fails on a key the engine does not write.
 * A key with prov "MEASURED" in keys.json renders "[read from screen]".
 *
 * node pitch/resolve.mjs [--strict] [--facts path] [--render dir] [files...]
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { catalogFindings, formatFinding, lintText, parseFacts, resolveInput } from "./lib/rules.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function failRun(message) {
  console.error(`could not run: ${message}`);
  process.exit(2);
}

function parseArgs(argv) {
  const args = { strict: false, facts: null, render: null, files: [] };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--strict") args.strict = true;
    else if (arg === "--facts") args.facts = argv[++i];
    else if (arg === "--render") args.render = argv[++i];
    else if (arg.startsWith("--")) failRun(`unknown flag ${arg}`);
    else args.files.push(arg);
  }
  return args;
}

function readJson(path, label) {
  if (!existsSync(path)) failRun(`missing ${label}: ${path}`);
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    failRun(`bad JSON in ${label}`);
  }
}

function loadContext(args) {
  const catalog = readJson(join(root, "pitch", "keys.json"), "keys.json");
  if (!catalog.keys || typeof catalog.keys !== "object") failRun("bad JSON in keys.json");
  let numbers = null;
  const numbersPath = join(root, "public", "derived", "numbers.json");
  if (existsSync(numbersPath)) {
    const rows = readJson(numbersPath, "numbers.json");
    if (!Array.isArray(rows)) failRun("bad JSON in numbers.json");
    numbers = new Map(rows.map((row) => [row.key, row]));
  }
  const needsFacts = Object.values(catalog.keys).some((entry) => entry.source === "facts");
  let facts = { rows: new Map(), sayInstead: [] };
  const factsPath = args.facts ? resolveInput(root, args.facts) : join(root, "docs", "FACTS.md");
  if (args.facts || needsFacts || existsSync(factsPath)) {
    if (!existsSync(factsPath)) failRun(`unreadable FACTS.md: ${factsPath}`);
    try {
      facts = parseFacts(readFileSync(factsPath, "utf8"));
    } catch {
      failRun(`unreadable FACTS.md: ${factsPath}`);
    }
  }
  const measured = Object.entries(catalog.keys)
    .filter(([, entry]) => entry.prov === "MEASURED")
    .map(([key]) => key);
  return { keys: catalog.keys, numbers, facts, measured, strict: args.strict || numbers !== null };
}

function pitchFiles() {
  const out = [];
  function walk(dir) {
    for (const ent of readdirSync(dir, { withFileTypes: true })) {
      const abs = join(dir, ent.name);
      const rel = relative(root, abs).replaceAll("\\", "/");
      if (ent.isDirectory()) {
        if (rel === "pitch/test/fixtures" || rel.startsWith("pitch/test/fixtures/")) continue;
        // pitch/out holds build.mjs output: resolved copies, not source copy.
        if (rel === "pitch/out") continue;
        walk(abs);
        continue;
      }
      if (!/\.(md|html)$/.test(ent.name)) continue;
      if (rel === "pitch/review-log.md" || /^pitch\/research-.*\.md$/.test(rel)) continue;
      if (rel.startsWith("pitch/test/fixtures/")) continue;
      out.push(rel);
    }
  }
  walk(join(root, "pitch"));
  return out;
}

const args = parseArgs(process.argv.slice(2));
const ctx = loadContext(args);
const files = args.files.length ? args.files : pitchFiles();
const findings = catalogFindings(ctx);
let unresolved = 0;
for (const file of files) {
  const abs = join(root, file);
  if (!existsSync(abs)) failRun(`unreadable ${file}`);
  const text = readFileSync(abs, "utf8");
  const result = lintText(file, text, ctx);
  findings.push(...result.findings);
  unresolved += result.unresolved;
  if (args.render && result.findings.length === 0) {
    const dest = join(args.render, file);
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, result.rendered, "utf8");
  }
}
if (!args.strict) console.log(`unresolved: ${unresolved}`);
if (findings.length) {
  console.error(findings.map(formatFinding).join("\n"));
  process.exit(1);
}
console.log(`ok: ${Object.keys(ctx.keys).length} keys`);
