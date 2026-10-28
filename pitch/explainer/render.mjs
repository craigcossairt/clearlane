/**
 * One command for the explainer video: scene data from the engine, the narration with every key
 * resolved, a voice clip per line, a generated pad, every frame rendered from the HTML scenes on
 * a fixed clock, then ffmpeg. Output goes to the gitignored tools/out/video/.
 *
 * node pitch/explainer/render.mjs [options]
 *   --voice-dir <dir>   use recorded clips <dir>/<line id>.wav instead of the Windows voice
 *   --voice <name>      Windows voice, default "Microsoft Zira Desktop"
 *   --rate <n>          Windows voice rate, -10 to 10, default 2
 *   --no-music          leave the pad out
 *   --fps <n>           default 30
 *   --from <s> --to <s> render part of the video to clearlane-explainer-draft.mp4
 *   --stills <s,s,...>  only write JPEG stills at these times, no video
 *   --workers <n>       browser pages rendering in parallel, default 4
 *   --browser <path>    a Chromium executable; default is Playwright's msedge channel
 *   --script-only       write the recording script and stop
 *   --timeline-only     speak the lines, write the timeline and captions, and stop
 */

import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { buildNarration, copyString, lineCues, root, toVtt } from "./narration.mjs";
import { pad, wavBytes } from "./music.mjs";

const OUT = join(root, "tools", "out", "video");
const WORK = join(OUT, "work");
const NAME = "clearlane-explainer";
const RATE = 44100;

// Seconds of silence around the lines of each scene. The page's animations key off line starts.
const PACE = {
  default: { lead: 0.8, gap: 0.55, tail: 1.0 },
  title: { lead: 1.3, gap: 0.5, tail: 0.8 },
  race: { lead: 0.8, gap: 0.7, tail: 1.3 },
  call: { lead: 0.9, gap: 0.6, tail: 1.0 },
  envelope: { lead: 0.8, gap: 0.6, tail: 1.3 },
  scale: { lead: 0.8, gap: 0.8, tail: 1.2 },
  close: { lead: 0.8, gap: 0.8, tail: 2.6 },
};

function args(argv) {
  const a = { voice: "Microsoft Zira Desktop", rate: 2, music: true, fps: 30, workers: 4 };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    const v = () => argv[++i];
    if (k === "--voice-dir") a.voiceDir = v();
    else if (k === "--voice") a.voice = v();
    else if (k === "--rate") a.rate = Number(v());
    else if (k === "--no-music") a.music = false;
    else if (k === "--fps") a.fps = Number(v());
    else if (k === "--from") a.from = Number(v());
    else if (k === "--to") a.to = Number(v());
    else if (k === "--stills") a.stills = v().split(",").map(Number);
    else if (k === "--workers") a.workers = Number(v());
    else if (k === "--browser") a.browser = v();
    else if (k === "--script-only") a.scriptOnly = true;
    else if (k === "--timeline-only") a.timelineOnly = true;
    else throw new Error(`unknown option ${k}`);
  }
  return a;
}

const run = (cmd, argv, opts = {}) => {
  const r = spawnSync(cmd, argv, { stdio: ["ignore", "pipe", "pipe"], encoding: "utf8", ...opts });
  if (r.status !== 0) throw new Error(`${cmd} failed (${r.status}):\n${r.stderr || r.stdout}`);
  return r.stdout;
};

/** Mono 16-bit PCM from a WAV file as floats, resampled with ffmpeg when it is not 44.1 kHz mono. */
function readWav(path) {
  let buf = readFileSync(path);
  const fmtAt = buf.indexOf("fmt ");
  const ok = fmtAt > 0 && buf.readUInt16LE(fmtAt + 8) === 1 && buf.readUInt16LE(fmtAt + 10) === 1 && buf.readUInt32LE(fmtAt + 12) === RATE && buf.readUInt16LE(fmtAt + 22) === 16;
  if (!ok) {
    const tmp = join(WORK, "convert.wav");
    run("ffmpeg", ["-y", "-v", "error", "-i", path, "-ac", "1", "-ar", String(RATE), "-c:a", "pcm_s16le", tmp]);
    buf = readFileSync(tmp);
  }
  const at = buf.indexOf("data");
  const len = Math.min(buf.readUInt32LE(at + 4), buf.length - at - 8);
  const out = new Float32Array(Math.floor(len / 2));
  for (let i = 0; i < out.length; i++) out[i] = buf.readInt16LE(at + 8 + i * 2) / 32768;
  return out;
}

/** First and last sample above a quiet threshold, so captions follow the speech, not the padding. */
function speechBounds(x) {
  const th = 0.01;
  let a = 0;
  let b = x.length - 1;
  while (a < x.length && Math.abs(x[a]) < th) a++;
  while (b > a && Math.abs(x[b]) < th) b--;
  return { start: a / RATE, end: (b + 1) / RATE };
}

/** A clip cut to its speech plus a breath either side; PACE then sets the pauses. */
function trimClip(x) {
  const b = speechBounds(x);
  return x.slice(Math.max(0, Math.round((b.start - 0.06) * RATE)), Math.min(x.length, Math.round((b.end + 0.12) * RATE)));
}

