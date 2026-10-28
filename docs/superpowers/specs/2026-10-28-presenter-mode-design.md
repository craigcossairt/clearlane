# Presenter mode: design

Issue #216. Approved by Craig on Oct 27 (option A, then the Torus-like race mockup: "Looks right").
Owner: a UI stand-in. Branch `ui/216-presenter-mode`. Target: PR open by 6:30am Wed for Craig's 7am read.

## Why

The six-beat stage works, but it is driven by eleven keys and reads as a dashboard. Craig presents it to a
judging panel from a laptop, maybe with a slide clicker. He wants a click-through: one idea per screen, a
visible Next button, labelled buttons for each action, and a look that sits next to Torus's own site.

He also misread the race as "Clearlane is more expensive", because the screen shows a dollar figure per
MW-day without saying it is value kept. Every dollar figure in presenter mode says what it is, and the race
screen shows the buy, sell and keep arithmetic.

## What does not change

- With `ff_presenter` off (the default), the app is byte-for-byte the current stage: the six-beat DOM
  snapshots, the key map, the projector check and every pinned number are unchanged.
- No published number changes. `public/derived/` is not regenerated. `numbers.json` gains no keys.
- The engine changes by one additive export (section "Race arithmetic"). No existing field or value moves.
- No network. `DATA_MODE=snapshot`. No webfont download: the font stack is system fonts only.

## The flag

