import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, renameSync, writeFileSync, readFileSync } from "node:fs";
import test from "node:test";
import { catalogFindings, formatFinding, lintText, parseFacts, resolveInput, resolveText } from "../lib/rules.mjs";

const facts = parseFacts(readFileSync(new URL("./fixtures/facts.md", import.meta.url), "utf8"));

function ctx(extra = {}) {
  return {
    keys: {
      known: { display: "{known}" },
      priced: { source: "numbers", display: "{priced}" },
      stated: { source: "facts", fact: "good_fact", display: "simulated" },
      stale: { source: "facts", fact: "unchecked_fact", display: "1" },
      pending: { source: "facts", fact: "pending_fact", display: "soon" },
      offrow: { source: "facts", fact: "good_fact", display: "not in the row" },
      conflicted: { source: "facts", fact: "conflict_fact", display: "say the conflict wording" },
      both: { source: "facts", fact: "good_fact", display: "simulated" },
    },
    numbers: new Map([
      ["priced", { key: "priced", display: "$1.00", as_of_mt: "2026-10-27" }],
      ["solve_ms", { key: "solve_ms", display: "12 ms", as_of_mt: "2026-10-27" }],
      ["both", { key: "both", display: "simulated", as_of_mt: "2026-10-27" }],
    ]),
    facts,
    strict: false,
    ...extra,
  };
}

function rulesIn(fileText, context = ctx()) {
  return lintText("fixture.md", fileText, context).findings.map((f) => f.rule);
}

test("unknown-key pass and fail", () => {
  assert.ok(!rulesIn("See {known}.").includes("unknown-key"));
  assert.ok(rulesIn("See {missing}.").includes("unknown-key"));
});

test("numbers-missing only in strict mode", () => {
  assert.ok(!rulesIn("Cost {priced}.", ctx({ numbers: new Map() })).includes("numbers-missing"));
  assert.ok(rulesIn("Cost {priced}.", ctx({ numbers: new Map(), strict: true })).includes("numbers-missing"));
});

test("facts-status pass and fail", () => {
  assert.ok(!rulesIn("It is {stated}.").includes("facts-status"));
  assert.ok(rulesIn("It is {stale}.").includes("facts-status"));
  assert.ok(rulesIn("It is {pending}.").includes("facts-status"));
});

test("facts-display pass and fail", () => {
  assert.ok(!rulesIn("It is {stated}.").includes("facts-display"));
  assert.ok(rulesIn("It is {offrow}.").includes("facts-display"));
  assert.ok(!rulesIn("Use {conflicted}.").includes("facts-display"));
});

test("two-sources fails when a facts key is also in numbers.json", () => {
  const found = catalogFindings(ctx());
  assert.ok(found.some((f) => f.rule === "two-sources" && f.text === "both"));
  const clean = catalogFindings(ctx({ numbers: new Map() }));
  assert.ok(!clean.some((f) => f.rule === "two-sources"));
});

test("measured renders from the screen, and a filed value fails", () => {
  const pass = resolveText("Solved in {solve_ms}.", ctx());
  assert.equal(pass.text, "Solved in [read from screen].");
  assert.ok(!pass.findings.some((f) => f.rule === "measured"));
  assert.ok(rulesIn("Solved in 12 ms.").includes("measured"));
});

test("operating-day pass and fail", () => {
  const agree = ctx({
    keys: {
      a: { source: "numbers", display: "{a}" },
      b: { source: "numbers", display: "{b}" },
    },
    numbers: new Map([
      ["a", { display: "$1", as_of_mt: "2026-10-27" }],
      ["b", { display: "$2", as_of_mt: "2026-10-27" }],
    ]),
  });
  const good = resolveText("{operating_day} {a} {b}", agree);
  assert.equal(good.text.startsWith("2026-10-27"), true);
  assert.ok(!good.findings.some((f) => f.rule === "operating-day"));
  const split = ctx({
    keys: agree.keys,
    numbers: new Map([
      ["a", { display: "$1", as_of_mt: "2026-10-27" }],
      ["b", { display: "$2", as_of_mt: "2026-10-28" }],
    ]),
  });
  assert.ok(rulesIn("{operating_day} {a} {b}", split).includes("operating-day"));
});

