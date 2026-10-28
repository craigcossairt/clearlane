import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { DOCS, envelopeExcerptHtml, lanesFromPrices, ribbonHtml, splitPages } from "../build.mjs";

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const json = (p) => JSON.parse(read(p));

const page = read("pitch/leave-behind.html");
const packet = read("pitch/envelope-packet.md");
const readme = read("pitch/torus-kit/README.md");
const sample = json("pitch/torus-kit/sample-envelope.json");
const envelope = json("public/derived/envelope_2026-10-27.json");
const bundle = json("public/data/bundle_2026-10-27.json");
const schema = json("contracts/envelope.v1.schema.json");

test("build lists the leave-behind at one page and the packet at two", () => {
  const byName = Object.fromEntries(DOCS.map((d) => [d.name, d]));
  assert.equal(byName["leave-behind"]?.src, "pitch/leave-behind.html");
  assert.equal(byName["leave-behind"]?.pages, 1);
  assert.equal(byName["envelope-packet"]?.src, "pitch/envelope-packet.md");
  assert.equal(byName["envelope-packet"]?.pages, 2);
});

test("leave-behind carries the ribbon, race, crash, envelope, what-is-real and Torus questions", () => {
  assert.match(page, /<!-- ribbon -->/);
  assert.match(page, /<!-- envelope-excerpt -->/);
  for (const key of ["fixed_usd_mw_day", "clearlane_usd_mw_day", "race_ratio", "enrolled_kw", "second_call_shortfall_kw", "rmp_events_2025"]) {
    assert.ok(page.includes(`{${key}}`), key);
  }
  for (const cls of ["REAL", "DERIVED", "SIMULATED", "TORUS_PUBLISHED", "ASSUMPTION", "MEASURED"]) {
    assert.ok(page.includes(`<td>${cls}</td>`), cls);
  }
  assert.match(page, /Questions we asked Torus/);
});

test("leave-behind keeps the guardrails", () => {
  for (const phrase of [
    "simulated Torus-style",
    "value to RMP's system at day-ahead prices",
    "a format Clearlane proposes",
    "a working example, not a filing",
    "our baseline, not Torus practice",
    "Torus has not reviewed or endorsed",
  ]) {
    assert.ok(page.includes(phrase), phrase);
  }
  assert.doesNotMatch(page, /Torus (?:endorses|approved)/i);
  assert.doesNotMatch(page, /regulator/i);
});

test("no QR code or URL until public-url has Craig's go", () => {
  assert.doesNotMatch(page, /https?:\/\//);
  assert.doesNotMatch(page, /<img|<svg/);
  assert.match(page, /<!-- qr-slot:/);
});

test("Torus questions are the four Torus answered, nothing unconfirmed", () => {
  const block = page.slice(page.indexOf("Questions we asked Torus"));
  const items = [...block.matchAll(/<li>/g)].length;
  assert.equal(items, 4);
});

test("packet defines every envelope v1 field, with its unit", () => {
  const fields = [...Object.keys(schema.properties), ...Object.keys(schema.properties.hours.items.properties)];
  for (const f of fields) {
    const row = packet.split(/\r?\n/).find((l) => l.startsWith(`| \`${f}\``));
    assert.ok(row, `no row for ${f}`);
    assert.equal(row.split("|").length, 5, `${f}: field, unit, meaning`);
  }
});

test("packet marks the SCH rule ours, says not a filing, and quotes ROWE briefly with the URL", () => {
  assert.match(packet, /our proposal/);
  assert.match(packet, /a working example, not a filing/);
  assert.ok(packet.includes("https://rowesternenergy.org/wp-content/uploads/2026/06/Consolidated-Spring-Workshop-Comments_06222026.pdf"));
  const quotes = [...packet.matchAll(/"([^"]+)"/g)].map((m) => m[1]).filter((q) => q.split(/\s+/).length > 3);
  assert.ok(quotes.length >= 2, "at least two ROWE quotes");
  for (const q of quotes) assert.ok(q.split(/\s+/).length < 15, `over 14 words: ${q}`);
});

test("packet splits into exactly two pages", () => {
  assert.equal(splitPages(packet).length, 2);
});

test("sample envelope is the derived envelope, unchanged", () => {
  assert.deepEqual(sample, envelope);
  assert.equal(sample.schema, "clearlane.envelope/v1");
  assert.equal(sample.hours.length, 24);
});

test("torus-kit README frames the envelope as one more grid signal, not a replacement", () => {
  assert.match(readme, /one more grid signal/);
  assert.match(readme, /not a Lasso replacement/);
  assert.match(readme, /Torus, message to Craig Cossairt, Oct 27 2026/);
});

test("ribbon lanes agree with the envelope's lane on every hour that is not System Critical", () => {
  const lanes = lanesFromPrices(bundle.hours.map((h) => h.lmp_usd_mwh));
  const byTs = new Map(bundle.hours.map((h, i) => [h.ts_utc, lanes[i]]));
  for (const h of envelope.hours) {
    const m = h.reason.match(/^(clear|shoulder|jam) lane/);
    if (!m) continue;
    assert.equal(byTs.get(h.ts_utc), m[1], h.ts_utc);
  }
});

test("ribbon has 24 hours and marks each System Critical Hour", () => {
  const html = ribbonHtml(bundle, envelope);
  assert.equal((html.match(/class="cell /g) ?? []).length, 24);
  assert.equal((html.match(/class="cell [a-z]+ sch"/g) ?? []).length, envelope.hours.filter((h) => h.system_critical).length);
});

test("envelope excerpt lists each hour with planned Pulse power, in Mountain time", () => {
  const html = envelopeExcerptHtml(envelope, bundle);
  const rows = (html.match(/<tr class="row">/g) ?? []).length;
  assert.equal(rows, envelope.hours.filter((h) => Math.round(h.planned_kw) !== 0).length);
  assert.match(html, /\b6pm\b/);
});
