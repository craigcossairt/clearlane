# UI lane brief

You are the **ui lane**: Cursor (Agent; Design Mode allowed), worktree `~/Code/clearlane-ui`, branch prefix `ui/`. You build the stage app the judges watch: six beats, keyboard driven, offline, on a projector in a sponsor room, plus a phone layout.

Precedence: `AGENTS.md`, `contracts/types.ts` and `DESIGN.md` win over this file. This file wins over the plan files in `docs/plan/`, which are superseded (see `docs/plan/README.md`): OpenCode is dropped, there is no Nucleus slide, and this is the Torus bounty only.

Lane done when (from `AGENTS.md`): the six beats run from the keyboard at 1920x1080 and 375px, every number carries a provenance chip, and snapshot mode makes no request to any other origin.

---

## 1. Role and boundaries

**You own `app/**` only:** `app/index.html`, `app/src/**`, `app/scripts/**`.

**You read but never write:** `contracts/`, `engine/`, `public/`, `prep/`, `api/`, `docs/`, `research/`, `demo/`, `tools/`, `science/`, `pitch/`, `.github/`, `bin/`, harness config, and every root file (`package.json`, `package-lock.json`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, `DESIGN.md`, `README.md`). The one exception: screenshots and check output go to `tools/out/` (gitignored, never committed).

**Need something outside `app/`?** Comment on your issue, then open an issue for the owner:
- a number, key, plan, crash, envelope, or engine export: `lane:engine`
- a file in `public/data/`: `lane:data`
- contracts, flags, dependencies, Vite or vitest config, `demo/keymap.md`: `lane:integration`

**Never:** merge a PR; push to `main`; edit `package.json` or the lockfile (a hook blocks it); add a dependency; load anything from a CDN or the web (fonts, scripts, images); compute a number that appears on stage (formatting and unit conversion only); type a number into JSX or copy; use a Torus logo, brand mark or product photo.

**Others depend on you for:** the stage build Integration tags `v1-stage`; deep links and `data-*` hooks that Pitch's backup video and Integration's smoke run drive (section 6.10); `app/scripts/projector-check.mjs`; and `app/src/keymap.ts`, which Integration mirrors into `demo/keymap.md`.

## 2. Boot sequence

```bash
cd ~/Code/clearlane-ui
git fetch origin
git status        # uncommitted work belongs to an open issue; do not discard it
npm ci            # only if node_modules is missing or package-lock.json changed on origin/main
```

If the worktree is missing: `git -C ~/Code/clearlane worktree add ../clearlane-ui origin/main`, then `npm ci` inside it. Forward slashes work in PowerShell and Git Bash; backslashes break in Git Bash.

Read, in this order:
1. `AGENTS.md`, then this file.
2. `contracts/types.ts` (every shape you render) and `DESIGN.md` (tokens and stage rules).
3. `docs/FACTS.md`: the "Do not say" table, and every CONFLICT row named in section 6.9.
4. `docs/STRETCH.md`: "Feature flags", "Keys", "Contracts, refresh and guardrails".
5. `docs/plan/synthesis.json` `final_concept.demo_script`: the 2:45 script the app serves.
6. Skim `research/TORUS.md` section 8 (guardrails) and `docs/GLOSSARY.md` "Time".

Then load your queue:

```bash
gh issue list --label lane:ui --state open --json number,title,labels,milestone --limit 50
gh issue view <n> --comments
```

Work in the order of sections 4 and 5 (each issue body states its order), not by issue number. Skip any issue whose comments show a claim by another session. Claim before you start:

```bash
gh issue comment <n> --body "claimed by Cursor (ui lane)"
```

**Work already in flight.** Issue #14 ("Stage app: six beats on the Oct 27 fixture") was opened before this brief, is claimed by you, and is now open as PR #18 on branch `ui/14-six-beats`. Before it merges: move `app/src/qa/cards.json` out (Q&A content belongs to pitch, through its own PR); replace `app/src/stub/published.ts` with a fetch of `public/data/torus_published.json` behind the stub flag; delete the reference math in `app/src/stub/reference.ts` in favor of `numbers.json`; and correct the Spin source URL to the torus-flywheel page in FACTS (not torus-nova). Cut it down to the scope of core 1 to 3 below, land it as one PR whose body says `Closes #14` plus those three issue numbers, and move everything else into the later beat issues.

## 3. Per-issue loop

