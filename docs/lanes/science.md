# Science lane brief

You are the **science lane**: Claude Science (desktop app, Windows 11), worktree `C:\Users\Craig Cossairt\Code\clearlane-science`, branch prefix `science/`, repo `craigcossairt/clearlane`, tracking issue **#6 "Lane: science status"**. You make the evidence a judge can check: three projector-ready charts, a two-page cited brief, and an independent re-derivation of the pinned numbers from raw public data.

Precedence: `AGENTS.md`, `contracts/types.ts`, `DESIGN.md` and `docs/FACTS.md` win over this file. This file wins over the plan files in `docs/plan/`, which are superseded (see `docs/plan/README.md`): OpenCode is dropped, there is no Nucleus slide, and this is the Torus bounty only.

Lane done when (from `AGENTS.md`): three charts, a cited brief and an independent cross-check of the pinned numbers are merged.

## For Craig: before you paste this into Claude Science

Do this before 2am; the lane runs unattended until 7am.

1. Start a Claude Science project named "clearlane science".
2. Grant two folders: `C:\Users\Craig Cossairt\Code\clearlane-science` (read and write) and `C:\Users\Craig Cossairt\Code\clearlane-raw` (read only). Both are local NTFS, which Claude Science requires.
3. Approve the hosts `github.com` and `api.github.com` only if you want the lane to push and open PRs itself (Path A). Approve no other host unless the agent names it and says why.
4. Paste this whole file as the first message, after one line: "Read AGENTS.md in the granted worktree, then follow this brief."

---

## 1. Role and boundaries

**You own `science/**` only.** Scratch output (PR bodies, the handoff file, rerun logs) goes to `tools/out/science/`, which is gitignored and never committed.

**You read but never write:** everything else, including `contracts/`, `engine/`, `public/`, `prep/`, `research/`, `docs/`, `app/`, `pitch/`, `tools/` (except `tools/out/science/`), `.github/`, `package.json`, the lockfile and every root file. `../clearlane-raw` is read only and never enters git.

**Independence is the point of this lane.** Write your code from the definitions in section 6 and the claim text in `docs/FACTS.md`. Never import, copy or read code in `research/analysis/**`, `research/**/scripts`, `prep/**`, `engine/**` or FACTS Appendix A before your own number exists. After it exists you may read them only to explain a mismatch, and the md must say you did.

**Need something outside `science/`?** Comment on your issue, then open an issue for the owner: a number or engine output `lane:engine`; a file in `public/data/` `lane:data`; contracts, CI, `package.json`, FACTS edits, merge order `lane:integration`.

**Never:** merge a PR; push to `main`; add a dependency (stdlib Python only, see 6.12); fetch data from the web when the repo or `../clearlane-raw` has it; type a number into prose that your script did not print or FACTS does not hold.

**Others depend on you for:** `science/crosscheck.json` (the `ff_lineage` panel shows match or mismatch from it), the chart SVGs (Pitch puts them in the deck and leave-behind), `science/brief.md` (the judge leave-behind), and the stretch JSON files the `proof-drawer` cards read.

## 2. Boot sequence

Claude Science runs shell commands in PowerShell. Run each line on its own (Windows PowerShell has no `&&`).

```powershell
Set-Location "C:\Users\Craig Cossairt\Code\clearlane-science"
python --version      # need 3.11 or newer; CI runs 3.13
git --version
git fetch origin
git status            # the worktree starts detached at an old commit; that is expected
gh auth status
node --version        # only needed for npm run check:all
npm ci                # only if node works and node_modules is missing
New-Item -ItemType Directory -Force tools\out\science | Out-Null
```

Pick your path from what worked, say which in your first chat message and at the top of `tools/out/science/HANDOFF.md`, and re-probe after any later failure:

- **Path A** (git, fetch, push and `gh` all work): run the full loop in section 3.
- **Path B** (git works locally, but push or `gh` fails): commit on your local `science/` branch. Worktrees share branches with the main checkout, so Integration pushes them and opens the PR from your body file `tools/out/science/pr-<n>.md`.
- **Path C** (no git): write files into the worktree and keep `tools/out/science/HANDOFF.md`. Per issue: issue number, every file you wrote, the commands you ran, test output, results table, new numbers, and the PR body. Integration branches, commits, pushes and opens the PR.
- **Path D** (cannot write the folder): deliver each file as an in-app artifact titled with its repo path (for example `science/crosscheck.py`). Craig saves them, so batch deliveries before 11am and before 6pm Tue, when he leaves.

In Paths B to D, Integration posts your claims and copies your status to #6. Write claims, blocks and status into HANDOFF.md and the chat instead of GitHub.

