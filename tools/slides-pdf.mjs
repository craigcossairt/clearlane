// Usage: node tools/slides-pdf.mjs [baseUrl] [--out tools/out/clearlane-slides.pdf] [--browser msedge|chrome|chromium]
//
// Builds the submission slides PDF: one 1920x1080 page per presenter screen at its end state
// (?ff=presenter&screen=N&step=end&motion=off), then a last page with the repo link, which the
// organizers ask for in the slides, and the judges' site link. Screens are found by deep-linking N = 1, 2, ... until the
// page stops landing on screen N, so new screens need no list. Serve the build first, for
// example `npx vite preview --port 4176 --strictPort`.
//
// The PDF and the PNGs go to tools/out/ (gitignored). Exit 0 built, 1 a screen failed, 2 could not run.
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_URL = "https://github.com/craigcossairt/clearlane";
const SITE_URL = "https://clearlane-mauve.vercel.app";
const SIZE = { width: 1920, height: 1080 };
const MAX_SCREENS = 20;
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function parseArgs(argv) {
  const args = { base: "http://localhost:4176", out: path.join(repoRoot, "tools/out/clearlane-slides.pdf"), browser: "msedge" };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--out") args.out = path.resolve(argv[++i]);
    else if (a === "--browser") args.browser = argv[++i];
    else if (!a.startsWith("--")) args.base = a.replace(/\/$/, "");
    else throw new Error(`unknown argument ${a}`);
  }
  return args;
}

async function main() {
  let args;
  let chromium;
  try {
    args = parseArgs(process.argv.slice(2));
    ({ chromium } = await import("playwright"));
  } catch (e) {
    console.log(`COULD NOT RUN: ${e.message}`);
    return 2;
  }
  const pngDir = path.join(path.dirname(args.out), "slides");
  mkdirSync(pngDir, { recursive: true });
  const browser = await chromium.launch(args.browser === "chromium" ? {} : { channel: args.browser });
  try {
    const context = await browser.newContext({ viewport: SIZE, deviceScaleFactor: 1, reducedMotion: "reduce" });
    const page = await context.newPage();
    const external = [];
    page.on("request", (r) => {
      if (!r.url().startsWith(args.base) && !/^(data|blob):/.test(r.url())) external.push(r.url());
    });
    const pngs = [];
    for (let n = 1; n <= MAX_SCREENS; n++) {
      await page.goto(`${args.base}/?ff=presenter&screen=${n}&step=end&motion=off`, { waitUntil: "load" });
      const landed = await page
        .waitForFunction((want) => document.body?.dataset.screen === want && document.body.dataset.state === "ready", String(n), {
          timeout: 15000,
        })
        .then(() => true, () => false);
      if (!landed) {
        // A deep link past the last screen clamps to the last one: that is the end of the deck.
        const at = await page.evaluate(() => document.body?.dataset.screen ?? "");
        if (n > 1 && at === String(n - 1)) break;
        console.log(`FAIL screen ${n}: the deep link never reached data-screen="${n}" (at "${at}")`);
        return 1;
      }
      await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(300);
      const file = path.join(pngDir, `screen${n}.png`);
      await page.screenshot({ path: file });
      pngs.push(file);
      console.log(`screen ${n}: ${await page.evaluate(() => document.body.dataset.step)}`);
    }
    if (external.length) {
      console.log(`FAIL ${external.length} external requests: ${external.join(", ")}`);
      return 1;
    }

    const img = (f) => `data:image/png;base64,${readFileSync(f).toString("base64")}`;
    const pages = pngs.map((f) => `<section><img src="${img(f)}" alt=""></section>`).join("\n");
    const html = `<!doctype html><html><head><meta charset="utf-8"><style>
@page { size: 1920px 1080px; margin: 0; }
html, body { margin: 0; padding: 0; background: #0b0f14; }
section { width: 1920px; height: 1080px; overflow: hidden; page-break-after: always; break-after: page; }
section:last-child { page-break-after: auto; break-after: auto; }
img { display: block; width: 1920px; height: 1080px; }
.end { display: flex; flex-direction: column; justify-content: center; align-items: center; color: #e8edf2;
  font: 600 64px system-ui, "Segoe UI", sans-serif; gap: 32px; }
.end a { color: #e8edf2; font-weight: 400; font-size: 48px; }
.end .site { font-weight: 400; font-size: 40px; }
.end .site a { font-size: 40px; }
</style></head><body>
${pages}
<section class="end"><div>Clearlane: code, data and how every number is made</div><a href="${REPO_URL}">${REPO_URL}</a><div class="site">Presentation, video and documents: <a href="${SITE_URL}">${SITE_URL}</a></div></section>
</body></html>`;
    const htmlFile = path.join(pngDir, "slides.html");
    writeFileSync(htmlFile, html);
    const pdfPage = await context.newPage();
    await pdfPage.goto(`file:///${htmlFile.split(path.sep).join("/")}`, { waitUntil: "load" });
    await pdfPage.pdf({ path: args.out, width: "1920px", height: "1080px", printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
    console.log(`wrote ${args.out}: ${pngs.length} screens + repo and site link page`);
    return 0;
  } finally {
    await browser.close().catch(() => {});
  }
}

process.exitCode = await main();
