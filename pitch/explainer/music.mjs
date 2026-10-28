/**
 * A quiet synth pad, generated here so the video has no music license question.
 * Slow chords, detuned sine voices, a low-pass, a little echo, a fade at each end.
 *
 * node pitch/explainer/music.mjs <seconds> <out.wav>
 */

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const RATE = 44100;
const midi = (n) => 440 * 2 ** ((n - 69) / 12);

// D major, unhurried: Dmaj9, Bm9, Gmaj9, A6sus2. MIDI notes, root first.
const CHORDS = [
  [50, 62, 66, 69, 73, 76],
  [47, 62, 66, 69, 74, 73],
  [43, 62, 66, 69, 71, 74],
  [45, 61, 64, 66, 69, 71],
];
const CHORD_S = 8;

/** A 16-bit PCM WAV from interleaved float samples in [-1, 1]. */
export function wavBytes(samples, channels, rate = RATE) {
  const data = Buffer.alloc(samples.length * 2);
  for (let i = 0; i < samples.length; i++) {
    data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, samples[i])) * 32767), i * 2);
  }
  const head = Buffer.alloc(44);
  head.write("RIFF", 0);
  head.writeUInt32LE(36 + data.length, 4);
  head.write("WAVE", 8);
  head.write("fmt ", 12);
  head.writeUInt32LE(16, 16);
  head.writeUInt16LE(1, 20);
  head.writeUInt16LE(channels, 22);
  head.writeUInt32LE(rate, 24);
  head.writeUInt32LE(rate * channels * 2, 28);
  head.writeUInt16LE(channels * 2, 32);
  head.writeUInt16LE(16, 34);
  head.write("data", 36);
  head.writeUInt32LE(data.length, 40);
  return Buffer.concat([head, data]);
}

/** Stereo pad, interleaved, peak normalized to `peak`. Deterministic for a given length. */
export function pad(seconds, peak = 0.5) {
  const n = Math.ceil(seconds * RATE);
  const out = new Float32Array(n * 2);
  const smooth = (x) => x * x * (3 - 2 * x);
  for (let c = 0; c < Math.ceil(seconds / CHORD_S) + 1; c++) {
    const chord = CHORDS[c % CHORDS.length];
    const t0 = c * CHORD_S - 2; // each chord swells in before its bar and rings past it
    const len = CHORD_S + 4;
    const i0 = Math.max(0, Math.floor(t0 * RATE));
    const i1 = Math.min(n, Math.floor((t0 + len) * RATE));
    chord.forEach((note, k) => {
      const f = midi(note);
      const gain = k === 0 ? 0.55 : 0.32 / Math.sqrt(k);
      for (const [detune, side] of [[-5, 0], [5, 1], [0, -1]]) {
        const w = 2 * Math.PI * f * 2 ** (detune / 1200);
        const phase = (note * 1.7 + detune) % (2 * Math.PI);
        for (let i = i0; i < i1; i++) {
          const t = i / RATE;
          const u = (t - t0) / len;
          const env = u < 0.35 ? smooth(u / 0.35) : u > 0.6 ? smooth((1 - u) / 0.4) : 1;
          const x = t * w + phase;
          const v = gain * env * (Math.sin(x) + 0.18 * Math.sin(2 * x) + 0.05 * Math.sin(3 * x));
          if (side <= 0) out[2 * i] += side === 0 ? v : 0.6 * v;
          if (side !== 0) out[2 * i + 1] += side === 1 ? v : 0.6 * v;
        }
      }
    });
  }
  // One-pole low-pass, a slow swell, then echoes that cross between channels.
  const lp = [0, 0];
  const a = 1 - Math.exp((-2 * Math.PI * 1400) / RATE);
  for (let i = 0; i < n; i++) {
    const swell = 0.85 + 0.15 * Math.sin((2 * Math.PI * i) / RATE / 11);
    for (let ch = 0; ch < 2; ch++) {
      lp[ch] += a * (out[2 * i + ch] - lp[ch]);
      out[2 * i + ch] = lp[ch] * swell;
    }
  }
  const dl = [Math.round(0.37 * RATE), Math.round(0.43 * RATE)];
  for (let i = 0; i < n; i++) {
    for (let ch = 0; ch < 2; ch++) {
      const j = i - dl[ch];
      if (j >= 0) out[2 * i + ch] += 0.32 * out[2 * j + (1 - ch)];
    }
  }
  let max = 0;
  for (let i = 0; i < out.length; i++) max = Math.max(max, Math.abs(out[i]));
  const fadeIn = 2.5 * RATE;
  const fadeOut = 4 * RATE;
  for (let i = 0; i < n; i++) {
    const g = Math.min(1, i / fadeIn, (n - i) / fadeOut);
    out[2 * i] *= (peak / max) * g;
    out[2 * i + 1] *= (peak / max) * g;
  }
  return out;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [seconds, path] = [Number(process.argv[2]), process.argv[3]];
  if (!(seconds > 0) || !path) {
    console.error("usage: node pitch/explainer/music.mjs <seconds> <out.wav>");
    process.exit(2);
  }
  writeFileSync(path, wavBytes(pad(seconds), 2));
  console.log(`music: ${path}`);
}
