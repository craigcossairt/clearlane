// Fact ledger checks for tools/facts-check.mjs (integration.md section 6.9).
// Pure parsing and checks, plus runFactsCheck which reads a repo root.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const KEY_RE = /^[a-z][a-z0-9_]*$/;
const STATUSES = ["PENDING-ENGINE", "VERIFIED", "UNCHECKED", "CONFLICT"];
// Same as pitch/resolve.mjs: these pitch files are working notes, not judge copy.
const PITCH_SKIP = new Set(["review-log.md", "research-tariff.md"]);

export class CouldNotRun extends Error {}

function cells(line) {
  const t = line.trim();
  if (!t.startsWith("|")) return null;
  return t
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());
}

// The first "Say ..." sentence of a claim (else "Show ..." or "Use ..."), keeping periods inside quotes.
function sayFromClaim(claim) {
  const m = /\bSay\b/.exec(claim) ?? /\b(?:Show|Use)\b/.exec(claim);
  if (!m) return undefined;
  let inQuote = false;
  for (let i = m.index; i < claim.length; i++) {
    const ch = claim[i];
    if (ch === '"') inQuote = !inQuote;
    else if (ch === "." && !inQuote && (i + 1 === claim.length || /\s/.test(claim[i + 1]))) {
      return claim.slice(m.index, i + 1);
    }
  }
  return claim.slice(m.index);
}

/** Parse FACTS.md into a Map of key -> row. First occurrence of a key wins. */
export function parseFacts(markdown) {
  const rows = new Map();
  const doNotSay = [];
  let inDoNotSay = false;
  for (const line of markdown.split(/\r?\n/)) {
    if (/^#/.test(line)) inDoNotSay = /^##\s+Do not say\b/i.test(line);
    const c = cells(line);
    if (!c) continue;
    if (inDoNotSay && c.length === 3 && !/^-+$/.test(c[0]) && c[0] !== "Do not say") {
      doNotSay.push({ text: `${c[0]} ${c[1]}`, sayInstead: c[2] });
      continue;
    }
    if (c.length !== 8 || !KEY_RE.test(c[0]) || rows.has(c[0])) continue;
    const [key, claim, value, cls, source, rederive, lvl, statusText] = c;
    const status = STATUSES.find((s) => statusText.startsWith(s)) ?? "OTHER";
    rows.set(key, { key, claim, value, cls, source, rederive, lvl, status, statusText, sayInstead: sayFromClaim(claim) });
  }
  for (const row of rows.values()) {
    if (row.sayInstead) continue;
    const hit = doNotSay.find((d) => d.text.includes(`(${row.key})`));
    if (hit) row.sayInstead = hit.sayInstead;
  }
  return rows;
}

/** {key} placeholders, matched like pitch/resolve.mjs; the literal {key} is skipped. */
export function extractCopyKeys(text) {
  const out = [];
  for (const m of text.matchAll(/\{([a-z0-9_]+)\}/g)) {
    if (m[1] !== "key" && !out.includes(m[1])) out.push(m[1]);
  }
  return out;
}

/** Quoted snake_case strings in app/src/stageKeys.ts. */
export function extractStageKeys(text) {
  const out = [];
  for (const m of text.matchAll(/["'`]([a-z][a-z0-9_]*)["'`]/g)) {
    if (!out.includes(m[1])) out.push(m[1]);
  }
  return out;
}

/** Keys whose prov is MEASURED in pitch/keys.json (the catalog pitch/resolve.mjs reads). Empty when the file is absent. */
export function measuredKeysFromCatalog(catalog) {
  const keys = catalog?.keys;
  if (!keys || typeof keys !== "object") return new Set();
  return new Set(Object.entries(keys).filter(([, e]) => e?.prov === "MEASURED").map(([k]) => k));
}

/**
 * The six checks. numbers is StageNumber[] or null when numbers.json is missing.
 * uses is a Map of key -> list of files that use it.
 * measuredKeys is the set of keys pitch/keys.json marks prov MEASURED. A key is
 * MEASURED when keys.json says so or its FACTS row has Class MEASURED. MEASURED
 * keys are live-only (timed on the demo machine, never stored), so they pass
 * check 2 whatever their status, and check 6 fails one that is also in numbers.json.
 */
export function checkFacts({ facts, numbers, uses, allowPending = false, measuredKeys = new Set() }) {
  const findings = [];
  const add = (level, check, key, message) => findings.push({ level, check, key, message });
  const byKey = new Map((numbers ?? []).map((n) => [n.key, n]));
  // A MEASURED key needs a FACTS row; a key with no row stays a check 2 failure.
  const isMeasured = (key) => facts.has(key) && (measuredKeys.has(key) || facts.get(key).cls === "MEASURED");

  if (numbers === null) {
    add("WARN", 0, "", "numbers.json missing (public/derived/numbers.json not built); checks 1, 3 and 4 skipped, copy checks still run");
  } else {
    for (const n of numbers) {
      if (!facts.has(n.key)) add("FAIL", 1, n.key, `${n.key}: in numbers.json but has no FACTS row`);
    }
  }

  for (const [key, files] of uses) {
    const where = files.join(", ");
    const row = facts.get(key);
    if (!byKey.has(key) && row?.status !== "VERIFIED" && !isMeasured(key)) {
      const why = row ? `FACTS status ${row.status}` : "no FACTS row";
      if (allowPending && numbers === null && row?.status === "PENDING-ENGINE") {
        add("WARN", 2, key, `{${key}} in ${where}: PENDING-ENGINE and numbers.json not built (allowed by --allow-pending)`);
      } else {
        add("FAIL", 2, key, `{${key}} in ${where}: resolves in neither numbers.json nor a VERIFIED FACTS row (${why})`);
      }
    }
    if (row?.status === "CONFLICT") {
      const say = row.sayInstead ?? "read its FACTS row";
      add("WARN", 5, key, `{${key}} in ${where}: CONFLICT key in judge copy; FACTS wording: ${say}`);
    }
  }

  if (numbers !== null) {
    for (const row of facts.values()) {
      const n = byKey.get(row.key);
      if (!n) continue;
      if (isMeasured(row.key)) {
        add("FAIL", 6, row.key, `${row.key}: MEASURED is live-only, but numbers.json also has a row for it (display "${n.display}")`);
        continue;
      }
      if (row.status === "VERIFIED" && row.value.trim() !== String(n.display).trim()) {
        add("WARN", 3, row.key, `${row.key}: VERIFIED value "${row.value}" differs from numbers.json display "${n.display}"`);
      }
      if (row.status === "PENDING-ENGINE") {
        add("WARN", 4, row.key, `${row.key}: PENDING-ENGINE but now in numbers.json (display "${n.display}"); update its FACTS row`);
      }
    }
  }
  return findings;
}

function mdFiles(dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const name of readdirSync(dir).sort()) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...mdFiles(p));
    else if (name.endsWith(".md")) out.push(p);
  }
  return out;
}