function voiceClips(scenes, a) {
  const lines = scenes.flatMap((s) => s.lines);
  if (a.voiceDir) {
    const missing = lines.filter((l) => !existsSync(join(a.voiceDir, `${l.id}.wav`)));
    if (missing.length) throw new Error(`--voice-dir is missing ${missing.map((l) => `${l.id}.wav`).join(", ")}`);
    return new Map(lines.map((l) => [l.id, trimClip(readWav(join(a.voiceDir, `${l.id}.wav`)))]));
  }
  // Re-speak only the lines whose words or voice changed since the last run.
  const dir = join(WORK, "voice");
  mkdirSync(dir, { recursive: true });
  const manifestPath = join(dir, "manifest.json");
  const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, "utf8")) : {};
  const hash = (l) => createHash("sha1").update(`${a.voice}|${a.rate}|${l.spoken}`).digest("hex");
  const todo = lines.filter((l) => manifest[l.id] !== hash(l) || !existsSync(join(dir, `${l.id}.wav`)));
  if (todo.length) {
    const list = join(WORK, "lines.json");
    writeFileSync(list, JSON.stringify(todo.map((l) => ({ id: l.id, text: l.spoken }))), "utf8");
    console.log(`voice: speaking ${todo.length} line(s) with ${a.voice}`);
    run("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", join(root, "pitch", "explainer", "voice.ps1"), "-Lines", list, "-OutDir", dir, "-Voice", a.voice, "-Rate", String(a.rate)]);
    for (const l of todo) manifest[l.id] = hash(l);
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 1));
  }
  return new Map(lines.map((l) => [l.id, trimClip(readWav(join(dir, `${l.id}.wav`)))]));
}

/** Scene and line times on the video clock, from the clip lengths and PACE. */
export function buildTimeline(scenes, clips) {
  let t = 0;
  const out = [];
  const captions = [];
  for (const s of scenes) {
    const p = { ...PACE.default, ...PACE[s.id] };
    const start = t;
    t += p.lead;
    const lines = s.lines.map((l, i) => {
      const clip = clips.get(l.id);
      const dur = clip.length / RATE;
      const b = speechBounds(clip);
      const line = { id: l.id, cue: l.cue, caption: l.caption, at: t, dur, speech: [t + b.start, t + b.end] };
      captions.push(...lineCues(l, t + b.start, t + b.end + 0.25));
      t += dur + (i < s.lines.length - 1 ? p.gap : 0);
      return line;
    });
    t += p.tail;
    const cues = Object.fromEntries(lines.filter((l) => l.cue).map((l) => [l.cue, l.at - start]));
    out.push({ id: s.id, chapter: s.chapter, start, end: t, cues, lines });
  }
  return { duration: t, scenes: out, captions };
}

function voiceTrack(timeline, clips) {
  const out = new Float32Array(Math.ceil(timeline.duration * RATE));
  for (const s of timeline.scenes) {
    for (const l of s.lines) {
      const clip = clips.get(l.id);
      out.set(clip.subarray(0, Math.max(0, out.length - Math.round(l.at * RATE))), Math.round(l.at * RATE));
    }
  }
  return out;
}

async function renderFrames(a, payload, times, onFrame) {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch(a.browser ? { executablePath: a.browser } : { channel: "msedge" });
  const url = pathToFileURL(join(root, "pitch", "explainer", "scenes", "index.html")).href;
  const pages = [];
  for (let i = 0; i < Math.max(1, a.workers); i++) {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
    page.on("pageerror", (e) => console.error(`page error: ${e.message}`));
    await page.addInitScript((p) => (window.__EXPLAINER__ = p), payload);
    await page.goto(url);
    await page.evaluate(() => window.__ready);
    pages.push(page);
  }
  // Each page renders every Nth frame; frames are handed on in order.
  const shot = (page, t) => page.evaluate((x) => window.__seek(x), t).then(() => page.screenshot({ type: "jpeg", quality: 92 }));
  const queues = pages.map(() => Promise.resolve());
  const pending = times.map((t, i) => {
    const k = i % pages.length;
    const p = queues[k].then(() => shot(pages[k], t));
    queues[k] = p.then(() => {}, () => {});
    return p;
  });
  for (let i = 0; i < pending.length; i++) {
    await onFrame(await pending[i], i);
    pending[i] = null;
  }
  await browser.close();
}

