// Usage: node tools/reproduce.mjs [--root <dir>] [--fetch] [--write-manifest] [--write-docs]
// Re-derives every stage number offline (#32, flag off_reproduce):
//   1. checks the SHA-256 of every public/data file against tools/manifest.sha256;
//   2. re-runs the engine CLIs into a temp dir;
//   3. compares every public/derived JSON with the fresh one (EXCLUDED_FIELDS aside) and docs/NUMBERS.md;
//   4. prints "REPRODUCED n/n stage numbers".
// --fetch then re-fetches the operating day's OASIS prices and the EIA PACE workbook into ../clearlane-raw/reproduce/
// and reports differences; it never fails the run.
// --write-manifest and --write-docs regenerate tools/manifest.sha256 and docs/NUMBERS.md and exit.
// Exit 0 reproduced, 1 a difference (named), 2 could not run (missing tool, input or CLI failure).
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  EXCLUDED_FIELDS,
  FETCH_TIME_FIELDS,
  diffJson,
  parseManifest,
  renderManifest,
  renderNumbersDoc,
  sha256,
} from "./lib/reproduce.mjs";

const repo = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
let root = repo;
let fetch = false;
let writeManifest = false;
let writeDocs = false;
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === "--root" && args[i + 1]) root = resolve(args[++i]);
  else if (a === "--fetch") fetch = true;
  else if (a === "--write-manifest") writeManifest = true;
  else if (a === "--write-docs") writeDocs = true;
  else cannot(`unknown argument ${a}`);
}

function cannot(msg) {
  console.error(`reproduce: could not run: ${msg}`);
  process.exit(2);
}

const lf = (buf) => Buffer.from(buf).toString("utf8").replace(/\r\n/g, "\n");
const at = (...p) => join(root, ...p);
const dataFiles = () =>
  existsSync(at("public/data"))
    ? readdirSync(at("public/data"))
        .filter((f) => !f.startsWith("."))
        .sort()
        .map((f) => `public/data/${f}`)
    : [];

if (writeManifest) {
  const files = Object.fromEntries(dataFiles().map((p) => [p, readFileSync(at(p))]));
  writeFileSync(at("tools/manifest.sha256"), renderManifest(files));
  console.log(`reproduce: wrote tools/manifest.sha256 (${Object.keys(files).length} files)`);
  process.exit(0);
}
if (writeDocs) {
  const numbers = JSON.parse(readFileSync(at("public/derived/numbers.json"), "utf8"));
  writeFileSync(at("docs/NUMBERS.md"), renderNumbersDoc(numbers));
  console.log(`reproduce: wrote docs/NUMBERS.md (${numbers.length} numbers)`);
  process.exit(0);
}

// 1. Inputs against the manifest.
if (!existsSync(at("tools/manifest.sha256"))) cannot("tools/manifest.sha256 is missing");
let manifest;
try {
  manifest = parseManifest(readFileSync(at("tools/manifest.sha256"), "utf8"));
} catch (e) {
  cannot(e.message);
}
const failures = [];
const listed = new Set(manifest.map((m) => m.path));
for (const { sha, path } of manifest) {
  if (!existsSync(at(path))) failures.push(`${path}: missing, but listed in tools/manifest.sha256`);
  else if (sha256(readFileSync(at(path))) !== sha) failures.push(`${path}: SHA-256 differs from tools/manifest.sha256`);
}
for (const p of dataFiles()) if (!listed.has(p)) failures.push(`${p}: not in tools/manifest.sha256`);
if (failures.length) {
  for (const f of failures) console.error(`FAIL ${f}`);
  console.error(`NOT REPRODUCED: ${failures.length} input file(s) differ from the manifest; nothing was re-derived.`);
  process.exit(1);
}
console.log(`inputs: ${manifest.length}/${manifest.length} public/data files match tools/manifest.sha256`);

// 2. Re-run the engine CLIs in a scratch copy of the inputs, with their default relative paths:
//    numbers.json records its input paths in `source`, so the run must look like the committed one.
let tsx;
try {
  tsx = createRequire(join(repo, "package.json")).resolve("tsx/cli");
} catch {
  cannot("tsx is not installed; run npm ci");
}
const committed = JSON.parse(readFileSync(at("public/derived/numbers.json"), "utf8"));
const dayCount = new Map();
for (const n of committed) dayCount.set(n.as_of_mt, (dayCount.get(n.as_of_mt) ?? 0) + 1);
const day = [...dayCount].sort((x, y) => y[1] - x[1])[0][0];
const bundle = `public/data/bundle_${day}.json`;
if (!existsSync(at(bundle))) cannot(`public/data/bundle_${day}.json is missing (the operating day of numbers.json)`);
const envelopeName = `envelope_${day}.json`;
const now = existsSync(at("public/derived", envelopeName))
  ? JSON.parse(readFileSync(at("public/derived", envelopeName), "utf8")).generated_utc
  : undefined;

