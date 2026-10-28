import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const JUDGES = ["Ryan Byrd", "Angela Smith", "The Torus judge", "Scott Holley", "Tanner Potter"];
const text = readFileSync(new URL("../qa.md", import.meta.url), "utf8");

function cards() {
  return text
    .split(/^### /m)
    .slice(1)
    .map((part) => {
      const lines = part.split(/\r?\n/);
      const field = (name) => lines.find((l) => l.startsWith(`${name}: `))?.slice(name.length + 2) ?? "";
      return { q: lines[0].trim(), judge: field("Judge"), answer: field("A"), source: field("Source") };
    });
}

// Sentence ends: . ? or ! followed by a space or the end. Keys are in braces, so decimals never appear.
export function sentences(answer) {
  return answer.split(/[.?!](?:\s+|$)/).filter((s) => s.trim().length > 0).length;
}

test("at least 22 cards: the 16 planned questions plus 6 new", () => {
  assert.ok(cards().length >= 22, `${cards().length} cards`);
});

test("every card names one of the five judges", () => {
  for (const c of cards()) assert.ok(JUDGES.includes(c.judge), `${c.q}: judge "${c.judge}"`);
  for (const name of JUDGES) assert.ok(cards().some((c) => c.judge === name), `no card for ${name}`);
});

test("every answer is two sentences or fewer", () => {
  for (const c of cards()) {
    assert.ok(c.answer.length > 0, `${c.q}: no answer`);
    assert.ok(sentences(c.answer) <= 2, `${c.q}: ${sentences(c.answer)} sentences`);
  }
});

test("every card has a key or a source line", () => {
  for (const c of cards()) assert.ok(/\{[a-z0-9_]+\}/.test(c.answer) || c.source.length > 0, c.q);
});

test("no card mentions a prize", () => {
  assert.doesNotMatch(text, /\bprize\b/i);
});

test("the required questions are covered", () => {
  const qs = cards().map((c) => c.q.toLowerCase());
  for (const needle of ["arbitrage", "second call", "when the calls happen", "torus earn", "inside lasso", "what did torus tell you"]) {
    assert.ok(qs.some((q) => q.includes(needle)), needle);
  }
});
