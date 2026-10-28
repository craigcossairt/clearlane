import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { chipHtml, inline, withChips } from "../build.mjs";

// Screen edition (#5): presenter-mode look, provenance chips on every keyed number.
const catalog = { a: { prov: "DERIVED" }, b: { prov: "TORUS_PUBLISHED" } };

test("each keyed value gets its provenance as a lowercase superscript", () => {
  const out = inline(withChips("Worth `{a}`, at `{b}` MW.", "Worth `$58.41`, at `70` MW.", catalog));
  assert.equal(
    out,
    'Worth <span class="num">$58.41<sup class="prov">derived</sup></span>, at <span class="num">70<sup class="prov">torus published</sup></span> MW.',
  );
});

test("bare keys in HTML get chips too, and a mismatch leaves the text alone", () => {
  assert.equal(chipHtml(withChips("<p>{a} a day</p>", "<p>$4,088 a day</p>", catalog)), '<p>$4,088<sup class="prov">derived</sup> a day</p>');
  assert.equal(withChips("<p>{a} a day</p>", "<p>$4,088 per day</p>", catalog), "<p>$4,088 per day</p>");
});

test("the screen edition prints its dark background, with system fonts and a header band", () => {
  const src = readFileSync(new URL("../build.mjs", import.meta.url), "utf8");
  assert.match(src, /print-color-adjust: exact/);
  assert.match(src, /background: #141414/);
  assert.match(src, /"Century Gothic", "Avenir Next", Futura, "Segoe UI", system-ui/);
  assert.match(src, /Presented by Craig Cossairt/);
  assert.doesNotMatch(src, /@import|url\(|<link/);
  assert.doesNotMatch(src, /[–—]/);
});