test("hand-typed results fail and allowlisted tokens pass", () => {
  assert.ok(rulesIn("Worth $4.").includes("hand-dollar"));
  assert.ok(rulesIn("About 12%.").includes("hand-percent"));
  assert.ok(rulesIn("Climb 10 MW.").includes("hand-unit"));
  assert.ok(rulesIn("Count 359.").includes("hand-bare"));
  const clean = rulesIn("On Oct 27 at 6pm, beat 0:25, Schedule 6, Option 1, Train 2, IEEE 2030.5, clearlane.envelope/v1, 1920x1080, docket 26-035-T08. See https://example.com/a.");
  assert.deepEqual(clean.filter((r) => r.startsWith("hand-")), []);
  const labeled = rulesIn("The overnight average, 1am to 6am, was $38.71 and the midday average, 9am to 5pm, was $22.83. Net load climbs 3,655 MW. 359 events in 2025. The larger agreement is an MOU for up to 500 MW.");
  assert.deepEqual(labeled.filter((r) => r.startsWith("hand-")), []);
  assert.ok(rulesIn("Worth $4.").includes("hand-dollar"));
});

test("year allowlist", () => {
  assert.ok(!rulesIn("Opened in 2026.").includes("hand-bare"));
});

test("dashes, banned phrases and hype words", () => {
  assert.ok(rulesIn("A clear lane \u2014 midday.").includes("em-dash"));
  assert.ok(rulesIn("A clear lane \u2013 midday.").includes("en-dash"));
  assert.ok(!rulesIn("A clear lane, midday.").includes("em-dash"));
  assert.ok(rulesIn("Torus lacks a timetable.").includes("banned"));
  assert.ok(!rulesIn("This is not Torus revenue.").includes("banned"));
  assert.ok(rulesIn("The plan is robust.").includes("hype"));
  assert.ok(!rulesIn("The plan is small.").includes("hype"));
});

test("deck bans Nucleus outright", () => {
  const deck = lintText("pitch/deck.md", "Thanks to Nucleus Fund.", ctx()).findings;
  assert.ok(deck.some((f) => f.rule === "banned" && f.text === "nucleus"));
  const qa = lintText("pitch/qa.md", "Angela Smith is with Nucleus Fund.", ctx()).findings;
  assert.ok(!qa.some((f) => f.text === "nucleus"));
});

test("each finding prints file:line: rule: text", () => {
  assert.match(
    formatFinding({ file: "pitch/deck.md", line: 4, rule: "banned", text: "torus-lacks" }),
    /^pitch\/deck.md:4: banned: torus-lacks$/,
  );
});

test("an absolute facts path is not joined onto the repo", () => {
  assert.equal(resolveInput("/repo", "C:/docs/FACTS.md"), "C:/docs/FACTS.md");
  assert.equal(resolveInput("/repo", "/docs/FACTS.md"), "/docs/FACTS.md");
});

test("current pitch copy exits 0 and fixtures are skipped", () => {
  const facts = "docs/FACTS.md";
  assert.ok(existsSync(facts), "FACTS.md not found");
  const run = spawnSync(process.execPath, ["pitch/resolve.mjs", "--facts", facts], { encoding: "utf8" });
  assert.equal(run.status, 0, run.stderr);
  assert.ok(!run.stderr.includes("skip-me"));
  assert.match(run.stdout, /unresolved: /);
});

test("exit 2 when keys.json or FACTS.md cannot be read", () => {
  const missingFacts = spawnSync(process.execPath, ["pitch/resolve.mjs", "--facts", "pitch/no-such-facts.md"], { encoding: "utf8" });
  assert.equal(missingFacts.status, 2);
  renameSync("pitch/keys.json", "pitch/keys.json.bak");
  try {
    const missing = spawnSync(process.execPath, ["pitch/resolve.mjs"], { encoding: "utf8" });
    assert.equal(missing.status, 2);
  } finally {
    renameSync("pitch/keys.json.bak", "pitch/keys.json");
  }
  const original = readFileSync("pitch/keys.json", "utf8");
  writeFileSync("pitch/keys.json", "{", "utf8");
  try {
    const bad = spawnSync(process.execPath, ["pitch/resolve.mjs"], { encoding: "utf8" });
    assert.equal(bad.status, 2);
  } finally {
    writeFileSync("pitch/keys.json", original, "utf8");
  }
});