- Add `ff_presenter` to `contracts/flags.ts` (default false, lanes `["ui"]`, description "Presenter mode:
  eight click-through screens with visible buttons, in a charcoal and off-white style"). Add its row to the
  `docs/STRETCH.md` table so `tools/contracts.test.ts` passes. These two files are Integration's; this PR
  touches them with Craig's approval and the PR body says so.
- `?ff=presenter` turns it on, through `parseFlags` and `useFlag` like every other flag.
- With the flag on, `App` renders a `Presenter` shell instead of `Stage`. It reuses the same `Live` data, the
  same engine calls and the same beat visuals where they fit; how much to reuse versus restyle is the
  builder's call, as long as the flag-off render is unchanged.

## The eight screens

Each screen has: a takeaway headline (one sentence), one supporting line, one hero visual or one to three
big numbers, labelled action buttons where the screen has an action, and a quiet source footer.

| #   | Screen         | Hero                                                                                           | Actions (in Next order)                                  |
| --- | -------------- | ---------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| 1   | Title          | Clearlane wordmark, one line on what it is, the operating day and the CAISO node               | Start                                                    |
| 2   | Traffic report | Beat 1's 24-hour lane ribbon                                                                   | none                                                     |
| 3   | Race           | Two cards, off-peak rule and Clearlane, with the arithmetic in each, over a 24-hour strip      | Replay the day                                           |
| 4   | Call           | Beat 3's call card: Spin answering, the battery-only ghost, then the second-call shortfall     | Rocky Mountain Power calls now; Call again during refill |
| 5   | Re-plan        | Beat 4's re-plan: dashed morning plan, solid re-plan from the call minute                      | Resume the day                                           |
| 6   | Envelope       | Beat 5's hourly envelope with System Critical Hours, then the backtest in its place            | Show the backtest                                        |
| 7   | Scale          | Beat 6's fleet cards and a visible slider from `mou_70mw` to `torus_500mw`                     | 70 MW; 500 MW (slider also drags)                        |
| 8   | Close          | The close card beat 6 shows at step end, with the Option 2 campus card and the two close lines | none                                                     |

The two calls stay on the Call screen, as in `pitch/stage-script.md` beat 3: the second call's shortfall
shows in the call card's existing `second-call` slot. Presenter copy names the button ("Call again during
refill"), never "Press C". On the Envelope screen the backtest replaces the envelope strip as it does on the
stage; a "Show the envelope" pill brings it back. Copy JSON is a button on the envelope strip only and is
not in the Next order (copying to the clipboard is not a talk step).

Headlines and supporting lines live in `app/src/copy.ts` in a new `PRESENTER` block so Pitch reviews one
file. Write them from the existing beat copy and `pitch/stage-script.md`, which are already reviewed for
guardrails: same claims, shorter. Numbers never appear in copy; a headline that needs one renders it with
`Num` (for example "keeps `{race_ratio}` the value of the off-peak rule"). Drafts to start from:

- Traffic report: "Power is cheapest at midday. The road jams after the evening step."
- Race: "Filling up at midday keeps {race_ratio} the value of the off-peak rule."
- Envelope: "Every hour, a limit Rocky Mountain Power can plan around." The supporting line says the
  envelope is a format Clearlane proposes (Torus does not know the Lasso API).
- Close: `closeLine1` and `closeLine2` as they are.

Guardrails apply to every string: "simulated Torus-style station", never a Torus product; the off-peak rule
is our baseline, never Torus practice; value is to RMP's system, not Torus revenue; no em dashes.

## Race arithmetic

The stage day is Oct 27. Craig made it final on Oct 27 at 11pm; there is no Oct 28 refresh on stage.

Layout (the mockup Craig approved, in words): the headline top left. Below it, two cards side by side,
"Battery on the off-peak rule" on the left and "Simulated Torus-style station on Clearlane" on the right,
the Clearlane card marked with a check chip. Each card leads with its Keeps figure, large, labelled "value
kept per MW per day, higher is better", then the three arithmetic rows beneath it. The arithmetic is
visible from the start; nothing waits for the replay. Under both cards, one thin 24-hour lane ribbon marks
each plan's buy hours and sell hours from `referenceRace`'s `charge_hb` and `discharge_hb` (fixed rule HB 1
to 4, Clearlane HB 13 to 15, both sell HB 18 and 19). "Replay the day" sweeps a time cursor across that
ribbon in the stage's 15 seconds and fills each mark as the cursor passes. The race screen does not animate
the DP plans, so nothing on it disagrees with the arithmetic. Next during a running replay jumps it to its
end; the next Next leaves the screen.

The arithmetic rows, per card:

| Row   | Off-peak rule              | Clearlane                  |
| ----- | -------------------------- | -------------------------- |
| Buys  | 2.132 MWh at $39.53 = $84  | 2.132 MWh at $21.55 = $46  |
| Sells | 1.876 MWh at $55.62 = $104 | 1.876 MWh at $55.62 = $104 |
| Keeps | $20                        | $58                        |

The large Keeps figure at the top of each card shows the key's own display in cents ($20.06, $58.41).

- Prices come from `fixed_rule_charge_usd_mwh`, `timetable_charge_usd_mwh` and `race_discharge_usd_mwh`.
  Keeps come from `fixed_usd_mw_day` and `clearlane_usd_mw_day`. All through `Num`, with their chips.
- Engine export: `RaceLeg` in `engine/src/reference.ts` gains `charge_mwh`, `discharge_mwh`,
  `buy_usd_per_mw_day` and `sell_usd_per_mw_day` (the `cg`, `dg`, `cost` and `rev` that `leg()` already
  computes). An engine test pins them on the Oct 27 bundle and asserts `sell - buy === usd_per_mw_day`
  within 1e-9. The MWh figures carry an ASSUMPTION chip (1 MW / 2 MWh battery, 88% round trip, FACTS
  `ref_station`); the dollar subtotals carry DERIVED.
- The rows must reproduce by hand as displayed. In cents they do not ($104.34 - $45.94 = $58.40, but the
  key is $58.41), and MWh at two decimals does not either (1.88 x $55.62 = $104.57). So MWh shows three
  decimals, prices show cents, and subtotals and the Keeps row show whole dollars. Tests on the Oct 27
  bundle, for both cards: the displayed MWh times the displayed price rounds to the displayed subtotal;
  the displayed sell minus the displayed buy equals the displayed keep; each displayed subtotal equals the
  engine value rounded to the dollar.
- The PR body lists every new on-screen value (2.132 MWh, 1.876 MWh, $84, $46, $104, $20, $58) so
  Integration can add FACTS rows after merge.

## Navigation

- Visible: a Back and a Next pill bottom right; a progress bar of eight labelled segments across the top,
  each clickable; action buttons on the screen itself.
- Next runs the screen's next unrun action in the order in the table, then moves to the next screen. So a
  clicker alone walks the whole talk: Title, Start, Traffic, Race, Replay, Call, Calls now, Call again,
  and so on.
- State is a pure function of (screen, actions run on that screen). Every earlier screen counts as finished:
  arriving on Re-plan by any route has both calls applied; arriving on Scale starts the slider at
  `mou_70mw`. Next and segment clicks land on a screen at its start state; Back lands on the previous
  screen at its end state, the way a deck shows the finished slide.
- `body[data-step]` reads `start` before the screen's first action, `end` after its last (or on a screen
  with no actions), and `partial` in between, with `body[data-actions]` holding the count run.
