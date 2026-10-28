// Usage: node app/scripts/projector-check.mjs [baseUrl] [--browser auto|chromium|msedge|chrome] [--presenter]
//
// The projector check (docs/lanes/ui.md section 4, core 12). Against a running stage build
// (default http://localhost:4173, which is `npm run preview`) it opens each beat's end state,
// ?beat=N&step=end&motion=off with reduced motion, at 1920x1080 and at 375x812, saves
// tools/out/screens/beat<N>-<w>x<h>.png (gitignored), and checks:
//   - no sideways scroll at either size;
//   - every [data-num] stays inside its [data-slot] and does not overflow;
//   - font sizes at 1920: [data-num] 40px outside [data-detail] and [data-axis], other text
//     24px, chips 18px;
//   - every request is same-origin;
//   - [data-slot] boxes stay put across state changes: step start against end, before and
//     after C, Copy JSON against Copied.
//
// --presenter (#216) checks presenter mode instead (?ff=presenter): each of the eight screens'
// end states, ?screen=N&step=end&motion=off, at both sizes with the same rules (no sideways
// scroll, numbers fit their slots, minimum font sizes at 1920, same-origin requests), and each
// start state for sideways scroll,
// saving tools/out/screens/presenter<N>-<w>x<h>.png. Without the flag the six-beat run is as
// it was.
//
// The rules and the exit code live in app/src/projector/verdict.ts (pure, vitest-pinned).
// Exit codes: 0 PASS; 1 FAIL, each violation listed; 2 COULD NOT RUN (Playwright missing,
// server unreachable, browser launch failed). A could-not-run is never reported as 1.
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../..");
const SCREENS = path.join(repoRoot, "tools/out/screens");
const SIZES = [
  { width: 1920, height: 1080 },
  { width: 375, height: 812 },
];
const BEATS = [1, 2, 3, 4, 5, 6];
const PRESENTER_SCREENS = [1, 2, 3, 4, 5, 6, 7, 8];
const HOOK_WAIT_MS = 15000;
const STATE_WAIT_MS = 5000;

class CouldNotRun extends Error {}

function parseArgs(argv) {
  const args = { base: "http://localhost:4173", browser: "auto", presenter: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--browser") args.browser = argv[++i];
    else if (a === "--presenter") args.presenter = true;
    else if (a.startsWith("--")) throw new CouldNotRun(`unknown option ${a}`);
    else args.base = a;
  }
  if (!["auto", "chromium", "msedge", "chrome"].includes(args.browser))
    throw new CouldNotRun(`--browser must be auto, chromium, msedge or chrome, got ${args.browser}`);
  try {
    args.base = new URL(args.base).origin;
  } catch {
    throw new CouldNotRun(`baseUrl is not a URL: ${args.base}`);
  }
  return args;
}

async function loadVerdict() {
  try {
    const { tsImport } = await import("tsx/esm/api");
    const file = pathToFileURL(path.join(repoRoot, "app/src/projector/verdict.ts")).href;
    return await tsImport(file, import.meta.url);
  } catch (e) {
    throw new CouldNotRun(`could not load app/src/projector/verdict.ts through tsx (${e.message})`);
  }
}

