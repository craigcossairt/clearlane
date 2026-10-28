# Explainer video

An animated explainer of Clearlane for judging and for sharing afterwards: the traffic report, the race, the
call, the re-plan, the envelope, scale and the close. It is not a screen recording. Every scene is drawn
from engine output, every figure is a key from `public/derived/numbers.json`, the engine or `app/src/copy.ts`,
and an unknown key fails the build.

## Render

```bash
node pitch/explainer/render.mjs
```

One command does it all: scene data from the engine, the narration with every key resolved and linted, a
voice clip per line, a generated pad under the voice, every frame drawn from the HTML scenes on a fixed
clock, then ffmpeg. It writes, all gitignored:

- `tools/out/video/clearlane-explainer.mp4`: full HD, voice, music, burned-in captions
- `tools/out/video/clearlane-explainer.vtt`: the same captions as WebVTT
- `tools/out/video/work/`: scene data, timeline, voice clips and the pad

Needs Windows (for the built-in voice), ffmpeg and ffprobe on the path, and Microsoft Edge (Playwright drives
it through its `msedge` channel; pass `--browser <path>` for another Chromium). Voice clips are cached by a
hash of their text, so a second run only re-speaks lines that changed.

Useful while editing:

```bash
node pitch/explainer/render.mjs --stills 26,55,92
```

writes JPEG stills at those seconds to `tools/out/video/stills/`, and `--from <s> --to <s>` renders a part
to `clearlane-explainer-draft.mp4`. `--no-music` leaves the pad out.

## Files

| File            | What it is                                                                                                                                                       |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `narration.txt` | The script. `## id \| Chapter` starts a scene; each `[cue] text` line is one voice clip and one caption. Keys go in braces; `copy.name` reads `app/src/copy.ts`. |
| `narration.mjs` | Parses and resolves the script with the pitch lint, spells units for the voice, chunks captions, writes WebVTT.                                                  |
| `data.ts`       | Runs the engine for the operating day: prices and lanes, the reference race, the scripted call and its trace, the re-plan, the envelope.                         |
| `voice.ps1`     | Speaks one WAV per line with the Windows voice.                                                                                                                  |
| `music.mjs`     | Generates the pad. No samples, nothing to license.                                                                                                               |
| `scenes/`       | The scenes: one page, every style set from the video clock, so a frame renders the same way twice.                                                               |
| `render.mjs`    | Ties it together.                                                                                                                                                |

Timing comes from the voice: each scene lasts as long as its lines plus the pauses in `PACE` in `render.mjs`,
and each animation cue starts with its line (or with a phrase inside it).

## Swap in your own voice

```bash
node pitch/explainer/render.mjs --script-only
```

writes `tools/out/video/recording-script.txt`: every line with its resolved figures and its file name
(`title-01.wav`, `traffic-01.wav` and so on). Record one WAV per line into a folder, any sample rate,
leaving a little silence either side, then:

```bash
node pitch/explainer/render.mjs --voice-dir path/to/your/clips
```

Clips are trimmed to the speech, and the scenes and captions stretch to fit your pace. A missing clip
fails the render and names it.

To try another installed Windows voice or pace instead, pass `--voice "<voice name>"` and `--rate <n>`
(from minus ten to ten).

A slower voice can still fit the length: `--tempo <x>` speeds every clip up by x without changing its
pitch, and `--pauses <x>` scales the silences in `PACE`.

The stage cut uses ElevenLabs clips (the Megan voice, model `eleven_v4`), generated under Craig's
ElevenLabs account. They are not in the repo; they live in the gitignored `tools/out/video/eleven/` and
render with `--voice-dir tools/out/video/eleven --tempo 1.18 --pauses 0.65`. Their spoken text writes
figures and units out in words, while the captions keep the written form.

## Guardrails

The narration runs through the same lint as the rest of the pitch (no em dashes, no hand-typed figures,
FACTS status per key), plus two video rules: a MEASURED key cannot be spoken, because a recording cannot
read a screen, and a `copy.name` that does not exist fails. `pitch/test/explainer.test.mjs` pins both, and
that every cue the scenes use is in the script. Stations are simulated Torus-style, the off-peak rule is
our baseline and never Torus practice, and every dollar figure is value to Rocky Mountain Power's system.
