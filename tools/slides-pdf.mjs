// Usage: node tools/slides-pdf.mjs [baseUrl] [--out tools/out/clearlane-slides.pdf] [--browser msedge|chrome|chromium]
//
// Builds the submission slides PDF: one 1920x1080 page per presenter screen at its end state
// (?ff=presenter&screen=N&step=end&motion=off), then three closing pages (how it works, check it yourself,
// what is next) and a last page with the repo link, which the
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

// Closing pages after the screens, in presenter mode's look. Words only: no number here that is not
// already on the site or in the README, so nothing new needs a key.
const CLOSING_CSS = `
.close { box-sizing: border-box; padding: 96px 120px 80px; display: flex; flex-direction: column; color: #f1ede4;
  font-family: "Century Gothic", "Avenir Next", Futura, "Segoe UI", system-ui, sans-serif; }
.close .band { display: flex; justify-content: space-between; align-items: baseline; font-size: 26px; color: #a39e94; }
.close .mark { color: #f1ede4; letter-spacing: 0.02em; }
.close .mark b { color: #3cbf84; font-weight: 400; }
.close .rule { height: 4px; margin: 18px 0 56px; border-radius: 2px; background: linear-gradient(90deg, #3cbf84 0 40%, #e2a73c 40% 70%, #ee6b58 70%); }
.close .kicker { font-size: 26px; letter-spacing: 0.08em; text-transform: uppercase; color: #3cbf84; margin: 0 0 14px; }
.close h1 { font-size: 68px; font-weight: 400; letter-spacing: -0.01em; line-height: 1.08; margin: 0 0 52px; }
.close p, .close li { font-size: 26px; line-height: 1.42; }
.close .muted { color: #a39e94; }
.close .grid { display: grid; gap: 28px; }
.close .card { background: #1b1b1a; border: 1px solid #34332f; border-radius: 20px; padding: 34px 34px 30px; }
.close .card h2 { font-size: 34px; font-weight: 400; margin: 0 0 14px; }
.close .card p { margin: 0; color: #d9d4ca; }
.close .tag { display: inline-block; margin-top: 18px; font-size: 19px; color: #7d7870; border: 1px solid #34332f; border-radius: 999px; padding: 2px 12px; }
.close .flow { grid-template-columns: repeat(4, 1fr); }
.close .flow .card { position: relative; display: flex; flex-direction: column; }
.close .flow .tag { align-self: flex-start; margin-top: auto; }
.close .flow .card p { margin-bottom: 22px; }
.close .flow .card:not(:last-child)::after { content: ""; position: absolute; right: -24px; top: 50%; width: 20px; height: 20px;
  border-top: 3px solid #a39e94; border-right: 3px solid #a39e94; transform: translateY(-50%) rotate(45deg); }
.close .flow .card:nth-child(1) { border-top: 4px solid #3cbf84; }
.close .flow .card:nth-child(2) { border-top: 4px solid #3cbf84; }
.close .flow .card:nth-child(3) { border-top: 4px solid #e2a73c; }
.close .flow .card:nth-child(4) { border-top: 4px solid #ee6b58; }
.close .foot { margin-top: auto; font-size: 24px; color: #a39e94; }
.close .two { grid-template-columns: 1fr 1fr; gap: 56px; align-items: start; }
.close pre { margin: 0; background: #1b1b1a; border: 1px solid #34332f; border-radius: 20px; padding: 40px 44px;
  font: 32px/1.7 Consolas, "Cascadia Mono", "Courier New", monospace; color: #f1ede4; }
.close pre .p { color: #3cbf84; }
.close ul { margin: 0; padding: 0; list-style: none; }
.close ul li { padding-left: 34px; position: relative; margin: 0 0 24px; }
.close ul li::before { content: ""; position: absolute; left: 0; top: 14px; width: 14px; height: 14px; border-radius: 50%; background: #3cbf84; }
.close .three { grid-template-columns: repeat(3, 1fr); }
.close .three .card ul li { font-size: 25px; margin-bottom: 16px; }
.close .three .card:nth-child(1) h2 { color: #3cbf84; }
.close .three .card:nth-child(2) h2 { color: #e2a73c; }
.close .three .card:nth-child(3) h2 { color: #ee6b58; }
.close .three .card:nth-child(2) ul li::before { background: #e2a73c; }
.close .three .card:nth-child(3) ul li::before { background: #ee6b58; }
.close.links { justify-content: center; }
.close.links .big { font-size: 120px; font-weight: 400; letter-spacing: -0.02em; margin: 0 0 64px; }
.close.links .big b { color: #3cbf84; font-weight: 400; }
.close.links .row { margin: 0 0 44px; }
.close.links .label { font-size: 28px; color: #a39e94; margin: 0 0 8px; }
.close.links a { color: #f1ede4; font-size: 52px; text-decoration-color: #3cbf84; text-underline-offset: 10px; }
`;

