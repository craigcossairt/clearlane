# Backup video

The video plays if the live demo fails on stage. It follows [`demo/stage-script.md`](stage-script.md) beat by beat, so the operator can cut to it at any beat's timestamp.

## Spec

- 1920x1080.
- 2:40 to 2:50 long.
- The operating day is visible on every frame (the stage header shows it).
- The beat timestamps match the stage script: 0:00, 0:25, 0:55, 1:40, 2:00, 2:25.
- Recorded from the `v1-stage` build with Wi-Fi off, so it shows exactly what the judges would see live.

## Tool

Pitch's `autovideo` (#12) is stretch-2 and blocked, so the plan is a manual capture.

**The laptop display is 2560x1080, not 1920x1080.** A full-screen capture at that size has the wrong shape, and the 1920x1080 layout is the one the projector check proves. Use one of these, in order:

1. **Switch the display to 1920x1080** (Settings, System, Display, Display resolution), press F11 in the browser, and record the whole screen with ffmpeg:
   ```bash
   ffmpeg -f gdigrab -framerate 30 -i desktop -c:v libx264 -pix_fmt yuv420p -crf 18 clearlane-backup.mp4
   ```
   Press q in the ffmpeg window to stop. Switch the resolution back afterwards.
2. **If the resolution cannot change,** record a 1920x1080 region instead. Size the browser so its page area fills that region (check with `window.innerWidth` and `innerHeight` in the console), then:
   ```bash
   ffmpeg -f gdigrab -framerate 30 -offset_x <x> -offset_y <y> -video_size 1920x1080 -i desktop -c:v libx264 -pix_fmt yuv420p -crf 18 clearlane-backup.mp4
   ```
3. **Fallback:** Xbox Game Bar (Win+Alt+R; files land in `Videos\Captures`), then scale to 1920x1080:
   ```bash
   ffmpeg -i capture.mp4 -vf "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2" -c:v libx264 -pix_fmt yuv420p -crf 18 clearlane-backup.mp4
   ```

Display scaling above 100% shifts gdigrab's coordinates; set it to 100% while recording.

**Check the file** before copying it:

```bash
ffprobe -v error -select_streams v:0 -show_entries stream=width,height -show_entries format=duration -of default=nw=1 clearlane-backup.mp4
```

It must print `width=1920`, `height=1080`, and a duration between 160 and 170 seconds. Trim a long head or tail with `ffmpeg -ss <start> -to <end> -i clearlane-backup.mp4 -c copy trimmed.mp4`.

**Recording run:** start the recording on beat 1 with `data-state="ready"`, wait one second, then run the beats at the stage script's timestamps (0:00, 0:25, 0:55, 1:40, 2:00, 2:25) with a phone stopwatch beside the keyboard. Skip the second C press if the run is long. Stop one second after the close card.

## Schedule

| When (MT)                                      | What                                        |
| ---------------------------------------------- | ------------------------------------------- |
| Rehearsal 0, Tue around 10:45am                | Test the capture tool for 10 seconds        |
| After the Train 6 rehearsal, Tue around 1:00am | Draft video from main with the chosen flags; this also tests the capture |
| Wed 2:00pm, after `v1-stage` is tagged         | Final video from the tagged build           |
| Wed 3:30pm                                     | Copies in place                             |

## Copies (by Wed 3:30pm)

- [ ] The demo laptop's desktop
- [ ] A USB stick, alongside the deck PDF
- [ ] The Mac, alongside its `v1-stage` build

## Checklist for the final video

- [ ] Length between 2:40 and 2:50
- [ ] Every beat reaches its end state; no `failed` state on screen
- [ ] The operating day matches the stage build
- [ ] The heatmap on the crash and backtest beats reads "Hours in Mountain time, confirmed by Torus"; no UTC reading is shown
- [ ] Plays from each of the three copies