1. Claim the issue (above).
2. Branch from fresh main: `git fetch origin`, then `git switch -c ui/<n>-<slug> origin/main` (slug: two to four words, kebab-case). One issue, one branch, one PR.
3. Test first. Write the failing vitest for the acceptance criteria and run `npx vitest run app/src/<path>.test.ts` (or `.tsx`). Confirm it fails for the reason you expect.
4. Build until green. For anything visible, run `npm run dev` and look at the page at 1920x1080 and 375x812 in Cursor's browser. Once core 12 is merged, use the projector check instead.
5. Gate: `npm run check:all` (tsc, vitest, vite build, prep unittest). Never open a PR on red.
6. Commit only `app/` files: `git add app`, with a plain message saying what changed and why.
7. Push: `git push -u origin ui/<n>-<slug>`.
8. Open the PR. Write the body to a temp file outside the repo, then:
   ```bash
   gh pr create --base main --title "[ui] <issue title>" --body-file <tempfile> --label lane:ui --label status:needs-review
   ```
   The body has these fields, in order:
   - `Closes #<n>`
   - **What changed:** three to six bullets.
   - **Evidence:** the `npm run check:all` summary lines (test files, tests passed, build ok); the names of the new tests; for a visible change, absolute paths to screenshots at 1920x1080 and 375x812 saved under `~/Code/clearlane-ui/tools/out/screens/` (Integration opens them on this machine).
   - **New numbers:** every new on-screen number with its `numbers.json` key or engine field and its provenance class. Write "None" if there are none.
   - **New copy:** every new judge-facing string (Pitch reviews these for guardrails and em dashes).
   - **Flag:** stretch PRs only: the flag name and the name of the flag-off test.
9. Comment on the issue: `gh issue comment <n> --body "PR #<m> open: <one line>"`.
10. Take the next issue. Cut every branch from `origin/main`; never stack a branch on an unmerged PR. If the next issue needs an unmerged PR, take a different issue or mark it blocked (section 8).
11. Review comments (Pitch reviews every PR; Integration may comment): fix on the same branch, push, and reply in the thread.

