# Backup video

The video plays if the live demo fails on stage. It follows [`demo/stage-script.md`](stage-script.md) beat by beat, so the operator can cut to it at any beat's timestamp.

## Spec

- 1920x1080.
- 2:40 to 2:50 long.
- The operating day is visible on every frame (the stage header shows it).
- The beat timestamps match the stage script: 0:00, 0:25, 0:55, 1:40, 2:00, 2:25.
- Recorded from the `v1-stage` build with Wi-Fi off, so it shows exactly what the judges would see live.

## Tool

- **First choice:** Pitch's `autovideo` (`off_record_video`), if it merges by Train 6.
- **Otherwise:** a manual capture of the browser window with Xbox Game Bar (Win+Alt+R). Test it at rehearsal 0: start, stop, and where the file lands.

## Schedule

| When (MT)                                      | What                                        |
| ---------------------------------------------- | ------------------------------------------- |
| Rehearsal 0, Tue around 10:45am                | Test the capture tool for 10 seconds        |
| After the Train 6 rehearsal, Tue around 1:00am | Draft video from main with the chosen flags |
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