**Read, in this order:**

1. `AGENTS.md`, then this file.
2. `docs/FACTS.md`: the ledger rows named in section 4, the command table (C1 to C10, to learn what each pins, not to run), the "Do not say" table, and the conventions at the top (hour ending vs beginning).
3. `contracts/types.ts`: `HistDay`, `BacktestResult`, `PolicyStats`, `Pctl`, `StageNumber`, `TorusPublished`, `Envelope`.
4. `DESIGN.md`: the tokens and the projector type sizes.
5. `docs/STRETCH.md`: the five science rows, "Feature flags", and the guardrails paragraph.
6. `docs/GLOSSARY.md` "Time"; `research/GRID.md` (source material for the brief); `research/TORUS.md` section 8 (guardrails); `docs/JUDGING.md` (who reads the brief).

**Load your queue and claim:**

```powershell
gh issue list --repo craigcossairt/clearlane --label lane:science --state open --json number,title,labels,milestone --limit 50
gh issue view <n> --repo craigcossairt/clearlane --comments
gh issue view 6 --repo craigcossairt/clearlane --comments
gh issue comment <n> --repo craigcossairt/clearlane --body "claimed by Claude Science (science lane)"
```

Work in the order of sections 4 and 5 (each issue body states its order), not by issue number. Skip any issue whose comments show a claim by another session.

## 3. Per-issue loop

1. Claim the issue (above).
2. Branch from fresh main: `git fetch origin`, then `git switch -c science/<n>-<slug> origin/main` (slug: two to four words, kebab-case). One issue, one branch, one PR.
3. **Tolerances first.** Before you read any real input, write a "Tolerances (written before computing)" section in the issue's md file: for every number the issue produces, the pinned value if one exists, the tolerance, the test statistic, and what a mismatch would mean. Commit it alone: `git add science/<file>.md`, `git commit -m "science: tolerances for #<n>"`. The PR cites this sha. Never edit that section after the real run; add a dated note below it instead.
4. **Test first, on synthetic data.** Write `science/tests/test_<topic>.py` with cases you can do on paper (a three-day price series with known step hours; a two-hour race; a Poisson case with refill 0). Run it and watch it fail for the reason you expect:
   `python -I -m unittest discover -s science/tests -t . -p "test_<topic>.py" -v`
5. Implement until green, then run on the real inputs. Run the script twice and compare `Get-FileHash` of every output; they must be identical.
6. **Gate:** `python -I -m unittest discover -s science/tests -t .` (this is the science check; `check:all` does not run science tests yet), then `npm run check:all` if node works. Never open a PR on red. Without node, write "check:all not run here: no node; CI runs it" in the PR.
7. Commit only science files: `git add science`. The message says what changed and why, in plain words.
8. Push: `git push -u origin science/<n>-<slug>`.
9. Open the PR. Write the body to `tools/out/science/pr-<n>.md`, then:
   ```powershell
   gh pr create --repo craigcossairt/clearlane --base main --title "[science] <issue title>" --body-file tools/out/science/pr-<n>.md --label lane:science --label status:needs-review
   ```
   Body fields, in order:
   - `Closes #<n>`
   - **Flag:** the stretch flag (for example `off_step_stats`), or "core, no flag".
   - **What changed:** three to six bullets.
   - **Evidence:** the unittest summary line; the `check:all` summary or why it did not run; the two output hashes from the rerun; the tolerance commit sha.
   - **Results:** a table of key, pinned value, science value, tolerance, status (match, mismatch, pending). Every mismatch also gets an issue (section 8).
   - **New numbers for FACTS:** key, value, class (REAL, DERIVED, ASSUMPTION, TORUS_PUBLISHED), source file or URL, command. "None" if none. Integration adds them to FACTS; nothing reaches the stage or the brief without a row.
   - **Guardrails:** tick each line of section 7 that applies.
10. Comment on the issue: `gh issue comment <n> --body "PR #<m> open: <one line>"`.
11. Take the next issue. Cut every branch from `origin/main`; never stack a PR on another unmerged PR. If an issue needs the scaffold (core 1) before it merges, do the work on a branch from `origin/main` and open the PR only after `git rebase origin/main` brings the scaffold in.
12. Review comments (Pitch reviews every science PR for claims; Integration may comment): fix on the same branch, push, reply in the thread.

**Trains.** After each PR, and at each train time, read `gh issue view 6 --comments`. When Integration announces a train, for each open science branch: `git fetch origin`, `git rebase origin/main`, rerun the gate, `git push --force-with-lease` (your own `science/` branches only). Then post the status comment (section 9).

**Never:** `gh pr merge`, `git push origin main`, `--no-verify`, a force push to a branch that is not yours.