async function checkServer(base) {
  try {
    const res = await fetch(base, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  } catch (e) {
    throw new CouldNotRun(`server unreachable at ${base} (${e.cause?.code ?? e.message}); run npm run build && npm run preview`);
  }
}

async function launchBrowser(choice) {
  let chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch (e) {
    throw new CouldNotRun(`playwright is not installed (${e.message})`);
  }
  // Bundled Chromium first (CI runs `npx playwright install chromium`), then installed browsers.
  const order = choice === "auto" ? ["chromium", "msedge", "chrome"] : [choice];
  const errors = [];
  for (const name of order) {
    try {
      const browser = await chromium.launch(name === "chromium" ? {} : { channel: name });
      return { browser, name };
    } catch (e) {
      errors.push(`${name}: ${String(e.message).split("\n")[0]}`);
    }
  }
  throw new CouldNotRun(`browser launch failed (${errors.join("; ")})`);
}

/** Runs in the page: raw measurements only. The rules are applied in Node by verdict.ts. */
function measure(withText) {
  // Document coordinates, so a click that scrolls the page is not read as a moved slot.
  const rect = (el) => {
    const b = el.getBoundingClientRect();
    return { x: b.x + window.scrollX, y: b.y + window.scrollY, width: b.width, height: b.height };
  };
  const shown = (el) => {
    const b = el.getBoundingClientRect();
    if (b.width === 0 || b.height === 0) return false;
    const s = getComputedStyle(el);
    return s.visibility !== "hidden" && s.display !== "none" && Number(s.opacity) !== 0;
  };
  const slots = {};
  const seen = {};
  for (const el of document.querySelectorAll("[data-slot]")) {
    const name = el.getAttribute("data-slot");
    seen[name] = (seen[name] ?? -1) + 1;
    slots[`${name}#${seen[name]}`] = rect(el);
  }
  const nums = [];
  for (const el of document.querySelectorAll("[data-num]")) {
    if (!shown(el)) continue;
    const slotEl = el.parentElement?.closest("[data-slot]");
    nums.push({
      key: el.getAttribute("data-num"),
      box: rect(el),
      slot: slotEl ? { name: slotEl.getAttribute("data-slot"), box: rect(slotEl) } : null,
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
    });
  }
  const texts = [];
  if (withText) {
    const done = new Set();
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const words = (node.textContent ?? "").trim();
      const el = node.parentElement;
      if (!words || !el || done.has(el)) continue;
      done.add(el);
      if (el.closest("title, style, script, noscript") || !shown(el)) continue;
      const kind = el.closest(".chip")
        ? "chip"
        : el.closest("[data-num]") && !el.closest("[data-detail], [data-axis]")
          ? "num"
          : "text";
      const css = parseFloat(getComputedStyle(el).fontSize) || 0;
      // SVG text: its screen matrix carries the viewBox and every CSS transform above it.
      // HTML text: multiply the scale of each transformed ancestor (the stage frame fit).
      // The magnitude of (a, b) is the scale even when the text is rotated.
      const mag = (m) => Math.hypot(m.a, m.b);
      let scale = 1;
      if (el instanceof SVGElement) {
        const m = el.getScreenCTM();
        scale = m ? mag(m) : 1;
      } else
        for (let a = el; a; a = a.parentElement) {
          const t = getComputedStyle(a).transform;
          if (t && t !== "none") scale *= mag(new DOMMatrix(t));
        }
      const where = el.closest("[data-slot]")?.getAttribute("data-slot");
      const key = el.closest("[data-num]")?.getAttribute("data-num");
      texts.push({
        kind,
        px: css * scale,
        what: `<${el.tagName.toLowerCase()}>${key ? ` num=${key}` : ""}${where ? ` slot=${where}` : ""} "${words.slice(0, 48)}"`,
      });
    }
  }
  return {
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    slots,
    nums,
    texts,
  };
}

async function open(page, url, beat) {
  await page.goto(url, { waitUntil: "load" });
  try {
    await page.waitForSelector(`body[data-beat="${beat}"]`, { timeout: HOOK_WAIT_MS });
  } catch {
    return false;
  }
  await page.evaluate(() => document.fonts?.ready);
  return true;
}

async function openScreen(page, url, screen) {
  await page.goto(url, { waitUntil: "load" });
  try {
    await page.waitForSelector(`body[data-mode="presenter"][data-screen="${screen}"]`, {
      timeout: HOOK_WAIT_MS,
    });
  } catch {
    return false;
  }
  await page.evaluate(() => document.fonts?.ready);
  return true;
}

/** Presenter mode (#216): the eight screens' end and start states at both sizes. */
async function runPresenter(args, rules) {
  const violations = [];
  let statesChecked = 0;
  await checkServer(args.base);
  const { browser, name } = await launchBrowser(args.browser);
  console.log(`projector-check --presenter: ${args.base} in ${name}, screenshots in tools/out/screens/`);
  mkdirSync(SCREENS, { recursive: true });
  try {
    for (const size of SIZES) {
      const tag = `${size.width}x${size.height}`;
      const context = await browser.newContext({
        viewport: size,
        reducedMotion: "reduce",
        serviceWorkers: "block",
      });
      context.on("request", (req) => violations.push(...rules.offOrigin(tag, req.url(), args.base)));
      const page = await context.newPage();
      for (const step of ["end", "start"]) {
        for (const screen of PRESENTER_SCREENS) {
          const label = `presenter${screen} ${step} ${tag}`;
          const q = step === "end" ? "&step=end" : "";
          if (!(await openScreen(page, `${args.base}/?ff=presenter&screen=${screen}${q}&motion=off`, screen))) {
            violations.push(`${label}: the deep link never set body[data-screen="${screen}"]`);
            continue;
          }
          if (step === "end")
            await page.screenshot({ path: path.join(SCREENS, `presenter${screen}-${tag}.png`) });
          // End states get every rule; start states, as in the six-beat run, the scroll rule.
          const full = step === "end";
          const m = await page.evaluate(measure, full && size.width === 1920);
          statesChecked++;
          violations.push(...rules.noSidewaysScroll(label, m.scrollWidth, m.clientWidth));
          if (!full) continue;
          for (const n of m.nums) violations.push(...rules.numFits(label, n));
          for (const t of m.texts) violations.push(...rules.fontTooSmall(label, t));
        }
      }
      await context.close();
    }
  } finally {
    await browser.close().catch(() => {});
  }
  return { couldNotRun: null, statesChecked, violations };
}

