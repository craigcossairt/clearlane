/**
 * Shared pitch guardrails. The copy resolver and the PR scanner both call this.
 * A finding is `{ file, line, rule, text }` and prints as `file:line: rule: text`.
 */

import { isAbsolute, resolve as resolvePath, win32 } from "node:path";

export const MEASURED_KEYS = ["solve_ms", "replan_ms"];
export const MEASURED_DISPLAY = "[read from screen]";

/** Each regex masks a span that is not a stage result. Longest tokens first. */
export const ALLOWLIST = [
  { name: "url", re: /https?:\/\/\S+/g, reason: "a source URL is not a result" },
  { name: "ieee", re: /IEEE\s*2030\.5/g, reason: "IEEE 2030.5 is a standard name" },
  { name: "schema", re: /clearlane\.[a-z0-9-]+\/v\d+/g, reason: "clearlane.envelope/v1 is a schema name" },
  { name: "docket", re: /\b\d{2}-\d{3}-(?:[A-Z]+)?\d+\b/g, reason: "a PSC docket number is a citation" },
  { name: "viewport", re: /\b1920x1080\b/g, reason: "1920x1080 is the projector size" },
  { name: "slide", re: /^## \d+\./g, reason: "a slide heading number is not a result" },
  { name: "schedule", re: /\bSchedule\s+6A\b|\bSchedule\s+[68]\b/g, reason: "Schedule 6, 6A and 8 are tariff names" },
  { name: "option", re: /\bOption\s+[12]\b/g, reason: "Option 1 and Option 2 name the bounty tracks" },
  { name: "train", re: /\bTrain\s+\d+\b/g, reason: "a Train number is a schedule label" },
  { name: "date", re: /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2}\b/g, reason: "a month and day are a date" },
  { name: "clock", re: /\b\d{1,2}(?::\d{2})?\s?(?:am|pm)\b/gi, reason: "a clock time is not a result" },
  { name: "beat", re: /\b\d{1,2}:\d{2}\b/g, reason: "a beat timing such as 0:25 is the stage clock" },
  { name: "year", re: /\b202[0-9]\b|\b2030\b/g, reason: "a year from 2020 to 2030 is a date" },
];