## 4. Core queue (ordered)

Integration merges in producer-to-consumer order (data, engine, ui, pitch, science), so science merges last. Targets, Mountain time:

| When | Science target |
|---|---|
| Mon 11:45pm | Boot; start core 1 |
| Tue 12:30am | Core 1 PR open (small, so it merges by Train 1) |
| Train 1, Tue 1:45am | Core 1 merged; core 2 in progress |
| 2am to 7am | Craig asleep: nobody answers; mark blocked and move on |
| Train 2, Tue 8:00am | Core 2 to 5 PRs open (CORE COMPLETE target) |
| Within 2 h of the engine's `public/derived/backtest.json` and the data lane's hist file landing on main | Core 6 and 7 PRs open |
| Train 4, Tue 2:00pm | All science core merged (formal core checkpoint) |

Each issue body holds the full checklist. The summary below is the contract.

**Core 1. Scaffold: science package, shared helpers, SVG writer, copy guard.**
- `science/__init__.py` and `science/tests/__init__.py` (empty).
- `science/common.py`: `ROOT`; OASIS LMP reader (filter `NODE_ID` and `LMP_TYPE == "LMP"`, value column `MW`, time from `INTERVALSTARTTIME_GMT`); Mountain-day grouping (6.1); EIA-930 reader (hour ending to UTC start); `sha256(path)`; JSON writer (sorted keys, indent 2, LF, final newline); a marker writer that replaces only the text between `<!-- results:start -->` and `<!-- results:end -->` in an md file.
- `science/svgplot.py`: dark and light palettes copied from `DESIGN.md`; bars, lines, direct labels, hatch patterns; refuses any text under 24px.
- Tests: OASIS `2026-10-27T06:00:00-00:00` is Oct 27 HB 0 MT; EIA "UTC Time at End of Hour" 07:00 is start 06:00; every hex in `svgplot.py` appears in `DESIGN.md`; a rendered SVG parses with `xml.etree` and every `<text>` is 24px or larger; `test_copy.py` scans every `science/**/*.md` and `*.svg` for U+2014, U+2013, the hype words and the phrases in section 7.

**Core 2. Cross-check the pinned Oct 27 numbers from raw public data.**
- `science/crosscheck.py` writes `science/crosscheck.json` (schema in 6.9) and the results table in `science/crosscheck.md`. Defaults reproduce Oct 27; `--day`, `--snapshot`, `--timetable-hours` and the raw file paths are arguments so the Oct 28 rerun is one command.
- Rows, each with its FACTS key, pinned value, your value, tolerance and status:
  - `fixed_usd_mw_day` $20.06 (20.0647), `clearlane_usd_mw_day` $58.41 (58.4053), `race_ratio` 2.911, `fixed_70` 1,404.5, `clearlane_70` 4,088.4, `fixed_500` $10,032, `clearlane_500` $29,203, all from raw OASIS prices (6.3).
  - `oct_step_hour_days` 24 of 27 (HB 5pm 9 days, HB 6pm 15) with median step $15.1; `jul_step_hour_spread` 28 of 30 in HB 1pm to 8pm with median $10.1 (6.4).
  - `fossil_priciest_oct` $67.3 at 85.1% vs $23.0 at 39.8%; `fossil_priciest_jul` $65.2 at 76.3% vs $12.9 at 52.2% (6.5).
  - `net_load_climb_mw` 604.6 MW at HB 3pm to 4,259.1 MW at HB 6pm, climb 3,654.51 MW, by two paths: raw `caiso3` plus `caiso4`, and the snapshot columns (6.6).
  - `lane_clear_max_usd` $29.98 and `lane_jam_min_usd` $47.18.
  - `clearlane_p50` and `share_days_beating`: status `pending` until core 7.
- Report any pinned number that the snapshot's HB 0 row touches (that row is Oct 28 00:00 MT; 6.1), computed both ways.
- When `public/derived/numbers.json` is on main, add its value as a second pinned column per row.

**Core 3. Chart: hour of each day's largest price step, October vs July.**
- `science/chart_step_hours.py` writes `science/charts/step_hours_oct_jul.svg` (dark, stage), `step_hours_oct_jul.light.svg` (print) and `step_hours_oct_jul.json` (the plotted counts).
- Bars by hour beginning 0 to 23: October (Oct 1 to 27, 27 days) solid, July (Jul 1 to 30, 30 days) hatched, side by side. Direct labels "24 of 27 October days: HB 5pm or 6pm" and "July: 28 of 30 between HB 1pm and 8pm". Counts come from the same function core 2 tests.
- Axis "hour beginning, Mountain time". Footer: both raw file paths, class DERIVED, script name.

