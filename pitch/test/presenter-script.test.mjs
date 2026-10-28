import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// Presenter-mode talk track: the stage story in plain words, cued to the eight presenter screens
// (app/src/presenter/model.ts). Same speech budget as script.test.mjs: 2.5 words a second, a
// {key} counts as 3 words.
const SCREENS = [
  ["Screen 1, title (0:00 to 0:08)", 20],
  ["Screen 2, traffic (0:08 to 0:30)", 55],
  ["Screen 3, race (0:30 to 1:00)", 75],
  ["Screen 4, call (1:00 to 1:35)", 87],
  ["Screen 5, re-plan (1:35 to 1:50)", 37],
  ["Screen 6, envelope (1:50 to 2:25)", 87],
  ["Screen 7, scale (2:25 to 2:35)", 25],
  ["Screen 8, close (2:35 to 2:45)", 25],
];

// The presenter's button labels (PRESENTER in app/src/copy.ts).
const BUTTONS = [
  "Start",
  "Next",
  "Replay the day",
  "Rocky Mountain Power calls now",
  "Call again during refill",
  "Resume the day",
  "Show the backtest",
];

const text = readFileSync(new URL("../stage-script-presenter.md", import.meta.url), "utf8");
const stage = readFileSync(new URL("../stage-script.md", import.meta.url), "utf8");
const drill = readFileSync(new URL("../drill.md", import.meta.url), "utf8");

function sections(src) {
  return src
    .split(/^## /m)
    .slice(1)
    .map((part) => {
      const [heading, ...rest] = part.split(/\r?\n/);
      const spoken = rest.filter((l) => l.startsWith("> ")).map((l) => l.slice(2)).join(" ");
      const field = (name) => rest.filter((l) => l.startsWith(`- **${name}:**`)).map((l) => l.slice(name.length + 7));
      return { heading: heading.trim(), spoken, point: field("Point at"), press: field("Press"), asked: field("If asked") };
    });
}

function words(spoken) {
  const keys = (spoken.match(/\{[a-z0-9_]+\}/g) ?? []).length;
  const rest = spoken.replace(/`?\{[a-z0-9_]+\}`?/g, " ").split(/\s+/).filter((w) => /[A-Za-z0-9]/.test(w));
  return rest.length + keys * 3;
}

const screens = sections(text);
const keysOf = (s) => new Set(s.match(/\{[a-z0-9_]+\}/g) ?? []);

test("eight screens in presenter order with their timings", () => {
  assert.deepEqual(
    screens.map((s) => s.heading),
    SCREENS.map(([h]) => h),
  );
});

test("each screen and the total stay inside the word budget and 2:45", () => {
  let total = 0;
  screens.forEach((s, i) => {
    const n = words(s.spoken);
    total += n;
    assert.ok(n <= SCREENS[i][1], `${s.heading}: ${n} words, budget ${SCREENS[i][1]}`);
  });
  assert.ok(total <= 400, `total ${total} words, budget 400`);
});

test("every screen says where to point, what to press and the likely hard question", () => {
  for (const s of screens) {
    assert.equal(s.point.length, 1, `${s.heading}: Point at`);
    assert.equal(s.press.length, 1, `${s.heading}: Press`);
    assert.equal(s.asked.length, 1, `${s.heading}: If asked`);
  }
});

test("hard-question answers come from drill.md's five", () => {
  const five = drill.slice(drill.indexOf("## Five hard questions first"), drill.indexOf("## Do not ad-lib"));
  const answers = text.split(/\r?\n/).filter((l) => /^- \*\*(?:If asked|Or):\*\* "/.test(l));
  assert.equal(answers.length, 5);
  for (const a of answers) {
    const q = a.match(/"([^"]+)"/)[1];
    assert.ok(five.includes(`"${q}"`), `not one of the five: ${q}`);
    const line = a.slice(a.indexOf(q) + q.length + 2).trim();
    assert.ok(five.includes(line), `answer differs from drill.md: ${line}`);
  }
});

test("no number the stage script does not already speak", () => {
  const stageKeys = keysOf(sections(stage).map((b) => b.spoken).join(" "));
  for (const k of keysOf(screens.map((s) => s.spoken).join(" "))) assert.ok(stageKeys.has(k), `new key ${k}`);
  for (const s of screens) assert.doesNotMatch(s.spoken.replace(/`\{[a-z0-9_]+\}`/g, ""), /\$|\d+(?:\.\d+)?\s?(?:%|MW|kW|x\b)/);
});

test("cues are clicks, never stage keys", () => {
  const cues = screens.flatMap((s) => [...s.point, ...s.press]).join("\n");
  assert.doesNotMatch(cues, /[Aa]rrow|[Pp]ress [A-Z]\b|then [A-Z]\b|\bSpace\b|\bEnd\b|\bHome\b/);
  for (const b of BUTTONS) assert.ok(cues.includes(b), `no cue for ${b}`);
});

test("guardrails hold", () => {
  const spoken = screens.map((s) => s.spoken).join(" ");
  assert.match(spoken, /simulated Torus-style/);
  assert.match(spoken, /That rule is ours, not Torus practice\./);
  assert.match(spoken, /value to RMP's system at day-ahead prices/);
  assert.match(spoken, /a format Clearlane proposes/);
  assert.match(spoken, /that rule is our proposal/);
  assert.match(spoken, /Our trace is simulated\./);
  assert.match(spoken, /not installed capacity/);
  assert.doesNotMatch(spoken, /price-only|Torus (?:could )?earns?|Torus revenue|Torus lacks|predict|\{second_call_shortfall_kw\}/);
  assert.doesNotMatch(text, /[–—]/);
});
