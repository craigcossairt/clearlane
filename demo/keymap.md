# Stage key map

Mirrors `docs/lanes/ui.md` section 6.8 today. Once `app/src/keymap.ts` is on main, it is the source, and Integration re-syncs this file at every train. A clash between two keys is a UI bug.

| Key             | Action                                                                    | Where                         |
| --------------- | ------------------------------------------------------------------------- | ----------------------------- |
| Right, PageDown | next step                                                                 | all beats                     |
| Left, PageUp    | previous step                                                             | all beats                     |
| 1 to 6          | jump to that beat                                                         | all                           |
| Space           | play or pause the time-lapse                                              | beat 2, and after the re-plan |
| C               | call at 6:40pm; again during the refill for the second call               | beats 2 and 3                 |
| E               | envelope                                                                  | beat 5                        |
| B               | backtest card                                                             | beat 5                        |
| + / -           | fleet slider step (Home and End jump to the MOU size and the MOU ceiling) | beat 6                        |
| R               | reset to beat 1 and clear live results                                    | all                           |
| ?               | show or hide the key map overlay                                          | all                           |
| Esc             | close any overlay                                                         | all                           |

- **Reserved for stretch:** T projector theme, D day picker, P proof drawer, F fleet board, I lineage panel.
- **Dropped:** T as a time-zone toggle (both heatmap readings are always shown), the Q cards, and the L live tile.
- Keys typed into an input are ignored, except Esc.

## Presenter remote: UNVERIFIED

What the remote sends is not known yet. Test it at rehearsal 0 and record the result here.

- Many remotes send PageDown and PageUp, which map to next and previous step.
- Some send B or a period for "blank screen". B opens the backtest card, so a stray press on any beat but 5 changes the screen.
- If the remote sends anything else, list it here and ask on #4.

| Remote button         | Sends | Result on stage | Tested |
| --------------------- | ----- | --------------- | ------ |
| (fill at rehearsal 0) |       |                 |        |