**Trains.** When Integration announces a train on `Lane: ui status` (#4), for each of your open PR branches: `git fetch origin`, `git rebase origin/main`, rerun `npm run check:all`, then `git push --force-with-lease` (your own `ui/` branches only). Then post the status comment (section 9).

**Never:** `gh pr merge`, `git push origin main`, `--no-verify`, or a force push to any branch that is not yours.

## 4. Core queue (ordered)

Deadlines, all Mountain time: core 1 to 3 by **Train 1 (Tue 1:45am)**, the UI shell on the fixture. All of core by **Train 2 (Tue 8:00am)**, the CORE COMPLETE target, on real engine output. **Train 4 (Tue 2:00pm)** is the formal core checkpoint. Overnight (2am to 7am) keep working down the queue; nobody will answer questions, so mark blocked and move on.

Each issue body holds the full checklist. The summary below is the contract.

**Core 1. App shell: stage frame, data loader, stage day and key map.**
- `app/src/data.ts` is the only data loader. It bundles JSON at build time (section 6.2), so there is no runtime data request. A missing file is the empty state, not a build failure.
- The stage day comes from `numbers.json` (section 6.2); `?day=YYYY-MM-DD` overrides it for rehearsal. If the bundle and `numbers.json` describe different days, the page shows a failed state that names both files. It never mixes days.
- The header always shows the operating day, labeled Today, Tomorrow (day-ahead) or Cached against the laptop's Mountain date; the node (ELAP_PACE-APND); and "Snapshot, fetched <time> MT" from `fetched_utc`.
- The stage frame is 1920x1080 logical px, scaled uniformly to the viewport. Below 768px wide the page reflows to one column (section 6.6). Tokens in `app/src/styles/tokens.css` match `DESIGN.md`; a vitest compares them.
- `app/src/keymap.ts` holds one table that drives the key handler and the `?` overlay. A vitest fails on any key that is bound twice in the same context.
- `app/src/flags.ts` reads `?ff=`; every flag is off by default.
- Deep links and `data-*` hooks from section 6.10 work.
- A vitest renders the shell on a second bundle with another operating day and finds no trace of Oct 27.

**Core 2. Provenance chips and the one-number rule.**
- `<Num k="key" />` renders a `numbers.json` entry: its `display` string verbatim, plus a chip with the class and a tooltip naming `source` and `as_of_mt`. `<Num value display prov source />` renders a live engine value.
- Missing, loading and failed states look different from each other (section 6.4). A missing key never renders as 0.
- `app/src/stageKeys.ts` lists every key each beat reads. A vitest checks each one against `numbers.json` once that file exists.
- Digit rule test: render every registered beat (later beats are covered with no test edit); any text node containing a digit must sit inside `[data-num]`, `[data-time]`, `[data-axis]` (chart tick labels) or `[data-copy-ok]` (a short allowlist such as P10/P50/P90 and schema ids, each with a comment).
- Copy guard test: no em dash (U+2014), hype word or "Do not say" phrase anywhere in `app/src` (section 7).
- A chip legend line on the stage explains all six classes in plain words.

**Core 3. Engine client with a labeled stub on the Oct 27 fixture.**
- `app/src/engineClient.ts` is the only module that imports `@engine` or the stub. Its interface is in section 6.3.
- Until the engine merges, the stub runs on `contracts/fixtures/bundle_2026-10-27.json` and returns contract-shaped objects.
- While the stub is active, a fixed-size header slot reads "Engine stub: not engine output".
- Vitest on the fixture: Oct 27 lanes (clear 9am to 4pm hour beginning, 5pm shoulder, jam 6pm to 11pm); a 330 s call served by Spin alone (shortfall 0); a second call inside the refill window reports a shortfall above 0; the meter stays at or under the host ceiling.

**Core 4. Beat 1: traffic-report ribbon.**
- 24 hours drawn as a road. Each hour is colored by its lane from the engine, never from hand-typed hours, and carries a text label (Clear, Shoulder, Jam).
- A solar forecast area and a net-load line; axis labeled "hour beginning, Mountain time".
- Each lane's price range comes from the engine or numbers.json, through `<Num>`.
- The caption reads from keys: net-load climb, peak over trough, the peak hour (read, never typed), and the October step count.

**Core 5. Beat 2: the race.**
- Space plays a 15 s time-lapse of the 96 intervals. Left: "Battery on the off-peak rule" (fixed_overnight). Right: "Simulated Torus-style station on Clearlane" (clearlane).
- Each side shows Spin and Pulse state bars, the host 15-minute meter line under its ceiling line (kW only), and a cycles meter against the daily budget.
- End cards: $/MW-day; $/day at the 70 MW MOU labeled "value to RMP's system at day-ahead prices"; and CO2 t/day at 70 MW with the line "Average-emissions estimate (EIA hourly); marginal emissions can differ." Values come from numbers.json.
- A vitest asserts the live clearlane plan's value matches its numbers.json key to the cent once the real engine is wired.
- Plans are solved before Space is pressed. Under reduced motion, Space lands on the end cards at once.

**Core 6. Beat 3: the crash.**
- C pauses the day at the scripted 6:40pm MT call and drops the banner "Simulated Rocky Mountain Power call: {enrolled_kw} kW now".
- An inset plays `CrashResult.trace` (call plus refill) in about 8 s: requested, Spin and Pulse kW; Spin energy draining then refilling; the meter under the host ceiling; and a simulated clock.
- The ghost "Battery-only plan" plays the same call against the price_only plan beside it.
- C again during the refill lands the scripted second call and shows the second-press rule and `shortfall_kwh`.
- The event card puts the TORUS_PUBLISHED 2025 facts (359 events; 19 s ramp against a 30 s target; 102% delivered against a 90 to 100% band) in a panel visibly apart from our SIMULATED result.
- Any heatmap-derived figure shows the Mountain reading; Torus confirmed the hours are Mountain time (`heatmap_readings`). UTC readings never show on stage.

**Core 7. Beat 4: re-plan.**
- The rest of the day redraws from `CrashResult.replan`, labeled "Re-planned in N ms", where N is the live `replan.solve_ms` with a MEASURED chip.
- The cycles meter shows today's cycles against the daily budget (key).
- R clears every live result. The slot for N is reserved before the re-plan exists.

**Core 8. Beat 5: envelope and backtest.**
- E shows the 24-hour envelope from `public/derived/envelope_<day>.json`: System Critical Hours shaded and labeled "our proposal", reserve, max charge, max discharge and planned kW per hour, the reason per hour, the `sch_rule` text, and the schema id.
- Copy JSON copies the file's exact content. Its labels (Copy JSON, Copied, Copy failed) share one fixed width.
- B flips to the backtest card from `backtest.json`: three policies, P10 to P90 bands of $/MW-day with a P50 tick, cycles per year against the 300 budget, calls unanswerable under both heatmap readings, share of days beating the off-peak rule, host ceiling breaches, and the window with its missing days.
- Before `backtest.json` exists, the card shows its "not computed yet" state.

**Core 9. Beat 6: scale and close.**
- A fleet slider runs from the 70 MW MOU to the 500 MW ceiling (both values from keys). Labels: "MOU ceiling, not installed capacity" and "Assumes the fleet does not move prices".
- $/day at the slider position comes from the engine (section 6.3). At 70 and 500 MW it equals the numbers.json keys (vitest).
- The close card shows the SIMULATED campus line {campus_usd}, "In Utah, compute should follow the sun in time, not in space.", and "Clearlane: fill up when the road is clear, and keep Spin ready for the crash."

**Core 10. Wire the real engine and numbers.json; retire the stub.** Take this as soon as `engine/src/index.ts` and `public/derived/numbers.json` are on main, even mid-queue.
- `engineClient.ts` maps onto the engine's exports; no other file changes for the swap.
- The production build no longer reaches the stub, and the stub banner is gone.
- The stage-key test passes against the real `numbers.json`. A live solve on the stage bundle matches the pinned numbers.
- Anything the app needs that the engine lacks becomes an engine issue, never app math.

**Core 11. Six-beat DOM snapshots, offline guard and flag-off harness.**
- jsdom snapshot of each beat's end state with every `ff_*` off. MEASURED values and `generated_utc` are masked.
- A runtime test records every `fetch`, `XMLHttpRequest` and dynamic import while all six beats render, and fails on any of them.
- A static scan fails on any `http://` or `https://` in `app/index.html` and `app/src` code (data strings are excluded).
- `app/src/test/flagsOff.ts` exports the check every stretch PR reuses.

**Core 12. Projector screenshot check.**
- `app/scripts/projector-check.mjs [baseUrl]` drives each beat's end state at 1920x1080 and 375x812, saves PNGs to `tools/out/screens/`, and checks: no sideways scroll; no clipped number; minimum font sizes at 1920; every request same-origin; `[data-slot]` boxes unchanged across state changes.
- Exit 0 means PASS, 1 means FAIL with each violation listed, 2 means could not run (no Playwright, server down). Never report a could-not-run as 1.
- It needs Playwright as a root dev dependency (Integration adds it). Until then, take the same screenshots by hand in Cursor's browser.

## 5. Stretch queue (behind flags)

**When to start.** Stretch-1 starts only when your core issues are merged and Integration has posted CORE GREEN on #4. Stretch-2 starts when your stretch-1 items are merged or cut. Deadlines: stretch-1 merged by **Train 5 (Tue 5:30pm)**; stretch-2 by **Train 6 (Tue 11:30pm, feature freeze)**. A miss means Integration requeues or cuts the item.

**Every stretch PR carries:**
- its flag, default off, read through `app/src/flags.ts`;
- the flag-off test from core 11 (six-beat snapshots and pinned numbers unchanged with every `ff_*` off);
- a chip on every new number;
- Pitch's guardrail review.

Flags turn on for rehearsal with `?ff=projector,any_day` (names without the `ff_` prefix). `contracts/flags.ts` (Integration, by Train 3) becomes the name list; until it lands, `flags.ts` keeps the list. Whether a flag ships on stage is Craig's call at Train 6.

**A red core stops stretch work.** When Integration posts CORE RED, stop stretch commits, leave stretch PRs open, and take core fixes until CORE GREEN. A stretch PR that turned a core test red is reverted, not fixed forward.

| # | Issue | Flag | Key | Waits on | Done when (summary) |
|---|---|---|---|---|---|
| S1-1 | Screens pass | `ff_projector`, `ff_public_url` | T | core on main | axe-core reports zero serious or critical violations on all six beats; every lane has a label and a pattern, with 3:1 contrast between adjacent fills in both themes; no clipped number at 1920x1080, 1280x720 or 1024x768; T toggles the projector theme with no box moving; a touch beat bar at 375x812; a fixed QR slot on the close card |
| S1-2 | Any day | `ff_any_day` | D | data hist file, engine backtest CLI | D lists every hist day plus the bundle days; picking one re-solves fixed_overnight and clearlane in the browser with a MEASURED solve time; five pinned days match the CLI to the cent; days the off-peak rule wins say so; days with missing hours are disabled with the reason; missing CO2 shows as unavailable |
| S1-3 | Judge mode | `ff_crash_anywhere` | C, click | engine `crashAt` | a click on a ribbon slot, keyboard selection, or C at the current minute drops a SIMULATED call there through `engineClient`; the card names the minute, the actual refill time and the MEASURED solve ms; a second drop in the refill window shows the shortfall; input is clamped to the day |
| S1-4 | Freeway ribbon | `ff_freeway` | none | core 4 | traffic density maps from `net_load_mw` through one function (a test asserts it rises with net load); slow in jam hours, flowing in clear hours, using engine lanes; one vehicle labeled "simulated Torus-style station", on the road while charging and off it while discharging; no long task over 50 ms; caption says density is net load |
| S2-1 | Proof drawer | `ff_proof_drawer` | P, Esc | card JSON from engine, data and science | P opens a drawer over the current beat and Esc closes it; one SVG card per merged source with chips, intervals as bands, and distinct empty, unknown and broken states; never part of the six beats |
| S2-2 | Lineage | `ff_lineage` | I, Enter | `torus_published.json` | every chip opens key, display, class, source and `as_of_mt`; TORUS_PUBLISHED values show their URL; a cross-check shows only when `science/crosscheck.json` lists the key; Esc returns focus to the chip |
| S2-3 | Fleet board | `ff_fleet_board`, `ff_fleet` | F, C | engine fleet-rollup, fleet-call | up to 24 simulated site tiles plus a fleet envelope strip; C runs `fleetCall` and shows per-site contributions, fleet delivered % and MEASURED ms; under `ff_fleet`, beat 5 shows three sites stacked under the fleet line |
| S2-4 | Compute drag | `ff_compute_drag` | arrows | engine Option 2 shift | a SIMULATED 25 MW x 3 h block moves on the close card by mouse, touch or arrows; cost and CO2 come from the engine; at the default position the saving equals {campus_usd}; a "move it in space" toggle uses `bundle.peers` or the research figures with their source path |

Full acceptance checklists are in each issue body and in `docs/STRETCH.md`.

## 6. Domain notes

### 6.1 What each beat must make obvious (demo script, 2:45 total)

| Beat | Time | Key | What the judge must see in five seconds |
|---|---|---|---|
| 1 Traffic report | 0:00-0:25 | (start) | The road is clear at midday and jammed after the evening step; price jumps {peak_over_trough} by the peak hour |
| 2 Race | 0:25-0:55 | Space | Same battery, two timetables; Clearlane earns more per MW-day and never crosses the host ceiling |
| 3 Crash | 0:55-1:40 | C, C | A call lands at 6:40pm on a station already discharging; Spin answers alone; the battery-only ghost misses or gives up its block; a second call during refill shows an honest shortfall |
| 4 Re-plan | 1:40-2:00 | Right | The rest of the day re-solved from actual state, in N ms measured on this laptop |
| 5 Envelope and proof | 2:00-2:25 | E, then B | An hourly envelope with System Critical Hours, then the May 1 to Oct 27 backtest across three policies |
| 6 Scale and close | 2:25-2:45 | slider, then Right | 70 MW to the 500 MW ceiling with its caveat; then compute follows the sun in time, not in space |

Any element that adds seconds to the 2:45 is a stretch item behind a flag.

### 6.2 Data: what you read, and how

All paths are relative to the repo root. Shapes are in `contracts/types.ts`.

| File | Shape | Owner | Used in |
|---|---|---|---|
| `public/data/bundle_<day>.json` | `Bundle` | data | ribbon, race, everything hourly |
| `public/derived/numbers.json` | `StageNumber[]` | engine | every scalar on stage |
| `public/derived/envelope_<day>.json` | `Envelope` | engine | beat 5 |
| `public/derived/backtest.json` | `BacktestResult` | engine | beat 5 |
| `public/data/torus_published.json` | `TorusPublished` | data | arrays and per-value URLs (stretch lineage); scalars come from numbers.json |
| `public/data/hist_2026-05-01_2026-10-27.json` | `HistDay[]` | data | stretch any-day only |
| `contracts/fixtures/bundle_2026-10-27.json` | `Bundle` | integration | stub and tests until the real bundle lands |

- **Bundle at build time.** Use `import.meta.glob("../../public/derived/*.json", { eager: true, import: "default" })` (and the same for `public/data/bundle_*.json`) in `app/src/data.ts`. A file that does not exist simply is not in the map, so it renders the empty state. Prove it on the first PR: `npm run check` runs `vite build`, and `npm run dev` must load it too. If Vite refuses to import JSON from the public directory, fall back to same-origin `fetch` of relative URLs (`derived/numbers.json`), which the offline rule allows. Say which you used in the PR, and comment on #4.
- **Stage day.** It is the `as_of_mt` shared by the day-level keys in `numbers.json` (the race keys), because the engine CLI regenerates `numbers.json` for whichever bundle goes on stage. A vitest asserts that every day-level key agrees. `?day=` overrides it. Backtest keys describe a window and are exempt.
- **Oct 28 refresh.** At about 9:16pm Tue, Integration regenerates data and rebuilds. The app must switch days with zero code change; core 1's second-bundle test proves it. If the refresh fails, the stage stays on Oct 27 and the header says Cached.
- **Data quirks.**
  - `peers` may be empty.
  - Operating-day CO2 is `co2_kind: "eia_profile_avg_30d"` (DERIVED, a trailing profile); history CO2 is REAL and may be `null`, which means unavailable, never 0.
  - Hour 0 of a Mountain day comes from the previous CAISO operating day; in the fixture it is borrowed from Oct 28 (see `bundle.notes`).
  - Hourly signals carry their own `prov`: use it.

### 6.3 Engine use

- Engine code is pure TypeScript (no DOM, no network) and runs in the browser on stage. `app/src/engineClient.ts` is the only module that imports it, so swapping the stub for the real engine touches one file.
- **The app-facing interface** is yours to define, with the stub and the real adapter behind it. It needs:
  - per-hour lanes, SCH flags and lane thresholds for a bundle;
  - the default simulated site;
  - `solve(bundle, site, policy) -> Plan`, with `solve_ms` measured inside the engine;
  - a crash call `(plan, site, event, prior?) -> CrashResult`, where `prior` makes it a second call;
  - the same call against the price_only plan (the ghost);
  - the envelope for a fleet size;
  - fleet scaling for the beat 6 slider (linear under the price-taker assumption);
  - the Option 2 shift.
  If the engine does not export one of these, open a `lane:engine` issue. Do not write the math in `app/`.
- **Engine behavior the UI must show faithfully** (see `final_concept.core_algorithms` in the plan):
  - *Lanes.* Clear means price at or under the day's min plus 25% of its range. Jam means at or over max minus 25%. Everything else is shoulder. SCH (our proposal) is the four highest net-load hours plus every jam hour.
  - *Plan.* A 96-step DP over Pulse SoC with the hourly price held for four steps. The host meter stays at or under the ceiling every step. In SCH, Pulse keeps spare power only while Spin is short. Terminal SoC is at least the start.
  - *Policies.* fixed_overnight is "Battery on the off-peak rule": our baseline, never Torus practice. price_only is "Battery-only plan": no Spin reserve, no ceiling. clearlane is the "Simulated Torus-style station on Clearlane".
  - *Crash.* A 1 s simulation with a 19 s ramp (TORUS_PUBLISHED). Spin serves first; Pulse covers any remainder from spare power. Spin refills at min(spin_kw, ceiling minus host load minus planned Pulse charge), about 6 minutes uncapped. A second call inside the refill always wins, Pulse diverts, and `shortfall_kwh` is reported. The re-plan starts from the actual SoC.
  - *Cycles.* 7,500 Pulse cycles over the 25-year Station lifespan is a budget of 300 a year, 0.82 a day. Show the budget from keys.
- **What runs live and what is precomputed.** Live in the browser: the day's solves (on load, before beat 2), the crash, the re-plan and its timing. Precomputed: `numbers.json`, `backtest.json`, `envelope_<day>.json`.
- **Scripted times.** The first call starts at hour 18 of the bundle plus 40 minutes (6:40pm MT), computed from `hours[].ts_utc`, never a typed UTC string. It lasts `duration_s` (330 s, ASSUMPTION) at `requested_kw = enrolled_kw`. The second press uses the offset the engine's pinned second-call test uses (ask engine if unclear; until then the stub's value). Both are SIMULATED and labeled so.
- **The stub** exists only to unblock you. Its numbers render with the stub banner, never in a production build once core 10 lands, and never as a stand-in for a missing `numbers.json` key.