async function run(args, rules) {
  if (args.presenter) return runPresenter(args, rules);
  const violations = [];
  let statesChecked = 0;
  await checkServer(args.base);
  const { browser, name } = await launchBrowser(args.browser);
  console.log(`projector-check: ${args.base} in ${name}, screenshots in tools/out/screens/`);
  mkdirSync(SCREENS, { recursive: true });
  try {
    for (const size of SIZES) {
      const tag = `${size.width}x${size.height}`;
      const context = await browser.newContext({
        viewport: size,
        reducedMotion: "reduce",
        serviceWorkers: "block",
      });
      await context
        .grantPermissions(["clipboard-read", "clipboard-write"], { origin: args.base })
        .catch(() => {});
      context.on("request", (req) => violations.push(...rules.offOrigin(tag, req.url(), args.base)));
      const page = await context.newPage();
      const endSlots = {};

      for (const beat of BEATS) {
        const label = `beat${beat} ${tag}`;
        if (!(await open(page, `${args.base}/?beat=${beat}&step=end&motion=off`, beat))) {
          violations.push(`${label}: the deep link never set body[data-beat="${beat}"]`);
          continue;
        }
        await page.screenshot({ path: path.join(SCREENS, `beat${beat}-${tag}.png`) });
        const m = await page.evaluate(measure, size.width === 1920);
        statesChecked++;
        endSlots[beat] = m.slots;
        violations.push(...rules.noSidewaysScroll(label, m.scrollWidth, m.clientWidth));
        for (const n of m.nums) violations.push(...rules.numFits(label, n));
        for (const t of m.texts) violations.push(...rules.fontTooSmall(label, t));
      }

      // Step start against end: a slot reserved at start must not move when the end state lands.
      for (const beat of BEATS) {
        const label = `beat${beat} ${tag} start vs end`;
        if (!endSlots[beat]) continue;
        if (!(await open(page, `${args.base}/?beat=${beat}&motion=off`, beat))) {
          violations.push(`${label}: the deep link never set body[data-beat="${beat}"]`);
          continue;
        }
        const m = await page.evaluate(measure, false);
        statesChecked++;
        violations.push(...rules.noSidewaysScroll(`beat${beat} ${tag} start`, m.scrollWidth, m.clientWidth));
        violations.push(...rules.slotChanges(label, m.slots, endSlots[beat]));
      }

      // Before and after C on the call beat.
      if (await open(page, `${args.base}/?beat=3&motion=off`, 3)) {
        const before = await page.evaluate(measure, false);
        await page.keyboard.press("c");
        const landed = await page
          .waitForSelector('body[data-state="call"]', { timeout: STATE_WAIT_MS })
          .then(() => true, () => false);
        if (!landed) violations.push(`beat3 ${tag}: C did not land the call (body[data-state] != call)`);
        const after = await page.evaluate(measure, false);
        statesChecked += 2;
        violations.push(...rules.slotChanges(`beat3 ${tag} before vs after C`, before.slots, after.slots));
      } else violations.push(`beat3 ${tag}: the deep link never set body[data-beat="3"]`);

      // Copy JSON against Copied (or Copy failed: the label width is shared either way).
      if (await open(page, `${args.base}/?beat=5&motion=off`, 5)) {
        const before = await page.evaluate(measure, false);
        const slot = page.locator('[data-slot="copy-json"]').first();
        const clickable =
          (await slot.count()) === 0
            ? null
            : (await slot.evaluate((el) => el.tagName)) === "BUTTON"
              ? slot
              : slot.locator("button").first();
        if (!clickable || (await clickable.count()) === 0) {
          violations.push(`beat5 ${tag}: no Copy JSON button in [data-slot="copy-json"]`);
          await context.close();
          continue;
        }
        await clickable.click();
        const changed = await page
          .waitForFunction(
            () => /Copied|Copy failed/.test(document.querySelector('[data-slot="copy-json"]')?.textContent ?? ""),
            null,
            { timeout: STATE_WAIT_MS },
          )
          .then(() => true, () => false);
        if (!changed) violations.push(`beat5 ${tag}: Copy JSON never showed Copied or Copy failed`);
        const after = await page.evaluate(measure, false);
        statesChecked += 2;
        violations.push(...rules.slotChanges(`beat5 ${tag} Copy JSON vs Copied`, before.slots, after.slots));
      } else violations.push(`beat5 ${tag}: the deep link never set body[data-beat="5"]`);

      await context.close();
    }
  } finally {
    await browser.close().catch(() => {});
  }
  return { couldNotRun: null, statesChecked, violations };
}

async function main() {
  let rules;
  try {
    rules = await loadVerdict();
  } catch (e) {
    // verdict.ts itself is unavailable, so its exit code cannot be asked: report 2 directly.
    console.error(`COULD NOT RUN projector-check: ${e.message}`);
    return 2;
  }
  let result;
  try {
    result = await run(parseArgs(process.argv.slice(2)), rules);
  } catch (e) {
    // Anything that stops the measurement part way (server gone, browser crash) is a
    // could-not-run, not a FAIL: the page was never fully checked.
    result = { couldNotRun: e instanceof CouldNotRun ? e.message : `run stopped: ${e.message}`, statesChecked: 0, violations: [] };
  }
  const v = rules.verdict(result);
  for (const line of v.lines) (v.code === 0 ? console.log : console.error)(line);
  return v.code;
}

process.exitCode = await main();
