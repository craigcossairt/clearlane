/**
 * Apply the pitch guardrails to the added lines of a diff.
 *
 * node pitch/review/scan.mjs <diff file>
 *
 * Prints `file:line: rule: text` per finding. Exit 0 clean, 1 findings, 2 could not run.
 * Judge-facing paths get every rule. docs/FACTS.md and docs/lanes/** get the em dash rule
 * only, because they quote banned phrases on purpose. A $ or % literal in app/src is a
 * "check" finding: is it read from numbers.json?
 */

import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { BANNED, HYPE } from "../lib/rules.mjs";

const JUDGE_FACING = [/^app\/src\//, /^README\.md$/, /^public\/derived\/numbers\.json$/, /^science\/.*\.md$/, /^demo\//, /^pitch\//];
const DASH_ONLY = [/^docs\/FACTS\.md$/, /^docs\/lanes\//];
const SKIP = [/^pitch\/drill\.md$/, /^pitch\/review-log\.md$/, /^pitch\/research-.*\.md$/, /^pitch\/test\/fixtures\//, /^pitch\/lib\/rules\.mjs$/, /^pitch\/review\//];

/** Added lines per file from a unified diff, with their new-file line numbers. */
export function addedLines(diff) {
  const out = [];
  let file = null;
  let line = 0;
  for (const raw of diff.split(/\r?\n/)) {
    if (raw.startsWith("+++ ")) {
      file = raw.slice(4).replace(/^b\//, "");
      if (file === "/dev/null") file = null;
      continue;
    }
    const hunk = raw.match(/^@@ -\d+(?:,\d+)? \+(\d+)/);
    if (hunk) {
      line = Number(hunk[1]);
      continue;
    }
    if (!file) continue;
    if (raw.startsWith("+")) out.push({ file, line: line++, text: raw.slice(1) });
    else if (!raw.startsWith("-")) line++;
  }
  return out;
}

export function scanLine({ file, line, text }) {
  if (SKIP.some((re) => re.test(file))) return [];
  const findings = [];
  const dash = (rule, t) => findings.push({ file, line, rule, text: t });
  if (text.includes("—")) dash("em-dash", "em dash");
  if (text.includes("–")) dash("en-dash", "en dash");
  if (DASH_ONLY.some((re) => re.test(file))) return findings;
  if (!JUDGE_FACING.some((re) => re.test(file))) return findings;
  // numbers.json: only the display strings are judge-facing.
  if (file === "public/derived/numbers.json" && !/"display"\s*:/.test(text)) return findings;
  for (const { name, re } of BANNED) if (re.test(text)) findings.push({ file, line, rule: "banned", text: name });
  for (const word of HYPE) if (new RegExp(`\b${word}\b`, "i").test(text)) findings.push({ file, line, rule: "hype", text: word });
  // Snapshot files and CSS sizes are not copy.
  if (/^app\/src\//.test(file) && !/\.test\.tsx?$/.test(file) && !/__snapshots__\//.test(file)) {
    const lit = text.replace(/(?:width|height|left|right|top|bottom|flex-basis|opacity)\s*:\s*[\d.]+%/g, "").match(/["'`][^"'`]*(?:\$\d|\d+(?:\.\d+)?%)[^"'`]*["'`]/);
    if (lit) findings.push({ file, line, rule: "check", text: `${lit[0].slice(0, 60)}: is it read from numbers.json?` });
  }
  return findings;
}

function main() {
  const path = process.argv[2];
  if (!path || !existsSync(path)) {
    console.error("could not run: give a diff file");
    process.exit(2);
  }
  const findings = addedLines(readFileSync(path, "utf8")).flatMap(scanLine);
  for (const f of findings) console.log(`${f.file}:${f.line}: ${f.rule}: ${f.text}`);
  process.exit(findings.length ? 1 : 0);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