### 6.4 Numbers and provenance

- **Sources of numbers.** Every number on screen is one of: a `numbers.json` entry, shown through `<Num k>` with its `display` string; a live engine field, shown through `<Num value display prov source>`; or a time or date label, shown through `<Time>` (`data-time`). There is nothing else.
- **Formatting is not computing.** `app/src/format.ts` may format and convert units (kW to MW, seconds to minutes). It may not add, average or derive a value. Need a derived value? It is an engine key.
- **Chip text.** REAL, DERIVED, SIMULATED, TORUS PUBLISHED, ASSUMPTION, MEASURED. The text names the class, so color is never the only signal. The tooltip names `source` and `as_of_mt`. Chips are at least 18px at 1920.
- **Classes for live engine fields** without their own `prov`:

| Field | Class |
|---|---|
| plan values, cycles, envelope values | DERIVED |
| anything about the host meter or a call (`meter_kw`, `host_peak_kw`, CrashResult) | SIMULATED |
| `solve_ms` | MEASURED; never cached, stored or hard-coded |

- **States.** Each looks different; none shows 0.
  - **Loading:** a muted placeholder of the same width.
  - **Not computed:** the key or file is absent. Dashed outline, the words "not computed".
  - **Unavailable:** the data is null or the hour is missing. The words "unavailable", plus the reason.
  - **Failed:** a parse or engine error. The words "failed" and the file or function name.
