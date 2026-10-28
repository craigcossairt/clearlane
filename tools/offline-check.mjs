// Usage: node tools/offline-check.mjs [--dist dist] [--browser msedge|chrome|chromium] [--plant] [--presenter]
//
// Proves the built stage app needs no network (docs/lanes/integration.md section 6.7):
//   1. scans dist/**/*.{html,js,css} for external URLs in a position the browser would load;
//   2. serves dist from a node:http server on 127.0.0.1 and a free port;
//   3. opens it in a real browser (service workers blocked), records every request and aborts
//      any request to another origin, any WebSocket and any /api/ request in snapshot mode;
//   4. drives beats 1 to 6 through ?beat=N&step=end&motion=off and each beat's keys.
//
// --presenter drives presenter mode instead: it opens ?ff=presenter&motion=off on the title
// screen and presses Next (ArrowRight) until Next changes nothing, so every screen and every
// screen action runs under the same network rules. The summary counts screens and actions.
//
// No stage app yet: while the UI lane's app is not on main, the built page has no data-beat
// hook. Each beat then prints a WARN "not built" line and does not count as driven, so the
// summary honestly reads 0/6 beats. The page still loads at every beat URL and the network
// rules still apply to every request it makes.
//
// --plant copies dist to a temp dir, adds an external <img> to index.html and an init script
// that fetches an external URL, and checks both are caught (SELF-TEST OK, exit 0) or not
// (SELF-TEST BROKEN, exit 1).
//
// Exit codes: 0 PASS, 1 FAIL, 2 COULD NOT RUN (no dist, no browser, or the server failed).
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import http from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  BEAT_KEYS,
  PRESENTER_MAX_PRESSES,
  PRESENTER_NEXT_KEY,
  RESET_KEY,
  classifyRequest,
  presenterSummaryLine,
  presenterWalkDone,
  scanBundleText,
  summaryLine,
} from "./lib/offline-check.mjs";

const PLANT_IMG = "https://planted.offline-check.invalid/x.png";
const PLANT_FETCH = "https://planted.offline-check.invalid/p";
const HOOK_WAIT_MS = 3000;
const READY_WAIT_MS = 20000;
const KEY_SETTLE_MS = 300;

class CouldNotRun extends Error {}

function parseArgs(argv) {
  const args = { dist: "dist", browser: "auto", plant: false, presenter: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--plant") args.plant = true;
    else if (a === "--presenter") args.presenter = true;
    else if (a === "--dist") args.dist = argv[++i];
    else if (a === "--browser") args.browser = argv[++i];
    else throw new CouldNotRun(`unknown argument ${a}`);
  }
  if (!args.dist) throw new CouldNotRun("--dist needs a directory");
  if (!["auto", "msedge", "chrome", "chromium"].includes(args.browser)) {
    throw new CouldNotRun(`--browser must be msedge, chrome or chromium, got ${args.browser}`);
  }
  return args;
}

function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(html|js|css)$/.test(e.name)) out.push(p);
  }
  return out;
}

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".csv": "text/csv; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
};

function startServer(root) {
  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      let rel;
      try {
        rel = decodeURIComponent(new URL(req.url ?? "/", "http://127.0.0.1").pathname);
      } catch {
        res.writeHead(400).end();
        return;
      }
      if (rel.endsWith("/")) rel += "index.html";
      const file = path.resolve(root, `.${rel}`);
      if (!file.startsWith(root + path.sep)) {
        res.writeHead(403).end();
        return;
      }
      try {
        const body = await readFile(file);
        res.writeHead(200, { "content-type": TYPES[path.extname(file)] ?? "application/octet-stream" });
        res.end(body);
      } catch {
        res.writeHead(404).end();
      }
    });
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

async function launchBrowser(choice) {
  let chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch (e) {
    throw new CouldNotRun(`playwright is not installed (${e.message})`);
  }
  const order = choice === "auto" ? ["msedge", "chrome", "chromium"] : [choice];
  const errors = [];
  for (const name of order) {
    try {
      const browser = await chromium.launch(name === "chromium" ? {} : { channel: name });
      return { browser, name };
    } catch (e) {
      errors.push(`${name}: ${String(e.message).split("\n")[0]}`);
    }
  }
  throw new CouldNotRun(`no browser (${errors.join("; ")})`);
}

