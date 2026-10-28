/**
 * Narration for the explainer video: parse pitch/explainer/narration.txt, resolve every {key}
 * from public/derived/numbers.json or the engine's scene data, lint it with the pitch
 * guardrails, and turn it into captions, spoken text and WebVTT.
 *
 * node pitch/explainer/narration.mjs <data.json>   prints the resolved script; exit 1 on findings
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { lintText, MEASURED_KEYS, parseFacts } from "../lib/rules.mjs";

export const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const FILE = "pitch/explainer/narration.txt";

/** Scenes in order: `{ id, chapter, lines: [{ id, cue, source, lineNo }] }`. */
export function parseNarration(text) {
  const scenes = [];
  text.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim();
    if (!line || (line.startsWith("#") && !line.startsWith("## "))) return;
    const head = line.match(/^## ([a-z0-9-]+)\s*\|\s*(.+)$/);
    if (head) {
      scenes.push({ id: head[1], chapter: head[2].trim(), lines: [] });
      return;
    }
    if (line.startsWith("## ")) throw new Error(`${FILE}:${i + 1}: scene header needs "## id | Chapter"`);
    const scene = scenes.at(-1);
    if (!scene) throw new Error(`${FILE}:${i + 1}: text before the first scene`);
    const cue = line.match(/^\[([a-z0-9-]+)\]\s*/);
    scene.lines.push({
      id: `${scene.id}-${String(scene.lines.length + 1).padStart(2, "0")}`,
      cue: cue ? cue[1] : null,
      source: cue ? line.slice(cue[0].length) : line,
      lineNo: i + 1,
    });
  });
  return scenes;
}

/** A string constant from app/src/copy.ts, which may wrap onto the next line. */
export function copyString(copyTs, name) {
  const m = copyTs.match(new RegExp(`\\b${name}:\\s*\\n?\\s*"((?:[^"\\\\]|\\\\.)*)"`));
  if (!m) throw new Error(`app/src/copy.ts has no string ${name}`);
  return JSON.parse(`"${m[1]}"`);
}

/**
 * The lint and resolve context: the pitch key catalog, plus every numbers.json key and the
 * engine keys from the scene data, all resolved as numbers rows.
 */
export function narrationContext(data, rootDir = root) {
  const read = (rel) => readFileSync(join(rootDir, rel), "utf8");
  const catalog = JSON.parse(read("pitch/keys.json")).keys;
  const rows = JSON.parse(read("public/derived/numbers.json"));
  const numbers = new Map(rows.map((r) => [r.key, r]));
  for (const [key, row] of Object.entries(data.engine_keys ?? {})) {
    if (numbers.has(key)) throw new Error(`engine key ${key} is also in numbers.json`);
    numbers.set(key, { key, ...row });
  }
  const keys = { ...catalog };
  for (const key of numbers.keys()) {
    if (!keys[key]) keys[key] = { source: "numbers", prov: numbers.get(key).prov, display: `{${key}}` };
  }
  const factsPath = join(rootDir, "docs", "FACTS.md");
  const facts = existsSync(factsPath) ? parseFacts(readFileSync(factsPath, "utf8")) : { rows: new Map(), sayInstead: [] };
  return { keys, numbers, facts, measured: [...MEASURED_KEYS], strict: true, copyTs: read("app/src/copy.ts") };
}

/** Resolve one line. Findings use the pitch rule names plus "unknown-copy" and "measured-in-video". */
export function resolveLine(source, ctx, where = { file: FILE, line: 1 }) {
  const findings = [];
  let text = source.replace(/\{copy\.([A-Za-z0-9_]+)\}/g, (token, name) => {
    try {
      return copyString(ctx.copyTs, name);
    } catch {
      findings.push({ ...where, rule: "unknown-copy", text: name });
      return token;
    }
  });
  for (const m of text.matchAll(/\{([a-z0-9_]+)\}/g)) {
    // A MEASURED key renders "[read from screen]" on stage; a recorded video cannot read a screen.
    if (ctx.measured.includes(m[1])) findings.push({ ...where, rule: "measured-in-video", text: m[1] });
  }
  const lint = lintText(where.file, text, ctx);
  for (const f of lint.findings) findings.push({ ...f, line: where.line });
  text = lint.rendered;
  if (/\{[^}]*\}/.test(text)) findings.push({ ...where, rule: "unresolved", text });
  return { caption: text, findings };
}

