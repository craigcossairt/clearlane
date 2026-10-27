// Seed the GitHub task board: labels, train milestones, one tracking issue per lane, and the lane issues.
// Input: tools/issues.json, an array of {lane, title, tier, order, body, depends_on_titles?, milestone?}.
// Idempotent: anything whose name or title already exists is left alone, so a rerun only fills gaps.
//
// Run from the repo root after `gh auth status` is clean:  node tools/seed-github.mjs [--dry-run]

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const DRY = process.argv.includes("--dry-run");
const LANES = ["integration", "data", "engine", "ui", "pitch", "science"];

const LABELS = [
  ...LANES.map((l) => [`lane:${l}`, "1d76db", `Work owned by the ${l} lane`]),
  ["tier:core", "b60205", "Needed for the six stage beats"],
  ["tier:stretch-1", "fbca04", "First stretch tier, behind a flag"],
  ["tier:stretch-2", "f9d0c4", "Second stretch tier, behind a flag"],
  ["tier:moonshot", "c5def5", "Only if everything else is green"],
  ["status:blocked", "000000", "Waiting on another issue or a person; the comment says what"],
  ["status:needs-review", "0e8a16", "PR open and waiting for a cross-review"],
  ["tracking", "ededed", "A lane's status thread: one status comment per train"],
];

// Due dates are UTC dates (GitHub ignores the time); the title carries the Mountain time.
const MILESTONES = [
  ["Train 1: Tue 1:45am MT, contracts frozen", "2026-10-27"],
  ["Train 2: Tue 8:00am MT, core complete", "2026-10-27"],
  ["Train 3: Tue 10:45am MT, stretch-1 under way", "2026-10-27"],
  ["Train 4: Tue 2:00pm MT, core checkpoint", "2026-10-27"],
  ["Train 5: Tue 5:30pm MT, stretch-1 merged", "2026-10-27"],
  ["Train 6: Tue 11:30pm MT, feature freeze", "2026-10-28"],
  ["Train 7: Wed 10:00am MT, fixes only", "2026-10-28"],
  ["Train 8: Wed noon MT, copy and polish", "2026-10-28"],
  ["Freeze: Wed 2:00pm MT, tag v1-stage", "2026-10-28"],
];
const DEFAULT_TRAIN = { core: 2, "stretch-1": 5, "stretch-2": 6, moonshot: 6 };

function gh(args, { input } = {}) {
  if (DRY) {
    console.log("[dry-run] gh", args.map((a) => (a.length > 60 ? a.slice(0, 57) + "..." : a)).join(" "));
    return "";
  }
  return execFileSync("gh", args, { encoding: "utf8", input, stdio: ["pipe", "pipe", "inherit"] }).trim();
}
const ghJson = (args) => (DRY ? [] : JSON.parse(gh(args) || "[]"));

const repo = DRY ? "OWNER/clearlane" : gh(["repo", "view", "--json", "nameWithOwner", "-q", ".nameWithOwner"]);
console.log(`seeding ${repo}${DRY ? " (dry run)" : ""}`);

// Labels
const haveLabels = new Set(ghJson(["label", "list", "--limit", "200", "--json", "name"]).map((l) => l.name));
for (const [name, color, description] of LABELS) {
  if (!haveLabels.has(name)) gh(["label", "create", name, "--color", color, "--description", description]);
}

// Milestones
const haveMs = new Map(ghJson(["api", `repos/${repo}/milestones?state=all&per_page=100`]).map((m) => [m.title, m.number]));
for (const [title, due] of MILESTONES) {
  if (!haveMs.has(title)) {
    gh(["api", `repos/${repo}/milestones`, "-f", `title=${title}`, "-f", `due_on=${due}T23:00:00Z`]);
  }
}
const trainTitle = (n) => MILESTONES[n - 1][0];

// Issues
const existing = new Map(
  ghJson(["issue", "list", "--state", "all", "--limit", "500", "--json", "title,number"]).map((i) => [i.title, i.number]),
);
const create = (title, body, labels, milestone) => {
  if (existing.has(title)) return existing.get(title);
  const args = ["issue", "create", "--title", title, "--body-file", "-"];
  for (const l of labels) args.push("--label", l);
  if (milestone) args.push("--milestone", milestone);
  const url = gh(args, { input: body });
  const n = DRY ? existing.size + 1 : Number(url.split("/").pop());
  existing.set(title, n);
  console.log(`#${n} ${title}`);
  return n;
};

for (const lane of LANES) {
  create(
    `Lane: ${lane} status`,
    `Status thread for the ${lane} lane. At each train, post one comment: merged, in flight, blocked, next.\n\nBrief: \`docs/lanes/${lane}.md\`.`,
    [`lane:${lane}`, "tracking"],
  );
}

const issuesFile = new URL("./issues.json", import.meta.url);
const issues = existsSync(issuesFile) ? JSON.parse(readFileSync(issuesFile, "utf8")) : [];
if (!issues.length) console.log("tools/issues.json missing or empty: seeded labels, milestones and tracking issues only");
const laneRank = (l) => LANES.indexOf(l);
issues.sort((a, b) => laneRank(a.lane) - laneRank(b.lane) || a.order - b.order);
for (const it of issues) {
  const train = it.milestone ?? DEFAULT_TRAIN[it.tier] ?? 2;
  create(it.title, it.body, [`lane:${it.lane}`, `tier:${it.tier}`], trainTitle(train));
}

// Dependencies: append "Depends on" once every number is known. An unresolved title is an error, never a silent drop.
const unresolved = issues.flatMap((it) => (it.depends_on_titles ?? []).filter((t) => !existing.has(t)).map((t) => `${it.title} -> ${t}`));
if (unresolved.length && !DRY) {
  console.error(`unresolved dependency titles:\n  ${unresolved.join("\n  ")}`);
  process.exit(1);
}
for (const it of issues) {
  const deps = (it.depends_on_titles ?? []).map((t) => existing.get(t));
  if (!deps.length || DRY) continue;
  const n = existing.get(it.title);
  const body = gh(["issue", "view", String(n), "--json", "body", "-q", ".body"]);
  if (/^Depends on: #/m.test(body)) continue; // a prose "Depends on:" heading in the body is not the link line
  gh(["issue", "edit", String(n), "--body-file", "-"], { input: `${body}\n\nDepends on: ${deps.map((d) => `#${d}`).join(", ")}` });
}
console.log(`done: ${existing.size} issues on the board`);