function plantCopy(dist) {
  const dir = mkdtempSync(path.join(tmpdir(), "offline-check-"));
  cpSync(dist, dir, { recursive: true });
  const index = path.join(dir, "index.html");
  const html = readFileSync(index, "utf8");
  const img = `<img src="${PLANT_IMG}" alt="">`;
  writeFileSync(index, html.includes("</body>") ? html.replace("</body>", `${img}</body>`) : html + img);
  return dir;
}

async function run(args) {
  const dist = path.resolve(args.dist);
  if (!existsSync(path.join(dist, "index.html"))) {
    throw new CouldNotRun(`no built app at ${path.join(dist, "index.html")} (run npm run build)`);
  }
  const root = args.plant ? plantCopy(dist) : dist;
  const dataMode = process.env.DATA_MODE ?? "snapshot";
  /** @type {{ where: string, url: string, reason: string }[]} */
  const violations = [];
  const fail = (where, url, reason) => {
    violations.push({ where, url, reason });
    console.log(`FAIL ${where} ${url}: ${reason}`);
  };

  try {
    // 1. Static scan.
    const seenInfo = new Set();
    for (const file of walk(root)) {
      const rel = path.relative(root, file).split(path.sep).join("/");
      for (const f of scanBundleText(readFileSync(file, "utf8"))) {
        if (f.level === "FAIL") fail(`static ${rel}`, f.url, f.reason);
        else if (!seenInfo.has(f.url)) {
          seenInfo.add(f.url);
          console.log(`INFO static ${rel} ${f.url}: ${f.reason}`);
        }
      }
    }

    // 2. Serve.
    let server;
    try {
      server = await startServer(root);
    } catch (e) {
      throw new CouldNotRun(`server failed (${e.message})`);
    }
    const { port } = server.address();
    const origin = `http://127.0.0.1:${port}`;

    let browser;
    try {
      // 3. Browse and record.
      const launched = await launchBrowser(args.browser);
      browser = launched.browser;
      console.log(`offline-check: serving ${root} at ${origin} in ${launched.name}, DATA_MODE=${dataMode}`);
      const context = await browser.newContext({ serviceWorkers: "block" });
      if (args.plant) await context.addInitScript(`fetch(${JSON.stringify(PLANT_FETCH)}).catch(() => {});`);

      let where = "page open";
      let sameOrigin = 0;
      const requests = [];
      const reported = new Set();
      await context.route("**/*", (route) => {
        const url = route.request().url();
        const v = classifyRequest(url, origin, { dataMode });
        requests.push({ where, url, ok: v.ok });
        if (v.ok) {
          sameOrigin++;
          return route.continue();
        }
        if (!reported.has(url)) {
          reported.add(url);
          fail(`request ${where}`, url, v.reason);
        }
        return route.abort("blockedbyclient");
      });
      await context.routeWebSocket(/.*/, (ws) => {
        const url = ws.url();
        requests.push({ where, url, ok: false });
        if (!reported.has(url)) {
          reported.add(url);
          fail(`request ${where}`, url, classifyRequest(url, origin, { dataMode }).reason);
        }
        ws.close();
      });

      const page = await context.newPage();
      const settle = () => page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => {});
      const state = () => page.evaluate(() => document.body?.dataset.state ?? null);

      if (args.presenter) {
        // 4. Walk presenter mode with Next.
        const walk = await walkPresenter(page, origin, settle, fail, (w) => (where = w));
        await context.close();
        console.log(`offline-check: ${requests.length} requests recorded`);
        console.log(presenterSummaryLine({ violations: violations.length, sameOrigin, ...walk }));
        return { violations, requests };
      }

      // 4. Drive the six beats.
      let beatsDriven = 0;
      let anyHooks = false;
      for (const n of /** @type {const} */ ([1, 2, 3, 4, 5, 6])) {
        where = `beat ${n}`;
        await page.goto(`${origin}/?beat=${n}&step=end&motion=off`, { waitUntil: "load" });
        const hooked = await page
          .waitForFunction(() => document.body?.hasAttribute("data-beat"), null, { timeout: HOOK_WAIT_MS })
          .then(() => true, () => false);
        if (!hooked) {
          await settle();
          console.log(`WARN beat ${n}: not built (no data-beat hook in this build; the stage app is not on main yet)`);
          continue;
        }
        anyHooks = true;
        const ready = await page
          .waitForFunction(() => (document.body.dataset.state ?? "loading") !== "loading", null, {
            timeout: READY_WAIT_MS,
          })
          .then(() => true, () => false);
        if (!ready) {
          fail(`beat ${n}`, page.url(), `page state still loading after ${READY_WAIT_MS} ms`);
          continue;
        }
        let ok = (await state()) !== "failed";
        for (const key of BEAT_KEYS[n]) {
          if (!ok) break;
          await page.keyboard.press(key);
          await page.waitForTimeout(KEY_SETTLE_MS);
          ok = (await state()) !== "failed";
        }
        await settle();
        if (ok) beatsDriven++;
        else fail(`beat ${n}`, page.url(), "page state failed");
      }
      if (anyHooks) {
        where = "reset";
        await page.keyboard.press(RESET_KEY);
        await page.waitForTimeout(KEY_SETTLE_MS);
        await settle();
        if ((await state()) === "failed") fail("reset", page.url(), "page state failed after R");
      }
      await context.close();

      // 5. Output.
      console.log(`offline-check: ${requests.length} requests recorded`);
      console.log(summaryLine({ violations: violations.length, sameOrigin, beatsDriven }));
      return { violations, requests };
    } finally {
      await browser?.close().catch(() => {});
      server.close();
    }
  } finally {
    if (args.plant) rmSync(root, { recursive: true, force: true });
  }
}

