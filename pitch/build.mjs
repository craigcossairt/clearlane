/**
 * Build the deck and one-pager PDFs offline.
 *
 * node pitch/build.mjs
 *
 * 1. Runs resolve.mjs --render pitch/out/src, so a lint finding stops the build.
 * 2. Turns the Markdown subset (headings, paragraphs, lists, tables, bold, code spans, links)
 *    into self-contained HTML in pitch/out/. System fonts, no external asset src or href.
 * 3. Prints each page with Edge headless (env MSEDGE, else the default install path).
 * 4. Checks page counts: one page per "## N." deck slide, one page per one-pager.
 *
 * Exit 0: built and counted. Exit 1: a check failed. Exit 2: could not run.
 * When Edge is missing the PDF step reports SKIP, never PASS.
 */

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "pitch", "out");
const EDGE_DEFAULT = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";

export const DOCS = [
  { name: "deck", src: "pitch/deck.md", pdf: "clearlane-deck.pdf", kind: "deck" },
  { name: "one-pager-host", src: "pitch/one-pager-host.md", pdf: "one-pager-host.pdf", kind: "page" },
  { name: "one-pager-rmp", src: "pitch/one-pager-rmp.md", pdf: "one-pager-rmp.pdf", kind: "page" },
];

const escapeHtml = (s) => s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

export function inline(text) {
  let s = escapeHtml(text);
  s = s.replace(/`([^`]+)`/g, '<span class="num">$1</span>');
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2">$1</a>');
  return s;
}

/** Markdown subset to HTML body. Unknown syntax falls through as a paragraph. */
export function mdToHtml(md) {
  const lines = md.split(/\r?\n/);
  const html = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    const h = line.match(/^(#{1,3})\s+(.*)$/);
    if (h) {
      html.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`);
      i++;
      continue;
    }
    if (/^\s*[-*]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*[-*]\s+/, ""));
      html.push(`<ul>${items.map((t) => `<li>${inline(t)}</li>`).join("")}</ul>`);
      continue;
    }
    if (line.startsWith("|")) {
      const rows = [];
      while (i < lines.length && lines[i].startsWith("|")) rows.push(lines[i++]);
      const cells = (r) => r.split("|").slice(1, -1).map((c) => c.trim());
      const body = rows.filter((r) => !/^\|[\s:|-]+\|$/.test(r));
      const [head, ...rest] = body;
      html.push(
        `<table><thead><tr>${cells(head).map((c) => `<th>${inline(c)}</th>`).join("")}</tr></thead><tbody>` +
          rest.map((r) => `<tr>${cells(r).map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`).join("") +
          "</tbody></table>",
      );
      continue;
    }
    if (line.startsWith("> ")) {
      const quote = [];
      while (i < lines.length && lines[i].startsWith("> ")) quote.push(lines[i++].slice(2));
      html.push(`<blockquote>${inline(quote.join(" "))}</blockquote>`);
      continue;
    }
    const para = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,3}\s|\||>\s|\s*[-*]\s)/.test(lines[i])) para.push(lines[i++]);
    html.push(`<p>${inline(para.join(" "))}</p>`);
  }
  return html.join("\n");
}