- **Reserved width.** Numbers use `font-variant-numeric: tabular-nums` and a min-width in `ch` sized for the longest expected display, so a value changing never moves its neighbors.
- **Key names.** `numbers.json` is the authority. `docs/FACTS.md` keys are the default names; the in-flight stub uses others (`co2_fixed_t_mw`, `solar_4pm_mw`, `price_min`). Keep the mapping in `app/src/stageKeys.ts` and follow whatever the engine writes.

Keys the beats expect, by their `docs/FACTS.md` names. Where a beat needs a scalar FACTS has no key for (marked "new"), or a FACTS row holds a pair that the stage shows as two numbers, open one engine issue for the whole set. Do not invent the value.

| Beat | Keys |
|---|---|
| 1 | `price_min_oct27`, `peak_price`, `peak_over_trough`, `net_load_climb_mw`, `solar_4pm_to_6pm_mw` (split into 4pm and 6pm), `oct_step_hour_days` (split into 24 and 27), `lane_clear_max_usd`, `lane_jam_min_usd`, `peak_hour_mt` |
| 2 | Reference set only, decided at Train 1 so one card never mixes two plans: `fixed_usd_mw_day`, `clearlane_usd_mw_day`, `race_ratio`, `fixed_70`, `clearlane_70`, `fixed_rule_charge_usd_mwh`, `timetable_charge_usd_mwh`. The animation plays the reference timetable. `clearlane_dp_usd_mw_day` (the engine DP) appears only on the backtest or crash beat, with its own label. Also: `co2_added_70`, `co2_avoided_70`, `mou_70mw`, `host_ceiling_kw`, `pulse_cycle_budget` (per day, new split) |
| 3 | `enrolled_kw`, `call_duration_s`, `rmp_events_2025`, `rmp_event_ramp_s` (split into 19 and 30), `rmp_event_target_pct` (split into 102, 90 and 100), `reserve_cost_pct`, `second_call_shortfall_kw`, `meter_peak_refill_kw` |
| 4 | `pulse_cycle_budget`, `cycles_today`, `replan_ms` (the live value wins on stage) |
| 5 | `share_days_beating`, `clearlane_p10`, `clearlane_p50`, `clearlane_p90`, `calls_answered_pct` (Mountain reading), `backtest_days`, `cycles_per_year_by_policy`, `calls_missed_by_policy`, `sch_hours_today` |
| 6 | `mou_70mw`, `torus_500mw`, `fixed_500`, `clearlane_500`, `campus_usd`, `campus_mwh` |