/**
 * Presses Next from the title screen until it changes nothing. Returns the number of screens
 * reached and screen actions run.
 */
async function walkPresenter(page, origin, settle, fail, setWhere) {
  const read = () =>
    page.evaluate(() => {
      const b = document.body?.dataset ?? {};
      return { mode: b.mode, screen: b.screen, actions: b.actions, state: b.state };
    });
  setWhere("presenter open");
  await page.goto(`${origin}/?ff=presenter&motion=off`, { waitUntil: "load" });
  const opened = await page
    .waitForFunction(() => document.body?.dataset.mode === "presenter" && document.body.dataset.screen === "1", null, {
      timeout: READY_WAIT_MS,
    })
    .then(() => true, () => false);
  if (!opened) {
    fail("presenter", page.url(), `body[data-mode="presenter"][data-screen="1"] not set after ${READY_WAIT_MS} ms`);
    return { screens: 0, actions: 0 };
  }
  await settle();
  const screens = new Set(["1"]);
  const actions = new Set();
  let before = await read();
  for (let press = 1; press <= PRESENTER_MAX_PRESSES; press++) {
    setWhere(`presenter screen ${before.screen} Next ${press}`);
    await page.keyboard.press(PRESENTER_NEXT_KEY);
    await page.waitForTimeout(KEY_SETTLE_MS);
    await settle();
    const after = await read();
    if (after.state === "failed") {
      fail(`presenter screen ${after.screen}`, page.url(), "page state failed");
      break;
    }
    if (presenterWalkDone(before, after)) return { screens: screens.size, actions: actions.size };
    screens.add(after.screen);
    if (after.screen === before.screen && Number(after.actions) > Number(before.actions)) {
      actions.add(`${after.screen}.${after.actions}`);
    }
    before = after;
  }
  fail("presenter", page.url(), `Next still changed the screen after ${PRESENTER_MAX_PRESSES} presses`);
  return { screens: screens.size, actions: actions.size };
}

async function main() {
  let args;
  let result;
  try {
    args = parseArgs(process.argv.slice(2));
    result = await run(args);
  } catch (e) {
    console.log(`COULD NOT RUN: ${e instanceof CouldNotRun ? e.message : (e?.stack ?? e)}`);
    return 2;
  }
  if (args.plant) {
    const caught = (url) => result.requests.some((r) => r.url === url && !r.ok);
    const missed = [PLANT_IMG, PLANT_FETCH].filter((u) => !caught(u));
    if (missed.length === 0) {
      console.log("SELF-TEST OK");
      return 0;
    }
    console.log(`SELF-TEST BROKEN: not caught: ${missed.join(", ")}`);
    return 1;
  }
  return result.violations.length === 0 ? 0 : 1;
}

process.exitCode = await main();