/** Judge copy files under root: pitch/**\/*.md (minus working notes), demo/**\/*.md, README.md. */
export function judgeCopyFiles(root) {
  const pitch = mdFiles(join(root, "pitch")).filter((p) => !PITCH_SKIP.has(relative(join(root, "pitch"), p).replace(/\\/g, "/")));
  const readme = join(root, "README.md");
  return [...pitch, ...mdFiles(join(root, "demo")), ...(existsSync(readme) ? [readme] : [])];
}

/** Read the repo at root and run every check. Throws CouldNotRun when it cannot. */
export function runFactsCheck({ root, numbersFile, allowPending = false }) {
  const factsPath = join(root, "docs", "FACTS.md");
  if (!existsSync(factsPath)) throw new CouldNotRun(`cannot read ${factsPath}: docs/FACTS.md missing`);
  const facts = parseFacts(readFileSync(factsPath, "utf8"));
  if (facts.size === 0) throw new CouldNotRun(`no fact rows parsed from ${factsPath}`);

  const numbersPath = numbersFile ?? join(root, "public", "derived", "numbers.json");
  let numbers = null;
  if (existsSync(numbersPath)) {
    try {
      numbers = JSON.parse(readFileSync(numbersPath, "utf8"));
    } catch (e) {
      throw new CouldNotRun(`cannot parse ${numbersPath}: ${e.message}`);
    }
    if (!Array.isArray(numbers) || numbers.some((n) => typeof n?.key !== "string")) {
      throw new CouldNotRun(`${numbersPath} is not a StageNumber[]`);
    }
  }

  const uses = new Map();
  const use = (key, file) => {
    const rel = relative(root, file).replace(/\\/g, "/");
    const list = uses.get(key) ?? [];
    if (!list.includes(rel)) list.push(rel);
    uses.set(key, list);
  };
  for (const file of judgeCopyFiles(root)) {
    for (const key of extractCopyKeys(readFileSync(file, "utf8"))) use(key, file);
  }
  const stageKeys = join(root, "app", "src", "stageKeys.ts");
  if (existsSync(stageKeys)) {
    for (const key of extractStageKeys(readFileSync(stageKeys, "utf8"))) use(key, stageKeys);
  }

  let measuredKeys = new Set();
  const catalogPath = join(root, "pitch", "keys.json");
  if (existsSync(catalogPath)) {
    try {
      measuredKeys = measuredKeysFromCatalog(JSON.parse(readFileSync(catalogPath, "utf8")));
    } catch (e) {
      throw new CouldNotRun(`cannot parse ${catalogPath}: ${e.message}`);
    }
  }

  return { findings: checkFacts({ facts, numbers, uses, allowPending, measuredKeys }) };
}

/** One line per finding, then the summary line, and the exit code. */
export function formatReport(findings) {
  const fails = findings.filter((f) => f.level === "FAIL");
  const warns = findings.filter((f) => f.level === "WARN");
  const lines = [...fails, ...warns].map((f) => `${f.level} ${f.message}`);
  lines.push(
    fails.length
      ? `FAIL facts-check: ${fails.length} failures, ${warns.length} WARN`
      : `PASS facts-check (${warns.length} WARN)`,
  );
  return { lines, exitCode: fails.length ? 1 : 0 };
}
