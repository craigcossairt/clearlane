# Stretch plan

Everything beyond the six core beats, ranked, with hard deadlines. Built Oct 26, 2026 (Mountain time) from 36 proposals by three review lenses (the Torus judge, technical depth, and the stage), merged and sorted by the integrator. Read it with `docs/JUDGING.md` (what we think the panel scores) and `docs/plan/synthesis.json` (the core).

Craig's call is to be ambitious: plans tend to overestimate agent build time, so every lane carries a full stretch queue. The price of that ambition is one rule that never bends: **the six core beats never depend on stretch work, and a red core stops all stretch work.**

## How the tiers work

### Deadlines

All times are Mountain. "Merged" means merged to `main` by Integration, green on `npm run check:all`.

| Tier | A lane starts it when | Hard deadline | If it misses |
|---|---|---|---|
| Core | Now | Train 2, Tue 8:00am (CORE COMPLETE target); Train 4, Tue 2:00pm, is the formal core checkpoint | Everything else waits |
| Stretch-1 | Its own core issues are merged and Integration has posted CORE GREEN. A long unattended fetch that touches no core path may start once the lane's core PRs are open and green. | **Train 5, Tue 5:30pm** | Integration either moves it to the end of the lane's stretch-2 queue (it then uses one of that lane's 4 stretch-2 slots) or cuts it |
| Stretch-2 | Its lane's stretch-1 items are merged or cut (this can be well before Train 5) | **Train 6, Tue 11:30pm, feature freeze** | Cut from `v1-stage`. The branch stays for after judging. |
| Moonshot | Every lane's stretch-2 items are merged or cut, and Integration has posted MOONSHOT OPEN | Train 6 for anything the stage build reads (`app/`, `engine/src`, `public/derived`). Off-stage moonshots (scripts, CI, notes) by Train 7, Wed 10:00am, and only if Craig says yes at the 7:00am read. | Cut. Wed is fixes and copy only. |

- **Capacity.** At most 4 stretch-1, 4 stretch-2 and 3 moonshot items per lane. A lane that runs out of queue reviews other lanes' PRs and supports rehearsal; it never takes work in another lane's paths.
- **Hours** in the tables are agent-hours from the proposals. Treat them as a ceiling, not a forecast: the deadline is the contract.
- **While Craig is away** (Tue 11:00am-1:30pm and 6:00pm-11:00pm), lanes keep working their queues and Integration keeps merging green PRs, remote-controlled from his phone.

### A red core stops all stretch work

At every train Integration runs the core gate: `npm run check:all` green on `main`, every pinned-number test, and the six-beat smoke run offline at 1920x1080 with every flag off. If any core beat is red:

1. Integration posts **CORE RED** on every lane's pinned tracking issue, naming the beat and the failing check.
2. Every lane stops stretch commits at once. Open stretch PRs stay open and unmerged.
3. Every lane takes core fix issues (its own, or reviews and tests for the owning lane) until Integration posts **CORE GREEN**.
4. A stretch PR that turned a core test red is reverted, not fixed forward.

Train 4 (Tue 2:00pm) is the formal checkpoint: if any beat is not solid there, the whole build fixes core before any stretch work resumes.

### Feature flags

- **Two kinds.**
  - `ff_*` stage flags: registered by Integration in `contracts/flags.ts`, default **off**. The app reads them through one helper in `app/`. `?ff=any_day,crash_anywhere` turns flags on for rehearsal and on the judge URL.
  - `off_*` off-stage switches: scripts, CI jobs, notes and data files the stage build never imports. Their "flag" is that nothing in the six beats reads them.
- **Engine and data code** may land on `main` without a runtime switch when nothing in the six beats calls it; the `ff_*` flag gates what the app reads or shows.
- **Every stretch PR carries:** its flag; a flag-off test proving the six-beat DOM snapshots and every pinned number are unchanged with all `ff_*` off; a provenance chip on every new number; and Grok's review for overclaims, guardrails and em dashes.
- **Turning a flag on for the stage** is Craig's decision at Train 6, after a flags-on rehearsal. A flag ships on only if it passed that rehearsal and adds no seconds to the 2:45. Everything else stays off on stage and is used in Q&A (the proof drawer) or on the judge URL. Candidates, not decisions: `ff_projector`, `ff_crash_anywhere`, `ff_any_day`, `ff_lineage`, `ff_proof_drawer`, `ff_fleet`, `ff_public_url`, and `ff_freeway` only if beat 1 stays inside 25 seconds.

### Keys

The UI lane owns the key map; a clash is a UI bug. Core keys stay as the demo script has them (C crash, E envelope, B backtest). Stretch keys: **P** proof drawer, **T** projector theme, **F** fleet board, **D** day picker, **I** lineage panel on the focused chip, **Esc** closes any overlay. A second key for the crash is mapped for a presenter remote once rehearsal shows which keys the remote sends (UNVERIFIED).

### Contracts, refresh and guardrails

- **Contracts** freeze at Train 1. After that only Integration changes `contracts/`, additively, with optional fields, so v1 consumers still validate. The list Integration owes the lanes is at the end of this file.
- **Oct 28 refresh.** At about 9:16pm Tue, Integration's refresh runs every engine CLI on `main`, stretch CLIs included. A stretch file that merges later is regenerated before Train 6 or shows its own operating day.
- **Guardrails apply to every stretch item:** stations are "simulated Torus-style", no Torus logos; say "not advertised", never "Torus lacks"; the fixed overnight schedule is our off-peak baseline, never Torus practice; value is to RMP's system at day-ahead prices, never Torus revenue; CO2 is an average-emissions estimate with a caveat unless a card says marginal and shows its interval; the 2025 heatmap shows the Mountain reading, as Torus confirmed (`heatmap_readings`), with UTC as a sensitivity check only; 500 MW is the MOU ceiling, not installed capacity; host results stay in kW until the RMP tariff is verified; no copied page text (quotes under 15 words with a URL); no keys in git.

## Stretch-1: merged by Train 5, Tue 5:30pm

| id | title | lane | flag | done when | hours |
|---|---|---|---|---|---|
| `crash-anywhere` | Crash anywhere: one RMP call swept across all 96 intervals | engine | `ff_crash_anywhere` | An engine test fires one call at each of the 96 intervals for the clearlane plan and the battery-only ghost. No start throws. For clearlane every CrashResult has `shortfall_kwh = 0` and `meter_peak_during_refill_kw <= host_ceiling_kw`; `spin_full_again_utc` is reported when the refill crosses midnight; the ghost's misses are reported, not asserted away. A mutation that removes the host-ceiling clamp on Spin refill fails the sweep, and the PR prints the mutation diff. The engine exports `crashAt(plan, interval)` for the UI. Any interval where clearlane falls short is filed as a `tier:core` engine issue. | 1 |
| `spin-refill-source` | Spin refill source: from the grid under the host ceiling, or from Pulse | engine | `ff_spin_refill_source` | The crash accepts `refill_source` grid or pulse (default grid). Vitest: grid mode never lifts `meter_kw` above `host_ceiling_kw` during refill; pulse mode leaves the meter untouched by the refill and debits Pulse SoC by the refilled energy divided by an ASSUMPTION transfer efficiency; the re-plan starts from the lower Pulse SoC; both modes refill Spin within 12 minutes when uncapped; a mutation that removes the ceiling cap fails the grid-mode test. The crash card names the mode shown and says Torus has not confirmed which applies. | 1 |
| `fleet-rollup` | Fleet rollup: simulated Wattsmart-size sites, one DP each, summed into one validated fleet envelope | engine | `ff_fleet` | `engine/src/fleet.ts` builds N seeded SIMULATED sites (3 for the envelope view, up to 24 for the board), station sizes inside the TORUS_PUBLISHED Wattsmart band of 30 kW to 1.2 MW, host load from at least 3 SIMULATED archetypes (machining shop, school, grocery refrigeration), each solved by the existing DP. Vitest: each hour's `reserve_kw`, `max_charge_kw`, `max_discharge_kw` and `planned_kw` equal the sum of the site values; `fleet_kw` equals the sum of site `pulse_kw`; `reserve_kw` equals the sum of `enrolled_kw`; no site exceeds its `host_ceiling_kw` in any of 96 intervals; the same seed gives byte-identical output; every `envelope_*.json` validates against `contracts/envelope.v1.schema.json` with a hand-written validator (no new dependency). Mutations that drop one site's ceiling, drop `reserve_kw`, or make `system_critical` a string each fail a test. `engine/cli/fleet.ts` writes `public/derived/fleet_<day>.json` and prints the MEASURED solve ms for 24 sites. | 2.5 |
| `fleet-call` | Fleet call allocator: one RMP call routed across sites by spare kW, skipping sites mid-refill | engine | `ff_fleet_call` | `engine/src/fleetCall.ts` takes a fleet `request_kw`, the call instant and each site's `spare_kw` and refill state, and returns per-site assignments plus fleet `delivered_pct`. Vitest: no site is assigned above its `spare_kw`; sites inside a refill window are assigned last; when fleet spare kW covers the request the fleet delivers at least 90% of it (the TORUS_PUBLISHED band floor); when it does not, `shortfall_kwh` is reported and nonzero; a second fleet call 3 minutes later is allocated from post-call state; a mutation that ignores refill state fails a test. Each site's slice then runs through the existing crash and re-plan. | 1.5 |
| `rt-history` | Real-time PACE prices, May 1 to Oct 27 2026, plus a pre-EDAM winter window | data | `off_rt_history` | `prep/rt_history.py` fetches OASIS RTM prices for ELAP_PACE-APND for May 1 to Oct 27 2026 and Nov 1 2025 to Apr 30 2026 (PRC_RTPD_LMP 15-minute first, PRC_INTVL_LMP 5-minute as fallback), chunked and paced per the fetch rules (under 31 days a call, 5 s spacing, 30 s backoff on 429), and writes `public/data/rt_<start>_<end>.json` with 96 values per Mountain day keyed by UTC interval start. DST is handled (Nov 2 2025, Mar 8 2026); missing intervals are listed, never filled. A unittest on a fixture checks the day boundary on both sides of DST. A spot check of the 5-minute path matches the committed `research/data/caiso1` Oct 25 extract to the cent. Only 15-minute or hourly aggregates are committed. | 1.5 |
| `response-tables` | Marginal CO2, forecast-error and price-response tables from EIA and OASIS | data | `off_response_tables` | `prep/response_tables.py` (stdlib, `python -I`) writes `public/data/response_tables.json` with three tables. (a) Marginal CO2 per hour-of-day x season: the OLS slope of the hourly change in EIA "CO2 Emissions Generated" on the change in net generation, plus a consumed-basis variant on the change in demand; each bin carries n, R2 and a seeded 90% bootstrap interval, and bins whose interval spans zero are flagged inconclusive, not dropped. (b) Whole-day vectors of PACE demand-forecast residuals (EIA-930 forecast minus demand) for May to Oct 2026, bad hours excluded and listed. (c) The slope of DA LMP on net load per hour group, with interval and R2. Unittests: OLS recovers exact slopes on synthetic data to 1e-9; a fixed seed gives byte-identical bootstrap output; a planted bad hour is excluded. Every table carries source URLs and prov DERIVED. The 75 MB PACE.xlsx extract stays in `../clearlane-raw`. | 2 |
| `export-2030-5` | IEEE 2030.5-shaped export of the hourly envelope | data | `ff_export_2030_5` | `api/export2030_5.ts` converts an Envelope into DERControlList-shaped XML and JSON: one DERControl per hour, `interval.start` = Unix seconds of `ts_utc`, `interval.duration` = 3600, power limits from `max_discharge_kw` and `max_charge_kw`, System Critical Hours carrying a plain-words description. Vitest: 24 controls; starts strictly increasing by 3600; every limit in its allowed range; parsing the output back reproduces the envelope kW within 1 kW. `api/docs/2030.5-mapping.md` marks each field VERIFIED or UNVERIFIED after the lane opens the SunSpec CSIP Implementation Guide. Wherever it shows, the label reads "2030.5-shaped, not certified". | 1.5 |
| `screens-pass` | Every screen: projector theme, lane patterns, three resolutions, phone touch bar | ui | `ff_projector` | axe-core over all six beats reports zero serious or critical violations (fixes to the default theme go in their own core-fix PR). Each lane carries a text label and a pattern, and adjacent lane fills meet 3:1 non-text contrast in both themes. Screenshots at 1920x1080, 1280x720 and 1024x768 show no clipped or overlapping number, checked by comparing text boxes with their containers. prefers-reduced-motion lands every beat on its end state. With `ff_projector` on, T toggles a projector theme (thicker strokes, larger labels inside reserved space) and no container moves or resizes. Under `ff_public_url`, a touch beat bar reaches all six beats at 375x812 with no sideways scroll, and the close card reserves a fixed QR slot. With flags off, the default theme is unchanged. | 1.25 |
| `any-day` | Pick any day: re-solve the race for any day from May 1 to Oct 27 in the browser | ui | `ff_any_day` | D opens a date control listing every day in `hist_2026-05-01_2026-10-27.json` plus the bundle days. Choosing a day re-solves fixed_overnight and clearlane in the browser and shows $/MW-day for both with a MEASURED solve time. A vitest checks five pinned days (one each in May, Jun, Jul, Sep, and Oct 27) against the engine CLI output to the cent. A day where the off-peak rule wins says so in plain words. Days with missing hours are disabled with the reason; days missing CO2 show CO2 as unavailable, not zero. The operating day on screen always names the chosen day. With the flag off, no control renders and the six-beat smoke run is unchanged. | 1 |
| `judge-mode` | Judge mode: click any 15-minute slot, or press C at any minute, to drop an RMP call | ui | `ff_crash_anywhere` | With the flag on, clicking a ribbon slot, keyboard selection, or C at the current time-lapse minute injects a SIMULATED CrashEvent at that interval, runs `crashAt` and the re-plan through `app/src/engineClient.ts`, and shows the event card naming the minute, the actual refill time and the MEASURED solve ms. A second drop inside the refill window shows the shortfall rule. Input is clamped to the operating day. The keyboard-only path works. With the flag off, beat 3's scripted 6:40pm press and its numbers are unchanged. | 1 |
| `freeway` | Freeway ribbon: net load drawn as traffic, with the station as one marked vehicle | ui | `ff_freeway` | Traffic density per hour comes from `net_load_mw` through one mapping function, and a vitest asserts it rises with net load. Traffic slows in jam hours and flows in clear hours using the engine's lanes, never hand-coded hours. The station is one vehicle labeled "simulated Torus-style station", on the road in the plan's charge intervals and off it in discharge intervals, read from the Plan. A performance trace at 1920x1080 shows no long task over 50 ms during the beat. Reduced motion renders a static density pattern with the same end state. The caption says density is net load, not vehicle data. With the flag off, the plain ribbon and the six-beat smoke run are unchanged. | 0.75 |
| `reproduce` | One-command reproduce of every stage number, with a SHA-256 manifest and a generated NUMBERS.md | integration | `off_reproduce` | On a clean clone with Node and Python 3.13 and Wi-Fi off, `npm ci` then `npm run reproduce` checks the SHA-256 of every `public/data` file against `tools/manifest.sha256`, re-runs the engine CLIs into a temp dir, byte-compares every `public/derived` JSON except fields on an explicit MEASURED list, and prints "REPRODUCED n/n stage numbers" with exit 0. A flipped byte exits 1 and names the file and changed keys; a missing tool or dependency exits 2, never 1. `npm run reproduce -- --fetch` re-fetches OASIS and EIA with no keys into `../clearlane-raw` and reports per-file diffs without failing. `docs/NUMBERS.md` is generated from `numbers.json` (key, display, prov, source, as_of_mt). README gains "Reproduce every number". A CI job runs the offline mode on every PR; Linux is the run of record. | 1.5 |
| `autovideo` | Scripted backup video with captions, re-recordable after the Oct 28 refresh | pitch | `off_record_video` | One command builds the stage app, drives the six beats at 1920x1080 on the demo-script timings with Playwright, and writes a video 2:40 to 2:50 long plus a WebVTT caption file whose lines come from the demo script with every {key} resolved from `numbers.json` (an unresolved key fails the run). Every frame shows the operating day. It works by Train 5, so after the Oct 28 regeneration a re-run finishes in under 10 minutes with the new values. Output goes to a gitignored folder, then the laptop and a USB copy by Wed 3:30pm. A manual screen capture stays the fallback. | 1 |
| `leave-behind` | Leave-behind kit: one-page judge PDF, two-page envelope packet, sample envelope file | pitch | `off_leave_behind` | `pitch/leave-behind.html` prints to one US Letter page: ribbon, race result, crash summary, envelope excerpt, the what-is-real table, the questions we asked Torus, and a QR code to the judge URL. `pitch/envelope-packet.md` (two pages, PDF at Train 8) defines every `clearlane.envelope/v1` field in one line with its unit, marks the SCH rule "our proposal", says "a working example, not a filing", and quotes the ROWE asks under 15 words each with the URL https://rowesternenergy.org/wp-content/uploads/2026/06/Consolidated-Spring-Workshop-Comments_06222026.pdf; it adds the SCH evidence table if `sch-rule-study` merged and the 2030.5 mapping appendix if `export-2030-5` merged. `pitch/torus-kit/` holds a sample envelope copied from `public/derived` and one paragraph on how Lasso could take it as one more grid signal. A script resolves every {key} from `numbers.json` and fails on an unknown key or a hand-typed number outside an allowlist (dates, URLs, the schema name). The em dash and banned-word check passes. Both PDFs regenerate after the Oct 28 numbers land. | 1.5 |
| `step-stats` | Is the 5-6pm price step real? Exact tests on REAL PACE day-ahead prices | science | `off_step_stats` | `science/step-stats.md` and `science/step_stats.json`, from code written separately from `research/analysis/option2/step_hours.py`: for each Mountain day in the hist file, the hour of the day's largest upward hour-to-hour price step. The October count reproduces beat 1's 24 of 27, or the mismatch is filed for Integration as a core issue. An exact binomial test against a uniform-hour null, and a permutation test of the October vs July step-hour distribution (the one to quote), with tolerances and test statistics stated before computing. Every number names its input file; no em dashes. | 1 |
| `sch-rule-study` | System Critical Hours rule study on REAL PACE data, for the docket | science | `off_sch_study` | `science/sch-study.md` and `science/charts/sch_rules.svg` compare at least 3 rules (ours: the 4 highest net-load hours plus every jam hour; the top N price hours; a net-load percentile threshold) over May 1 to Oct 27 2026, using EIA-930 PACE demand, solar and wind from `research/data/eia930` (REAL) and the hist price file. A table gives hours flagged per month per rule and the overlap with the TORUS_PUBLISHED by-hour counts under the Mountain and UTC readings. One row reproduces the engine's Oct 27 SCH flags exactly. Every number names its file; no em dashes. | 2 |
| `reserve-risk` | Chance a call lands while Spin is refilling, from Torus's own 2025 counts | science | `off_reserve_risk` | `science/reserve-risk.md` and `science/reserve_risk.json` model calls as a non-homogeneous Poisson process: hourly rates from the TORUS_PUBLISHED by-hour and by-weekday counts under the Mountain and UTC readings, call duration over an ASSUMPTION band of 5 to 6 minutes, refill windows of 6 and 12 minutes, and annual totals from 137 (2024) to 359 (2025). For each case: the expected calls a year that start inside a previous call's refill window and the chance of at least one per season, in closed form and by a seeded simulation that agrees within 3 standard errors on 3 pinned configs. A clustered-arrival stress case is included. Refill time 0 gives 0. Once `call-ledger` merges, the note compares its overlap count with the ledger's replay. | 1.5 |
| `presenter` | Presenter mode: eight click-through screens with visible buttons, in a charcoal and off-white style | ui | `ff_presenter` | Spec `docs/superpowers/specs/2026-10-28-presenter-mode-design.md` (#216). With the flag on, `?ff=presenter` renders eight screens (Title, Traffic report, Race, Call, Re-plan, Envelope, Scale, Close) with Back and Next pills, a labelled progress bar and labelled action buttons; Next walks every action in order; the race screen shows the buy, sell and keep arithmetic from the engine, pinned by tests. With the flag off, the six-beat snapshots and the projector check are unchanged. | 2 |

Stretch-1 notes and risks:

- `crash-anywhere` goes first in the engine queue because it hardens core beat 3 before the Train 4 checkpoint. A midday call with Pulse charging near the host ceiling can stretch Spin's refill past 6 minutes; the card shows the real time. A shortfall found here turns core red until fixed.
- `spin-refill-source` answers Torus question 2. The Pulse-to-Spin transfer efficiency is an ASSUMPTION, and in pulse mode the battery-only contrast may shrink: show it honestly. If Torus answers Tue morning, Integration decides whether to flip the default, which changes core numbers and regenerates `numbers.json`.
- `fleet-rollup`: the site mix is SIMULATED and must never read as Torus's fleet; label it "simulated Wattsmart-size sites". Summing site envelopes assumes no feeder limit between sites, and `sch_rule` says so. `FleetResult` stays engine-local until Integration adds it to `contracts/types.ts`.
- `fleet-call`: how RMP's DBGMS splits a call across Torus C&I sites is not public, so the allocator is labeled "our rule" and joins the Torus question list. Never claim it matches Lasso.
- `rt-history`: OASIS window limits for interval data and the PRC_RTPD_LMP path are UNVERIFIED. About 360 days of paced calls is mostly waiting, so it runs unattended. Winter results are labeled "RT proxy" because the day-ahead market did not exist then.
- `response-tables`: EIA's hourly CO2 is fuel-type generation times EIA factors, so the slope measures fuel-mix response, not plant heat rates. PACE exports in most hours, and midday curtailment is invisible in net generation, which can bias midday factors. The method follows Siler-Evans, Azevedo and Morgan 2012 (citation UNVERIFIED, not opened).
- `export-2030-5` moved from engine to data: `api/` is data's, and engine is the bottleneck lane. Field names came from search excerpts, not opened pages (opModMaxLimW, opModFixedW, DefaultDERControl, potentiallySuperseded); opModExpLimW, opModImpLimW and the 2030.5 revision RMP uses are UNVERIFIED. Percent versus watts units are easy to get wrong.
- `screens-pass`: the venue projector's resolution and color are UNVERIFIED until a room check, so 1024x768 is a worst-case guess. axe-core and Playwright are root dev dependencies that Integration adds.
- `any-day`: HistDay carries only price and CO2, so history days show price and the plan, labeled, with no net-load or solar line unless Integration adds an optional field.
- `judge-mode`: unscripted input can land in a dull hour or an unrehearsed edge. Craig keeps the scripted press inside the 2:45 and offers the judge a press in Q&A.
- `freeway`: motion can eat beat 1's 25 seconds and pull eyes off the 2.6x number, so the traffic stays inside the existing ribbon. Frame rate on the demo laptop is UNVERIFIED until rehearsal 0. No Torus logos on the vehicle.
- `reproduce`: byte equality breaks on `generated_utc`, key order, float formatting, CRLF (JSON gets `eol=lf` in `.gitattributes`) and MEASURED timings; each is pinned or explicitly excluded. OASIS can revise data, so `--fetch` differences are reported, not failed.
- `public-url`: the URL goes public before the repo does, so every deployed file must already be public-safe: no raw page snapshots, no PACE.xlsx, no keys. The stage never needs the URL, so venue Wi-Fi does not matter.
- `autovideo`: Playwright video quality on Windows and ffmpeg on the laptop are UNVERIFIED. Narration still needs Craig's voice or a live voiceover.
- `leave-behind`: Torus's judging criteria are UNVERIFIED (`docs/JUDGING.md`), so the kit is framed on Torus's own ROWE asks, not a rubric. Never imply Torus endorsed it or that we have a regulatory role. Printing paper copies is Craig's call.
- Science items: Claude Science may not run git, so Integration commits its files. Every science item is off the critical path.

## Stretch-2: merged by Train 6, Tue 11:30pm

| id | title | lane | flag | done when | hours |
|---|---|---|---|---|---|
| `public-url` | Judge URL: the stage build as a static site, with a QR code on the close card | integration | `ff_public_url` | Craig gives the go before any public URL exists. A production URL serves the tagged stage build in snapshot mode. From a logged-out phone browser at 375x812 the page loads, the touch beat bar reaches all six beats, nothing scrolls sideways, and the network log shows only same-origin requests. With `VITE_PUBLIC_URL` set and the flag on, the close card and README show a QR code generated at build time as inline SVG (no CDN) that a phone camera resolves to the URL. The deploy holds only `dist` files, and deployment protection is checked from a logged-out browser. With the flag off or the variable unset, the close card is unchanged. | 0.5 |
| `call-ledger` | Call ledger: 359 calls replayed from the published counts, logged the way Lasso logs dispatches | engine | `ff_call_ledger` | `engine/cli/ledger.ts` writes `public/derived/call_ledger.json` with exactly 359 SIMULATED calls per heatmap reading (Mountain and UTC) whose by-hour and by-weekday counts equal the TORUS_PUBLISHED arrays exactly (vitest). Each row: `start_utc`, `requested_kw`, `ramp_s` (19, TORUS_PUBLISHED), `delivered_pct`, `spin_kwh`, `pulse_kwh`, `shortfall_kwh`, `policy`, `refill_source`. A summary per policy and reading gives the share of calls at or above 90% delivered and the shortfall count. The same seed gives a byte-identical file. The card states the replay density: 359 calls on about 180 backtest days, roughly twice the 2025 daily rate, so it is a stress replay. | 1.5 |
| `sensitivity` | Sensitivity tornado, breakevens and per-day backtest rows | engine | `ff_sensitivity` | `engine/cli/sensitivity.ts` first writes `public/derived/backtest_days.json` (per day and policy: $/MW-day, t CO2/MW-day, cycles), then varies each input one at a time over the backtest: RTE 0.80 to 0.92, wear price, host ceiling slack, host load archetype, enrolled kW, export limit, Spin refill 6 vs 12 minutes, heatmap reading, CO2 basis (EIA average vs the `response_tables` marginal estimate with its interval), and DP SoC grid at 41, 81 and 161 levels. It writes `public/derived/sensitivity.json` with the low and high delta of Clearlane minus the off-peak rule in $/MW-day, t CO2/MW-day and calls unanswerable; solves for the RTE and the daily price spread at which Clearlane equals the off-peak rule; and adds one two-way RTE x spread grid. Tests: the base case reproduces `backtest.json` exactly; a zero-width range gives zero delta; DP value never decreases across the nested grids (41 within 81 within 161) to 1e-9. | 2 |
| `wear-rainflow` | Rainflow cycle counting, depth stress and full-battery dwell for Pulse | engine | `ff_wear_rainflow` | `engine/src/wear.ts` implements 3-point rainflow on the SoC trace, Miner damage under N(DoD) = N_rated x DoD^-k anchored to Torus's 7,500 cycles (the rating's DoD is an ASSUMPTION; k swept at 1.0, 1.5 and 2.0), and hours per day at SoC above 80%. Unit tests match `research/analysis/depth/bandsplit.py`'s rainflow on three seeded random traces and return exactly n full cycles for n identical full swings. A DP variant with piecewise cycle-depth segment costs reduces to the linear wear price to the cent when k = 1. The backtest reports, for all three policies in `numbers.json`: equivalent cycles per year, dwell hours, and a life estimate with an ASSUMPTION chip. | 2 |
| `host-frontier` | Host frontier: how much evening block a host can give RMP before its monthly peak moves | engine | `ff_host_frontier` | `engine/src/frontier.ts` runs a month-to-date billing simulation (Oct 1 to Oct 27, REAL day-ahead prices, SIMULATED host load, month-to-date ceiling ratchet) for each `fleet-rollup` archetype and sweeps the evening block from 0 to `pulse_kw` in 10 steps. Per step: host monthly peak kW with and without storage, grid value $/MW-day. Break point = the largest block with zero increase in the host's monthly peak. Vitest: block 0 reproduces the peak-shaving-only plan; grid value is non-decreasing in block size; a mutation that ignores the ratchet moves the break point and fails. Host results in kW only. | 2.5 |
| `lasso-feed` | A versioned, keyless grid-signal feed Lasso could poll after the 9:16pm day-ahead post | data | `off_lasso_feed` | `api/openapi.yaml` (OpenAPI 3.1) documents GET `/v1/signal/{day}` (24 rows: lane, system_critical, lmp, net_load, co2, each with prov), `/v1/envelope/{day}`, `/v1/fleet/{day}` and `/v1/envelope/{day}/2030.5`. `api/feed.ts` serves them from the committed `public/data` and `public/derived` files with no network and no key, and the same responses are written as static JSON examples. A vitest contract test loads one example per route and checks the schema id, `generated_utc`, `data_mode` and a prov field on every value; a planted missing prov fails it. Examples regenerate at the Tue-night refresh. | 1.5 |
| `territories` | Same engine on Torus's other territories: PACW and PGE day-ahead nodes | data | `ff_territories` | prep builds `hist_pacw_2026-05-01_2026-10-27.json` and `hist_pge_2026-10-01_2026-10-27.json` (PGE joined EDAM Oct 1, per `research/notes/utah-grid.findings.md`) in the HistDay schema under the existing fetch rules. Unittest checks 24 hours per day, lists missing days and fails on any filled value. The engine backtest CLI runs unchanged with a node argument and writes `backtest_<node>.json` (the run is filed as a one-line engine issue if the CLI lacks the argument). A proof-drawer card shows lanes and $/MW-day per node, each labeled with its window. Price results only. | 1.5 |
| `proof-drawer` | Proof drawer: Q&A cards for the stretch analyses | ui | `ff_proof_drawer` | P opens a drawer over the current beat and Esc closes it. Each card reads only its own JSON and renders hand-written SVG with provenance chips; intervals show as bands, never bare points; each card has distinct empty, unknown and broken states, and a missing file is the empty state. One card per merged source: step-stats, reserve-risk, call ledger, sensitivity tornado, wear and dwell, host frontier, territories, the 2030.5 view (labeled "2030.5-shaped, not certified"), the reproduce manifest hash, and rt-replay and the scale curve if those moonshots merge. With every `ff_*` off, the six-beat DOM snapshots are unchanged. Legible at 1920x1080, fits 375px with no sideways scroll, and the offline check shows no network request. | 3 |
| `lineage` | Number lineage: every provenance chip opens to its source, date, class and cross-check | ui | `ff_lineage` | Every chip is focusable; with the flag on, Enter, a click or I opens a panel with the StageNumber key, display value, provenance class, source path or URL, and `as_of_mt`. TORUS_PUBLISHED values show their per-value URL from `torus_published.json`. When `science/crosscheck.json` lists the key, the panel shows match or mismatch from that file; otherwise it says nothing about a cross-check, and a missing check is never shown as passed. Esc closes and focus returns to the chip. A vitest asserts every key in `numbers.json` resolves to a panel with a non-empty source. With the flag off, chips behave as in core. | 0.5 |
| `fleet-board` | Fleet board: site tiles, the fleet envelope strip, and a fleet call landing live | ui | `ff_fleet_board` | F opens a board of up to 24 site tiles (Spin and Pulse SoC bars, host meter vs ceiling, refill countdown) and a 24-hour fleet envelope strip with System Critical Hours shaded. C on the board runs `fleetCall` through `engineClient` and shows per-site contributions and fleet `delivered_pct` with MEASURED solve ms; any shortfall is shown. Under `ff_fleet`, beat 5 shows the three sites stacked under the fleet envelope line. Every number carries a chip, with a one-line caption that reads on its own. Reads at 1920x1080 and 375px with no sideways scroll. With both flags off, the six beats render identically (test). | 2 |
| `compute-drag` | Drag the compute block: move a simulated AI training block into the clear lane | ui | `ff_compute_drag` | With the flag on, the closing Option 2 card shows a SIMULATED 25 MW x 3 h block on the day's price line that moves by mouse, touch or arrow keys. At every start hour the cost and CO2 come from the engine's Option 2 shift, and at the engine's default positions the saving equals `{campus_usd}` in `numbers.json` (vitest). A "move it in space" toggle shows the same hours at the peer nodes from `bundle.peers`, or, when peers are empty, the research figures (time 40-41% vs space 8%) with their source path `research/analysis/option2/where_vs_when_output.txt`. The card carries a SIMULATED chip and makes no Torus data-center claim. With the flag off, the close card is the static line from the core script. | 0.75 |
| `backtest-intervals` | Intervals on the backtest headline numbers | science | `off_backtest_intervals` | `science/backtest-intervals.md` and `science/backtest_intervals.json`: a seeded 7-day block bootstrap over `public/derived/backtest_days.json` gives 90% intervals for P50 $/MW-day per policy and for `days_beating_fixed_overnight_pct`; a stationary bootstrap gives a second interval for comparison; a fixed seed gives identical output; every number names its file; no em dashes. | 1 |
| `crosscheck-stretch` | Independent second-method check of the stretch numbers, plus a methods note | science | `off_science_methods` | `science/crosscheck-stretch.md` reports match or mismatch, each tolerance stated before computing, for every stretch output merged by 9:00pm Tue: marginal CO2 from a load-level-binned estimator vs the hour-of-day OLS (agreement within the OLS interval); `reserve-risk`'s closed-form overlap count vs `call-ledger`'s replay; rainflow cycles on two plans from separately written counting code; the fleet envelope sum recomputed from the site files; the sensitivity base case vs `backtest.json`. Items merged later get the line "not cross-checked". `science/methods.md` gives every equation, input file and limit in under 4 pages, no em dashes. Integration opens a GitHub issue for each mismatch. | 2.5 |

Stretch-2 notes and risks:

- `call-ledger`: the heatmap is read as Mountain time, as Torus confirmed (`heatmap_readings`); UTC readings are a sensitivity check and never show on stage. Rows are SIMULATED and must never read as RMP event records; placing them on 2026 days is our choice, not data.
- `sensitivity`: one-at-a-time ranges ignore interactions, hence the one two-way grid. The ranges are our choices and carry ASSUMPTION chips. The marginal CO2 axis waits on `response-tables`, and the archetype axis on `fleet-rollup`; ship without either if it slipped.
- `wear-rainflow`: Torus does not publish the basis of its 7,500-cycle rating (DoD, temperature, end-of-life capacity), so absolute life years depend on assumptions; lead with the policy ranking and the dwell hours, which need none. The proposal reads `research/analysis/demo-story/habit.py` as holding Pulse full about 13 hours a day under the off-peak rule and about 2 under the midday timetable; that is UNVERIFIED until this item's test reproduces it. The exact piecewise-segment DP (after Xu et al. 2018, citation UNVERIFIED) multiplies the state space, so use the segment approximation and label it.
- `host-frontier`: host shapes are SIMULATED, so the break point is illustrative, and a peaky archetype may show a break point of 0, which is still a true answer. Torus says peak demand charges are about 50% of a C&I bill (TORUS_PUBLISHED, `research/TORUS.md`), but host results stay in kW until RMP Schedules 6, 6A and 8 are verified, and never show as Torus-measured savings.
- `lasso-feed`: Lasso's API is not public, so this is a proposed shape, never an integration. Never say Torus agreed to consume it.
- `territories`: the PGE window is only 27 days, and the card says so. Wattsmart is an RMP program, so on other nodes the envelope is a format proposal only.
- `proof-drawer`: the drawer never joins the six beats or their timing. Card shapes land late, so build against fixtures. The app reading `science/` JSON needs Integration to agree the paths.
- `fleet-board`: clutter on a projector past about 24 tiles, so cap visible tiles and summarize the rest. Label "simulated Torus-style sites", no logos. Not every judge is a grid engineer, so the caption has to stand alone.
- `compute-drag`: Torus took its data-center pages down after August 2026 (`research/notes/torus-intel.md`), so the card stays SIMULATED. `bundle.peers` may be empty for Oct 28. Dragging live would push past 2:45, so it lives on the close card for Q&A and on the judge URL only.
- Science stretch-2 inputs land late Tuesday; coverage is whatever merged by 9pm.

## Moonshot: only after every lane's stretch-2 is merged or cut

| id | title | lane | flag | done when | hours |
|---|---|---|---|---|---|
| `rt-replay` | Day-ahead vs real-time replay with hourly rolling re-plans | engine | `ff_rt_replay` | `engine/src/replay.ts` settles a day as DA price x DA schedule plus RT price x (actual minus DA schedule) and runs three policies over every day in the RT history: hold the DA plan; re-plan each hour from actual SoC over the remaining horizon, with DA prices as the forecast and observed RT so far; perfect foresight on RT. Tests: all three are equal to the cent when RT equals DA; perfect foresight is never below the other two on any day; reserve and host-ceiling constraints hold in every re-plan. `public/derived/rt_replay.json` lists per-day regret, the count of days where the RT evening price fell below RT midday, and measured re-plan times. Merge by Train 6. | 2 |
| `price-impact` | Price-impact correction for the 70 to 500 MW scale slider | engine | `ff_price_impact` | `engine/src/dp.ts` accepts an optional hourly price-response slope from `response_tables.json`, so the price at each step moves by slope x fleet MW x the fleet's net injection; each step's reward still depends only on that step's action, so the DP stays exact. Negative slopes are clamped to zero and flagged; evening hours whose slope interval spans zero are marked inconclusive. `engine/cli/scale.ts` writes `public/derived/scale_curve.json` for 70, 140, 250 and 500 MW with the slope's interval as a band. Tests: slope 0 reproduces the price-taker numbers to the cent; value per MW never rises with fleet size. Beat 6's caveat stays on stage; the curve lives only in the proof drawer. Merge by Train 6. | 1.25 |
| `nightly` | Nightly traffic report: the judge URL publishes the next day's real plan every evening | integration | `off_nightly_live` | Craig gives the go first. A scheduled GitHub Actions workflow at 03:45 UTC (9:45pm MDT) runs the data lane's refresh for the next operating day, then the engine CLIs. On success it commits the bundle and regenerated derived files to a `live` branch, never `main`, and the live alias shows the new operating day and `fetched_utc`. On any fetch or schema failure it exits non-zero, commits nothing, and the page keeps its last day with a plain "last refresh failed at <time>" line. A manual run with the OASIS host pointed at a bad address proves the failure path. The stage build and `main` never read the `live` branch. The job stops after the Oct 31 operating day, because MDT ends Nov 1 and the contracts assume UTC-6. Merge by Train 7 with Craig's yes. | 1 |

Moonshot notes and risks:

- `rt-replay`: the EDAM settlement structure (DA schedule at DA price, deviations at RT) is UNVERIFIED against CAISO's EDAM business practice manual; check it before saying it on stage. A behind-the-meter station is not itself a market participant, so the result is still value to RMP's system, not Torus revenue.
- `price-impact`: a slope of PACE price on PACE net load is confounded by gas prices, imports and the wider EDAM footprint that sets the price. Show it as a DERIVED estimate with R2 and interval. 500 MW is about 8% of PACE's Oct 27 forecast peak of 6,024 MW (CAISO SLD_FCST, `research/analysis/byrd/t2.txt`) and stays labeled as the MOU ceiling.
- `nightly`: OASIS may throttle cloud runner IPs (UNVERIFIED) and scheduled workflows can start late, so the page always shows `fetched_utc`.

## Lane queues, in order

Work top to bottom. Core comes first in every lane. Integration merges producer to consumer: data, engine, ui, pitch, science.

**Engine (Claude Code, `../clearlane-engine`)**
1. `crash-anywhere` (stretch-1)
2. `spin-refill-source` (stretch-1)
3. `fleet-rollup` (stretch-1)
4. `fleet-call` (stretch-1)
5. `call-ledger` (stretch-2)
6. `sensitivity` (stretch-2)
7. `wear-rainflow` (stretch-2)
8. `host-frontier` (stretch-2)
9. `rt-replay` (moonshot)
10. `price-impact` (moonshot)

**Data (Codex, `../clearlane-data`)**: cross-family review of engine PRs continues through every tier.
1. `rt-history` (stretch-1): start the unattended fetch first, then work the next item while it runs
2. `response-tables` (stretch-1)
3. `export-2030-5` (stretch-1)
4. `lasso-feed` (stretch-2)
5. `territories` (stretch-2)

**UI (Cursor, `../clearlane-ui`)**
1. `screens-pass` (stretch-1)
2. `any-day` (stretch-1)
3. `judge-mode` (stretch-1)
4. `freeway` (stretch-1)
5. `proof-drawer` (stretch-2): shell first, then one card per merged source
6. `lineage` (stretch-2)
7. `fleet-board` (stretch-2)
8. `compute-drag` (stretch-2)

**Integration (Claude Code, main checkout)**: continuous merging, trains, and the Oct 28 refresh at about 9:16pm come before any item here.
Trimmed at Train 3 (Tue 10:50am, after the slip) to four stretch-1 items, in this order:
1. Train 4 contract additions (#29): `FleetResult`, `FleetCallResult`, `refill_source`
2. Proof-drawer types: an optional exported type for each card's JSON, before that card merges
3. Refresh list: every merged stretch CLI that writes a per-day file is on the Tue-night list by Train 5 (#31)
4. `reproduce` (stretch-1, #32)
5. `public-url` (moved to stretch-2 at Train 3), only after Craig's go
6. `nightly` (moonshot), after Craig's go

**Pitch (Grok Build, `../clearlane-pitch`)**: reviewing every stretch PR for overclaims, guardrails and em dashes is standing work in every tier.
1. `autovideo` (stretch-1)
2. `leave-behind` (stretch-1)
3. After the Oct 28 regeneration: re-run both (part of their done-when, not a new item)

**Science (Claude Science, `../clearlane-science`)**
1. `step-stats` (stretch-1)
2. `sch-rule-study` (stretch-1)
3. `reserve-risk` (stretch-1)
4. `backtest-intervals` (stretch-2)
5. `crosscheck-stretch` (stretch-2)

Capacity used, stretch-1 / stretch-2 / moonshot: engine 4/4/2, data 3/2/0, ui 4/4/0, integration 1/1/1, pitch 2/0/0, science 3/2/0.

## Where each proposal went

All 36 proposals are accounted for. Merges and moves are noted.

| Proposal | Became | Tier | Note |
|---|---|---|---|
| `s1-judge-button` | `crash-anywhere` | stretch-1 | Engine half of the judge-picks-the-minute idea |
| `judge-drops-call` | `judge-mode` | stretch-1 | UI half; one flag `ff_crash_anywhere` for both halves |
| `spin-refill-source` | `spin-refill-source` | stretch-1 | |
| `fleet-rollup`, `s2-fleet-envelope` | `fleet-rollup` | stretch-1 | Merged: sum tests plus schema validation; the schema file moves to `contracts/` (Integration); the beat 5 stacked view moves to `fleet-board` |
| `fleet-call-dispatch` | `fleet-call` | stretch-1 | |
| `rt-price-history` | `rt-history` | stretch-1 | |
| `eia-response-tables` | `response-tables` | stretch-1 | |
| `envelope-2030-5` | `export-2030-5` | stretch-1 | Moved from engine to data (`api/`) |
| `s1-projector` | `screens-pass` | stretch-1 | Also takes the touch beat bar and QR slot from `s1-judge-url`; projector key is T because P is the proof drawer |
| `s1-any-day` | `any-day` | stretch-1 | |
| `s1-freeway` | `freeway` | stretch-1 | |
| `repro-one-command`, `s1-reproduce` | `reproduce` | stretch-1 | Merged: one command, one manifest, NUMBERS.md, README section, CI job |
| `s1-judge-url` | `public-url` | stretch-2 (moved at Train 3) | UI pieces moved to `screens-pass` |
| `s1-autovideo` | `autovideo` | stretch-1 | |
| `s1-leave-behind`, `envelope-packet` | `leave-behind` | stretch-1 | Merged into one pitch kit |
| `uq-bootstrap` | `step-stats`, `backtest-intervals`, `sensitivity` | stretch-1, stretch-2 | Split: price-step tests to science stretch-1; block bootstrap to science stretch-2 on engine's per-day rows; DP grid refinement joins `sensitivity`; the call-season seed sweep is rejected below |
| `sch-rule-study` | `sch-rule-study` | stretch-1 | |
| `reserve-frontier` | `reserve-risk`, `call-ledger` | stretch-1, stretch-2 | Split: closed form to science; the deterministic replay is `call-ledger`; the engine Monte Carlo is rejected below |
| `call-ledger` | `call-ledger` | stretch-2 | Adds a `refill_source` column |
| `sensitivity-tornado` | `sensitivity` | stretch-2 | Also writes `backtest_days.json` |
| `wear-rainflow` | `wear-rainflow` | stretch-2 | |
| `host-frontier` | `host-frontier` | stretch-2 | |
| `lasso-feed` | `lasso-feed` | stretch-2 | Hosted deploy rejected below |
| `territories` | `territories` | stretch-2 | CO2 part rejected below |
| `proof-drawer` | `proof-drawer` | stretch-2 | Shell and cards both in stretch-2 |
| `s2-lineage` | `lineage` | stretch-2 | |
| `fleet-board` | `fleet-board` | stretch-2 | Also shows the beat 5 stacked sites |
| `s2-compute-block` | `compute-drag` | stretch-2 | |
| `science-crosscheck-stretch` | `crosscheck-stretch` | stretch-2 | Scoped to outputs merged by 9pm Tue |
| `rt-replay` | `rt-replay` | moonshot | |
| `price-maker-scale` | `price-impact` | moonshot | Beat 6 caveat stays on stage |
| `m-nightly` | `nightly` | moonshot | |
| `prob-sch` | rejected | | See below |

## Rejected

| Idea | Reason |
|---|---|
| Probabilistic System Critical Hours (`prob-sch`) | It needs a new envelope field after the contract freeze for a number no one can check on stage. EIA-930's PACE demand forecast is not the CAISO forecast the bundle uses, so its residuals give proxy probabilities. `sch-rule-study` already answers Torus's ask for a transparent definition. Revisit after the event. |
| Engine-side reserve frontier with Monte Carlo (the engine half of `reserve-frontier`) | Duplicates `call-ledger`'s replay and `reserve-risk`'s closed form, in the bottleneck lane whose stretch-2 slots are full. The value cost of a bigger reserve comes from `sensitivity`'s enrolled-kW and refill axes. |
| Call-season seed sweep for the calls-answered rate (part of `uq-bootstrap`) | `call-ledger` replays a fixed list of 359 calls read as Mountain time, which a judge can check; a seed sweep adds sampling noise to the same question. |
| Hosted API deploy for the Lasso feed (part of `lasso-feed`) | A live service no beat needs, one more thing that can fail, and off the offline stage path. Static examples under the judge URL serve the same purpose. |
| PACW and PGE CO2 (part of `territories`) | Needs EIA's PACW and PGE workbooks, which are large and local-only. Price results carry the point. |
| A paid marginal-emissions feed for PACE | Paid data. WattTime gives full data only for CAISO_NORTH without a subscription (`research/notes/data-option2.md`). `response-tables` estimates marginal CO2 from EIA's free hourly data instead. |

## What Integration owes the lanes

- **By Train 3 (Tue 10:45am):** `contracts/flags.ts` with every `ff_*` name above, default off; `contracts/envelope.v1.schema.json`; exact-version root dev dependencies for axe-core and Playwright, and a QR encoder for `public-url` unless the UI hand-writes one; `eol=lf` for `*.json` in `.gitattributes`; an optional `refill_source` on CrashResult (landed early, in the Train 1 freeze); one GitHub issue per item above, labeled `lane:*` and `tier:*`, milestoned to its deadline train, with this file's done-when as acceptance.
- **By Train 4 (Tue 2:00pm):** `FleetResult` and `FleetCallResult` in `contracts/types.ts`, copied exactly from the engine's local definitions in `engine/src/fleet.ts` after its PR merges (the engine does not wait on contracts for these).
- **Before each proof-drawer card merges:** an optional exported type for the JSON it reads, and the agreed path for any `science/` file the app reads.
- **By Train 5:** every merged stretch CLI that writes a per-day file is on the Tue-night refresh list.
- **At Train 6:** Craig picks the stage flag set after the flags-on rehearsal; `v1-stage` bakes it in.
- **Needs Craig's explicit go:** any public URL (`public-url`) and the nightly workflow's write access (`nightly`).