### 6.5 Time

- **Intervals are identified by their UTC start.** Display is Mountain time, hour beginning. Format with `Intl.DateTimeFormat("en-US", { timeZone: "America/Denver" })` or from `hour_mt`/`local_mt`. Never use the machine's local time zone: CI runs in UTC, and snapshots would differ.
- A Mountain day is the 24 hours from 06:00Z while daylight time lasts (until Nov 1 2026). Interval `i` is hour `floor(i/4)`, minute `(i%4)*15`.
- **The axis caption is "hour beginning, Mountain time".** `docs/plan/plan-v1.html` says "hour ending"; that label is wrong (FACTS `ribbon_hour_label`).
- **Torus's 2025 heatmap is Mountain time.** The image states no time zone, and Torus confirmed the hours are Mountain time (`heatmap_readings`). Any figure derived from it shows the Mountain reading only; the UTC readings are a sensitivity check and are not on screen.

### 6.6 Layout and theme

- **Stage frame.** One 1920x1080 frame in logical px, scaled with `transform: scale(min(vw/1920, vh/1080))` from the top left and letterboxed on `--bg`. Every projector resolution then shows the same composition.
- **Phone.** Below 768px wide, no transform: one column, SVG at 100% width with a `viewBox`, and no sideways scroll at 375px. Hiding overflow is not a fix.
- **Tokens and theme.** Tokens come from `DESIGN.md` only. Dark tokens are the default on `:root`; `prefers-color-scheme: light` applies light; `?theme=dark|light` overrides both, so the stage URL can force dark. No other colors.
- **Type.** System UI stack for text, `ui-monospace` for numbers, no web fonts. At 1920: body text at least 24px; every number a judge must read at least 40px; end-card headline numbers at least 64px; chart strokes at least 3px. Dense tables (the 24-row envelope) and axis ticks sit in `[data-detail]` or `[data-axis]` and need 24px, since the judge reads their shape, not each value.
- **Lanes.** A lane color always comes with its text label: clear `--clear`, shoulder `--shoulder`, jam `--jam`, solar `--solar`. Patterns come in stretch S1-1. `--accent` marks the one primary action and focus rings, nothing else.
- **No resizing.** Every region that changes state is a `[data-slot]` with a fixed size, set at rest: banner, inset, ghost, re-plan line, copy button, end cards, backtest bands. A state change (Solve to Solving, a crash firing, Copied) never resizes its container.