**Core 4. Chart: October hour-of-day price vs average CO2.**
- `science/chart_price_co2.py` writes `science/charts/oct_price_co2.svg`, `.light.svg` and `.json`.
- Two aligned panels on one hour-beginning axis, Oct 1 to 25: mean PACE day-ahead price ($/MWh) from `research/data/oasis/dam_oct/`, and mean CO2 intensity (g/kWh). CO2 source order: `../clearlane-raw/eia/PACE.xlsx` column "CO2 Emissions Intensity for Generated Electricity" (lb/kWh x 453.592); else `co2_g_kwh` in the hist file; else the FACTS `co2_profile_he_oct` values, labeled as such. Hour beginning h uses HE h+1.
- The caption says: average emissions, estimated, for PacifiCorp East (Utah, Wyoming, Idaho); not marginal; not measured outcomes.
- If PACE.xlsx is the source, your hourly means must match `co2_profile_he_oct` within 1 g/kWh, or you report the mismatch.

**Core 5. Brief: "Why Utah's rush hour moved to 6pm".**
- `science/brief.md`, two printed pages: 900 to 1,100 words plus the two light charts from core 3 and 4. It is the judge leave-behind (6.11).
- Every number carries a citation to a FACTS key, a repo file or a URL you opened. A number with none is marked UNVERIFIED or cut.
- States its limits: one season of EDAM prices (public PACE day-ahead prices start May 1 2026), forecasts vs metered values, average not marginal CO2, PACE spans three states.

**Core 6. Chart: backtest spread by policy.** (Waits on `public/derived/backtest.json` on main.)
- `science/chart_backtest.py` writes `science/charts/backtest_spread.svg`, `.light.svg` and `.json`.
- One row per policy (fixed_overnight, price_only, clearlane): P10 to P90 bar, P50 tick with its value, mean dot, $/MW-day. The window (start, end, days, missing days) from the file. Caption: "value to RMP's system at day-ahead prices; the fixed overnight rule is our comparison rule, not Torus practice."
- Never commit a chart drawn from a fixture or a guess. Tests use a synthetic `BacktestResult`.

**Core 7. Cross-check the backtest P50 and the history file.** (Waits on `backtest.json` and `public/data/hist_2026-05-01_2026-10-27.json` on main.)
- Extend `science/crosscheck.py`:
  - Recompute fixed_overnight P10, P50 and P90 from the hist file with your own implementation of the engine's documented rule (6.7), to the cent.
  - Run an independent price-only DP and compare its P50.
  - Confirm clearlane P10, P50 and P90 are at or below price_only's.
  - Confirm `window.days` and `missing_days` from the hist file.
  - Spot-check hist prices against raw OASIS for May 1 to 23, Jul 1 to 30 and Oct 1 to 27 (every hour, to $0.00001).
  - Confirm the Oct 27 bundle's HB 0 price is 30.21857 ($30.22), not the fixture's borrowed $46.11.
- Take the policy definitions from `contracts/types.ts`, `docs/lanes/engine.md` (when present), the engine's test names and `backtest.json` itself, never from engine code.
- Report P50 under both percentile methods (6.7) and say which one matches.

## 5. Stretch queue (behind flags)

Stretch-1 starts only when every science core issue is merged and Integration posts CORE GREEN on #6, or Integration comments on #6 allowing an early start. If Integration posts CORE RED, stop stretch work at once: leave stretch branches unpushed, and do only the read-only re-derivations Integration asks for. No science item has a stage flag that turns on; `off_*` means nothing in the six beats reads it. Every stretch PR names its flag and the doc header says "Flag: off_<name> (not read by the stage app)".

**Stretch-1, merged by Train 5 (Tue 5:30pm):**

