import assert from "node:assert/strict";
import test from "node:test";
import { addedLines, scanLine } from "../review/scan.mjs";

const diff = [
  "+++ b/app/src/copy.ts",
  "@@ -1,2 +10,3 @@",
  " keep",
  '+  title: "Torus lacks a planner — we add one",',
  '+  value: "$58.41 a day",',
  "+++ b/docs/FACTS.md",
  "@@ -5 +5,2 @@",
  "+| x | Do not say Torus lacks — ever |",
  "+++ b/engine/src/a.ts",
  "@@ -1 +1 @@",
  "+// robust — note",
].join("\n");

test("added lines carry new-file line numbers", () => {
  const lines = addedLines(diff);
  assert.deepEqual(lines.slice(0, 2).map((l) => [l.file, l.line]), [["app/src/copy.ts", 11], ["app/src/copy.ts", 12]]);
});

test("judge-facing paths get every rule, FACTS only the dash rule, other paths only dashes", () => {
  const rules = addedLines(diff).flatMap(scanLine).map((f) => `${f.file}:${f.rule}`);
  assert.ok(rules.includes("app/src/copy.ts:em-dash"));
  assert.ok(rules.includes("app/src/copy.ts:banned"));
  assert.ok(rules.includes("app/src/copy.ts:check"));
  assert.ok(rules.includes("docs/FACTS.md:em-dash"));
  assert.ok(!rules.includes("docs/FACTS.md:banned"));
  assert.ok(rules.includes("engine/src/a.ts:em-dash"));
  assert.ok(!rules.includes("engine/src/a.ts:hype"));
});