/** Deck slides: each "## N. Title" section. Text before slide 1 is author notes, not printed. */
export function splitSlides(md) {
  return md
    .split(/^(?=## \d+\.)/m)
    .filter((part) => /^## \d+\./.test(part))
    .map((part) => {
      const lines = part.split(/\r?\n/);
      const body = lines.slice(1).filter((l) => !/^Notes:/.test(l));
      return { title: lines[0].replace(/^## /, "").trim(), body: body.join("\n") };
    });
}

export function keysIn(text) {
  return [...new Set([...text.matchAll(/\{([a-z0-9_]+)\}/g)].map((m) => m[1]))];
}

/** Provenance classes of the keys a slide uses, in the AGENTS.md order. */
export function provClasses(keys, catalog) {
  const order = ["REAL", "DERIVED", "SIMULATED", "TORUS_PUBLISHED", "ASSUMPTION", "MEASURED"];
  const found = new Set(keys.map((k) => catalog[k]?.prov).filter(Boolean));
  return order.filter((c) => found.has(c));
}

export function countPdfPages(buf) {
  return (buf.toString("latin1").match(/\/Type\s*\/Page(?![a-z])/g) ?? []).length;
}

const CSS_BASE = `
* { box-sizing: border-box; }
body { margin: 0; font-family: "Segoe UI", system-ui, -apple-system, Arial, sans-serif; color: #14202b; }
.num { font-variant-numeric: tabular-nums; font-weight: 600; }
table { border-collapse: collapse; margin: 0.4em 0; }
th, td { border-bottom: 1px solid #c9d3dc; padding: 0.25em 0.6em; text-align: left; vertical-align: top; }
a { color: #14507a; text-decoration: none; word-break: break-all; }
footer { color: #51606e; font-size: 0.8em; }
`;

function deckHtml(slides, rendered, catalog, day) {
  const pages = slides.map((slide, n) => {
    const prov = provClasses(keysIn(slide.body), catalog);
    const r = rendered[n];
    return `<section class="slide"><h1>${inline(r.title)}</h1>${mdToHtml(r.body)}<footer>Operating day ${day}. ${
      prov.length ? `Numbers: ${prov.join(", ")}.` : "No numbers on this slide."
    } Stations are simulated Torus-style.</footer></section>`;
  });
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Clearlane deck</title><style>${CSS_BASE}
@page { size: 13.333in 7.5in; margin: 0; }
.slide { width: 13.333in; height: 7.5in; padding: 0.6in 0.8in 0.5in; position: relative; page-break-after: always; overflow: hidden; font-size: 20px; line-height: 1.4; }
.slide:last-child { page-break-after: auto; }
.slide h1 { font-size: 40px; margin: 0 0 0.4em; }
.slide footer { position: absolute; left: 0.8in; right: 0.8in; bottom: 0.3in; }
</style></head><body>${pages.join("\n")}</body></html>`;
}

function pageHtml(title, body, day) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>${CSS_BASE}
@page { size: Letter; margin: 0.55in 0.6in; }
body { font-size: 11px; line-height: 1.38; }
h1 { font-size: 20px; margin: 0 0 0.3em; }
h2 { font-size: 13px; margin: 0.8em 0 0.2em; }
p, ul { margin: 0.25em 0; }
footer { margin-top: 0.8em; }
</style></head><body>${mdToHtml(body)}<footer>Operating day ${day}. Stations are simulated Torus-style. Every number is from public/derived/numbers.json or docs/FACTS.md.</footer></body></html>`;
}

/** The operating day as "Oct 27, 2026", from the as_of_mt of the race value. */
export function operatingDay(rows) {
  const row = rows.find((r) => r.key === "clearlane_usd_mw_day") ?? rows[0];
  const [y, m, d] = (row?.as_of_mt ?? "").split("-").map(Number);
  if (!y) return "not set";
  const month = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][m - 1];
  return `${month} ${d}, ${y}`;
}

function printPdf(edge, html, pdf) {
  const profile = mkdtempSync(join(tmpdir(), "clearlane-edge-"));
  try {
    const r = spawnSync(
      edge,
      [
        "--headless=new",
        "--disable-gpu",
        "--no-first-run",
        `--user-data-dir=${profile}`,
        "--no-pdf-header-footer",
        `--print-to-pdf=${pdf}`,
        pathToFileURL(html).href,
      ],
      { encoding: "utf8", timeout: 60000 },
    );
    if (r.status !== 0) return false;
    // The msedge.exe launcher can exit before its headless child writes the PDF.
    // Wait for the file, then for its size to hold still, up to 60 seconds.
    let last = -1;
    for (let waited = 0; waited < 60000; waited += 500) {
      if (existsSync(pdf)) {
        const size = statSync(pdf).size;
        if (size > 0 && size === last) return true;
        last = size;
      }
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 500);
    }
    return false;
  } finally {
    // Edge can still hold its profile for a moment; a leftover temp dir is harmless.
    try {
      rmSync(profile, { recursive: true, force: true });
    } catch {}
  }
}

function main() {
  const render = join(out, "src");
  rmSync(out, { recursive: true, force: true });
  mkdirSync(render, { recursive: true });
  const lint = spawnSync(process.execPath, [join(root, "pitch", "resolve.mjs"), "--render", render, ...DOCS.map((d) => d.src)], {
    cwd: root,
    encoding: "utf8",
  });
  if (lint.status !== 0) {
    console.error(lint.stdout + lint.stderr);
    process.exit(lint.status === 2 ? 2 : 1);
  }
  const catalog = JSON.parse(readFileSync(join(root, "pitch", "keys.json"), "utf8")).keys;
  const numbersPath = join(root, "public", "derived", "numbers.json");
  const day = existsSync(numbersPath) ? operatingDay(JSON.parse(readFileSync(numbersPath, "utf8"))) : "not set";
  const edge = process.env.MSEDGE || EDGE_DEFAULT;
  const haveEdge = existsSync(edge);
  let failed = false;
  for (const doc of DOCS) {
    const source = readFileSync(join(root, doc.src), "utf8");
    const resolved = readFileSync(join(render, doc.src), "utf8");
    let html;
    let expected;
    if (doc.kind === "deck") {
      const slides = splitSlides(source);
      html = deckHtml(slides, splitSlides(resolved), catalog, day);
      expected = slides.length;
    } else {
      html = pageHtml(doc.name, resolved, day);
      expected = 1;
    }
    const htmlPath = join(out, `${doc.name}.html`);
    writeFileSync(htmlPath, html, "utf8");
    if (!haveEdge) {
      console.log(`SKIP ${doc.pdf}: Edge not found at ${edge}`);
      continue;
    }
    const pdfPath = join(out, doc.pdf);
    if (!printPdf(edge, htmlPath, pdfPath)) {
      console.error(`FAIL ${doc.pdf}: Edge wrote no PDF`);
      failed = true;
      continue;
    }
    const pages = countPdfPages(readFileSync(pdfPath));
    const ok = pages === expected;
    if (!ok) failed = true;
    console.log(`${ok ? "PASS" : "FAIL"} ${doc.pdf}: ${pages} page(s), expected ${expected}`);
  }
  process.exit(failed ? 1 : 0);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