1. **`step-stats`** (`off_step_stats`): `science/step-stats.md` and `science/step_stats.json`, from code written apart from `research/analysis/option2/step_hours.py`. For each Mountain day in the hist file, the hour of the largest upward hour-to-hour step. October must reproduce 24 of 27, or you file the mismatch as a core issue for Integration. An exact binomial test of {HB 5pm, HB 6pm} against a uniform-hour null (p = 2/23), and a permutation test of October vs July step-hour distributions (the one to quote). Add one line per month, May to October, giving each month's modal step hour.
2. **`sch-rule-study`** (`off_sch_study`): `science/sch-study.md` and `science/charts/sch_rules.svg`. At least three rules over May 1 to Oct 27: ours (the 4 highest net-load hours plus every jam hour), the top N price hours, and a net-load percentile threshold. Use EIA-930 PACE demand, solar and wind from `research/data/eia930` with hist prices. A table gives hours flagged per month per rule and the overlap with the TORUS_PUBLISHED by-hour counts under both readings. One row reproduces the engine's Oct 27 System Critical Hours exactly, using the engine's inputs, not EIA actuals (6.6).
3. **`reserve-risk`** (`off_reserve_risk`): `science/reserve-risk.md` and `science/reserve_risk.json`. A non-homogeneous Poisson model (6.8): hourly rates from the by-hour and by-weekday counts under both readings, call duration over a 5 to 6 minute ASSUMPTION band, refill windows of 6 and 12 minutes, annual totals from 137 to 359. For each case: the expected calls a year that start inside a previous call's refill window, and the chance of at least one per season, in closed form and by a seeded simulation that agrees within 3 standard errors on 3 pinned configs. A clustered-arrival stress case. Refill 0 gives exactly 0. Once `call-ledger` merges, compare its overlap count at the ledger's own density.

**Stretch-2, merged by Train 6 (Tue 11:30pm):**

4. **`backtest-intervals`** (`off_backtest_intervals`): `science/backtest-intervals.md` and `science/backtest_intervals.json`. A seeded 7-day block bootstrap over `public/derived/backtest_days.json` (from engine core 10, the backtest) gives 90% intervals for P50 $/MW-day per policy and for `days_beating_fixed_overnight_pct`; a stationary bootstrap (mean block 7 days) gives a second interval for comparison. Same seed, identical bytes.
5. **`crosscheck-stretch`** (`off_science_methods`): `science/crosscheck-stretch.md` reports match or mismatch, tolerances written first, for every stretch output merged by 9:00pm Tue:
   - marginal CO2, a load-level-binned estimator vs `response_tables.json`'s hour-of-day OLS (agreement means within the OLS interval);
   - `reserve-risk` vs `call-ledger`;
   - rainflow cycles on two plans, from counting code you write;
   - the fleet envelope sum, recomputed from the site files;
   - the `sensitivity` base case vs `backtest.json`.

   Items merged later get the line "not cross-checked". `science/methods.md` gives every equation, input file and limit in under 4 pages. Integration opens an issue per mismatch.

After stretch-2: no new analysis. Fix review comments, keep the brief current, and do numbers reviews (section 8). Code freeze is Wed 2:00pm (tag `v1-stage`).

**Oct 28 refresh (prices available by about 9:16pm Tue, hard stop 10:30pm).** If Integration posts on #6 that the Oct 28 day-ahead files have landed, rerun core 2 for Oct 28 with the paths from the data lane's refresh PR and the timetable hours from the engine's Oct 28 output. Open the PR by 10:15pm. The charts and the brief stay on October data and do not change.

## 6. Domain notes

### 6.1 Time

- The whole window May 1 to Oct 27 2026 is MDT, UTC-6. Mountain day D runs from D 06:00Z to D+1 06:00Z; hour beginning h starts at D (06+h):00Z.
- CAISO operating days start at 07:00Z (Pacific midnight). Never use `OPR_DT` or `OPR_HR`; use `INTERVALSTARTTIME_GMT`. Mountain HB 0 of day D is CAISO `OPR_DT` D-1 HE24.
- EIA-930 and `PACE.xlsx` are hour ENDING, local: UTC start = "UTC Time at End of Hour" minus 1 hour; hour beginning h uses HE h+1.
- `research/data/pace_snapshot_2026-10-27.csv` is the CAISO operating day: 07:00Z Oct 27 to 06:00Z Oct 28, `local_mt` 10-27 01:00 to 10-28 00:00. Its HB 0 row is **Oct 28** 00:00 MT ($46.11). The true Oct 27 HB 0 price is 30.21857 ($30.22), from `research/analysis/option2/oct/`. The contract fixture borrows the Oct 28 hour and says so in its notes.
- May 1 has only 23 priced hours (prices begin 2026-05-01T07:00Z). A day without 24 prices is skipped and listed, never filled.

### 6.2 Inputs (all REAL unless noted; all in git unless marked local)