export const BANNED = [
  { name: "torus-lacks", re: /Torus lacks/i },
  { name: "torus-cant", re: /Torus can't/i },
  { name: "torus-cannot", re: /Torus cannot/i },
  { name: "lasso-doesnt", re: /Lasso doesn't/i },
  { name: "lasso-does-not", re: /Lasso does not/i },
  { name: "torus-revenue", re: /(?<![Nn]ot )Torus revenue/i },
  { name: "utah-regulators", re: /Utah regulators/i },
  { name: "six-minute-call", re: /six-minute call/i },
  { name: "6-minute-call", re: /6-minute call/i },
  { name: "500-installed", re: /500 MW installed/i },
  { name: "nucleus-x", re: /Nucleus x/i },
  { name: "nucleus-bounty", re: /Nucleus bounty/i },
  { name: "nucleus-slide", re: /Nucleus slide/i },
  { name: "startup-state", re: /Startup State/i },
  { name: "record-peak", re: /record peak/i },
  { name: "old-range", re: /14% to 77%/i },
  { name: "pulse-life", re: /Pulse has a 25-year/i },
  { name: "july-count", re: /27 of 30/i },
  { name: "prices-post", re: /prices post at/i },
  { name: "evening-calls", re: /most calls in the evening/i },
];

export const HYPE = ["comprehensive", "robust", "seamless", "leverage", "cutting-edge", "game-changer"];

const HAND = [
  { rule: "hand-dollar", re: /\$\s?\d/ },
  { rule: "hand-percent", re: /\d+(?:\.\d+)?\s?%/ },
  { rule: "hand-unit", re: /\d[\d,]*(?:\.\d+)?\s?(?:kWh|MWh|g\/kWh|kW|MW|ms|min|t|s|C|x)\b/ },
  { rule: "hand-bare", re: /\b\d{3,}\b/ },
];

export function formatFinding(f) {
  return `${f.file}:${f.line}: ${f.rule}: ${f.text}`;
}

export function resolveInput(rootDir, inputPath) {
  if (isAbsolute(inputPath) || win32.isAbsolute(inputPath)) return inputPath;
  return resolvePath(rootDir, inputPath);
}

function isDeck(file) {
  return /(?:^|[\\/])deck\.(?:md|html)$/.test(file);
}

export function maskAllowlist(line) {
  let masked = line.replace(/\{[a-z0-9_]+\}/g, (m) => " ".repeat(m.length));
  for (const { re } of ALLOWLIST) {
    masked = masked.replace(new RegExp(re.source, "gi"), (m) => " ".repeat(m.length));
  }
  return masked;
}

export function parseFacts(text) {
  const rows = new Map();
  const sayInstead = [];
  let mode = "facts";
  for (const line of text.split(/\r?\n/)) {
    if (/^##\s+Do not say/.test(line)) {
      mode = "say";
      continue;
    }
    if (/^##\s+/.test(line)) mode = "facts";
    if (!line.startsWith("|")) continue;
    const cells = line.split("|").slice(1, -1).map((c) => c.trim());
    if (cells.length < 3 || cells.every((c) => /^:?-+:?$/.test(c))) continue;
    if (mode === "say") {
      if (cells[0] === "Do not say") continue;
      sayInstead.push({ mentions: `${cells[0]} ${cells[1] ?? ""}`, say: cells[2] ?? "" });
      continue;
    }
    if (!/^[a-z][a-z0-9_]*$/.test(cells[0])) continue;
    const status = cells[7] ?? "";
    if (!/\b(?:PENDING-ENGINE|UNCHECKED|CONFLICT|VERIFIED)\b/.test(status)) continue;
    rows.set(cells[0], {
      claim: cells[1] ?? "",
      value: cells[2] ?? "",
      status,
    });
  }
  return { rows, sayInstead };
}

function statusOf(row) {
  const s = row?.status ?? "";
  if (/\bPENDING-ENGINE\b/.test(s)) return "PENDING-ENGINE";
  if (/\bUNCHECKED\b/.test(s)) return "UNCHECKED";
  if (/\bCONFLICT\b/.test(s)) return "CONFLICT";
  if (/\bVERIFIED\b/.test(s)) return "VERIFIED";
  return "MISSING";
}

function displayInRow(display, row, sayInstead, fact) {
  if (!display) return false;
  if (row && (row.claim.includes(display) || row.value.includes(display))) return true;
  return sayInstead.some((item) => item.say.includes(display) && (item.mentions.includes(fact) || item.mentions.includes(display)));
}

export function checkFactsKey(key, entry, facts) {
  const findings = [];
  const fact = entry.fact;
  const row = fact ? facts?.rows.get(fact) : undefined;
  if (!fact || !row) {
    findings.push({ rule: "facts-status", text: `${key} has no FACTS row` });
    return findings;
  }
  const status = statusOf(row);
  if (status === "UNCHECKED" || status === "PENDING-ENGINE" || status === "MISSING") {
    findings.push({ rule: "facts-status", text: `${fact} is ${status}` });
    return findings;
  }
  if (!displayInRow(entry.display, row, facts.sayInstead, fact)) {
    findings.push({ rule: "facts-display", text: `${key} display is not in the FACTS row` });
  }
  return findings;
}

export function catalogFindings(ctx) {
  const findings = [];
  for (const [key, entry] of Object.entries(ctx.keys)) {
    if (entry.source === "facts" && ctx.numbers?.has(key)) {
      findings.push({ file: "pitch/keys.json", line: 1, rule: "two-sources", text: key });
    }
    if (entry.source === "facts") {
      for (const item of checkFactsKey(key, entry, ctx.facts)) {
        findings.push({ file: "pitch/keys.json", line: 1, rule: item.rule, text: item.text });
      }
    }
  }
  return findings;
}

function lineFindings(file, lineNo, line, ctx) {
  const findings = [];
  if (line.includes("\u2014")) findings.push({ file, line: lineNo, rule: "em-dash", text: "em dash" });
  if (line.includes("\u2013")) findings.push({ file, line: lineNo, rule: "en-dash", text: "en dash" });
  for (const { name, re } of BANNED) {
    if (re.test(line)) findings.push({ file, line: lineNo, rule: "banned", text: name });
    re.lastIndex = 0;
  }
  if (isDeck(file) && /\bNucleus\b/i.test(line)) {
    findings.push({ file, line: lineNo, rule: "banned", text: "nucleus" });
  }
  for (const word of HYPE) {
    if (new RegExp(`\\b${word}\\b`, "i").test(line)) {
      findings.push({ file, line: lineNo, rule: "hype", text: word });
    }
  }
  const masked = maskAllowlist(line);
  for (const { rule, re } of HAND) {
    const hit = masked.match(re);
    if (hit) findings.push({ file, line: lineNo, rule, text: hit[0] });
  }
  for (const match of line.matchAll(/\{([a-z0-9_]+)\}/g)) {
    const key = match[1];
    if (key === "operating_day" || MEASURED_KEYS.includes(key)) continue;
    if (!ctx.keys[key]) findings.push({ file, line: lineNo, rule: "unknown-key", text: key });
  }
  return findings;
}

export function keysUsed(text) {
  return [...text.matchAll(/\{([a-z0-9_]+)\}/g)].map((m) => m[1]);
}

export function operatingDay(text, ctx) {
  const used = keysUsed(text).filter((key) => ctx.keys[key]?.source === "numbers" || (!ctx.keys[key]?.source && ctx.keys[key]));
  const days = new Set();
  for (const key of used) {
    const row = ctx.numbers?.get(key);
    if (row?.as_of_mt) days.add(row.as_of_mt);
  }
  if (days.size > 1) return { ok: false, day: null };
  if (days.size === 1) return { ok: true, day: [...days][0] };
  return { ok: true, day: null };
}

export function resolveText(text, ctx) {
  const findings = [];
  const day = operatingDay(text, ctx);
  if (!day.ok) findings.push({ rule: "operating-day", text: "as_of_mt disagrees" });
  let unresolved = 0;
  const rendered = text.replace(/\{([a-z0-9_]+)\}/g, (token, key) => {
    if (MEASURED_KEYS.includes(key)) return MEASURED_DISPLAY;
    if (key === "operating_day") {
      if (!day.ok) return token;
      if (!day.day) {
        unresolved += 1;
        if (ctx.strict) findings.push({ rule: "operating-day", text: "no as_of_mt" });
        return token;
      }
      return day.day;
    }
    const entry = ctx.keys[key];
    if (!entry) return token;
    if (entry.source === "facts") return entry.display;
    const row = ctx.numbers?.get(key);
    if (row?.display) return row.display;
    unresolved += 1;
    if (ctx.strict && (entry.source === "numbers" || entry.source == null)) {
      findings.push({ rule: "numbers-missing", text: key });
    }
    return entry.display ?? token;
  });
  for (const key of MEASURED_KEYS) {
    const filed = ctx.numbers?.get(key)?.display;
    if (filed && text.includes(filed)) findings.push({ rule: "measured", text: key });
  }
  return { text: rendered, findings, unresolved };
}

export function lintText(file, text, ctx) {
  const findings = [];
  const lines = text.split(/\r?\n/);
  lines.forEach((line, i) => findings.push(...lineFindings(file, i + 1, line, ctx)));
  for (const key of new Set(keysUsed(text))) {
    const entry = ctx.keys[key];
    if (entry?.source !== "facts") continue;
    if (ctx.numbers?.has(key)) findings.push({ file, line: 1, rule: "two-sources", text: key });
    for (const item of checkFactsKey(key, entry, ctx.facts ?? { rows: new Map(), sayInstead: [] })) {
      findings.push({ file, line: 1, rule: item.rule, text: item.text });
    }
  }
  const resolved = resolveText(text, ctx);
  for (const item of resolved.findings) {
    findings.push({ file, line: 1, rule: item.rule, text: item.text });
  }
  return { findings, unresolved: resolved.unresolved, rendered: resolved.text };
}
