/**
 * Resolve {key} placeholders in judge-facing pitch copy.
 *
 * Usage: node pitch/resolve.mjs [file...]
 * With no files, checks every .md in pitch/ except review-log.md and research-tariff.md.
 *
 * Exit 0 when every key is known and the copy has no em dash or banned phrase.
 * Exit 1 when a key is unknown, a number is hand-typed, or a guardrail fails.
 * If public/derived/numbers.json exists, display text comes from there and a
 * key missing from that file fails. Until it exists, pitch/keys.json is the catalog.
 *
 * Two kinds of key never read numbers.json (docs/lanes/pitch.md section 3):
 * - source "facts": display is the keys.json wording, which must appear verbatim
 *   in the named FACTS row (`fact`). The row must be VERIFIED, or CONFLICT with
 *   the display inside its say-instead wording. Such a key in numbers.json fails.
 * - prov "MEASURED": timed live on the demo machine, rendered "[read from screen]".
 *   Such a key in numbers.json fails.
 */

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseFacts } from "../tools/lib/facts.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const keysPath = join(root, "pitch", "keys.json");
const numbersPath = join(root, "public", "derived", "numbers.json");
const factsPath = join(root, "docs", "FACTS.md");
const MEASURED_DISPLAY = "[read from screen]";

const BANNED = [
  [/Torus lacks/i, "Torus lacks"],
  [/Torus can't/i, "Torus can't"],
  [/Torus cannot/i, "Torus cannot"],
  [/Lasso doesn't/i, "Lasso doesn't"],
  [/Lasso does not/i, "Lasso does not"],
];

const SKIP = new Set(["review-log.md", "research-tariff.md", "keys.json"]);

function factsDisplay(key, entry, facts) {
  const fact = facts.get(entry.fact);
  if (!fact)
    throw new Error(
      `${key}: source "facts" names FACTS row ${entry.fact}, which does not exist`,
    );
  const display = entry.display;
  if (
    typeof display !== "string" ||
    display.length === 0 ||
    display.includes("{")
  ) {
    throw new Error(
      `${key}: source "facts" needs its exact wording in display`,
    );
  }
  if (
    fact.status === "VERIFIED" &&
    (fact.claim.includes(display) || fact.value.includes(display))
  )
    return display;
  if (fact.status === "CONFLICT" && fact.sayInstead?.includes(display))
    return display;
  throw new Error(
    `${key}: display "${display}" is not in FACTS row ${entry.fact} as allowed for status ${fact.status}`,
  );
}

function loadCatalog() {
  const catalog = JSON.parse(readFileSync(keysPath, "utf8")).keys;
  const facts = parseFacts(readFileSync(factsPath, "utf8"));
  const display = {};
  for (const [key, entry] of Object.entries(catalog)) {
    if (entry.prov === "MEASURED") display[key] = MEASURED_DISPLAY;
    else if (entry.source === "facts")
      display[key] = factsDisplay(key, entry, facts);
    else display[key] = entry.display;
  }
  if (!existsSync(numbersPath)) return { display, fromNumbers: false };
  const rows = JSON.parse(readFileSync(numbersPath, "utf8"));
  const byKey = new Map(rows.map((row) => [row.key, row]));
  for (const [key, entry] of Object.entries(catalog)) {
    const row = byKey.get(key);
    if (entry.prov === "MEASURED" || entry.source === "facts") {
      if (row)
        throw new Error(
          `${key}: ${entry.prov === "MEASURED" ? "MEASURED" : 'source "facts"'}, but numbers.json also has a row for it`,
        );
      continue;
    }
    if (!row) throw new Error(`numbers.json has no row for ${key}`);
    if (typeof row.display !== "string" || row.display.length === 0) {
      throw new Error(`numbers.json display empty for ${key}`);
    }
    display[key] = row.display;
  }
  return { display, fromNumbers: true };
}

function check(file, text, display) {
  const errors = [];
  if (text.includes("\u2014") || text.includes("\u2013")) {
    errors.push(`${file}: em dash or en dash`);
  }
  for (const [pattern, label] of BANNED) {
    if (pattern.test(text)) errors.push(`${file}: banned phrase "${label}"`);
  }
  // A result a judge could read as ours: a dollar figure, a percent, or a
  // number glued to a unit. Years, docket numbers and clock times are not
  // results. A bare count has to be a {key}; a year (19xx or 20xx) does not.
  const withoutKeys = text.replace(/\{[a-z0-9_]+\}/g, " ");
  const result = withoutKeys.match(
    /\$\s?\d|\d+(?:\.\d+)?\s?%|\d[\d,]*(?:\.\d+)?\s?(?:MW|kW|kWh|MWh|g\/kWh|t\/day|ms)\b|\b(?!19|20)\d{3,}\b/,
  );
  if (result) errors.push(`${file}: hand-typed result "${result[0]}"`);
  for (const match of text.matchAll(/\{([a-z0-9_]+)\}/g)) {
    const key = match[1];
    if (key === "key") continue;
    if (!(key in display)) errors.push(`${file}: unknown key {${key}}`);
  }
  return errors;
}

function filesFromArgs(args) {
  if (args.length) return args;
  return readdirSync(join(root, "pitch"))
    .filter((name) => name.endsWith(".md") && !SKIP.has(name))
    .map((name) => join("pitch", name));
}

const { display } = loadCatalog();
const errors = [];
for (const file of filesFromArgs(process.argv.slice(2))) {
  const text = readFileSync(join(root, file), "utf8");
  errors.push(...check(file, text, display));
}
if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log(`ok: ${Object.keys(display).length} keys`);