| Data | File | Notes |
|---|---|---|
| Oct 1 to 27 DA LMP, 4 nodes | `research/analysis/option2/oct/20260930_20261028_PRC_LMP_DAM_*.csv` | First row 2026-10-01T06:00Z; node `ELAP_PACE-APND` |
| Jul 1 to 30 DA LMP | `research/analysis/option2/jul/20260630_20260730_PRC_LMP_DAM_*.csv` | PACE, PACW, SP15 |
| Oct 1 to 25 DA LMP, PACE | `research/data/oasis/dam_oct/*.csv` | 600 hours; the CO2 and fossil window |
| July DA LMP, PACE | `research/data/oasis/dam_jul/*.csv` | |
| May DA LMP, PACE | `research/data/caiso7/20260425_20260524_*.csv` | From 2026-05-01T07:00Z |
| Oct 27 DA LMP | `research/data/caiso2/*.csv` (PACE), `caiso5/*.csv` (4 nodes) | |
| Oct 27 DA load forecast | `research/data/caiso3/*.csv` | `TAC_AREA_NAME == "PACE"`, value `MW`; find the filter that reproduces the snapshot column and state it |
| Oct 27 EDAM solar and wind forecast | `research/data/caiso4/*.xml` | `BAA_GRP_ID == "PACE"`; average sub-hourly rows to hours if present, and state it |
| Oct 27 snapshot | `research/data/pace_snapshot_2026-10-27.csv` | second path only |
| EIA-930 PACE balance | `research/data/eia930/PACE_EIA930_BALANCE_*.csv` | Use "(Adjusted)" columns; time format `%m/%d/%Y %I:%M:%S %p` |
| PACE CO2 intensity | `../clearlane-raw/eia/PACE.xlsx` (local, 75 MB) | Read with stdlib `zipfile` plus `xml.etree.ElementTree.iterparse`; "Local date" is an Excel serial; tests that need it skip when absent |
| History | `public/data/hist_2026-05-01_2026-10-27.json` (data lane) | `HistDay[]`; not on main yet |
| Backtest | `public/derived/backtest.json`, later `backtest_days.json` (engine) | not on main yet |
| Heatmap counts | `public/data/torus_published.json` (data lane) or FACTS `rmp_heatmap_by_hour`, `rmp_heatmap_by_weekday` | TORUS_PUBLISHED |

### 6.3 Reference race (FACTS `fixed_usd_mw_day`, `clearlane_usd_mw_day`)

Reference station: 1 MW, 2 MWh usable, round-trip efficiency 0.88 (ASSUMPTION) split as sqrt on each leg. It buys Cg = 2/sqrt(0.88) MWh at the mean price of its charge hours and sells Dg = 2 x sqrt(0.88) MWh at the mean price of its discharge hours. Value = Dg x mean(discharge) minus Cg x mean(charge).
- Fixed overnight rule: charge HB 1am to 4am (pinned mean $39.53), discharge HB 6pm to 7pm ($55.62).
- Timetable: charge HB 1pm to 3pm ($21.55), the same discharge.
- 70 MW and 500 MW lines multiply by MW, assuming every MW behaves like the reference station and the fleet does not move prices.
- The fixed rule's windows are fixed for every day. The timetable's charge hours are an Oct 27 result, so on another day they are an argument; that row then checks the arithmetic, not the choice.

### 6.4 Step hour

For each Mountain day with 24 prices: step(h) = p[h] minus p[h-1] for h = 1 to 23. The step hour is the h with the largest step; a tie goes to the earliest h. The step amount is that largest value. No cross-midnight step.

### 6.5 Fossil share deciles (FACTS `fossil_priciest_*`)

- Per hour: fossil share = (max(coal, 0) + max(gas, 0)) / sum of max(x, 0) over coal, gas, hydro, solar without battery, wind without battery, geothermal and other.
- Join EIA hours to OASIS hours on **UTC start**.
- Rank the hours by LMP (ties broken by UTC time) and cut into deciles of n/10 (60 for Oct 1 to 25).
- Report each decile's mean LMP and mean share.
- If your result differs from the pinned one beyond tolerance, look first at the join key and at columns that may be missing or blank in some months, then report what you find.

### 6.6 Net load, lanes and System Critical Hours

- Net load = PACE DA load forecast minus EDAM solar forecast (clamped at 0) minus EDAM wind forecast. These are forecasts, not metered values.
- Lanes: clear = price at or under min + 25% of the day's range; jam = price at or over max minus 25%. On Oct 27: min $21.38 at HB 3pm, range $34.40, clear at or under $29.98, jam at or over $47.18.
- Our System Critical Hours rule: the 4 highest net-load hours plus every jam hour. To reproduce the engine's Oct 27 flags, use the engine's own inputs (bundle forecasts). EIA-930 actuals serve only for the season study, and they will differ from CAISO forecasts; say so in the md.

### 6.7 Backtest, planner and percentiles

