import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { MEASURED_DISPLAY, resolveText } from "../lib/rules.mjs";

// Spoken lines are blockquotes ("> "). Cue tables and notes are not spoken.
// Speech budget: 2.5 words a second; a {key} counts as 3 words (docs/lanes/pitch.md section 5).
const BEATS = [
  ["Beat 1, traffic report (0:00 to 0:25)", 62],
  ["Beat 2, the race (0:25 to 0:55)", 75],
  ["Beat 3, the crash (0:55 to 1:35)", 100],
  ["Beat 4, re-plan (1:35 to 1:50)", 37],
  ["Beat 5, envelope and proof (1:50 to 2:25)", 87],
  ["Beat 6, scale and close (2:25 to 2:45)", 50],
];

const text = readFileSync(new URL("../stage-script.md", import.meta.url), "utf8");

function beats() {
  const parts = text.split(/^## /m).slice(1);
  return parts.map((part) => {
    const [heading, ...rest] = part.split(/\r?\n/);
    const spoken = rest.filter((l) => l.startsWith("> ")).map((l) => l.slice(2)).join(" ");
    return { heading: heading.trim(), body: rest.join("\n"), spoken };
  });
}

export function words(spoken) {
  const keys = (spoken.match(/\{[a-z0-9_]+\}/g) ?? []).length;
  const rest = spoken.replace(/`?\{[a-z0-9_]+\}`?/g, " ").split(/\s+/).filter((w) => /[A-Za-z0-9]/.test(w));
  return rest.length + keys * 3;
}

test("six beat headings in order with their timings", () => {
  assert.deepEqual(
    beats().map((b) => b.heading),
    BEATS.map(([h]) => h),
  );
});

test("each beat and the total stay inside the word budget", () => {
  let total = 0;
  beats().forEach((b, i) => {
    const n = words(b.spoken);
    total += n;
    assert.ok(n <= BEATS[i][1], `${b.heading}: ${n} words, budget ${BEATS[i][1]}`);
  });
  assert.ok(total <= 400, `total ${total} words, budget 400`);
});

test("MEASURED keys stay [read from screen]", () => {
  const ctx = { keys: { replan_ms: { prov: "MEASURED", display: "x" } }, measured: ["replan_ms"], numbers: null, facts: null };
  const rendered = resolveText(beats()[3].spoken, ctx).text;
  assert.ok(rendered.includes(MEASURED_DISPLAY));
  assert.ok(!/\d+\s?ms\b/.test(rendered));
});

test("required lines are present where they belong", () => {
  const [b1, b2, b3, b4, b5, b6] = beats().map((b) => b.spoken);
  assert.match(b1, /the day on screen/);
  assert.doesNotMatch(beats().map((b) => b.spoken).join(" "), /\btoday\b/i);
  assert.match(b2, /simulated Torus-style/);
  assert.match(b2, /value to RMP's system at day-ahead prices/);
  assert.match(b2, /a battery on a fixed off-peak rule\. That rule is ours, not Torus practice\./);
  assert.match(b2, /\{fixed_rule_charge_usd_mwh\}/);
  assert.match(b2, /\{timetable_charge_usd_mwh\}/);
  assert.match(b2, /\{clearlane_usd_mw_day\}/);
  assert.doesNotMatch(b2, /\{clearlane_dp_usd_mw_day\}|\{overnight_avg\}|\{midday_avg\}/);
  for (const b of [b1, b2, b3, b4, b5, b6]) {
    if (/CO2/.test(b)) assert.match(b, /estimated, using average emissions/);
  }
  assert.match(b3, /about five and a half minutes/);
  assert.match(b3, /Our trace is simulated\./);
  assert.match(b3, /Torus's own 2025 report/);
  assert.match(b5, /our proposal/);
  assert.match(b5, /we found no Utah or Wyoming docket that defines it/);
  assert.match(b5, /a format Clearlane proposes/);
  assert.match(b5, /Mountain time/);
  assert.match(b5, /\{calls_missed_by_policy_clearlane_mt\}/);
  assert.match(b5, /earns more on paper/);
  assert.match(b5, /Clearlane is the plan a host and RMP would allow\./);
  assert.doesNotMatch(beats().map((b) => b.spoken).join(" "), /price-only|\{second_call_shortfall_kw\}/);
  assert.match(b6, /\ban MOU for up to `?\{torus_500mw\}`? MW/i);
  assert.match(b6, /not installed capacity/);
  assert.match(b6, /the fleet is assumed not to move prices/);
  assert.match(b6, /\{clearlane_500\}/);
  assert.match(b6, /in time, not in space/i);
  assert.match(b6, /Fill up when the road is clear, keep Spin ready for the crash\./);
  assert.match(b6, /Ask:/);
  assert.match(b4, /\{replan_ms\}/);
});

test("every beat has a Craig's cues table", () => {
  for (const b of beats()) assert.match(b.body, /\|\s*Craig's cue\s*\|\s*Screen\s*\|/, b.heading);
});