- Keys: Right and PageDown are Next; Left and PageUp are Back; Home goes to Title. That is what a slide
  clicker sends. The digit keys and the old stage keys are not bound in presenter mode, and `?` shows these
  four keys only.
- After any button click, focus returns to the stage container, so Space or Enter never re-fires a button
  the presenter clicked earlier (this bit us on the current stage).
- Deep links for checks and rehearsal: `?ff=presenter&screen=N&step=end&motion=off`. Set
  `body[data-mode="presenter"]`, `body[data-screen]` and `body[data-step]` the way the stage sets
  `data-beat`.
- Reduced motion lands every action on its end state, as the stage does.

## Visual language

Borrow Torus's language, not its identity.

- Charcoal near-black background, warm off-white text, one muted gray for secondary text. Lane colors keep
  the existing `--clear`, `--shoulder` and `--jam` meaning, tuned only if contrast needs it.
- Font stack: `"Century Gothic", "Avenir Next", Futura, "Segoe UI", system-ui, sans-serif`. No CircularXX
  (commercial) and no downloaded font.
- Headlines large and light: weight 400, about 72 to 96px at 1920x1080, slight negative letter-spacing.
  Lots of whitespace; one idea per screen.
- Pill buttons: the primary filled off-white on charcoal, secondary outlined. Provenance chips become quiet
  pills with a check mark in our own `--clear` green, not a color sampled from Torus.
- Brand: the Clearlane wordmark and a plain circle mark drawn in CSS. No Torus logo, no Torus wordmark, no
  Torus brand colors, no copied page text.
- Scope every new style under `[data-mode="presenter"]` so the default theme cannot change.
- Footer, on every screen: the operating day and the snapshot fetch time on the left (the stage header's
  day line, so the day is on screen the whole talk), one quiet line naming the screen's sources in plain
  words, and a "Sources" pill that opens an overlay with the chip legend (`COPY.chipLegend`) and each
  source.

## Sizes

1920x1080 is the stage. 375x812 is a phone: the screen stacks, the progress bar shrinks to dots, Back and
Next become a bottom bar, and nothing scrolls sideways.

## Checks

- `npm run check:all` green, `node tools/offline-check.mjs` and `node tools/facts-check.mjs` pass.
- Flag-off: the existing flag-off harness proves the six-beat snapshots and pinned numbers are unchanged.
- Presenter tests: each screen renders at its start and end state; clicking Next from Title reaches Close
  through every action in order; every number on every screen is a `Num` (the digit rule covers the new
  copy); the race arithmetic tests above; the focus rule after a click.
- Projector check: add a `--presenter` pass to `app/scripts/projector-check.mjs` that opens the eight end
  states at 1920x1080 and 375x812 with the same rules (no sideways scroll, numbers fit their slots, minimum
  font sizes, same-origin requests). The six-beat run stays as it is. Both pass, and the PR says so with
  the violation counts.

## Out of scope

Deploying or Vercel, flipping any flag default, changing the deck or the stage script (Pitch updates cues
after Craig picks the mode), new data, and any published number.
