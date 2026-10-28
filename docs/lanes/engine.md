# Engine lane brief

You are the **engine lane**: Claude Code (second session), worktree `C:\Users\Craig Cossairt\Code\clearlane-engine`, branch prefix `engine/`. You write the planner the stage runs: lanes and System Critical Hours, the 15-minute DP, the three policies, the crash and re-plan, the envelope, the backtest and `numbers.json`. Every number a judge sees either comes out of your code or passes through your `numbers.json`.

Precedence: `AGENTS.md` and `contracts/types.ts` win over this file. This file wins over the engine `first_prompt` in `docs/plan/synthesis.json`, which predates the current paths and scope `prep/reference/` arrives with data Core 1; until then use `research/analysis/demo-story/`, matching FACTS "Paths". The plan files in `docs/plan/` are superseded (see `docs/plan/README.md`): OpenCode is dropped, there is no Nucleus slide, and this is the Torus bounty only.

Lane done when (from `AGENTS.md`): the pinned Oct 27 numbers pass to the cent; `backtest.json` and `numbers.json` validate; solve times are measured, never typed.

---

## 1. Role and boundaries

**You own** `engine/**` (`engine/src`, `engine/cli`, `engine/test`) and `public/derived/**`.

**You read but never write:** `contracts/`, `research/`, `docs/`, `public/data/`, `prep/`, `api/`, `app/`, `pitch/`, `science/`, `tools/`, `demo/`, `.github/`, `bin/`, harness config, and every root file (`package.json`, `package-lock.json`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, `README.md`, `DESIGN.md`).

**Need something outside your paths?** Comment on your issue, then open an issue for the owner:
- a contract field, a flag in `contracts/flags.ts`, a root npm script, a dependency, a new FACTS row or key rename: `lane:integration`, and say it on #1
- a file in `public/data/` (bundle, hist, `torus_published.json`, RT history, response tables): `lane:data`
- how the stage shows something: `lane:ui`

