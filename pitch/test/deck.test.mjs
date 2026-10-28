import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { countPdfPages, DOCS, inline, mdToHtml, provClasses, splitSlides } from "../build.mjs";

const deck = readFileSync(new URL("../deck.md", import.meta.url), "utf8");
const out = new URL("../out/", import.meta.url);

test("no Nucleus or Startup State in the deck", () => {
  assert.doesNotMatch(deck, /Nucleus|Startup State/i);
});

test("eleven slides: the outline's eleven with the Nucleus slot used for the scale caveat", () => {
  const titles = splitSlides(deck).map((s) => s.title);
  assert.equal(titles.length, 11);
  assert.match(titles[0], /^1\. Title/);
  assert.match(titles[2], /^3\. Live demo/);
  assert.match(titles[8], /^9\. Scale/);
  assert.match(titles[10], /^11\. Close/);
});

test("the HTML has no external asset src or stylesheet href", () => {
  const html = mdToHtml(deck);
  assert.doesNotMatch(html, /<(?:img|script|link|iframe)\b/i);
  assert.doesNotMatch(html, /\bsrc=/i);
  assert.match(inline("`$1`"), /<span class="num">\$1<\/span>/);
});

test("slide footers list the provenance classes of the slide's keys", () => {
  const keys = { a: { prov: "REAL" }, b: { prov: "MEASURED" }, c: { prov: "DERIVED" } };
  assert.deepEqual(provClasses(["b", "a", "c"], keys), ["REAL", "DERIVED", "MEASURED"]);
});

test("page counts match: one per slide, one per one-pager (SKIP without built PDFs)", (t) => {
  const slides = splitSlides(deck).length;
  let checked = 0;
  for (const doc of DOCS) {
    const pdf = new URL(doc.pdf, out);
    if (!existsSync(pdf)) continue;
    checked++;
    assert.equal(countPdfPages(readFileSync(pdf)), doc.kind === "deck" ? slides : 1, doc.pdf);
  }
  if (checked === 0) t.skip("SKIP: no PDFs in pitch/out; run node pitch/build.mjs");
});
