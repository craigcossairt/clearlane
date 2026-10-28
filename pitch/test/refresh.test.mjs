import assert from "node:assert/strict";
import { test } from "node:test";
import { refreshNote, tail } from "../refresh.mjs";

const ok = (name) => ({ name, cmd: `node pitch/${name}.mjs`, status: 0, output: "ok: 60 keys\n" });

test("Oct 27 says staying, any other day says refreshed", () => {
  assert.match(refreshNote("Oct 27, 2026", [ok("resolve")]), /^Pitch: staying on Oct 27\./);
  assert.match(refreshNote("Oct 28, 2026", [ok("resolve")]), /^Pitch: refreshed to Oct 28\./);
});

test("a failed step is named, and every step shows its exit and output tail", () => {
  const note = refreshNote("Oct 28, 2026", [ok("resolver"), { ...ok("build"), status: 1, output: "FAIL deck\n" }]);
  assert.match(note, /\*\*Failed:\*\* build\./);
  assert.match(note, /`node pitch\/build\.mjs` \(exit 1\)\n```\nFAIL deck\n```/);
  assert.doesNotMatch(refreshNote("Oct 28, 2026", [ok("resolver")]), /Failed/);
});

test("tail keeps the last lines only", () => {
  assert.equal(tail("a\nb\nc\n", 2), "b\nc");
});

test("the note has no em dash", () => {
  assert.doesNotMatch(refreshNote("Oct 28, 2026", [ok("resolver")]), /—/);
});
