import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

function rendered(file) {
  const dir = mkdtempSync(join(tmpdir(), "pitch-render-"));
  const run = spawnSync(process.execPath, ["pitch/resolve.mjs", "--render", dir, file], { encoding: "utf8" });
  assert.equal(run.status, 0, run.stderr);
  return readFileSync(join(dir, file), "utf8");
}

test("the resolved host page has no dollar sign", () => {
  assert.doesNotMatch(rendered("pitch/one-pager-host.md"), /\$/);
});

test("the host page states its value in kW", () => {
  const text = readFileSync(new URL("../one-pager-host.md", import.meta.url), "utf8");
  assert.match(text, /does not set a new peak/);
  assert.match(text, /\{host_ceiling_kw\}`? kW/);
});

test("the RMP page carries the framing line and marks the SCH rule as a proposal", () => {
  const text = readFileSync(new URL("../one-pager-rmp.md", import.meta.url), "utf8");
  assert.match(text, /value to RMP's system at day-ahead prices, not Torus revenue, not a host bill cut/);
  assert.match(text, /a format Clearlane proposes/);
});

test("both pages say simulated Torus-style", () => {
  for (const name of ["one-pager-host.md", "one-pager-rmp.md"]) {
    assert.match(readFileSync(new URL(`../${name}`, import.meta.url), "utf8"), /simulated Torus-style/, name);
  }
});