### 6.7 Motion

- **One clock.** The time-lapse and the inset run on one `requestAnimationFrame` clock with an explicit play id. Pause and resume continue from the current position; re-triggering never restarts from zero or queues a second run.
- **Speeds.** The race time-lapse plays 96 intervals in 15 s. The crash inset plays the whole trace in about 8 s and shows the simulated clock, not a speed factor.
- **Transitions.** UI transitions (cards, banner, drawer) stay under 400ms.
- **Reduced motion.** Under `prefers-reduced-motion: reduce`, or `?motion=off`, every playback lands on its end state at once, and nothing is hidden. Never write an end state that is reachable only by playing the animation.

### 6.8 Keys (owned here; a clash is a UI bug)

| Key | Action | Where |
|---|---|---|
| Right, PageDown | next step | all beats |
| Left, PageUp | previous step | all beats |
| 1 to 6 | jump to that beat | all |
| Space | play or pause the time-lapse | beat 2, and after the re-plan |
| C | call at 6:40pm; again during the refill for the second call | beats 2 and 3 |
| E | envelope | beat 5 |
| B | backtest card | beat 5 |
| + / - | fleet slider step (Home and End jump to 70 and 500 MW) | beat 6 |
| R | reset to beat 1 and clear live results | all |
| ? | show or hide the key map overlay | all |
| Esc | close any overlay | all |

- **Reserved for stretch:** T projector theme, D day picker, P proof drawer, F fleet board, I lineage panel.
- **Dropped from the old draft:** T as a time-zone toggle (the heatmap is Mountain time, so there is nothing to toggle), Q plus 1 to 6 Q&A cards (the proof drawer replaces them), and L live tile (snapshot stamp only).
- The key handler ignores keys typed into inputs, except Esc.
- **Presenter remotes are UNVERIFIED.** Many send PageDown and PageUp, and some send B or a period for "blank screen", which would hit B. Ask on #4 for the remote to be tested at the first rehearsal.

### 6.9 Copy and claims on screen

- **One copy file.** Every judge-facing string lives in `app/src/copy.ts`, so Pitch reviews one file. Strings to use as written:
  - "Battery on the off-peak rule"
  - "Simulated Torus-style station on Clearlane"
  - "Battery-only plan"
  - "value to RMP's system at day-ahead prices"
  - "Average-emissions estimate (EIA hourly); marginal emissions can differ."
  - "MOU ceiling, not installed capacity"
  - "Assumes the fleet does not move prices"
  - "System Critical Hours (our proposal)"
  - "In Utah, compute should follow the sun in time, not in space."
  - "Clearlane: fill up when the road is clear, and keep Spin ready for the crash."
- **FACTS.md CONFLICT rows that affect the screen:**
  - `overnight_avg` and `midday_avg` are window means, not what the rules pay. Never label them "charges at". If the race shows a charge price, it needs engine keys for the rules' charge-hour means ($39.53 and $21.55).
  - `crash_call_minutes`: never "six-minute call". Say "a call of about five and a half minutes", from the duration key.
  - `rmp_events_2025`: say "359 events in 2025 (Torus, RMP case study)".
  - `rowe_audience`: say "Torus's June 2026 comments to ROWE", never "Utah regulators".
  - `torus_lifespan_yr`: 25 years is the Station lifespan, not Pulse's.
  - `torus_500mw`: an MOU for up to 500 MW, never installed capacity.
  - `net_load_climb_mw`: render its `display` string as written.