const work = mkdtempSync(join(tmpdir(), "clearlane-reproduce-"));
for (const p of ["public/data", "research", "docs/FACTS.md"]) {
  if (!existsSync(at(p))) {
    rmSync(work, { recursive: true, force: true });
    cannot(`${p} is missing`);
  }
  cpSync(at(p), join(work, p), { recursive: true });
}
const tmp = join(work, "public/derived");
mkdirSync(tmp, { recursive: true });
const engine = (cli, ...rest) => {
  const r = spawnSync(process.execPath, [tsx, join(repo, "engine/cli", cli), ...rest], {
    cwd: work,
    encoding: "utf8",
  });
  if (r.status !== 0) {
    rmSync(work, { recursive: true, force: true });
    cannot(`engine/cli/${cli} exited ${r.status}: ${(r.stderr || r.stdout || "").trim().split("\n").slice(-3).join(" / ")}`);
  }
};
engine("backtest.ts");
engine("numbers.ts", bundle);
engine("envelope.ts", bundle, ...(now ? ["--now", now] : []));
engine("site.ts");

// 3. Compare.
const derived = readdirSync(at("public/derived")).filter((f) => f.endsWith(".json")).sort();
const fresh = readdirSync(tmp).filter((f) => f.endsWith(".json")).sort();
let same = 0;
let changedNumbers = [];
for (const f of derived) {
  if (!fresh.includes(f)) {
    failures.push(`public/derived/${f}: no engine CLI regenerates it`);
    continue;
  }
  const a = lf(readFileSync(at("public/derived", f)));
  const b = lf(readFileSync(join(tmp, f)));
  if (a === b) {
    same++;
    continue;
  }
  const paths = diffJson(JSON.parse(a), JSON.parse(b));
  if (!paths.length) {
    same++;
    console.log(`public/derived/${f}: same apart from ${Object.keys(EXCLUDED_FIELDS).join(", ")}`);
    continue;
  }
  if (f === "numbers.json") changedNumbers = paths;
  failures.push(`public/derived/${f}: differs at ${paths.slice(0, 20).join(", ")}${paths.length > 20 ? ` and ${paths.length - 20} more` : ""}`);
}
for (const f of fresh) if (!derived.includes(f)) failures.push(`public/derived/${f}: regenerated but not committed`);

const regenerated = JSON.parse(readFileSync(join(tmp, "numbers.json"), "utf8"));
const doc = existsSync(at("docs/NUMBERS.md")) ? lf(readFileSync(at("docs/NUMBERS.md"))) : null;
if (doc === null) failures.push("docs/NUMBERS.md: missing; run node tools/reproduce.mjs --write-docs");
else if (doc !== renderNumbersDoc(regenerated))
  failures.push("docs/NUMBERS.md: stale; run node tools/reproduce.mjs --write-docs");
rmSync(work, { recursive: true, force: true });

console.log(`derived: ${same}/${derived.length} public/derived files reproduced`);
const n = committed.length;
let exitCode = 0;
if (failures.length) {
  for (const f of failures) console.error(`FAIL ${f}`);
  console.error(`NOT REPRODUCED: ${changedNumbers.length} of ${n} stage numbers differ; ${failures.length} failure(s) above.`);
  exitCode = 1;
} else {
  console.log(`REPRODUCED ${n}/${n} stage numbers (operating day ${day})`);
}

// 4. Optional live re-fetch: report only.
if (fetch) {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  const out = resolve(root, "..", "clearlane-raw", "reproduce", stamp);
  mkdirSync(out, { recursive: true });
  const py = process.platform === "win32" ? "python" : "python3";
  if (spawnSync(py, ["--version"]).status !== 0) cannot(`${py} not found for --fetch`);
  // prep/build_hist.py has no re-fetch (it reads the local cache), so the history is not re-fetched.
  const jobs = [
    {
      name: `bundle_${day}.json`,
      committed: `public/data/bundle_${day}.json`,
      argv: ["prep/build_bundle.py", "--day", day, "--refetch", "--out", join(out, `bundle_${day}.json`)],
    },
    {
      name: "eia_pace_hourly.csv",
      committed: "prep/data/eia_pace_hourly.csv",
      argv: ["prep/eia.py", "--fetch", "--out", join(out, "eia_pace_hourly.csv"), "--meta", join(out, "eia_pace_hourly.meta.json")],
    },
  ];
  for (const job of jobs) {
    const target = join(out, job.name);
    const r = spawnSync(py, ["-I", ...job.argv], { cwd: repo, encoding: "utf8" });
    if (r.status !== 0 || !existsSync(target)) {
      console.log(`fetch: ${job.name}: could not re-fetch (exit ${r.status}); reported, not failed`);
      continue;
    }
    const before = lf(readFileSync(at(job.committed)));
    const after = lf(readFileSync(target));
    let diffs;
    if (job.name.endsWith(".json"))
      diffs = diffJson(JSON.parse(before), JSON.parse(after), "", { ...EXCLUDED_FIELDS, ...FETCH_TIME_FIELDS });
    else {
      const old = new Set(before.split("\n"));
      diffs = after.split("\n").filter((l) => l && !old.has(l)).map((l) => l.split(",")[0]);
    }
    console.log(
      diffs.length
        ? `fetch: ${job.name}: ${diffs.length} difference(s) from ${job.committed}, e.g. ${diffs.slice(0, 5).join(", ")} (sources can revise or extend data; reported, not failed)`
        : `fetch: ${job.name}: identical to ${job.committed}`,
    );
  }
  console.log(`fetch: files in ${out}`);
}
process.exit(exitCode);
