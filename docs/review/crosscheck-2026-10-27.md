# Cross-check of the lane briefs (Tue Oct 27 2026, ~1am MT)

Read-only review run after the six briefs were written. Integration applies these (issue "Apply the 25 cross-check fixes"). Items 8 and 9 were handled when the board was seeded.

1. docs/lanes/engine.md (Core 3, §6.2), docs/lanes/integration.md (Core 1)
   - Problem: Integration Core 1 fixes hour 0 of the fixture (46.11 becomes 30.21857). That breaks engine Core 3's premise that "the fixture rotated left by one" equals the snapshot. Once Core 1 lands, the fix.py hourly pins can no longer match. Engine §6.2 still says hour 0 is $46.11, borrowed from Oct 28.
   - Fix: in engine Core 3, build the hourly test vector directly from research/data/pace_snapshot_2026-10-27.csv in snapshot order, not by rotating the fixture. In §6.2, state that the fixture's hour 0 is 30.21857 ($30.22) after Integration Core 1. Add to integration Core 1: "comment on #3 in the Core 1 PR that the fixture hour 0 changed".

2. docs/lanes/engine.md §3, docs/lanes/integration.md §6.1 and §6.2, docs/lanes/pitch.md item 3
   - Problem: the merge rules contradict each other.
     - engine §3 says "nothing merges between Train 1 (1:45am) and Train 2 (8:00am)" and allows stacking.
     - integration §6.2 keeps merging from 2am to 7am.
     - integration §6.1 says "If a lane stacks one branch on an unmerged PR, tell it to stop".
     - pitch already stacks on origin/grok/9-deck (#17).
   - Fix:
     - Delete the "nothing merges between Train 1 and Train 2" sentence from engine §3.
     - Add to integration §6.1: "Exception: a PR whose body says 'Stacked on #N' is allowed for engine (up to 4 deep) and for pitch on #17. Merge the parent first, then retarget the child to main."

3. docs/lanes/engine.md S1-2, S1-3, S1-4; docs/lanes/integration.md stretch 2; docs/STRETCH.md "What Integration owes"
   - Problem: circular wait.
     - Engine S1-3 and S1-4 wait on FleetResult and FleetCallResult in contracts (Train 4).
     - Integration writes those types only after it sees engine's shape.
     - S1-2 waits on refill_source, also Train 4.
   - Fix:
     - Engine defines FleetResult and FleetCallResult locally in engine/src/fleet.ts first and names them in the PR body.
     - Integration copies them into contracts/types.ts as an additive change after that PR merges.
     - Move refill_source (CrashResult) into the Train 3 enablers list in STRETCH.md and integration stretch 1.

4. contracts/types.ts vs docs/lanes/data.md (Core 2, Core 6)
   - Problem: two contract gaps.
     - data Core 2 writes `sources` and `notes` on TorusPublished, which has neither field.
     - data Core 6 writes a hist meta sidecar `clearlane.hist_meta/v1`, and no HistMeta type exists.
   - Fix: in the Train 1 freeze PR (integration Core 1), add `sources?: SourceRef[]` and `notes?: string[]` to TorusPublished, and add `export interface HistMeta { schema: "clearlane.hist_meta/v1"; ... }` with the fields data Core 6 lists. Name both in the Core 1 checklist.

5. docs/lanes/engine.md (stretch-2 sensitivity), docs/lanes/ui.md (any-day, stretch-1), docs/lanes/science.md (backtest-intervals)
   - Problem: public/derived/backtest_days.json is produced only by engine's stretch-2 sensitivity item. Two consumers need it earlier: ui any-day (stretch-1) and science backtest-intervals.
   - Fix:
     - Engine Core 10 (backtest) writes backtest_days.json.
     - Integration adds a `BacktestDay` type to contracts in Core 1.
     - Add `depends_on_titles` to both consumer issues, pointing at engine Core 10.

6. docs/lanes/integration.md §6.11, docs/lanes/engine.md Core 12, docs/lanes/pitch.md, docs/FACTS.md
   - Problem: three names for the same two charge-price numbers.
     - integration proposes `fixed_charge_avg_usd_mwh` and `clearlane_charge_avg_usd_mwh`.
     - pitch uses `fixed_rule_charge_usd_mwh` and `timetable_charge_usd_mwh`.
     - FACTS has rows for none of the four. It has only `overnight_avg` and `midday_avg`, and two table rows begin with each of those keys, so they may be duplicate rows (UNVERIFIED which).
   - Fix:
     - Adopt pitch's `fixed_rule_charge_usd_mwh` and `timetable_charge_usd_mwh` in integration §6.11 and engine Core 12.
     - Integration adds FACTS rows for both (39.53 and 21.55, DERIVED, C1). Either mark `overnight_avg`/`midday_avg` as the window means that must not be quoted, or merge the duplicate rows.

7. docs/lanes/integration.md §6.11, docs/lanes/ui.md §6.4 beat 2
   - Problem: the race-card source is decided at Train 2, but UI and pitch build beat 2 before then. Beat 2 also mixes `clearlane_dp_usd_mw_day` (engine DP) with `fixed_70`/`clearlane_70` (reference timetable), so one card would show numbers from two different plans.
   - Fix: decide at Train 1, in the Core 1 PR. Beat 2 reads only the reference set (`fixed_usd_mw_day`, `clearlane_usd_mw_day`, `race_ratio`, `fixed_70`, `clearlane_70`). `clearlane_dp_usd_mw_day` moves to the backtest or crash beat with its own label. Update ui §6.4 to match.

8. tools/seed-github.mjs and the drafted issues JSON
   - Problem:
     - (a) Pitch drafts duplicate existing issues #7 to #13 under slightly different titles. Dedup matches exact titles only, so the seeder will create duplicates.
     - (b) Some drafts use `deps`, but the seeder reads `depends_on_titles`. Unresolved dependencies are silently dropped by `.filter(Boolean)`.
     - (c) The tier-default milestone puts every stretch-1 issue on milestone 5, which is wrong for the Train 3 enablers.
   - Fix:
     - Retitle the pitch drafts to the exact titles of #7 to #13, or drop those drafts.
     - Rename `deps` to `depends_on_titles` everywhere.
     - Make the seeder exit non-zero when it cannot resolve a dependency title.
     - Give every draft an explicit `milestone`.
     - Put "Queue: <tier>, position N" in every body.

9. Drafted issues JSON (all lanes)
   - Problem: the drafts omit the dependencies the briefs describe, so the QUEUE order cannot be enforced. Examples:
     - ui beats wait on engine numbers.json;
     - pitch deck PDF waits on numbers;
     - science crosscheck waits on data Core 1 oracles;
     - engine Core 3 waits on integration Core 1.
   - Fix: add `depends_on_titles` for each cross-lane and same-lane wait named in the briefs' "waits on" lines.

10. docs/lanes/data.md Core 7, docs/lanes/integration.md §6.5, docs/lanes/engine.md §6.9
    - Problem: the Tuesday-night Oct 28 refresh is described four different ways.
      - data uses `--poll-until 22:30`; integration stops trying at 10:00pm and merges at 10:30pm.
      - integration names `prep/refresh_tonight.ps1`; data names `prep/refresh_tonight.py`.
      - integration says it fetches the 930-api and PACE.xlsx; data uses the committed CO2 extract.
      - engine re-runs "envelope.ts then numbers.ts"; integration's list also includes the backtest and FACTS re-pins.
    - Fix:
      - One script, `prep/refresh_tonight.py --poll-until 22:00`.
      - Integration §6.5 drops the 930/xlsx fetch and uses the committed extract.
      - One ordered command list (numbers.ts, envelope.ts, then the check:all gate), copied verbatim into data Core 7, engine §6.9 and integration §6.5.

11. tsconfig.json, vitest.config.ts, package.json, .github/workflows/ci.yml, docs/lanes/integration.md
    - Problem:
      - data's export-2030-5 is "Blocked until Integration widens vitest.config.ts and tsconfig.json to include api/**", but no integration issue does that.
      - pitch waits for "check:pitch in check:all"; science says "check:all does not run science tests yet". Neither script exists, and neither has an issue.
      - ui imports bare `@engine`, but tsconfig maps only `@engine/*`.
    - Fix: add integration Train 3 enabler issues that:
      - add api/** to tsconfig `include` and vitest `include`;
      - add `"@engine": ["engine/src/index.ts"]` to tsconfig paths;
      - add `check:pitch` and `check:science` scripts and chain both into `check:all`, so CI runs them.

12. PR #18 (ui/14-six-beats) vs docs/lanes/ui.md, data.md, AGENTS.md
    - Problem:
      - ui.md still calls #14 "uncommitted stub work", but it is now open PR #18.
      - #18 commits app/src/qa/cards.json (Q&A content that is pitch's job).
      - app/src/stub/published.ts types Torus values straight into the app instead of reading public/data.
      - app/src/stub/reference.ts recomputes reference math in the app.
      - The spinC source URL points at torus-nova, not torus-flywheel.
    - Fix:
      - Add #18 to the integration §6.11 open items.
      - Before merge: move cards.json to pitch/ (or have pitch own it through a PR); replace published.ts with a fetch of public/data/torus_published.json behind the stub flag; delete the reference.ts math in favor of numbers.json; correct the spin URL against FACTS.
      - Update ui.md #14 to "PR #18".

13. docs/lanes/science.md §6.1 and Core 7; research DATA-SOURCES §4
    - Problem: science gives hour 0 as "$30.22857". data.md has 30.21857 (rounds to $30.22) and flags the DATA-SOURCES §4 value as a typo.
    - Fix: change both science occurrences to 30.21857 ($30.22), and have Integration correct DATA-SOURCES §4 in the Core 1 PR.

14. docs/lanes/integration.md §6.7 (offline check)
    - Problem: the key list "Space; C, then C again; E; B; + and End; R" uses R for beat 4. In ui §6.8, R resets the stage and Right is the next step, so the offline check would reset mid-run.
    - Fix: replace R with Right for beat 4, and end the list with R only as the final reset. Copy the key list from ui §6.8 so there is one source.

15. contracts/types.ts PolicyStats
    - Problem: `calls_unanswerable_pct` has `heatmap_as_mt` and `heatmap_as_utc` only. FACTS (calls_unanswerable_price_only, calls_missed_range_pct) needs the MST (UTC-7) reading too, because the stage line "43% to 77%" uses its 43%.
    - Fix: add `heatmap_as_utc_mst: number` in the Train 1 freeze, and have engine Core 10 fill it.

16. docs/lanes/science.md §6.7 vs docs/lanes/engine.md §6.4
    - Problem: science's DP spec says "at most 5 levels per step (0.5C)". It omits the 4-up/5-down asymmetry, export limit 0, the host ceiling, the SCH rule and the start/end at level 2. Science also has no source for host load. Its crosscheck would disagree with the engine for spec reasons, not bugs.
    - Fix: engine writes public/derived/site_default.json (host load and limits) in Core 2. Science §6.7 replaces its spec with a verbatim copy of engine §6.4 and reads site_default.json.

17. docs/lanes/engine.md vs docs/lanes/data.md Core 1, docs/FACTS.md "Paths"
    - Problem: engine says "there is no `prep/reference/`", but data Core 1 creates prep/reference/ (habit.py, fix.py, stage_numbers.py) with the `{R}/data/oasis/` fix.
    - Fix: engine.md should say "prep/reference/ arrives with data Core 1; until then use research/analysis/demo-story/", matching FACTS "Paths".

18. docs/lanes/pitch.md item 12, docs/lanes/integration.md (submission, README)
    - Problem: pitch drafts pitch/submission.md and readme-judges.md by Train 8. Integration also owns README and submission at the freeze, so the two lanes write the same material at the same moment.
    - Fix: pitch delivers both drafts at Train 7 as input. Integration alone writes README.md and the final submission text at Train 8.

19. docs/lanes/pitch.md item 12 (pitch/release/ PDFs), AGENTS.md 500 KB rule
    - Problem: committing the final deck and one-pager PDFs to pitch/release/ breaks the 500 KB file rule and lands after the freeze.
    - Fix: attach the PDFs as GitHub release assets on the submission tag. Keep only the source and a link in git.

20. docs/lanes/pitch.md, docs/lanes/engine.md Core 12, docs/FACTS.md
    - Problem:
      - pitch asks engine for `peak_hour_mt` and `trough_hour_mt`, but the request only reaches engine through a PR review after Core 12 is built.
      - FACTS has no rows for either key.
      - ui §6.4 calls the peak hour "(new)" under a different name.
    - Fix: Integration seeds the full stage-key list, including `peak_hour_mt` and `trough_hour_mt`, into engine Core 12's issue body at Train 1, adds PENDING-ENGINE rows to FACTS, and renames the ui §6.4 key to `peak_hour_mt`.

21. docs/lanes/engine.md (minor)
    - Problem: the moonshot items lack the "MOONSHOT OPEN" gate the other lanes use, and `option2Shift` returns `{ from_hb, to_hb, mwh, usd }` with no CO2, though pitch's option-2 card shows CO2.
    - Fix: add "Start only after the QUEUE line says MOONSHOT OPEN", and add `co2_t` to the option2Shift return (DERIVED, same profile as charge_co2_race).

22. docs/plan/synthesis.json, docs/plan/concepts.json (guardrail; found by a repo-wide grep)
    - Problem: the plan files still carry dropped scope:
      - synthesis.json:113-118 has an "Overflow lane (OpenCode)" with `branch: opencode/tools` and a full first_prompt;
      - synthesis.json:15 and concepts.json have `nucleus_fit` fields;
      - synthesis.json:49 and :126 put the headroom card on "the Nucleus slide".
    - Only integration.md:5 says the lane briefs win over synthesis. A fresh harness that reads synthesis first could start the overflow lane or Nucleus framing, and the repo goes public.
    - Fix: add docs/plan/README.md stating "superseded by docs/lanes/*.md; OpenCode dropped 2026-10-26 (decision-log); Torus bounty only". Either add a top-level `"_superseded"` key to both JSON files, or move them to docs/plan/archive/. Repeat the precedence line in every lane brief, not just integration.md.

23. .gitattributes (minor)
    - Problem: a comment contains an em dash, and template leftovers remain (brain/bin/qmd, .trellis/*, .githooks/*, .agents). The repo goes public.
    - Fix: replace the em dash with a hyphen and delete the four leftover lines.

24. docs/lanes/pitch.md vs integration §6.11 (minor)
    - Problem: pitch says #17 is merge-ready for Train 2. Integration's open items list only #15 to #17 and do not say which train #17 merges in.
    - Fix: integration §6.11 says "#17 merges at Train 2, then #15 and #16", and pitch's stacked branch retargets after that.

25. AGENTS.md lanes table vs docs/lanes/ui.md and science.md (minor)
    - Problem: ui writes screenshots to tools/out/ and science writes to tools/out/science/. Integration owns tools/**.
    - Fix: add to AGENTS.md "tools/out/** is gitignored scratch; any lane may write there".

Checked and fine:
- No "Science optional" text anywhere.
- In the lane briefs, "Nucleus" appears only in bans and as Angela Smith's affiliation ("Nucleus Fund"). The JUDGING.md mentions are factual scope notes.
- FACTS keys are plain `| key |` table cells, not backticked. A key-row grep confirms `fixed_70`, `clearlane_70`, `clearlane_dp_usd_mw_day` and `calls_unanswerable_price_only` exist, and none of the six proposed new keys in items 6 and 20 do.
- Not checked: harness config files outside the .md, .json, .toml, .ts and .mjs extensions.