**Never:**
- merge a PR or push to `main`
- edit `contracts/types.ts` or add a dependency (the engine is plain TypeScript: no solver library, no numpy port)
- use the DOM, the network, `node:` modules, `Math.random`, `Date.now()` or a no-argument `new Date()` in `engine/src` (CLIs in `engine/cli` may use `node:fs` and `node:path`)
- hard-code, cache or write a solve time anywhere
- hand-edit a file in `public/derived/` (only a CLI writes there)
- add a new file to `public/derived/` without naming its CLI command in the PR body: `npm run reproduce` (#32) fails on a derived file no CLI regenerates, and Integration adds the line to `tools/reproduce.mjs`
- put a Torus number on stage from a source constant (stage Torus numbers come from `public/data/torus_published.json`)

**Others depend on you for:**
- `engine/src/index.ts`, the UI's only engine import (section 6.1). UI swaps its stub for it in their core 10, so land the exports early and keep the names stable.
- `public/derived/numbers.json`, `envelope_<day>.json` and `backtest.json`, read by UI, Pitch (every deck number is a key) and Science (independent cross-check).
- The CLIs Integration runs at the Oct 28 refresh (section 6.9).

## 2. Boot sequence

```bash
cd "C:\Users\Craig Cossairt\Code\clearlane-engine"
git fetch origin
git status   # a detached HEAD is normal here; uncommitted work belongs to an open issue, do not discard it
npm ci       # each worktree needs its own node_modules; rerun when package-lock.json changes on origin/main
```

If the worktree is missing: `git -C "C:\Users\Craig Cossairt\Code\clearlane" worktree add --detach ../clearlane-engine origin/main`, then `npm ci`.

Read, in this order:
1. `AGENTS.md`, then this file.
2. `contracts/types.ts`: every shape you produce. Note the sign conventions (section 6.2).
3. `docs/FACTS.md`: the key registry. Read the "Hour conventions", the "Do not say" table, and every row your issue names.
4. `docs/STRETCH.md`: "Feature flags" and the engine rows.
5. `research/TORUS.md` sections 2, 3 and 5 (Spin and Pulse specs, the 2025 event record, the heatmap's missing time zone).
6. `research/DATA-SOURCES.md` section 4 (UTC joins; Mountain hour 0 is the previous CAISO operating day's HE24; May 1 has 23 priced hours).
7. `research/analysis/demo-story/habit.py`, `fix.py` and `numbers.py`: your pins come from these.

Load the queue and the lane channel:

```bash
gh issue list --repo craigcossairt/clearlane --label lane:engine --state open --json number,title,labels,milestone --limit 100
gh issue view <n> --comments
gh issue view 3 --comments      # "Lane: engine status": train notices, CORE RED and CORE GREEN
```

Work in the order of sections 4 and 5 (each body says "Queue: <tier>, position N"), not by issue number. Skip any issue another session has claimed. Claim before you start:

```bash
gh issue comment <n> --body "claimed by Claude Code (engine lane)"
```

## 3. Per-issue loop

1. Claim (above). Read the latest comments on #3 first: a CORE RED notice changes what you take next.
2. Branch from fresh main: `git fetch origin`, then `git switch -c engine/<n>-<slug> origin/main` (slug: two to four words, kebab-case). One issue, one branch, one PR. Stacking exception below.
3. Test first. Write the failing vitest in `engine/test/<topic>.test.ts`, run `npx vitest run engine/test/<topic>.test.ts`, and confirm it fails for the reason you expect, not on an import error.
4. Build until green. Fast loop: `npx vitest run engine/test` and `npx tsc --noEmit -p tsconfig.json`.
5. If the issue adds a safety constraint, run its mutation (section 6.7) before the gate.
6. Gate: `npm run check:all` (tsc, vitest, vite build, prep unittest). Never open a PR on red. If the red comes from another lane's files already on `origin/main`, say so on #1 and in the PR body, naming the failing test.
7. Commit only your paths: `git add engine public/derived`. Plain message: what changed and why.
8. Push: `git push -u origin engine/<n>-<slug>`.
9. Open the PR. Write the body to a temp file outside the repo (your session scratchpad), then:
   ```bash
   gh pr create --repo craigcossairt/clearlane --base main --title "[engine] <issue title>" --body-file <tempfile> --label lane:engine --label status:needs-review
   ```
   Body fields, in order:
   - `Closes #<n>` (plus `Stacked on #<pr>` on the next line when stacked)
   - **What changed:** three to six bullets.
   - **Evidence:** the `npm run check:all` summary lines; the new test names; for every pin, a table of engine value against the reference script's printed value.
   - **Mutations:** per constraint, the diff (5 to 10 lines), the tests you predicted would fail, the tests that did fail, and "reverted".
   - **New numbers:** every value that can reach the stage, with key, unit, class and source. Keys that are not in `docs/FACTS.md` go in a separate list for Integration.
   - **Measured:** median and max solve or re-plan ms over 20 runs on this machine. Never written to a file.
   - **Flag:** stretch PRs only: the flag name and the flag-off test name.
10. `gh issue comment <n> --body "PR #<m> open: <one line>"`, then take the next issue.
11. Reviews. Data (Codex) cross-reviews every engine PR; Pitch (Grok) reviews every PR for claims, guardrails and em dashes. Fix on the same branch, push, reply in the thread. If you disagree with a finding, reply with the reason and the evidence; never resolve a thread silently.

**Stacking (engine only).** The core queue is a chain. When the next issue needs code from your own open engine PR, cut from that branch (`git switch -c engine/<n>-<slug> engine/<parent-branch>`), keep `--base main`, and put `Stacked on #<pr>` in the body. Never stack on another lane's PR. When the parent merges: `git fetch origin`, `git rebase --onto origin/main engine/<parent-branch>`, `npm run check:all`, `git push --force-with-lease`. Keep a stack at most four deep; past that, take an issue that does not need it.

**Trains.** When Integration announces a train on #3, for each open `engine/` branch: `git fetch origin`, `git rebase origin/main` (or `--onto` for a stack), `npm run check:all`, `git push --force-with-lease`. Then post the status comment (section 9).

**Never:** `gh pr merge`, `git push origin main`, `--no-verify`, or a force push to a branch that does not start with `engine/`.

## 4. Core queue (ordered)

Deadlines, Mountain time:
- **Train 1 (Tue 1:45am):** core 1 to 3 (lanes, reference race, DP pinned to `fix.py`).
- **As early as possible:** core 4 to 7 (everything the stage runs live). UI's real-engine swap waits on them.
- **Train 2 (Tue 8:00am, CORE COMPLETE):** all of core.
- **Train 4 (Tue 2:00pm):** formal core checkpoint.

Overnight (2am to 7am) nobody answers questions: mark blocked and move on. Each issue body holds the full checklist; the summary below is the contract.

**Core 1. Inputs, lanes and System Critical Hours.**
- `engine/src/bundle.ts`:
  - interval start times from `hours[].ts_utc` plus 15-minute steps, never from the machine time zone
  - a bundle validator: 24 consecutive hours, finite prices
- `engine/src/lanes.ts`:
  - lane thresholds; lanes for 24 hours
  - System Critical Hours: the 4 highest net-load hours (ties go to the earlier hour) plus every jam hour
  - a price-proxy mode for inputs without net load, labeled as a proxy
- Oct 27 fixture pins:
  - thresholds 29.98 and 47.18
  - clear HB 9-16, jam HB 18-23, shoulder everywhere else (HB 0-8 and 17)
  - top 4 net load HB 19-22; SCH HB 18-23 (6 hours)
- A second synthetic day gives lanes from its own prices.
- `engine/src/index.ts` exists, and a purity test scans `engine/src`.

**Core 2. Reference race, CO2, fleet scale and Option 2 shift.**
- `referenceRace(bundle)` uses the `habit.py` method on a 1 MW / 2 MWh battery with RTE 0.88:
  - off-peak rule: charge HB 1-4, discharge HB 18-19
  - timetable: charge the 3 cheapest hours of HB 9-17, discharge HB 18-19
- Pins on the fixture:
  - values $20.06 and $58.41; timetable hours 13, 14 and 15; ratio 2.911
  - charge means $39.53 and $21.55; discharge mean $55.615
  - CO2 -0.2625 and +0.2698 t/MW-day
  - 70 MW: $1,404.53 and $4,088.37; 500 MW: $10,032.37 and $29,202.67
- `scaleUsdPerDay` is linear (price taker).
- `option2Shift` moves 25 MW x 3 h from HB 18-20 to HB 13-15: 75 MWh, $2,550.75. It also returns `co2_t` (DERIVED, same CO2 profile as the race's charge CO2) for pitch's option-2 card.
- Write `public/derived/site_default.json` (the `defaultSite()` host load and limits). Science's planner cross-check reads it.

**Core 3. Grid DP with an hourly mode that reproduces `fix.py`.**
- `engine/src/dp.ts` is the one DP. `dpHourly` mirrors `fix.py dp_wear` operation for operation.
- Build the hourly test vector directly from `research/data/pace_snapshot_2026-10-27.csv` in snapshot order. Do not rotate the fixture: after Integration Core 1 the fixture's hour 0 is the real Oct 27 value ($30.22), so a rotated fixture no longer equals the snapshot.
- Pins:
  - W=0: $65.79, 3.846 MWh discharged
  - W=10: gross $57.54, objective $38.78, 1.876 MWh discharged, active HB 8, 13, 14, 15, 18 and 19
  - W=15: the same plan as W=10
  - reserve variant: $55.56; reserve cost 3.4%
  - unanswerable call shares: 77/52/43% (price only) and 40/18/14% (wear 10)
  - July and October means through a research CSV test helper

**Core 4. Simulated site and the 15-minute DP: host ceiling, export limit, Spin reserve rule, terminal SoC.**
- `defaultSite()`: "Simulated Utah manufacturer", SIMULATED, sized in section 6.4.
- The 96-step DP on 41 Pulse levels, with grid-side power limits (4 levels up and 5 down per step on this site).
- Constraints:
  - meter at or under the host ceiling
  - meter at or above minus the export limit
  - the SCH spare-power rule
  - terminal SoC at least the start
- Four mutations, one per constraint.

**Core 5. Three policies on the simulated site.**
- `solve(bundle, site, policy, opts)` returns a full `Plan` with `solve_ms` from `performance.now()`.
- fixed_overnight is a direct schedule that fills from empty. It pins to the reference race: $20.06 and -0.2625 t/MW-day.
- price_only: no wear, no ceiling, no Spin.
- clearlane: wear, ceiling, export limit, Spin reserve rule.
- `checkPlan` flags every hand-built bad plan.

**Core 6. Crash: one RMP call at 1-second resolution, the second press and the battery-only ghost.**
- Spin serves first; Pulse covers from spare power; 19 s ramp.
- Spin refills under the host ceiling; the meter stays above the export floor.
- The scripted 6:40pm call on clearlane: delivered 100%, shortfall 0, Spin only.
- The ghost on the price_only plan reports its miss.
- The second call, 180 s after the first ends, reports a shortfall above 0.
- A midday call shows the refill clamp. Mutation: remove the clamp.

**Core 7. Re-plan the rest of the day from the actual state of charge, timed.**
- `crash()` returns a `CrashResult` with `replan`.
- The re-plan solves from the first interval boundary after the call, from the actual Pulse SoC, with the Spin refill as load and the SCH rule fed by real Spin availability.
- The terminal target falls back without throwing.
- `replan.solve_ms` is measured.

**Core 8. Operating envelope export, `clearlane.envelope/v1`.**
- Per hour: reserve, max charge, max discharge, planned kW and a plain-words reason.
- The SCH rule is written in words.
- `engine/cli/envelope.ts` writes `public/derived/envelope_<day>.json`: deterministic, validated, one site by default, `--fleet-kw` to scale.

**Core 9. Event sampler.**
- Seeded Poisson calls at 359/365 a day, with hour and weekday weights from the 2025 heatmap.
- Two readings: Mountain, and UTC (MT hour = label - 6 under MDT).
- The same seed gives the same calls.

**Core 10. Backtest CLI, May 1 to Oct 27.**
- Every Mountain day, all three policies, sampled calls under both readings.
- Clearlane re-plans after each call.
- Reports:
  - P10/P50/P90/mean of $/MW-day and t CO2/MW-day
  - cycles a year; calls unanswerable per reading
  - host-ceiling breaches; share of days beating the off-peak rule
- Missing days are listed, never filled.
- Writes `public/derived/backtest.json` and `public/derived/backtest_days.json` (`BacktestDay[]` in `contracts/types.ts`; one row per day and policy). UI `any-day` and science `backtest-intervals` read it, so it lands here, not in the stretch-2 sensitivity item.
- Fills `calls_unanswerable_pct.heatmap_as_utc_mst` (the UTC-7 reading) next to the Mountain and UTC readings.

**Core 11. Wear price calibrated to 300 Pulse cycles a year.**
- Bisect W over $0 to $60/MWh: the smallest W at which clearlane uses at most 300 full-equivalent cycles a year.
- Evaluate W=10 first and report its cycles.
- The calibrated W goes into `backtest.json` and numbers.

**Core 12. `numbers.json` writer for every stage number.**
- `engine/cli/numbers.ts` writes `StageNumber[]` under the FACTS keys, with the rules in section 6.5.
- Validated against the FACTS key list plus a new-key list for Integration.
- The full stage-key list is in this issue's body (Integration, Train 1). It includes `fixed_rule_charge_usd_mwh` ($39.53) and `timetable_charge_usd_mwh` ($21.55), the two rules' charge-hour means, and `peak_hour_mt` and `trough_hour_mt`.
- Deterministic, with no MEASURED values.

**Core 13. Regenerate `public/derived` on real data and prove Oct 28 readiness.**
- Rerun every CLI on the data lane's real bundle, hist and Torus files, and commit the outputs.
- A synthetic Oct 28 bundle goes through the refresh commands with zero code change.
- Post the exact refresh commands on #1.

## 5. Stretch queue (behind flags)

**When to start.** Stretch-1 starts only when all your core issues are merged and Integration has posted CORE GREEN on #3. Stretch-2 starts when your stretch-1 items are merged or cut. Moonshots go after stretch-2, start only after the QUEUE line on #3 says MOONSHOT OPEN, and must be merged by Train 6 or they are cut. Deadlines: stretch-1 by **Train 5 (Tue 5:30pm)**, stretch-2 and moonshots by **Train 6 (Tue 11:30pm, feature freeze)**.

**Every stretch PR carries:**
- its `ff_*` flag (Integration registers it in `contracts/flags.ts` by Train 3, default off)
- a flag-off test proving the pinned numbers, `numbers.json` and the core CLI outputs are byte-identical with the flag off
- provenance on every new number
- Pitch's guardrail review

Engine code may land without a runtime switch when nothing in the six beats calls it. New output files go in `public/derived/` and are written only when the CLI runs with the flag.

**A red core stops stretch work.** When Integration posts CORE RED on #3, stop stretch commits, leave stretch PRs open, and take core fixes until CORE GREEN. A stretch PR that turned a core test red is reverted, not fixed forward.

| # | Issue | Flag | Waits on | Done when (summary) |
|---|---|---|---|---|
| S1-1 | Crash anywhere | `ff_crash_anywhere` | core 7 | a call at each of 96 intervals, clearlane and ghost; clearlane never short and never over the ceiling; midnight-crossing refill reported; `crashAt(plan, interval)` exported; any clearlane shortfall becomes a core issue |
| S1-2 | Spin refill source | `ff_spin_refill_source` | core 7; `refill_source` on CrashResult (Integration, Train 1 freeze) | grid or pulse refill; grid never lifts the meter over the ceiling; pulse debits Pulse SoC at an ASSUMPTION efficiency; both refill within 12 minutes uncapped |
| S1-3 | Fleet roll-up | `ff_fleet` | core 8; envelope schema (Train 3). Define `FleetResult` locally in `engine/src/fleet.ts` and name it in the PR body; Integration copies it into contracts after the merge | N seeded SIMULATED sites (3 and 24), 30 kW to 1.2 MW, 3 archetypes; the fleet envelope is the sum of the site envelopes; byte-identical by seed; `fleet_<day>.json` |
| S1-4 | Fleet call | `ff_fleet_call` | S1-3. Define `FleetCallResult` locally in `engine/src/fleet.ts`, as for S1-3 | allocate a fleet request by `spare_kw`, refill-window sites last; 90% when covered; honest shortfall; "our rule" |
| S2-1 | Call ledger | `ff_call_ledger` | core 9, core 6 | exactly 359 calls per reading matching the heatmap arrays; per-call rows and summary; byte-identical by seed; stress-replay density stated |
| S2-2 | Sensitivity | `ff_sensitivity` | core 11 | reads core 10's `backtest_days.json`; one-at-a-time ranges; break-even RTE and spread; RTE x spread grid; base case equals `backtest.json` |
| S2-3 | Wear rainflow | `ff_wear_rainflow` | core 10 | rainflow, Miner damage at k 1.0, 1.5 and 2.0, dwell above 80%, a life estimate with an ASSUMPTION chip; DP variant equals linear wear at k = 1 |
| S2-4 | Host frontier | `ff_host_frontier` | S1-3 | Oct 1-27 month-to-date ratchet; evening block 0 to `pulse_kw` in 10 steps; break point; kW only |
| M-1 | RT replay | `ff_rt_replay` | core 7, core 10; data's rt-history | DA plus RT settlement; hold, re-plan and foresight policies; regret per day; measured re-plan times |
| M-2 | Price impact | `ff_price_impact` | core 3, core 12; data's response-tables | optional price slope in the DP; `scale_curve.json` for 70, 140, 250 and 500 MW; slope 0 reproduces the price-taker numbers to the cent |

The full done-when for each is in its issue body and in `docs/STRETCH.md`. Capacity: at most 4 stretch-1, 4 stretch-2 and 3 moonshots per lane.

## 6. Domain notes

### 6.1 Public API (`engine/src/index.ts`)

Grow this export list issue by issue. Do not rename a published export; add a new one and comment on #4 (UI) when you do.

| Export | Returns | Core | Used by |
|---|---|---|---|
| `lanes(bundle)`, `laneThresholds(prices)` | `Lane[]` (24), `{ clear_max_usd, jam_min_usd }` | 1 | beat 1 |
| `systemCriticalHours(bundle)` | Mountain hours, ascending | 1 | beats 1, 5 |
| `referenceRace(bundle)`, `scaleUsdPerDay(usdPerMwDay, fleetMw)` | race values; $/day | 2 | numbers CLI, beat 6 |
| `option2Shift(bundle, opts?)` | `{ from_hb, to_hb, mwh, usd, co2_t }` | 2 | close card |
| `defaultSite()` | `Site` | 4 | everything |
| `solve(bundle, site, policy, opts?)` | `Plan` (live, `solve_ms` measured) | 5 | beat 2 |
| `checkPlan(plan, site)` | violation strings, empty when clean | 5 | tests |
| `scriptedCalls(bundle, site)` | `[first, second]: CrashEvent[]` | 6 | beat 3 |
| `crash(plan, site, bundle, event, prior?)` | `CrashResult` with `replan` | 7 | beats 3, 4 (ghost: pass the price_only plan) |
| `buildEnvelope(plan, site, bundle, opts)`, `validateEnvelope(x)` | `Envelope`; errors | 8 | beat 5, CLI |
| `sampleCalls(days, opts)` | `CrashEvent[]` | 9 | backtest |
| `validateBacktest(x)`, `validateNumbers(x, keys)` | errors | 10, 12 | CLIs, tests |

`opts.wear_usd_mwh` on `solve` defaults to 10 (research start, ASSUMPTION) until core 11. After that the stage passes the `wear_usd_mwh` key from `numbers.json`, so the live solve matches the stored number to the cent. Every `Plan` records the W it used.

### 6.2 Conventions

- **Time.**
  - Intervals are identified by their UTC start. Interval `i` covers hour `floor(i/4)` of the bundle, minute `(i % 4) * 15`.
  - A Mountain day starts at 06:00Z through Oct 31 2026 (MDT, UTC-6); the whole backtest window is MDT.
  - Take times from `hours[].ts_utc`, never from the machine time zone (CI runs in UTC).
  - Use `"en-US"` in every `Intl` call.
- **Hour labels.** Hour beginning (HB) everywhere. EIA CO2 is published by hour ending; the bundle's `co2_g_kwh` is already shifted to hour beginning, the same as `habit.py`'s `ci[h] = he[h + 1]`.
- **The `fix.py` vector.**
  - `research/data/pace_snapshot_2026-10-27.csv` runs HB 1 of Oct 27 to HB 0 of Oct 28.
  - `fix.py` and `numbers.py` solve over that order. Hourly-mode pins read that vector straight from the CSV; never rotate the fixture to get it.
  - Everything 15-minute uses the Mountain day, HB 0 to 23.
- **Hour 0.** After Integration Core 1, the fixture's hour 0 is the real Oct 27 value, 30.21857 ($30.22, CAISO OPR_DT Oct 26 HE 24; see `bundle.notes`). It used to borrow Oct 28's $46.11. Both are shoulder. The race never touches hour 0, so its pins hold on both.
- **Signs.**
  - `pulse_kw` and `spin_kw` are + for charging or recharging and - for discharging, at the meter.
  - `meter_kw = host + pulse_kw + spin_kw`.
  - Grid export (a negative Pulse meter contribution) earns `price x MWh`.
  - `co2_avoided_kg` is + when avoided: discharged MWh x g/kWh minus charged MWh x g/kWh.
- **Units.**
  - `value_usd_per_mw_day = value_usd / (pulse_kw / 1000)`; `value_usd` is gross of wear, and wear is reported separately.
  - Full-equivalent cycles = grid-side discharged kWh / `pulse_kwh`. This matches `fix.py`: 1.876 MWh per MW is 0.94 cycles.
  - Wear is charged per grid-side discharged MWh.
- **Determinism.**
  - CLI output is byte-identical for the same inputs: stable key order, arrays sorted where order is not meaningful, LF line endings, a trailing newline, and `generated_utc` taken from `--now` when it is given.
  - Seeded PRNG only (a small pure-TS generator such as mulberry32).

### 6.3 Pins (Oct 27; to the cent unless stated)

All reproduced by running the scripts on Oct 27 MT (see `docs/FACTS.md` C1 and C3). The `fix.py` and `numbers.py` runs need the M1 mirror in FACTS, because they look for `<R>/oasis/`.

| What | Value | Reference |
|---|---|---|
| Lane thresholds | clear at or under $29.98, jam at or over $47.18 | FACTS `lane_clear_max_usd`, `lane_jam_min_usd` |
| Lanes | clear HB 9-16; jam HB 18-23; shoulder HB 0-8 and 17 | `lane_hours_oct27` |
| Top 4 net load; SCH | HB 19, 20, 21, 22; SCH HB 18-23 (6 h) | fixture `net_load_mw` |
| Off-peak rule | $20.064746/MW-day; charge mean $39.53; CO2 -0.262493 t/MW-day | `habit.py` |
| Timetable | $58.405341/MW-day at HB 13-15; charge mean $21.55; CO2 +0.269798 t | `habit.py` |
| Discharge mean (both) | $55.615 (HB 18-19) | `habit.py` |
| Ratio; 70 MW; 500 MW | 2.911; $1,404.53 and $4,088.37; $10,032.37 and $29,202.67 | `habit.py` |
| CO2 at 70 MW | rule adds 18.37 t; timetable avoids 18.89 t | `habit.py` |
| Option 2 shift | HB 18, 19, 20 to HB 13, 14, 15; 75 MWh; $2,550.75 | `numbers.py` (window = snapshot index 8-16 = HB 9-17) |
| Hourly DP, W=0 | value $65.791609; discharged 3.846141 MWh | `fix.py` |
| Hourly DP, W=10 | gross $57.537074; objective $38.775411; discharged 1.876166 MWh; active HB 8, 13, 14, 15, 18, 19 | `fix.py` |
| Hourly DP, W=15 | same plan as W=10 | `fix.py` |
| Reserve variant (soc_min 0.1, dis_cap 0.75, W=10) | gross $55.558700; reserve cost 3.4384% | `fix.py` |
| Unanswerable hours, W=0 | HB 0, 1, 2, 3, 8, 9, 10, 11, 12, 13, 19, 20, 21, 22, 23: 276, 186, 156 of 359 (77%, 52%, 43%) | `fix.py` crash rule |
| Unanswerable hours, W=10 | HB 8-13: 142, 65, 51 of 359 (40%, 18%, 14%) | `fix.py` |
| Multi-day means (hourly) | wear 10: July $48.52, Oct $39.71. Price only: July $51.74, Oct $48.68 | `fix.py`, `numbers.py` on `research/data/oasis/dam_jul`, `dam_oct` |

Do not use `numbers.py`'s crash section (72/55/52%): it has an index bug (FACTS `numbers_py_crash_bug`). If an engine value disagrees with a pin, the engine is wrong until proven otherwise. Never edit a pin to match; report on #3.

### 6.4 Model

- **Site** (`engine/src/site.ts`, all SIMULATED unless marked):
  - Label "Simulated Utah manufacturer".
  - Station: Spin 250 kW / 25 kWh, Pulse 250 kW / 500 kWh, enrolled 250 kW, RTE 0.88 (ASSUMPTION, `ref_station`), 300 cycles a year, `spin_recharge_min` 6, `export_limit_kw` 0 (ASSUMPTION; Torus question 6), `demand_charge_usd_kw_month` null.
  - Host shape: tune it, but keep three properties, each pinned by a test:
    1. the ceiling binds on at least one clear-lane interval on Oct 27;
    2. host load is at least `pulse_kw + enrolled_kw` through HB 17-20, so the zero-export default never binds during the scripted call;
    3. host load is at or under `host_ceiling_kw` in every interval.
  - Starting point: about 300 kW overnight, about 550 to 650 kW through the morning, a peak of 800 kW at HB 14-15, about 600 kW second shift to HB 20, back to about 300 kW by HB 23.
  - `host_ceiling_kw` is the month-to-date 15-minute peak, here today's maximum.
  - Torus-derived model inputs (19 s ramp, 10C Spin, 0.5C Pulse, 6-minute recharge, 7,500 cycles over the 25-year Station life) live in one module, each with its FACTS key in a comment. A test cross-checks them against `public/data/torus_published.json` once it lands.
- **DP** (`engine/src/dp.ts`), one solver for both modes:
  - **Levels.** `levels + 1` SoC levels, `dz = capacity / levels`; 40 levels gives 41 states.
  - **Backward pass.** For each state `j`, try every next state `k` ascending and keep the strictly greater value (the same tie-break as `fix.py`).
  - **Charge.** `d = L[k] - L[j] > 0`; `grid = -d / eta`; feasible if `-grid` is at most the step's charge limit.
  - **Discharge.** `grid = -d * eta`; feasible if `grid` is at most the step's discharge limit.
  - **Reward.** `price * grid - W * max(grid, 0)` (in the 15-minute mode, scaled to MWh and the step length).
  - **Bounds.** States below `soc_min` are infeasible. Terminal value is 0 at or above the end level, minus infinity below it. Then a forward trace from the start level.
  - Keep `fix.py`'s operation order (`L[i] = i * dz`, the `1e-9` tolerances) so ties break the same way.
  - Hourly mode: P = 1 MW, E = 2 MWh, 40 levels, `soc0 = soc_end = 0.1` MWh, `eta = sqrt(0.88)`.
  - 15-minute mode: 96 steps with each hourly price held for four steps. 40 levels of 12.5 kWh. Power limits apply at the meter, which gives 4 levels up and 5 down per step on this site.
- **15-minute limits, per interval `t`:**
  - charge grid kW at most `min(pulse_kw, ceiling - host[t] - other_load[t])`;
  - discharge grid kW at most `min(pulse_kw, host[t] + other_load[t] + export_limit, sch_cap[t])`;
  - in SCH intervals, `sch_cap = pulse_kw - max(0, enrolled_kw - spin_avail_kw[t])`, where `spin_avail_kw = min(spin_kw, spin_soc_kwh * 3600 / duration_s)`;
  - `other_load` is the Spin refill (0 day-ahead, because Spin starts full);
  - terminal SoC at least the start level.
- **Policies:**
  - **fixed_overnight** ("Battery on the off-peak rule"; our baseline, never Torus practice):
    - no DP and no Spin
    - starts at 0 kWh, charges evenly over HB 1-4 to full, discharges evenly over HB 18-19 to 0
    - this mirrors `habit.py`'s full swing, so its $/MW-day and CO2 equal the reference race
  - **price_only** ("Battery-only plan"): DP with W = 0, no host ceiling, no SCH rule, no Spin. It keeps the export limit.
  - **clearlane** ("Simulated Torus-style station on Clearlane"): DP with wear W, the host ceiling, the export limit, the SCH rule, and Spin full on standby.
  - DP policies start and must end at or above level 2 (25 kWh, 5%), mirroring `fix.py`'s 0.1 of 2 MWh (ASSUMPTION). A nonzero start is what makes the terminal-SoC mutation detectable.
  - `spare_kw = min(spin_avail_kw + (pulse_kw - |pulse_kw planned|), meter_kw + export_limit_kw)`.
- **Crash** (`engine/src/crash.ts`), 1 s steps from call start until Spin is full again:
  - Target kW = `requested_kw * min(1, t / 19)` (19 s ramp, TORUS_PUBLISHED). The trace's `requested_kw` is this target, so a fully served call is 100% and has zero shortfall.
  - Spin serves first, limited by `spin_kw` and its energy. Pulse covers any remainder from spare power, `pulse_kw - |planned|`, limited by its SoC. Total served is capped so the meter stays at or above `-export_limit_kw`.
  - After the call, Spin refills at `min(spin_kw, ceiling - host - planned Pulse charge)`, never below 0. That is 6 minutes from empty when uncapped. Spin losses are not modeled (ASSUMPTION).
  - `delivered_pct = served kWh / target kWh * 100`; `shortfall_kwh = target - served`; `meter_peak_during_refill_kw` is the maximum meter from call end until Spin is full.
  - Defaults: `duration_s` 330 (ASSUMPTION; FACTS `call_duration_s` notes 340 s would match the chart better); `requested_kw = enrolled_kw`.
  - The scripted first call starts at hour 18 plus 40 minutes, from `ts_utc`.
  - The second press starts `SECOND_CALL_OFFSET_S = 180` s after the first call ends, inside the refill window (SIMULATED), and a second call always wins.
  - If the Oct 27 stage plan shows no second-call shortfall at 180 s, lower the offset (never below 30 s), and say so on #3 and #4. Never change the plan to make a shortfall.
- **Re-plan:**
  - Starts at the first interval boundary at or after the last call's end. Intervals before it are copied as executed, with the actual SoC.
  - The start SoC is the actual Pulse SoC floored to a grid level. Spin availability per interval comes from the refill trace, and the refill power is `other_load`.
  - The terminal target is the original start level if reachable; otherwise the highest reachable level, with the deficit reported. Never throw.
  - `value_usd` is over all 96 intervals; `replan.solve_ms` times only the re-solve.
- **Envelope** (`engine/src/envelope.ts`), per hour `h`:
  - `reserve_kw`: the minimum over the hour's intervals of `spin_avail_kw`, plus the Pulse spare held by the SCH rule in SCH hours
  - `max_charge_kw` and `max_discharge_kw`: the minimum over the hour's intervals of the plan's limits
  - `planned_kw`: the mean of planned `pulse_kw`
  - `reason`: plain words, such as "System Critical Hour (our proposal): Spin holds 250 kW" or "clear lane: charging, host ceiling limits charge to 120 kW"
  - `sch_rule`: "System Critical Hours (our proposal): the 4 highest net-load hours of the day plus every jam hour. In these hours Pulse keeps enough spare power to cover any part of the enrolled kW that Spin cannot."
  - Fleet scaling multiplies every kW by `fleet_kw / pulse_kw`.
- **Event sampler:**
  - Daily count ~ Poisson(359/365 x weekday weight / mean weekday weight); hour from `rmp_heatmap_by_hour`; minute uniform 0-59. All SIMULATED.
  - UTC reading: the weight for MT hour `h` is `by_hour[(h + 6) % 24]`. Weekday weights apply to the Mountain day (ASSUMPTION).
  - The arrays come from `torus_published.json`, or the test fixture until it lands. Fixed seed, written into `backtest.json`.
- **Backtest:**
  - **Days.** Every Mountain day May 1 to Oct 27. A day that is absent, has a non-finite price or has fewer than 24 hours goes in `missing_days`; May 1 is one.
  - **SCH.** HistDay has no net load, so the backtest's SCH is the price proxy (jam hours plus the 4 highest-price hours), labeled so.
  - **Calls.** Clearlane answers each day's sampled calls in time order, re-planning after each. Baselines meet each call against their day-ahead plan (generous to them).
  - **Unanswerable** means delivered below 90%, the floor of Torus's published band.
  - **Statistics.** Percentiles by linear interpolation (numpy's default). Cycles a year = mean daily cycles x 365.
  - **Breaches** count 15-minute intervals with the meter over the ceiling.
  - **Beating the rule** means a strictly higher value than fixed_overnight that day.
  - **CO2.** A day with any null CO2 in an hour it trades is left out of the CO2 statistics; print the count.
  - **Wear.** Bisect on clearlane cycles a year over the backtest; tolerance $0.01/MWh.

### 6.5 `numbers.json` rules

- `StageNumber[]`, sorted by key. Keys are FACTS keys exactly (FACTS is the registry). A multi-valued row splits with suffixes (`_mt`, `_utc_mdt`, `_utc_mst`, `_<policy>`, `_4pm`, `_6pm`, `_n`).
- Every key is either in `docs/FACTS.md` or in `engine/src/newKeys.ts`. A test parses the FACTS key column. New keys go in the PR body for Integration to add to FACTS.
- Where a FACTS row gives a display string ("2.6x", "3,655"), use it. Otherwise format with `en-US` grouping. There is no U+2014 or U+2013 in any display; ranges use "to".
- `prov` is the class in FACTS. `source` is the repo path of the producing module plus its input file, or the URL from `torus_published.json`. `as_of_mt` is the stage day for day-level keys, the window end for backtest keys, and 2026-10-27 for the `fix.py` reproductions.
- Never stored: MEASURED values (`solve_ms`, `replan_ms`), fixture-sourced Torus values, values from the stub.
- If an input file is missing, omit its keys, print which ones, and exit 0. A missing bundle exits 2.

### 6.6 Files you read

| File | Shape | When |
|---|---|---|
| `contracts/fixtures/bundle_2026-10-27.json` | `Bundle` | now; tests forever |
| `public/data/bundle_<day>.json` | `Bundle` | when data lands it (Train 1 target) |
| `public/data/hist_2026-05-01_2026-10-27.json` | `HistDay[]` | when data lands it; until then, tests use the research CSV helper |
| `public/data/torus_published.json` | `TorusPublished` | when data lands it; until then `engine/test/fixtures/torus_published.fixture.json`, built from FACTS values and URLs (write "UNVERIFIED" where FACTS has no URL), tests only |
| `research/data/pace_snapshot_2026-10-27.csv`, `research/data/oasis/dam_jul`, `dam_oct`, `research/analysis/option2/oct` | CSV | pinned tests (OASIS columns: `INTERVALSTARTTIME_GMT`, `NODE`, `LMP_TYPE`, `MW`; keep `NODE = ELAP_PACE-APND`, `LMP_TYPE = LMP`; Mountain = GMT - 6 h; keep days with 24 hours, as `numbers.py load_dam` does) |

Never read `../clearlane-raw/` from engine code or tests: CI does not have it.

### 6.7 Mutations (one per safety constraint)

The constraints are: host ceiling, export floor, SCH spare rule, terminal SoC (core 4), and the Spin refill ceiling clamp (core 6). For each:
1. Write the names of the tests you expect to fail.
2. Apply the smallest source change that removes the constraint, and print the diff.
3. Run `npx vitest run engine/test`.
4. Compare predicted with observed. Chase any extra or missing red before continuing.
5. Revert, and rerun green.

Paste all of it in the PR. A constraint whose removal turns nothing red needs a new test, not a shrug. `checkPlan` tests on hand-built bad plans are permanent; the source mutations are not committed.

### 6.8 Performance

- Target: a 15-minute solve under 50 ms on this laptop, and a backtest plus calibration under 2 minutes. Measure, do not assume.
- If a target is missed, report it on #3 with the measurement before optimizing.
- Never trade correctness for speed: the pins must still pass.

### 6.9 Oct 28 refresh

At about 9:16pm Tue, Integration regenerates data and reruns your CLIs on `bundle_2026-10-28.json` (hard stop 10:30pm). The backtest window ends Oct 27, so `backtest.json` does not change. The refresh runs exactly this list:

```bash
python -I prep/refresh_tonight.py --day 2026-10-28 --poll-until 22:00
npx tsx engine/cli/numbers.ts public/data/bundle_2026-10-28.json
npx tsx engine/cli/envelope.ts public/data/bundle_2026-10-28.json
npm run check:all
```
This is the one refresh command list. It is copied verbatim in `docs/lanes/data.md` Core 7, `docs/lanes/engine.md` section 6.9 and `docs/lanes/integration.md` section 6.5; change all three together. CO2 comes from the committed extract; nothing fetches EIA at night.

 Core 13 proves this on a synthetic Oct 28 bundle and posts the exact commands on #1. Date-bearing FACTS keys (`price_min_oct27` and similar) keep their names until Integration renames them in FACTS; `as_of_mt` carries the real day.

## 7. Guardrails

- **Torus.**
  - Stations are "simulated Torus-style".
  - Say "not advertised", never "Torus lacks".
  - The off-peak rule is our baseline, never Torus practice.
  - Dollar values are "value to RMP's system at day-ahead prices", never Torus revenue or host savings.
  - 500 MW is the MOU ceiling, not installed capacity.
  - Never invent a Torus fact; an engine assumption is labeled ASSUMPTION.
- **Honesty in outputs.**
  - Every stage number has a class.
  - Both heatmap readings always ship together.
  - CO2 is an average-emissions estimate (EIA hourly); say so in `source` or the PR.
  - The ghost's misses and the second call's shortfall are reported, never asserted away.
  - Missing days are listed, never filled. Null means unavailable, never 0.
- **Host results stay in kW.** The RMP tariff is unverified, so no demand-charge dollars.
- **Measured means measured.** `performance.now()` around the solve; never a literal. A test greps `engine/src` for a numeric literal assigned to `solve_ms`.
- **Copy.** Judge-facing strings you write (`reason`, `sch_rule`, `display`): no em dashes, American English, plain words, none of comprehensive, robust, seamless, leverage, cutting-edge, game-changer. A test scans `engine/src` and `public/derived` for U+2014.
- **Public repo.** No keys, no `.env`, no copied page text (quotes under 15 words with a URL), nothing from `../clearlane-raw/`.
- **Core never depends on stretch.** Stretch code sits behind its flag at the entry point, and core modules never import stretch modules.

## 8. When blocked

1. `gh issue edit <n> --add-label status:blocked`
2. `gh issue comment <n> --body "Blocked: need <exact thing> from <lane or Craig>; see #<issue>"`. Open that lane's issue first if none exists.
3. Push what you have to the branch (no PR on red), then take the next unblocked issue in order.
4. When the dependency lands, remove the label (`gh issue edit <n> --remove-label status:blocked`), rebase on `origin/main`, and finish.

Data not landed yet is rarely a block: build on the fixture and the research CSV helper, and leave the real-file run to core 13. Craig is away Tue 11:00am to 1:30pm and 6:00pm to 11:00pm, and asleep about 2am to 7am. Never wait on him.

## 9. Status reporting

Post one comment on **Lane: engine status (#3)** at every train and whenever your queue empties:

```
Train <N> (<time> MT)
- Merged: #a, #b
- In flight: #c (PR #d, check green|red, stacked on #e)
- Blocked: #f (needs <what> from <lane>)
- Next: #g, #h
- Pins: race <ok|red>, fix.py <ok|red>, site fixed $20.06 <ok|red>
- Outputs on main: numbers.json <ok|missing>, envelope <ok|missing>, backtest.json <ok|missing>
- Measured: solve <median> ms, re-plan <median> ms (this laptop)
```

When your queue is empty, say so on #3. Then review other lanes' PRs that read your outputs (keys, shapes, numbers), with comments only, and help Science's cross-check. Never take work in another lane's paths.