function closingPages() {
  const band = `<div class="band"><span class="mark"><b>Clear</b>lane</span><span>Presented by Craig Cossairt</span></div><div class="rule"></div>`;
  return `
<section class="close">${band}
<p class="kicker">How it works</p>
<h1>From tomorrow's public prices to an hourly plan</h1>
<div class="grid flow">
  <div class="card"><h2>Public data</h2><p>CAISO day-ahead prices and forecasts for PacifiCorp East, and EIA hourly grid data. Python fetches them, checks them and saves a snapshot.</p><span class="tag">real</span></div>
  <div class="card"><h2>Plan the day</h2><p>A TypeScript optimizer fills Pulse in the midday clear lane, sells into the evening jam and keeps Spin ready, inside the host building's meter limit and a wear budget.</p><span class="tag">derived</span></div>
  <div class="card"><h2>Re-plan on a call</h2><p>When Rocky Mountain Power calls, Spin answers at once and the planner re-plans the rest of the day around it.</p><span class="tag">derived</span></div>
  <div class="card"><h2>Publish</h2><p>The envelope: one row per hour for the next day, with System Critical Hours. Every number the presentation shows comes from one numbers file.</p><span class="tag">derived</span></div>
</div>
<p class="foot">The stations, the host building's power use and the calls are simulated Torus-style, built from Torus's published specs. The backtest runs the same planner on real prices from May 1 to Oct 27.</p>
</section>
<section class="close">${band}
<p class="kicker">Check it yourself</p>
<h1>Every number re-derives offline with one command</h1>
<div class="grid two">
  <pre><span class="p">&gt;</span> git clone ${REPO_URL}
<span class="p">&gt;</span> cd clearlane
<span class="p">&gt;</span> npm ci
<span class="p">&gt;</span> npm run reproduce</pre>
  <ul>
    <li>Checks every input file against its recorded fingerprint, re-runs the planner and compares every published number.</li>
    <li>No keys and no network: the data snapshot is in the repo.</li>
    <li>Every number on screen carries its label: real, derived, simulated, torus published, assumption or measured.</li>
    <li>Tests pin every number that reaches the stage, and CI runs the same checks on every change.</li>
  </ul>
</div>
</section>
<section class="close">${band}
<p class="kicker">What's next</p>
<h1>Built, next, then</h1>
<div class="grid three">
  <div class="card"><h2>Built</h2><ul>
    <li>Day-ahead planner and the re-plan after a call</li>
    <li>Hourly envelope with System Critical Hours</li>
    <li>Backtest on six months of real prices</li>
    <li>Open code and data that run offline</li></ul></div>
  <div class="card"><h2>Next: this winter</h2><ul>
    <li>Pilot the envelope at a few sites in Rocky Mountain Power's Wattsmart program</li>
    <li>Publish it each evening and compare the plan with what each station did</li>
    <li>First learn from Torus how Spin refills, how call delivery is measured and whether sites export</li></ul></div>
  <div class="card"><h2>Then</h2><ul>
    <li>Forecast the host building's load and the calls: where machine learning fits</li>
    <li>Connect to the station's and Rocky Mountain Power's own systems once their interfaces are known</li>
    <li>More stations on the same envelope</li></ul></div>
</div>
<p class="foot">Built solo by Craig Cossairt, with six AI agent lanes: integration, engine, data, UI, pitch and science.</p>
</section>
<section class="close links">
<p class="big"><b>Clear</b>lane</p>
<div class="row"><p class="label">Code, data and how every number is made</p><a href="${REPO_URL}">${REPO_URL.replace("https://", "")}</a></div>
<div class="row"><p class="label">Presentation, video and documents</p><a href="${SITE_URL}">${SITE_URL.replace("https://", "")}</a></div>
<p class="foot">Presented by Craig Cossairt · Hard Tech Hackathon, Salt Lake City · Torus bounty</p>
</section>`;
}

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
html, body { margin: 0; padding: 0; background: #121212; }
section { width: 1920px; height: 1080px; overflow: hidden; page-break-after: always; break-after: page; }
section:last-child { page-break-after: auto; break-after: auto; }
img { display: block; width: 1920px; height: 1080px; }
${CLOSING_CSS}
</style></head><body>
${pages}
${closingPages()}
</body></html>`;
    const htmlFile = path.join(pngDir, "slides.html");
    writeFileSync(htmlFile, html);
    const pdfPage = await context.newPage();
    await pdfPage.goto(`file:///${htmlFile.split(path.sep).join("/")}`, { waitUntil: "load" });
    await pdfPage.pdf({ path: args.out, width: "1920px", height: "1080px", printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
    console.log(`wrote ${args.out}: ${pngs.length} screens + 3 closing pages + repo and site link page`);
    return 0;
  } finally {
    await browser.close().catch(() => {});
  }
}

process.exitCode = await main();
