import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const text = readFileSync(new URL("../drill.md", import.meta.url), "utf8");

test("twenty questions, each with an answer and a trap", () => {
  const qs = text.match(/^\d+\. \*\*/gm) ?? [];
  assert.equal(qs.length, 20);
  assert.equal((text.match(/^ {3}A: /gm) ?? []).length, 20);
  assert.equal((text.match(/^ {3}Trap: /gm) ?? []).length, 20);
});

test("a stopwatch row for each beat and no dashes", () => {
  for (let b = 1; b <= 6; b++) assert.match(text, new RegExp(`^\| ${b}, `, "m"));
  assert.doesNotMatch(text, /[–—]/);
});