- **Host results stay in kW.** The RMP tariff is unverified, so no demand-charge dollars.
- **Data centers.** No claim about a Torus data-center product; any AI campus is SIMULATED.
- **Torus values and URLs** are never typed into `app/` outside test fixtures; they come from `numbers.json` and `torus_published.json`.

### 6.10 Test hooks (other lanes drive these; keep them stable)

- **URL parameters:**
  - `?beat=1..6` with `&step=start|end`
  - `?day=YYYY-MM-DD`
  - `?ff=name,name`
  - `?theme=dark|light`
  - `?motion=off`
- **Attributes:**
  - `document.body` carries `data-beat`, `data-step` and `data-state` (`loading`, `ready`, `playing`, `paused`, `call`, `replanned`, `failed`).
  - Numbers carry `data-num` and `data-prov`.
  - Time labels carry `data-time`.
  - State regions carry `data-slot="<name>"`.
  - Chart tick labels carry `data-axis`; dense tables carry `data-detail`.
- Renaming any of these breaks Pitch's backup video and Integration's smoke run. Announce a change on #4 first.

### 6.11 Testing notes

- `vitest.config.ts` runs in `node`. Put `// @vitest-environment jsdom` on the first line of DOM tests; `@testing-library/react` and `jsdom` are installed.
- Use `"en-US"` explicitly in every `Intl` call.
- Inject the clock and `matchMedia` into components that read them, so tests control "today" and reduced motion.
- **Snapshots.** Use `toMatchFileSnapshot` under `app/src/__snapshots__/`. Mask MEASURED values and `generated_utc` before comparing.
- **Test fixtures.** Fixture numbers for tests may use only verified values from `docs/FACTS.md` and live under `app/src/test/fixtures/`. The production build never imports them.

## 7. Guardrails

- **Torus:**
  - Stations are "simulated Torus-style"; no Torus logos or branding.
  - Say "not advertised", never "Torus lacks".
  - The off-peak rule is our baseline, never Torus practice.
  - Dollar values are "value to RMP's system at day-ahead prices", never Torus revenue or host savings.
  - 500 MW is the MOU ceiling.
  - Never invent a Torus fact.
- **Data honesty:**
  - Every number has a chip.
  - Both heatmap readings are shown.
  - CO2 carries the average-emissions caveat.
  - Empty, unknown and failed are visibly different, and nothing renders as a confident 0.
- **Copy:**
  - No em dashes; American English; plain words.
  - None of: comprehensive, robust, seamless, leverage, cutting-edge, game-changer.
  - The core 2 copy guard scans `app/src` for these and for "Torus lacks", "six-minute call" and "Utah regulators".
- **Offline:**
  - `DATA_MODE=snapshot` is the default, and nothing on stage needs the network.
  - No CDN, web font, remote image or analytics.
  - The only requests are the page's own same-origin assets.
- **Public repo:**
  - No keys and no copied page text in `app/`. Quotes stay under 15 words and carry a URL.
  - No screenshots or binaries committed; they go to `tools/out/`.
- **Core never depends on stretch.** Stretch code paths sit behind a flag check at their entry point, and core components never import stretch modules.

## 8. When blocked

1. `gh issue edit <n> --add-label status:blocked`
2. `gh issue comment <n> --body "Blocked: need <exact thing> from <lane or Craig>; see #<issue>"`. Open that lane's issue first if none exists.
3. Push what you have to the branch (no PR on red). Take the next unblocked issue in order.
4. When the dependency lands, remove the label (`gh issue edit <n> --remove-label status:blocked`), rebase on `origin/main`, and finish.

Craig is away Tue 11:00am to 1:30pm and 6:00pm to 11:00pm, and asleep about 2am to 7am. Never wait on him; mark the issue blocked and keep moving.

## 9. Status reporting

Post one comment on **Lane: ui status (#4)** at every train and whenever your queue empties:

```
Train <N> (<time> MT)
- Merged: #a, #b
- In flight: #c (PR #d, check green or red)
- Blocked: #e (needs <what> from <lane>)
- Next: #f, #g
- Beats on main: 1 <ok|stub|missing> ... 6 <ok|stub|missing>; projector check <PASS|FAIL|not run>
```

From Train 3 on, at every train and before each rehearsal Integration announces, run the projector check against a build of `origin/main` (with a clean tree: `git fetch origin`, `git switch --detach origin/main`, `npm run build`, `npm run preview` (port 4173), then in a second terminal `node app/scripts/projector-check.mjs http://localhost:4173`) and post its summary. Switch back to your branch afterward. When your queue is empty, say so on #4. Then review other lanes' PRs for anything the stage reads (keys, copy, shapes), with comments only, and support rehearsals. Never take work in another lane's paths.