- The window is May 1 to Oct 27 (180 calendar days before skips). Policies: `fixed_overnight`, `price_only`, `clearlane`.
- The planner spec is engine.md section 6.4 ("DP" and "15-minute limits"), copied verbatim, not paraphrased: 41 levels of 12.5 kWh, 4 levels up and 5 down per step at the meter, export limit 0, the host ceiling, the SCH spare rule, ending charge at or above the start level, sqrt(0.88) on each leg. Read host load and limits from `public/derived/site_default.json` (engine core 2), never from your own guess. `price_only` uses no wear price, no envelope, no host ceiling and no Spin reserve.
- **Dominance you can test without engine code.** Clearlane's plan is feasible for the price-only problem, so its value is at or below price_only's on every day. Order statistics keep that order, so its P10, P50 and P90 must be too. A violation is a mismatch, filed.
- The percentile method is not pinned in the contracts. Compute nearest-rank and linear interpolation (Hyndman-Fan type 7) and report both; Integration pins one. Count `days_beating_fixed_overnight_pct` with strict "greater than", ties not beating, and say so.

### 6.8 Calls, the heatmap and reserve risk

- The 2025 heatmap (TORUS_PUBLISHED) gives counts by clock hour 12am to 11pm: 9, 41, 5, 4, 1, 3, 4, 14, 23, 26, 25, 20, 15, 33, 19, 14, 14, 8, 6, 4, 5, 34, 24, 8 (sum 359). By weekday, Mon to Sun: 50, 57, 43, 57, 53, 45, 54. It states no time zone, so every result shows two readings: as Mountain (label h is HB h MT) and as UTC (MT hour = (h minus 6) mod 24 under MDT). A 7-hour (MST) shift is a sensitivity only. 2024 had 137 events with no hourly shape; scaling 2025's shape to 137 is an ASSUMPTION.
- Spin: full discharge in 6 minutes, discharge and recharge in 12 (TORUS_PUBLISHED). The published event ran about 5.6 minutes (`rmp_event_minutes`).
- Reserve risk, closed form:
  - A rate lambda(t) per minute, separable as hour x weekday.
  - A call starting at s ends at s + d; its refill window is [s + d, s + d + R].
  - Expected calls a year that start inside some earlier call's refill window: E = integral of lambda(t) x (1 minus exp(minus Lambda(t minus d minus R, t minus d))) dt, about the integral of lambda(t)^2 x R dt for small R.
  - Chance of at least one in a season is about 1 minus exp(minus E_season); state that approximation.
- Expect the two readings to give nearly the same E: a clock shift relabels hours but keeps the set of rates. The readings matter for which hours, not how many overlaps. Report both anyway.
- `call-ledger` replays 359 calls on about 180 backtest days, about twice the 2025 daily rate. E scales with N^2/T, so compare at the ledger's density, not 2025's.

### 6.9 Statistics and reproducibility

- Write every tolerance and test statistic before the real run (section 3). Default tolerances unless a row needs another and says why: dollars $0.01 at the pinned rounding; counts exact; shares 0.1 percentage point; MW 0.1; g/kWh 1. A re-derivation from the same raw file should match exactly; a miss means the definitions differ, and you say which.
- Seeds go in the output. Use `random.Random(seed)` instances, never the global random. No timestamps, hostnames or absolute paths in outputs. Every output records the sha256 of each input.
- `science/crosscheck.json`:
  - Top level: `schema: "clearlane.science.crosscheck/v1"`, `operating_day_mt`, `script`, `inputs` [{path, sha256}], `checks` {facts_key: entry}.
  - Each entry: `facts_key`, `numbers_key` (null until Integration gives the map), `unit`, `pinned` {facts, numbers_json}, `science`, `tolerance`, `status` (`match`, `mismatch`, `pending`, `not_checked`), `method` (one sentence), `inputs`.
  - Never write `match` for a value you did not compute.

### 6.10 Charts

- `viewBox="0 0 1920 1080"`. Dark tokens for the stage file, light for `.light.svg`, both from `DESIGN.md`. System UI font stack, `ui-monospace` for numbers. Every `<text>` 24px or larger; every number a judge must read 40px or larger.
- Each SVG has `<title>` and `<desc>` and a footer: source files or URLs, provenance class, script name, data window.
- Color is never the only signal: use hatching or direct labels, and label series in text.
- Write numbers at fixed precision. Emit attributes in a fixed order so reruns are byte-identical. No U+2014 or U+2013 anywhere.
- Each chart also writes a `.json` of exactly the values it plots, so Pitch and the cross-check can read them.

### 6.11 Writing the brief

- Readers: judges who include a former CTO (`docs/JUDGING.md`). Lead with the finding in one sentence, then the evidence in this order:
  - October's largest price step lands at HB 5pm or 6pm on 24 of 27 days, while July's spread from 1pm to 8pm.
  - Oct 27 net load climbs 3,654.5 MW from the 3pm hour to the 6pm hour as solar falls off.
  - The cheap midday hours are also the lower-CO2 hours.
  - Close with what that means for a simulated Torus-style station: fill in the clear lane, keep Spin ready for the jam.
