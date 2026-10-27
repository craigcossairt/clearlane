import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import test from "node:test";
import { MEASURED_KEYS, parseFacts } from "../lib/rules.mjs";

const catalog = JSON.parse(readFileSync(new URL("../keys.json", import.meta.url), "utf8"));
const keys = catalog.keys;

function factsPath() {
  const candidates = ["docs/FACTS.md", "../clearlane/docs/FACTS.md"];
  const found = candidates.find((path) => existsSync(path));
  assert.ok(found, "FACTS.md not found next to this repo or in docs/");
  return found;
}

const facts = parseFacts(readFileSync(factsPath(), "utf8"));

function rowStatus(row) {
  const s = row?.status ?? "";
  if (/\bPENDING-ENGINE\b/.test(s)) return "PENDING-ENGINE";
  if (/\bUNCHECKED\b/.test(s)) return "UNCHECKED";
  if (/\bCONFLICT\b/.test(s)) return "CONFLICT";
  if (/\bVERIFIED\b/.test(s)) return "VERIFIED";
  return "MISSING";
}

test("every catalog fact exists in FACTS.md", () => {
  for (const [name, entry] of Object.entries(keys)) {
    assert.equal(typeof entry.fact, "string", name);
    assert.ok(facts.rows.has(entry.fact), `${name} fact ${entry.fact}`);
  }
});

test("UNCHECKED and PENDING-ENGINE rows are source numbers", () => {
  for (const [name, entry] of Object.entries(keys)) {
    const status = rowStatus(facts.rows.get(entry.fact));
    if (status === "UNCHECKED" || status === "PENDING-ENGINE" || status === "MISSING") {
      assert.equal(entry.source, "numbers", `${name} is ${status}`);
    }
  }
});

test("MEASURED keys are flagged", () => {
  const flagged = Object.entries(keys)
    .filter(([, entry]) => entry.prov === "MEASURED")
    .map(([name]) => name)
    .sort();
  assert.deepEqual(flagged, [...MEASURED_KEYS].sort());
  for (const name of MEASURED_KEYS) {
    assert.equal(keys[name].source, "numbers");
    assert.equal(keys[name].prov, "MEASURED");
  }
});

test("shared displays say why", () => {
  const byDisplay = new Map();
  for (const [name, entry] of Object.entries(keys)) {
    const list = byDisplay.get(entry.display) ?? [];
    list.push(name);
    byDisplay.set(entry.display, list);
  }
  for (const [display, names] of byDisplay) {
    if (names.length < 2) continue;
    for (const name of names) {
      assert.ok(keys[name].note, `${name} shares ${display} without a note`);
    }
  }
});

test("pitch copy uses only catalog keys", () => {
  const root = fileURLToPath(new URL("..", import.meta.url));
  const files = readdirSync(root).filter((name) => name.endsWith(".md") && !name.startsWith("research-") && name !== "review-log.md");
  for (const name of files) {
    const text = readFileSync(join(root, name), "utf8");
    for (const match of text.matchAll(/\{([a-z0-9_]+)\}/g)) {
      const key = match[1];
      if (key === "operating_day") continue;
      assert.ok(keys[key], `${name} uses unknown {${key}}`);
    }
  }
});

test("every entry has the catalog fields", () => {
  for (const [name, entry] of Object.entries(keys)) {
    assert.ok(entry.fact, name);
    assert.ok(entry.source === "numbers" || entry.source === "facts", name);
    assert.equal(typeof entry.unit, "string", name);
    assert.equal(typeof entry.prov, "string", name);
    assert.equal(typeof entry.display, "string", name);
    assert.equal(typeof entry.note, "string", name);
  }
});