async function main() {
  const a = args(process.argv.slice(2));
  const t0 = Date.now();
  mkdirSync(WORK, { recursive: true });

  const dataPath = join(WORK, "data.json");
  run(process.execPath, [join(root, "node_modules", "tsx", "dist", "cli.mjs"), join(root, "pitch", "explainer", "data.ts"), dataPath], { cwd: root });
  const data = JSON.parse(readFileSync(dataPath, "utf8"));
  const scenes = buildNarration(data);

  const script = scenes
    .map((s) => `${s.chapter}\n${s.lines.map((l) => `  ${l.id}.wav  ${l.caption}`).join("\n")}`)
    .join("\n\n");
  writeFileSync(join(OUT, "recording-script.txt"), `Record one WAV per line, named as shown, then run render.mjs --voice-dir <folder>.\n\n${script}\n`, "utf8");
  if (a.scriptOnly) return console.log(`script: ${join(OUT, "recording-script.txt")}`);

  const clips = voiceClips(scenes, a);
  const timeline = buildTimeline(scenes, clips);
  writeFileSync(join(WORK, "timeline.json"), JSON.stringify(timeline, null, 1));
  writeFileSync(join(OUT, `${NAME}.vtt`), toVtt(timeline.captions), "utf8");
  console.log(`timeline: ${timeline.duration.toFixed(1)} s, ${timeline.captions.length} captions`);
  if (a.timelineOnly) {
    for (const s of timeline.scenes) console.log(`  ${s.id.padEnd(9)} ${s.start.toFixed(1).padStart(6)} to ${s.end.toFixed(1).padStart(6)} s`);
    return;
  }

  const numbers = JSON.parse(readFileSync(join(root, "public", "derived", "numbers.json"), "utf8"));
  const keys = Object.fromEntries([...numbers.map((r) => [r.key, { display: r.display, prov: r.prov, value: r.value }]), ...Object.entries(data.engine_keys)]);
  const copyTs = readFileSync(join(root, "app", "src", "copy.ts"), "utf8");
  const copy = Object.fromEntries(["closeLine1", "closeLine2", "fixedLabel", "clearlaneLabel", "priceOnlyLabel", "mouCeiling", "priceTaker", "schLabel", "publishedTitle"].map((k) => [k, copyString(copyTs, k)]));
  const payload = { data, timeline, keys, copy };

  if (a.stills) {
    const dir = join(OUT, "stills");
    mkdirSync(dir, { recursive: true });
    await renderFrames({ ...a, workers: 1 }, payload, a.stills, (buf, i) => {
      const p = join(dir, `still-${a.stills[i].toFixed(1)}.jpg`);
      writeFileSync(p, buf);
      console.log(`still: ${p}`);
    });
    return;
  }

  const voicePath = join(WORK, "voice.wav");
  writeFileSync(voicePath, wavBytes(voiceTrack(timeline, clips), 1));
  const musicPath = join(WORK, "music.wav");
  if (a.music) writeFileSync(musicPath, wavBytes(pad(timeline.duration), 2));

  const from = a.from ?? 0;
  const to = Math.min(a.to ?? timeline.duration, timeline.duration);
  const n = Math.round((to - from) * a.fps);
  const times = Array.from({ length: n }, (_, i) => from + i / a.fps);
  const part = a.from != null || a.to != null;
  const mp4 = join(OUT, part ? `${NAME}-draft.mp4` : `${NAME}.mp4`);

  const audioIn = ["-ss", String(from), "-t", String(to - from), "-i", voicePath];
  if (a.music) audioIn.push("-ss", String(from), "-t", String(to - from), "-i", musicPath);
  // The pad sits far under the voice and ducks further while anyone speaks.
  const mix = a.music
    ? "[1:a]aformat=sample_rates=44100:channel_layouts=stereo,asplit=2[v1][v2];" +
      "[2:a]aformat=sample_rates=44100:channel_layouts=stereo,volume=-21dB[m];" +
      "[m][v1]sidechaincompress=threshold=0.02:ratio=5:attack=30:release=600[duck];" +
      "[v2][duck]amix=inputs=2:duration=first:normalize=0,volume=4dB,alimiter=limit=0.89[a]"
    : "[1:a]aformat=sample_rates=44100:channel_layouts=stereo,volume=4dB,alimiter=limit=0.89[a]";
  const ff = spawn("ffmpeg", ["-y", "-v", "error", "-f", "image2pipe", "-framerate", String(a.fps), "-c:v", "mjpeg", "-i", "-", ...audioIn, "-filter_complex", mix, "-map", "0:v", "-map", "[a]", "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", "-r", String(a.fps), "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", "-shortest", mp4], { stdio: ["pipe", "inherit", "inherit"] });
  const done = new Promise((res, rej) => ff.on("close", (c) => (c === 0 ? res() : rej(new Error(`ffmpeg exited ${c}`)))));
  let last = Date.now();
  await renderFrames(a, payload, times, async (buf, i) => {
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once("drain", r));
    if (Date.now() - last > 15000 || i === n - 1) {
      last = Date.now();
      console.log(`frames: ${i + 1} of ${n}`);
    }
  });
  ff.stdin.end();
  await done;

  const dur = Number(run("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", mp4]).trim());
  console.log(`video: ${mp4}`);
  console.log(`length: ${Math.floor(dur / 60)}:${String(Math.round(dur % 60)).padStart(2, "0")} (${dur.toFixed(1)} s); captions: ${join(OUT, `${NAME}.vtt`)}`);
  console.log(`took ${((Date.now() - t0) / 1000).toFixed(0)} s`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