- "Moved" means the shift from July to October 2026, inside the EDAM era. Public PACE day-ahead prices begin May 1 2026, so make no multi-year price claim. A multi-year net-load-peak check from `PACE.xlsx` is optional and labeled.
- RMP peak-window facts (summer peak about 3 to 8pm; the Schedule 1 TOU pilot's 6 to 10pm weekday on-peak) come from `research/GRID.md` with their URLs. List each as a new FACTS number.
- Quotes stay under 15 words, with a URL; otherwise paraphrase. Sources go in a numbered list at the end, with file paths and URLs.

### 6.12 Python, files and CI

- Stdlib only (no numpy, pandas or matplotlib in committed code); CI runs bare Python 3.13 on Ubuntu. You may explore with other tools in the app's kernel, but committed results come from committed stdlib scripts.
- Run scripts as `python -I science/<script>.py`. `-I` drops the script's own folder from `sys.path`, so each script starts with `ROOT = pathlib.Path(__file__).resolve().parents[1]` and `sys.path.insert(0, str(ROOT))` before `from science import common`. Tests run via `python -I -m unittest discover -s science/tests -t .`.
- Paths are relative to ROOT inside the code; `../clearlane-raw` is `ROOT.parent / "clearlane-raw"`. Tests needing it use `unittest.skipUnless`, and so do tests needing files not yet on main.
- Open files with `encoding="utf-8"` and write with `newline="\n"`; `.gitattributes` forces LF.

## 7. Guardrails

Every science file, chart and PR:
- Never invent a number, quote, URL or fact. If it is not in the repo research, `../clearlane-raw`, FACTS or a source you opened in this session, write UNVERIFIED next to it or cut it.
- Torus: say "not advertised", never "Torus lacks" or "Torus can't". Stations are "simulated Torus-style", no Torus logos or product photos. The fixed overnight schedule is our comparison rule, never Torus or Lasso practice. 500 MW is "an MOU for up to 500 MW", never installed capacity.
- Value is "value to RMP's system at day-ahead prices", never Torus revenue, host savings or a bill cut. No annualized dollar figures.
- CO2 figures are "estimated, using average emissions", never marginal or measured. When quoting PACE CO2 or fuel mix, say "PacifiCorp East (Utah, Wyoming, Idaho)", not "Utah's grid".
- Any heatmap result shows both the Mountain and UTC readings. Never say "most RMP calls come in the evening". Say "a call of under six minutes", not "a six-minute call".
- Read the full "Do not say" table in FACTS before writing prose; it is binding.
- External text: no em dashes or en dashes; American English; plain words; none of comprehensive, robust, seamless, leverage, cutting-edge, game-changer.
- No keys or tokens in any file. No copied page text. Third-party files stay in `../clearlane-raw`.

## 8. When blocked

1. Add the label and say what you need, from whom:
   ```powershell
   gh issue edit <n> --repo craigcossairt/clearlane --add-label status:blocked
   gh issue comment <n> --repo craigcossairt/clearlane --body "Blocked: need <file or decision> from <lane>. Next: #<m>."
   ```
2. Take the next unblocked issue in order. When the input lands, remove the label (`--remove-label status:blocked`) and resume.
3. **A mismatch is not a block.** Finish the PR with the mismatch reported, then file:
   ```powershell
   gh issue create --repo craigcossairt/clearlane --title "[integration] Mismatch: <key> science <x> vs pinned <y>" --label lane:integration --label tier:core --body-file tools/out/science/mismatch-<key>.md
   ```
   The body names the owning lane, both values, both methods and the input hashes.
4. **Queue empty or everything blocked:** do numbers reviews. List open PRs (`gh pr list --repo craigcossairt/clearlane --state open`), re-derive any new number one introduces where the raw data allows, and comment the result on the PR. Comments only, never commits to another lane's branch.
5. In Paths B to D, put blocks and mismatches at the top of HANDOFF.md and in chat.

## 9. Status reporting

At each train, after rebasing, and once when your queue empties, post one comment on #6:

```powershell
gh issue comment 6 --repo craigcossairt/clearlane --body-file tools/out/science/status.md
```

Keep it under 12 lines, in this order: `Train <k> (science), <time> MT`; merged (issue numbers); in review (PR and issue); in progress (what is left); blocked (what you need, from whom); mismatches filed; cross-check scoreboard (n match, n mismatch, n pending); next. If CORE RED or CORE GREEN was posted, say what you stopped or started. In Paths B to D, keep the same block at the top of HANDOFF.md and paste it in chat.
