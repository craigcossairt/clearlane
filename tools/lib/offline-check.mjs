// Pure helpers for tools/offline-check.mjs: the request classifier, the origin check, the static
// bundle scanner, the beat keys and the summary line. Tested in tools/offline-check.test.ts.

/**
 * @param {string} url
 * @param {string} origin
 */
export function isSameOrigin(url, origin) {
  try {
    return new URL(url).origin === new URL(origin).origin;
  } catch {
    return false;
  }
}

/**
 * Decide whether a request the browser made is allowed on stage.
 * @param {string} url
 * @param {string} origin the static server's origin
 * @param {{ dataMode?: string }} [opts] dataMode defaults to "snapshot", the stage default
 * @returns {{ ok: boolean, reason: string }}
 */
export function classifyRequest(url, origin, { dataMode = "snapshot" } = {}) {
  let u;
  try {
    u = new URL(url);
  } catch {
    return { ok: false, reason: "unparseable URL" };
  }
  if (u.protocol === "ws:" || u.protocol === "wss:") return { ok: false, reason: "websocket" };
  // data: and blob: are built inside the page and never touch the network.
  if (u.protocol === "data:" || u.protocol === "blob:") return { ok: true, reason: "in-page URL" };
  if (!isSameOrigin(url, origin)) return { ok: false, reason: `other origin (${u.origin})` };
  if (dataMode === "snapshot" && (u.pathname === "/api" || u.pathname.startsWith("/api/"))) {
    return { ok: false, reason: "/api/ request in snapshot mode" };
  }
  return { ok: true, reason: "same-origin" };
}

// A URL is a FAIL when the text right before it puts it where the browser would load it.
// Each pattern is matched against the text that ends just before the URL.
const LOAD_POSITIONS = [
  // html attributes and element.src = "..." assignments
  { re: /\b(?:src|href|srcset|poster)\s*=\s*["']?$/i, what: "src/href attribute" },
  // compiled JSX props that make the browser load the URL (an <a href> does not, so href is left out)
  { re: /[{,]\s*(?:src|srcSet|poster)\s*:\s*["'`]$/, what: "src prop" },
  { re: /url\(\s*["']?$/i, what: "css url(" },
  { re: /@import\s+(?:url\(\s*)?["']?$/i, what: "css @import" },
  { re: /\bimport\s*\(\s*["'`]$/, what: "import(" },
  { re: /\bfrom\s*["'`]$/, what: "static import" },
  { re: /\bfetch\s*\(\s*["'`]$/, what: "fetch(" },
  { re: /\bnew\s+URL\s*\(\s*["'`]$/, what: "new URL(" },
  { re: /\.open\s*\(\s*["'`][A-Za-z]+["'`]\s*,\s*["'`]$/, what: "XMLHttpRequest open" },
  { re: /\bsendBeacon\s*\(\s*["'`]$/, what: "sendBeacon(" },
  { re: /\bEventSource\s*\(\s*["'`]$/, what: "EventSource(" },
  { re: /\bWebSocket\s*\(\s*["'`]$/, what: "WebSocket(" },
];

// Known absolute URLs that sit in the bundle as plain strings. INFO only, each with its reason.
const INFO_REASONS = [
  {
    re: /^https?:\/\/www\.w3\.org\//,
    reason: "XML or SVG namespace URI, an identifier the browser never fetches",
  },
  {
    re: /^https?:\/\/(?:react\.dev\/errors|reactjs\.org\/docs\/error-decoder)/,
    reason: "React's error-decoder link, only printed inside an error message",
  },
];
const DEFAULT_INFO = "bundled string (for example a data source citation), not in a load position";

// Absolute (http, https, ws, wss) or protocol-relative URLs. A protocol-relative match only
// counts in a load position and with a dotted host, so "//" comments are never reported.
const URL_RE = /(?:\b(?:https?|wss?):)?\/\/[A-Za-z0-9][A-Za-z0-9.-]*(?::\d+)?[^\s"'`()<>\\{}]*/g;

/**
 * Scan the text of one built html, js or css file.
 * @param {string} text
 * @returns {{ level: "FAIL" | "INFO", url: string, reason: string }[]}
 */
export function scanBundleText(text) {
  /** @type {{ level: "FAIL" | "INFO", url: string, reason: string }[]} */
  const findings = [];
  for (const m of text.matchAll(URL_RE)) {
    const url = m[0].replace(/[.,;]+$/, "");
    const before = text.slice(Math.max(0, (m.index ?? 0) - 80), m.index);
    const load = LOAD_POSITIONS.find((p) => p.re.test(before));
    const schemeless = url.startsWith("//");
    if (schemeless && (!load || !/^\/\/[^/]*\./.test(url))) continue;
    if (load) {
      findings.push({ level: "FAIL", url, reason: `external URL in a load position (${load.what})` });
    } else {
      const known = INFO_REASONS.find((r) => r.re.test(url));
      findings.push({ level: "INFO", url, reason: known ? known.reason : DEFAULT_INFO });
    }
  }
  return findings;
}

// Keys pressed after each beat opens at ?beat=N&step=end&motion=off. Copied from
// docs/lanes/ui.md section 6.8, the one source for keys; update this when that table changes.
// Beat 2 plays the time-lapse (Space), beat 3 takes the call and the second call (C, C),
// beat 4 steps to the re-plan (Right), beat 5 opens the envelope and backtest (E, B),
// beat 6 steps the fleet slider and jumps to 500 MW (+, End).
export const BEAT_KEYS = {
  1: [],
  2: ["Space"],
  3: ["c", "c"],
  4: ["ArrowRight"],
  5: ["e", "b"],
  6: ["+", "End"],
};
// Pressed once after beat 6: reset to beat 1 and clear live results.
export const RESET_KEY = "r";

/**
 * @param {{ violations: number, sameOrigin: number, beatsDriven: number }} r
 */
export function summaryLine({ violations, sameOrigin, beatsDriven }) {
  if (violations > 0) return `FAIL offline-check: ${violations} violations`;
  return `PASS offline-check: 0 external requests, ${sameOrigin} same-origin, ${beatsDriven}/6 beats`;
}

// --presenter: Next is pressed from the title screen until it stops changing anything, so every
// screen and every screen action is driven whatever the screen list is. The cap stops a loop.
export const PRESENTER_NEXT_KEY = "ArrowRight";
export const PRESENTER_MAX_PRESSES = 60;

/**
 * True when a Next press left the presenter where it was: the last screen at its end.
 * A press that only stopped a running replay is not the end.
 * @param {{ screen?: string, actions?: string, state?: string }} before body dataset before Next
 * @param {{ screen?: string, actions?: string, state?: string }} after body dataset after Next
 */
export function presenterWalkDone(before, after) {
  if (before.state === "playing") return false;
  return before.screen === after.screen && before.actions === after.actions;
}

/**
 * @param {{ violations: number, sameOrigin: number, screens: number, actions: number }} r
 */
export function presenterSummaryLine({ violations, sameOrigin, screens, actions }) {
  if (violations > 0) return `FAIL offline-check --presenter: ${violations} violations`;
  return `PASS offline-check --presenter: 0 external requests, ${sameOrigin} same-origin, ${screens} screens, ${actions} actions`;
}
