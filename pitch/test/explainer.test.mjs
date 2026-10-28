import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { buildNarration, chunkCaption, lineCues, parseNarration, root, spoken, toVtt } from "../explainer/narration.mjs";

// The explainer's scene data comes from the engine, so build it once the way render.mjs does.
const tmp = mkdtempSync(join(tmpdir(), "explainer-"));
const dataPath = join(tmp, "data.json");
const r = spawnSync(
  process.execPath,
  [join(root, "node_modules", "tsx", "dist", "cli.mjs"), join(root, "pitch", "explainer", "data.ts"), dataPath],
  { cwd: root, encoding: "utf8" },
);
assert.equal(r.status, 0, r.stderr);
const data = JSON.parse(readFileSync(dataPath, "utf8"));
rmSync(tmp, { recursive: true, force: true });

const narration = readFileSync(join(root, "pitch", "explainer", "narration.txt"), "utf8");
const scenesJs = readFileSync(join(root, "pitch", "explainer", "scenes", "scenes.js"), "utf8");

test("every key in the narration resolves, with no guardrail findings", () => {
  const scenes = buildNarration(data);
  const lines = scenes.flatMap((s) => s.lines);
  assert.ok(lines.length > 20);
  for (const l of lines) {
    assert.doesNotMatch(l.caption, /[{}]/, l.id);
    assert.ok(!l.caption.includes(String.fromCharCode(0x2014)), `${l.id} has an em dash`);
  }
});

test("an unknown key fails the build", () => {
  const text = "## t | T\n[mark] Worth {no_such_key} a day.\n";
  assert.throws(() => buildNarration(data, { text }), (e) => e.findings.some((f) => f.text.includes("no_such_key")));
});

test("an unknown copy string fails the build", () => {
  const text = "## t | T\n[mark] {copy.noSuchLine}\n";
  assert.throws(() => buildNarration(data, { text }), (e) => e.findings.some((f) => f.rule === "unknown-copy"));
});

test("a MEASURED key cannot be spoken in a recorded video", () => {
  const text = "## t | T\n[mark] It solves in {solve_ms}.\n";
  assert.throws(() => buildNarration(data, { text }), (e) => e.findings.some((f) => f.rule === "measured-in-video"));
});

test("every scene has a builder and every cue the scenes use is in the narration", () => {
  const scenes = parseNarration(narration);
  for (const s of scenes) assert.match(scenesJs, new RegExp(`BUILD(\\.${s.id}|\\["${s.id}"\\]) =`), s.id);
  const cues = new Set(scenes.flatMap((s) => s.lines.map((l) => l.cue)));
  const used = [
    ...scenesJs.matchAll(/c\.when\(\s*"([a-z0-9-]+)"/g),
    ...scenesJs.matchAll(/c\["([a-z0-9-]+)"\]/g),
    ...scenesJs.matchAll(/c\.([a-z][a-z0-9]*)\.(?:at|s1)\b/g),
  ].map((m) => m[1]);
  assert.ok(used.length > 10);
  for (const cue of used) assert.ok(cues.has(cue), `scenes.js uses cue "${cue}"`);
});

test("the voice reads units and acronyms the way they are said", () => {
  assert.equal(spoken("Clearlane"), "Clear-lane");
  assert.equal(spoken("At the 70 MW MOU"), "At the 70 megawatt M.O.U.");
  assert.equal(spoken("2.132 MWh at 250 kW"), "2.132 megawatt hours at 250 kilowatts");
  assert.equal(spoken("2.9x as much by 6pm"), "2.9 times as much by 6 PM");
  assert.equal(spoken("At 6:40pm"), "At 6:40 PM");
});

test("captions split into balanced chunks that fit the caption box", () => {
  for (const l of buildNarration(data).flatMap((s) => s.lines)) {
    const chunks = chunkCaption(l.caption);
    assert.equal(chunks.join(" "), l.caption.replace(/\s+/g, " "));
    for (const c of chunks) assert.ok(c.length <= 66, `${l.id}: "${c}"`);
    if (chunks.length > 1) for (const c of chunks) assert.ok(c.length >= 12, `${l.id}: stray chunk "${c}"`);
  }
});

test("WebVTT cues run in order and refuse overlaps", () => {
  const cues = [
    ...lineCues({ caption: "At midday, power is cheapest. The road is clear." }, 1, 4),
    ...lineCues({ caption: "That is the jam." }, 4.5, 6),
  ];
  const vtt = toVtt(cues);
  assert.match(vtt, /^WEBVTT\n\n1\n00:00:01\.000 --> /);
  assert.match(vtt, /00:00:04\.500 --> 00:00:06\.000\nThat is the jam\./);
  assert.throws(() => toVtt([cues[1], cues[0]]), /out of order/);
});