/** Resolve the whole script. Throws with every finding when anything fails. */
export function buildNarration(data, { text, rootDir = root } = {}) {
  const ctx = narrationContext(data, rootDir);
  const scenes = parseNarration(text ?? readFileSync(join(rootDir, FILE), "utf8"));
  const findings = [];
  for (const scene of scenes) {
    for (const line of scene.lines) {
      const r = resolveLine(line.source, ctx, { file: FILE, line: line.lineNo });
      findings.push(...r.findings);
      line.caption = r.caption;
      line.spoken = spoken(r.caption);
    }
  }
  if (findings.length) {
    const err = new Error(`narration has ${findings.length} finding(s):\n${findings.map((f) => `${f.file}:${f.line}: ${f.rule}: ${f.text}`).join("\n")}`);
    err.findings = findings;
    throw err;
  }
  return scenes;
}

/** What the synthetic voice reads: units and acronyms spelled the way they are said. */
const SPOKEN = [
  [/\bClearlane\b/g, "Clear-lane"],
  [/\bCAISO\b/g, "Cal I.S.O."],
  [/\bPacifiCorp\b/g, "Pacific Corp"],
  [/(\d) MW MOU\b/g, "$1 megawatt M.O.U."],
  [/\bMOU\b/g, "M.O.U."],
  [/\bper MWh\b/g, "per megawatt hour"],
  [/\bMWh\b/g, "megawatt hours"],
  [/\bper MW\b/g, "per megawatt"],
  [/\bMW\b/g, "megawatts"],
  [/\bkW\b/g, "kilowatts"],
  [/(\d)x\b/g, "$1 times"],
  [/\b(\d{1,2}(?::\d{2})?)(am|pm)\b/g, (_, t, ap) => `${t} ${ap.toUpperCase()}`],
];

export function spoken(text) {
  return SPOKEN.reduce((s, [re, to]) => s.replace(re, to), text);
}

/**
 * Split a caption into chunks of at most `max` characters. Each split is the space closest to
 * the middle, with sentence ends, then colons and semicolons, then commas preferred, so the
 * chunks come out balanced and no chunk is a stray word or two.
 */
export function chunkCaption(text, max = 66) {
  if (text.length <= max) return [text];
  const weight = (before) =>
    /[.!?]$/.test(before) ? 0 : /[:;]$/.test(before) ? 0.2 : /,$/.test(before) ? 0.3 : 0.5;
  let best = null;
  for (const m of text.matchAll(/\s+/g)) {
    const before = text.slice(0, m.index);
    const cost = Math.abs(m.index - text.length / 2) / text.length + weight(before);
    if (!best || cost < best.cost) best = { cost, at: m.index, end: m.index + m[0].length };
  }
  if (!best) return [text];
  return [
    ...chunkCaption(text.slice(0, best.at), max),
    ...chunkCaption(text.slice(best.end), max),
  ];
}

/** Caption cues for one line: its chunks share the line's time in proportion to their length. */
export function lineCues(line, start, end) {
  const chunks = chunkCaption(line.caption);
  const total = chunks.reduce((a, c) => a + c.length, 0);
  let t = start;
  return chunks.map((text, i) => {
    const t1 = i === chunks.length - 1 ? end : t + ((end - start) * text.length) / total;
    const cue = { start: t, end: t1, text };
    t = t1;
    return cue;
  });
}

const stamp = (s) => {
  const ms = Math.round(s * 1000);
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const sec = Math.floor((ms % 60_000) / 1000);
  const pad = (n, w = 2) => String(n).padStart(w, "0");
  return `${pad(h)}:${pad(m)}:${pad(sec)}.${pad(ms % 1000, 3)}`;
};

export function toVtt(cues) {
  let prev = -Infinity;
  const body = cues.map((c, i) => {
    if (!(c.start >= prev && c.end > c.start)) throw new Error(`caption ${i + 1} is out of order`);
    prev = c.end;
    return `${i + 1}\n${stamp(c.start)} --> ${stamp(c.end)}\n${c.text}\n`;
  });
  return `WEBVTT\n\n${body.join("\n")}`;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const dataPath = process.argv[2];
  if (!dataPath) {
    console.error("usage: node pitch/explainer/narration.mjs <data.json>");
    process.exit(2);
  }
  try {
    const scenes = buildNarration(JSON.parse(readFileSync(dataPath, "utf8")));
    for (const s of scenes) {
      console.log(`\n${s.chapter}`);
      for (const l of s.lines) console.log(`  ${l.id}  ${l.caption}`);
    }
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
