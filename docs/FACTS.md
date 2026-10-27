# Clearlane fact ledger

Every number or factual claim that may appear on stage, in the app, the deck, the README, the one-pagers or judge Q&A is listed here once. If a number is not in this file, do not say it. If its row says UNCHECKED, CONFLICT or PENDING-ENGINE, read the row before you say it.

Compiled Mon Oct 26 2026, about 11:45pm MT, from the repo research, `../clearlane-raw`, and pages opened this pass (Torus pages fetched live on Oct 26 2026). The UI and deck read numbers from `public/derived/numbers.json` (`StageNumber[]`, see `contracts/types.ts`); a key here that the engine writes keeps the same name there.

## How to read a row

Columns: Key | Claim | Value | Class | Source | Re-derive | Lvl | Status.

- **Class** is the provenance tag from `contracts/types.ts`: REAL (public data or a public statement, as published), DERIVED (our code on REAL inputs), SIMULATED, TORUS_PUBLISHED, ASSUMPTION (a value we chose), MEASURED (timed live, never stored). Third-party statements (RMP, Creekstone, Duke, EIA) are REAL and name the publisher.
- **Lvl** is the certainty ladder: 1 = stated in a research note or the plan, not opened this pass; 2 = read this pass in the named source (line, page or image); 3 = math walked by hand from level 2 or 4 inputs; 4 = printed by a script run this pass; 5 = reproduced in the running app (nothing yet).
- **Status**: VERIFIED (re-derived or read this pass, as the Lvl says), UNCHECKED (carried from a research note or the plan; open the source before quoting it on stage), CONFLICT (two sources disagree; the row quotes both and says which wording to use), PENDING-ENGINE (the engine has not produced it; never type a value).
- **Re-derive** names a command from the Commands section (C1, C2, ...) or a short one-off.
- **Checked by verifier (Oct 27)** in a Status cell means a second agent re-ran the named command or re-opened the named source on Oct 27 2026 and got the same value. A note in parentheses after a status says what the verifier corrected, upgraded or downgraded. The Verifier report at the end lists every change.

## Hour conventions

Read this before quoting any hourly number.

- MT is Mountain Daylight Time (UTC-6) until Sun Nov 1 2026 at 2am, then MST (UTC-7). The whole May 1 to Oct 27 backtest window is UTC-6.
- "HB 6pm" or "the 6pm hour" means hour beginning, 6:00 to 7:00pm MT. Ranges such as "HB 1am-5am" list hours beginning, so they span 1am to 6am.
- `research/data/pace_snapshot_2026-10-27.csv`: `local_mt` is hour BEGINNING MDT. The first row is `2026-10-27T07:00Z` = `10-27 01:00`; the last row is `2026-10-28T06:00Z` = `10-28 00:00`. It is CAISO's Oct 27 trade day (Pacific midnight is 07:00Z), so it has no row for hour 0 of the Mountain day Oct 27 (06:00Z) and its 24th row is hour 0 of Oct 28. A Mountain-day bundle that starts at 06:00Z matches it in hours 1 to 23 only (the engine's pinned tests say the same).
- EIA-930 files and EIA's `PACE.xlsx` are hour ENDING, local prevailing time: HE19 is 6 to 7pm. Hour beginning h uses HE h+1.
- CAISO OASIS stamps each interval by its start in GMT. The research scripts convert to MDT hour beginning.
- `research/analysis/depth/headroom.py` prints hour ending, local.
- Torus's 2025 event heatmap labels hours 12am to 11pm and states no time zone. Always show both readings: as Mountain time, and as UTC (subtract 6 hours for MDT, 7 for MST).

## Paths

- `docs/plan/synthesis.json` cites old script paths such as `research/scratch-demo-story/habit.py`. The scripts live in `research/analysis/demo-story/`, `research/analysis/option2/`, `research/analysis/depth/` and `research/analysis/scripts/`.
- `prep/reference/habit.py`, `fix.py` and `stage_numbers.py`, named in the engine's pinned tests, do not exist yet. Until the Data lane copies them, the research copies above are the reference.
- `../clearlane-raw` sits beside the repo and never enters git (third-party page snapshots, `PACE.xlsx`, all-BA EIA files, event slides). Commands that read it need that folder in place.

## Commands

Run from the repo root (`C:/Users/Craig Cossairt/Code/clearlane`) in Git Bash. Mirrors go in a temp directory, never in the repo.

```bash
W=$(mktemp -d)

# M1: demo-story scripts read {R}/data and {R}/oasis
mkdir -p "$W/R/data" && cp research/data/pace_snapshot_2026-10-27.csv "$W/R/data/" && cp -r research/data/oasis "$W/R/oasis"

# M2: option2 scripts import a sibling module and read ../data/eia930 (all-BA file from the raw folder)
mkdir -p "$W/o2/data/eia930" && cp -r research/analysis/option2 "$W/o2/option2" && cp ../clearlane-raw/eia/EIA930_BALANCE_2026_Jul_Dec.csv "$W/o2/data/eia930/"

# M3: depth scripts expect EIA-930 file names; the PACE extracts are enough
mkdir -p "$W/hr/eia930" "$W/hr/data/eia930"
cp research/data/eia930/PACE_EIA930_BALANCE_2025_Jul_Dec.csv "$W/hr/eia930/EIA930_BALANCE_2025_Jul_Dec.csv"
cp research/data/eia930/PACE_EIA930_BALANCE_2026_Jan_Jun.csv "$W/hr/eia930/EIA930_BALANCE_2026_Jan_Jun.csv"
cp research/data/eia930/PACE_EIA930_BALANCE_2026_Jul_Dec.csv "$W/hr/data/eia930/EIA930_BALANCE_2026_Jul_Dec.csv"
cp research/data/pace_snapshot_2026-10-27.csv "$W/hr/data/"
```

| ID | Command | Notes |
|---|---|---|
| C1 | `python -I research/analysis/demo-story/habit.py research` | Reference race. Prints the fixed overnight and timetable plans, 70 MW and 500 MW scale. |
| C2 | `python -I research/analysis/demo-story/numbers.py "$W/R"` | Needs M1. Its crash section reads snapshot index as local hour and is wrong; use C3 for call shares. |
| C3 | `python -I research/analysis/demo-story/fix.py "$W/R" research/analysis/demo-story/numbers.py` | Needs M1. Hourly DP with wear price, call shares under three heatmap readings, reserve cost. |
| C4 | `python -I research/analysis/demo-story/co2.py ../clearlane-raw/eia/PACE.xlsx` | About 15 s. EIA PACE CO2 by hour ending, Oct 1-25 and July. |
| C5a | `(cd "$W/o2/option2" && python -I -c 'import sys,runpy; sys.path.insert(0,"."); runpy.run_path(sys.argv[1], run_name="__main__")' step_hours.py)` | Needs M2. Matches `research/analysis/option2/step_hours_output.txt`. |
| C5b | same as C5a with `edam_where_vs_when.py` | Needs M2. Matches `where_vs_when_output.txt`. |
| C5c | same as C5a with `carbon_tradeoff.py` | Needs M2. Matches `carbon_tradeoff_output.txt`, including its known traceback at the end. |
| C6 | `python -I -c 'import site,sys,runpy; sys.path.append(site.getusersitepackages()); sys.argv=sys.argv[1:]; runpy.run_path(sys.argv[0], run_name="__main__")' research/analysis/depth/headroom.py "$W/hr"` | Needs M3 and numpy (`-I` hides user site-packages; this adds them back). Matches `headroom_output.txt`. Swap in `extras.py` for `extras_output.txt` (all but its last two lines reproduce). |
| C7a | `(cd research && python -I analysis/scripts/pace_analysis.py data/eia930)` | Matches `research/analysis/pace_analysis_output.txt`. |
| C7b | `(cd research && python -I analysis/scripts/join_analysis.py data/eia930 'data/oasis/dam_jul/*.csv' 'data/oasis/dam_oct/*.csv')` | Matches `join_analysis_output.txt`. |
| C7c | `(cd research && python -I analysis/scripts/lmp_analysis.py 'data/oasis/dam_jul/*.csv' 'data/oasis/dam_oct/*.csv')` | Matches `lmp_analysis_output.txt`. HB = hour beginning MDT. |
| C8 | `(cd research && python -I analysis/scripts/cong.py 'data/oasis/dam_jul/*.csv' 'data/oasis/dam_oct/*.csv' 'data/caiso7/*.csv' 'data/caiso2/*.csv')` | Congestion share of price. |
| C9 | `python -I research/analysis/scripts/pace_co2_units.py ../clearlane-raw/eia/PACE.xlsx 46320` | Oct 25 2026 hourly PACE CO2 (Excel serial 46320). |
| C10 | `python -I "$W/arith.py" research/data/pace_snapshot_2026-10-27.csv` | Save the script in Appendix A as `$W/arith.py` first. Snapshot means, lanes, race, CO2, campus, storage arithmetic. |
| C11 | `curl -sL -A "Mozilla/5.0" -o "$W/p.html" "<url>" && python -I research/analysis/scripts/html2text.py "$W/p.html" \| grep -n -i "<term>"` | Live page check. html2text keeps the first 160 text lines. |
| C12 | `grep -n -i "<term>" ../clearlane-raw/torus-text/<file>.txt` | Raw Torus page snapshot (captured Oct 26 2026). |
| C13 | `curl -sL -o "$W/i.jpg" "<image url>"`, then open the image | Torus case-study images. |
| C14 | `curl -s -o /dev/null -A "Mozilla/5.0" -w "%{http_code}\n" "<url>"` | HTTP status. |
| C15 | open `../clearlane-raw/event/s<N>.png` | Kickoff slides. |
| N | open the URL cited on the named note line | For UNCHECKED rows. |

## Utah grid prices and timing

All prices are PACE day-ahead LMP at node ELAP_PACE-APND, in $/MWh, from CAISO OASIS PRC_LMP DAM.

| Key | Claim | Value | Class | Source | Re-derive | Lvl | Status |
|---|---|---|---|---|---|---|---|
| edam_go_live | The western Extended Day-Ahead Market went live May 1 2026 with CAISO and PacifiCorp's two balancing areas (PacifiCorp East and PacifiCorp West). Portland General Electric joined Oct 1 2026. | 2026-05-01; PGE 2026-10-01 | REAL | https://www.pacificorp.com/about/newsroom/news-releases/extended-day-ahead-market-live.html ; https://www.caiso.com/about/news/news-releases/extended-day-ahead-market-expanded-to-include-portland-general-electric ; `research/notes/utah-grid.findings.md:1` | N | 2 | VERIFIED (upgraded by verifier Oct 27: both releases read in web search excerpts; PGE's own Oct 1 2026 release agrees) |
| pace_dam_history_start | Public PACE day-ahead prices begin with EDAM, so the backtest cannot start before May 1 2026. An OASIS query for Apr 25 to May 24 returned ELAP_PACE-APND rows only from 2026-05-01T07:00Z (Pacific midnight). | 2026-05-01 | REAL | `research/data/caiso7/20260425_20260524_PRC_LMP_DAM_20261026_20_27_01_v12.csv`; `research/notes/data-option1.findings.md:3`; `contracts/types.ts` header | one-off: list the distinct INTERVALSTARTTIME_GMT hours for NODE ELAP_PACE-APND in the caiso7 file (552 hours, first 2026-05-01T07) | 4 | VERIFIED (upgraded by verifier Oct 27: ran the one-off; the file holds no PACE hour before May 1) |
| oct27_prices_available_mt | Oct 27 prices were already on OASIS when queried at 03:16Z Oct 27 (8:16pm PT, 9:16pm MT Oct 26). The exact posting time is unknown. Note: synthesis says Oct 28 prices "post at about 9:16pm"; the research only shows they were there by then. Say "available by 9:16pm the night before". | by 9:16pm MT, Oct 26 | REAL | `research/data/caiso2/20261027_20261028_PRC_LMP_DAM_20261026_20_16_40_v12.csv` (file stamp, Pacific); `research/notes/data-option1.findings.md:2`; `docs/plan/synthesis.json` (milestones) | `ls research/data/caiso2` | 2 | CONFLICT. Checked by verifier (Oct 27): file stamp 20261026_20_16_40 re-read; that the stamp is Pacific time comes from the research note and was not independently confirmed |
| price_min_oct27 | Cheapest hour on Oct 27 was the 3pm hour. | $21.38 at HB 3pm | REAL | snapshot `da_lmp_elap_pace` | C10 | 4 | VERIFIED. Checked by verifier (Oct 27): C10 and C2 re-run; the HB 3pm row reads 21.38 |
| peak_price | Priciest hour on Oct 27 was the 6pm hour. | $55.78 at HB 6pm | REAL | snapshot | C10 | 4 | VERIFIED. Checked by verifier (Oct 27): C10 and C2 re-run; the HB 6pm row reads 55.78 |
| peak_over_trough | The 6pm price was 2.6 times the 3pm price. | 2.609x, show "2.6x" | DERIVED | snapshot | C10 | 4 | VERIFIED. Checked by verifier (Oct 27): C10 re-run, 55.78 / 21.38 = 2.609 |
| overnight_avg | Mean price of HB 1am-5am (1am to 6am). Verifier correction: this is NOT the window the fixed overnight rule charges in. The rule (C1 and the engine pins) charges HB 1am-4am (1am to 5am) at a mean of $39.53 (C1). Demo Beat 2 says "The off-peak rule charges overnight at {overnight_avg} [$39]", which pairs this 5-hour mean with a rule that pays $39.53. Say "$39.53" for the rule's charge price, or label $38.71 "overnight average, 1am to 6am". | $38.71 | DERIVED | snapshot; `docs/plan/synthesis.json` demo_script Beat 2 and Engine pins | C10, C2, C1 | 4 | CONFLICT (verifier Oct 27: value re-run with C10 and C2; claim text corrected and status changed from VERIFIED). Window mean only: never quote it as a charge price; the charge-price keys are fixed_rule_charge_usd_mwh and timetable_charge_usd_mwh (#19, item 6) |
| midday_avg | Mean price of HB 9am-4pm (9am to 5pm). Verifier note: Clearlane's reference timetable charges HB 1pm-3pm at a mean of $21.55 (C1), not at this mean. Demo Beat 2 says "Clearlane charges at {midday_avg} [$22]"; $22.83 shows as $23 and does not match the bracket. Say "$21.55" for the timetable's charge price, or label $22.83 "midday average, 9am to 5pm". | $22.83 | DERIVED | snapshot; `docs/plan/synthesis.json` demo_script Beat 2 | C10, C2, C1 | 4 | CONFLICT (verifier Oct 27: value re-run with C10 and C2; status changed from VERIFIED because of the Beat 2 pairing). Window mean only: never quote it as a charge price; the charge-price keys are fixed_rule_charge_usd_mwh and timetable_charge_usd_mwh (#19, item 6) |
| fixed_rule_charge_usd_mwh | Mean price of the hours the fixed off-peak rule charges in (HB 1am-4am, 1am to 5am) on Oct 27. The beat 2 charge price for the off-peak rule. | $39.53 | DERIVED | C1 (the engine writes this key in Core 12) | C1 | 1 | UNCHECKED (value as the verifier's C1 run is quoted in the overnight_avg row; not re-run this pass; added in #19) |
| timetable_charge_usd_mwh | Mean price of the hours Clearlane's reference timetable charges in (HB 1pm-3pm) on Oct 27. The beat 2 charge price for Clearlane. | $21.55 | DERIVED | C1 (the engine writes this key in Core 12) | C1 | 1 | UNCHECKED (value as the verifier's C1 run is quoted in the midday_avg row; not re-run this pass; added in #19) |
| option2_co2_t | CO2 avoided per day by the Option 2 shift: 25 MW for 3 hours moved from the priciest hours (HB 6pm-8pm) to the cheapest midday hours (HB 1pm-3pm) on Oct 27. An average-emissions estimate, not marginal. | 15.975 t/day | DERIVED | `engine/src/reference.ts` option2Shift on the snapshot bundle; pinned in `engine/test/reference.test.ts` (#115) | 25 x (629+673+676 - 450-443-446) / 1000 from the bundle co2_g_kwh | 1 | UNCHECKED (Integration re-derived the arithmetic from the fixture, Oct 27; not cross-checked by Science) |
| evening_avg | Mean price of HB 6pm-9pm (6pm to 10pm). | $55.31 | DERIVED | snapshot | C10, C2 | 4 | VERIFIED. Checked by verifier (Oct 27): C10 and C2 re-run (HB 6pm-9pm) |
| oct27_mean_price | Mean of the snapshot's 24 rows. Note: the rows are HB 1am Oct 27 to HB 0 Oct 28 (see Hour conventions). | $38.22 | DERIVED | snapshot; `research/analysis/depth/extras_output.txt` | C10 | 4 | VERIFIED. Checked by verifier (Oct 27): C10, C8 (caiso2 mean LMP 38.22) and C6 extras re-run |
| lane_clear_max_usd | Clear lane: price at or under the day's minimum plus 25% of its range. | $29.98 (21.38 + 0.25 x 34.40) | DERIVED | lane rule in `docs/plan/plan-v1.html`, `docs/plan/synthesis.json` | C10 | 4 | VERIFIED. Checked by verifier (Oct 27): C10 re-run |
| lane_jam_min_usd | Jam: price at or over the day's maximum minus 25% of its range. | $47.18 | DERIVED | same | C10 | 4 | VERIFIED. Checked by verifier (Oct 27): C10 re-run |
| lane_hours_oct27 | Oct 27 lanes: clear HB 9am-4pm, jam HB 6pm-11pm, every other hour shoulder (including HB 5pm at $34.03). | clear 8 h, jam 6 h | DERIVED | snapshot; engine pinned tests in `docs/plan/synthesis.json` | C10 | 4 | VERIFIED. Checked by verifier (Oct 27): C10 re-run; HB 5pm ($34.03) and HB 0 of Oct 28 ($46.11) fall in shoulder |
| ribbon_hour_label | The plan-v1 chart caption says "by hour ending", but its labels (1am $44.17 to midnight $46.11) are hour beginning. Use "hour beginning, Mountain time". | hour beginning | DERIVED | `docs/plan/plan-v1.html` chart caption vs snapshot `local_mt` | `grep -n "hour ending" docs/plan/plan-v1.html` | 2 | CONFLICT. Checked by verifier (Oct 27): plan-v1.html line 187 caption says hour ending; its bar titles run 1am $44.17 to midnight $46.11, which is snapshot hour beginning |
| solar_4pm_to_6pm_mw | EDAM day-ahead solar forecast for PACE falls from the 4pm hour to the 6pm hour. It is a forecast, not metered output. | 2,056 MW to 36 MW | REAL | snapshot `edam_solar_fcst_pace_mw` | C10 | 4 | VERIFIED. Checked by verifier (Oct 27): C10 re-run (2,055.85 and 35.73) |
| net_load_climb_mw | Net load (day-ahead load forecast minus EDAM solar and wind forecasts) climbs from the 3pm hour (604.6 MW) to the 6pm hour (4,259.1 MW). Note: the demo script rehearses "[3,654]"; the value 3,654.51 rounds to 3,655, which is what C2 prints. Show "3,655" or "about 3,650". | 3,654.5 MW | DERIVED | snapshot; `docs/plan/synthesis.json` demo_script | C10, C2 | 4 | CONFLICT. Checked by verifier (Oct 27): C10 prints 3,654.51; C2 prints +3655 |
| net_load_max_oct27 | Highest net load of the day, HB 8pm. | 4,709 MW | DERIVED | snapshot | C10, C2 | 4 | VERIFIED. Checked by verifier (Oct 27): C10 and C2 re-run (4,709.0 at HB 8pm) |
| net_load_min_daytime | Lowest daytime net load, HB 11am. | 341 MW | DERIVED | snapshot | C2 | 4 | VERIFIED. Checked by verifier (Oct 27): C2 re-run (341 at HB 11am) |
| load_peak_oct27_mw | Day-ahead PACE load forecast peaks at HB 7pm; low is HB 3am (4,888 MW). Forecast, not metered. | 6,024 MW | REAL | snapshot `da_load_fcst_pace_mw` | C10 | 4 | VERIFIED. Checked by verifier (Oct 27): C10 re-run (4,888 to 6,024) |
| congestion_oct27 | PACE's congestion component was negative every hour of Oct 27. | -$7.59 to -$0.48 | REAL | snapshot `da_congestion_pace` | C10 (min/max of the column) | 4 | VERIFIED. Checked by verifier (Oct 27): C10 re-run; C8 shows caiso2 nonzero in 24 of 24 hours, max magnitude 7.59 |
| peers_oct27 | Same day, PACW and PGE prices ran $25.67 to $55.42; SP15 (California) $9.14 to $50.23. | see claim | REAL | snapshot | C10 (min/max) | 4 | VERIFIED. Checked by verifier (Oct 27): C10 re-run |
| oct_step_hour_days | On 24 of 27 October days (Oct 1-27), the day's largest upward hourly price step landed in HB 5pm (9 days) or HB 6pm (15 days). | 24 of 27; median step $15.1 | DERIVED | `research/analysis/option2/step_hours_output.txt` | C5a | 4 | VERIFIED. Checked by verifier (Oct 27): C5a re-run, output identical to step_hours_output.txt: {5: 1, 6: 1, 8: 1, 17: 9, 18: 15} |
| jul_step_hour_spread | In July (30 days) the largest step was spread out: 28 of 30 days between HB 1pm and HB 8pm (HB 1pm 2, 2pm 5, 3pm 1, 4pm 3, 5pm 1, 6pm 6, 7pm 7, 8pm 3); the other two days at HB 6am and HB 11pm. | 28 of 30; median step $10.1 | DERIVED | `research/analysis/option2/step_hours_output.txt` | C5a | 4 | VERIFIED (corrected by verifier Oct 27: was "27 of 30"; C5a prints {6: 1, 13: 2, 14: 5, 15: 1, 16: 3, 17: 1, 18: 6, 19: 7, 20: 3, 23: 1}) |
| oct_hb17_hb18_jump | Median Oct jump from HB 5pm to HB 6pm. A different measure from oct_step_hour_days. | $10.8, n=27 | DERIVED | `research/analysis/option2/carbon_tradeoff_output.txt` | C5c | 4 | VERIFIED. Checked by verifier (Oct 27): C5c re-run (last line) |
| oct_hourly_ratio | Oct 1-25 means: HB 6pm $57.0 vs HB 11am $28.6. | 1.99x | DERIVED | `research/analysis/lmp_analysis_output.txt:59` | C7c | 4 | VERIFIED. Checked by verifier (Oct 27): C7c re-run, output identical |
| jul_hourly_ratio | July 1-30 means: HB 8pm $46.7 vs HB 8am $19.0. | 2.45x | DERIVED | `research/analysis/lmp_analysis_output.txt:28` | C7c | 4 | VERIFIED. Checked by verifier (Oct 27): C7c re-run, output identical |
| daily_spread_median | Median daily max-minus-min price spread. | July $27.2 (30 days); Oct 1-25 $22.7 (25 days) | DERIVED | `lmp_analysis_output.txt:30,61` | C7c | 4 | VERIFIED. Checked by verifier (Oct 27): C7c re-run |
| congestion_share | Share of PACE price from congestion. | July 0.8%; Oct 1-25 6.9% | DERIVED | C8 output | C8 | 4 | VERIFIED. Checked by verifier (Oct 27): C8 re-run (dam_jul 0.8%; dam_oct, 600 hours, 6.9%) |
| congestion_may | May 1-23 PACE congestion was nonzero in 300 of 552 hours, max magnitude $41.65. | 300/552 | DERIVED | C8 output (`data/caiso7`); `research/notes/data-option1.findings.md:4` | C8 | 4 | VERIFIED. Checked by verifier (Oct 27): C8 re-run; caiso7 holds 552 PACE hours, 2026-05-01T07Z to 2026-05-24T06Z |
| pace_peak_16mo_mw | Highest PACE demand hour in the 16-month EIA-930 pull, Jul 20 2026, HE 17:00 local (4 to 5pm MDT). Not a confirmed all-time record. | 10,173 MW | REAL | `research/analysis/pace_analysis_output.txt`; `headroom_output.txt` line 1 | C7a, C6 | 4 | VERIFIED. Checked by verifier (Oct 27): C7a and C6 re-run, outputs identical |
| eia_forecast_error | EIA-930 day-ahead demand forecast error for PACE. | median 4.3%, p90 11.9% | DERIVED | `pace_analysis_output.txt` | C7a | 4 | VERIFIED. Checked by verifier (Oct 27): C7a re-run (n=11,473) |
| price_fossil_corr | Correlation of PACE price with fossil share. | July 0.31; Oct 1-25 0.63 | DERIVED | `join_analysis_output.txt:1,4` | C7b | 4 | VERIFIED. Checked by verifier (Oct 27): C7b re-run, output identical |
| utah_tou_peak | Utah's residential time-of-use pilot (Schedule 1 TOU) puts on-peak at 6 to 10pm weekdays. | 6-10pm | REAL | `research/notes/utah-grid.findings.md:13` (utahcleanenergy.org) | N | 1 | UNCHECKED |
| oasis_limits | One OASIS query must cover under 31 days (exactly 31 returns error 1004); about one request per 5 s or HTTP 429; no CORS header, so the browser cannot fetch it. | 31-day cap | REAL | `research/notes/data-option1.findings.md:5,6,10` | N | 1 | UNCHECKED |

## CO2 and fuel mix

CO2 numbers are average-emissions estimates from EIA's hourly PACE data (generated basis, lb/kWh x 453.592 = g/kWh). They are not marginal emissions. Say "estimated, average emissions" every time. PACE covers Utah, Wyoming and Idaho, so say "PacifiCorp East" when quoting hourly CO2 or fuel mix.

| Key | Claim | Value | Class | Source | Re-derive | Lvl | Status |
|---|---|---|---|---|---|---|---|
| co2_profile_he_oct | Mean PACE CO2 intensity by hour ENDING, Oct 1-25 2026 (n=25). HE01-24: 697, 697, 695, 694, 698, 704, 709, 698, 623, 534, 485, 461, 455, 450, 443, 446, 464, 531, 629, 673, 676, 682, 684, 693. | g/kWh | DERIVED | `../clearlane-raw/eia/PACE.xlsx`; profile pinned in `docs/plan/synthesis.json` | C4 | 4 | VERIFIED. Checked by verifier (Oct 27): C4 re-run (n=25 per hour); matches the profile in habit.py and the synthesis pins |
| co2_overnight_avg | Mean of HE2-6 (1am to 6am), the same window as overnight_avg. Verifier correction: this is not the fixed rule's charge window; the rule charges HE2-5 (HB 1am-4am) at 696 g/kWh (charge_co2_race). | 698 g/kWh | DERIVED | same | C4 | 4 | VERIFIED (verifier Oct 27: value re-run with C4; label corrected) |
| co2_midday_avg | Mean of HE10-16 (9am to 4pm). Note: one hour shorter than midday_avg's price window (9am to 5pm). | 468 g/kWh | DERIVED | same | C4 | 4 | VERIFIED. Checked by verifier (Oct 27): C4 re-run |
| co2_evening_avg | Mean of HE19-22 (6pm to 10pm). | 665 g/kWh | DERIVED | same | C4 | 4 | VERIFIED. Checked by verifier (Oct 27): C4 re-run |
| co2_clean_dirty_hours | Cleanest hour HE15 (2 to 3pm), dirtiest HE7 (6 to 7am), Oct 1-25. | 443 vs 709 g/kWh, 1.60x | DERIVED | same | C4 | 4 | VERIFIED. Checked by verifier (Oct 27): C4 re-run |
| co2_profile_jul | July: HE10-16 480, HE19-22 636, HE2-6 751; cleanest HE12 464, dirtiest HE6 770. | g/kWh | DERIVED | same | C4 | 4 | VERIFIED. Checked by verifier (Oct 27): C4 re-run (n=31 per hour) |
| co2_oct25_range | On Oct 25, PACE CO2 ran from 817 g/kWh at HE8 (1.8008 lb/kWh) to 504 g/kWh at HE16 (1.1104 lb/kWh: 3,429.44 t over 6,809 MWh). The consumed-basis column is blank. | 504 to 817 g/kWh | DERIVED | `PACE.xlsx` | C9 | 4 | VERIFIED. Checked by verifier (Oct 27): C9 re-run (serial 46320 is Oct 25 2026); HE8 is the day's maximum and HE16 its minimum |
| fossil_priciest_oct | Oct 1-25: the priciest 10% of hours averaged $67.3 at 85.1% fossil; the cheapest 10% averaged $23.0 at 39.8% fossil. | 85.1% vs 39.8% | DERIVED | `research/analysis/join_analysis_output.txt:5-6` | C7b | 4 | VERIFIED. Checked by verifier (Oct 27): C7b re-run |
| fossil_priciest_jul | July: priciest 10% $65.2 at 76.3% fossil; cheapest 10% $12.9 at 52.2%. | 76.3% vs 52.2% | DERIVED | `join_analysis_output.txt:2-3` | C7b | 4 | VERIFIED. Checked by verifier (Oct 27): C7b re-run |
| utah_mix_2025 | Utah generation 2025: coal about 47%, gas about 30%, solar about 17% (EIA). Utah, not PACE. | % of generation | REAL | `research/notes/utah-grid.findings.md:27` (eia.gov/states/UT) | N | 1 | UNCHECKED |
| utah_co2_rate_2024 | Utah's 2024 CO2 rate, 8th highest among states (EIA). | 1,322 lb/MWh | REAL | same | N | 1 | UNCHECKED |
| option2_ci_basis | The Option 2 scripts use lifecycle intensity built from IPCC factors on EIA-930 fuel mix, not EIA's observed CO2. Their g/kWh values differ from the rows above and must say so. | method note | DERIVED | `research/analysis/option2/edam_where_vs_when.py` (`load_ci`) | read the function | 2 | VERIFIED. Checked by verifier (Oct 27): EF table at edam_where_vs_when.py:33 (IPCC AR5 lifecycle medians, per its header); load_ci at line 45 |

## Torus-published facts

Torus's own published numbers are company claims, not independent measurements. Show them with a TORUS_PUBLISHED chip and keep them apart from our SIMULATED results. Live checks were run on Oct 26 2026.

| Key | Claim | Value | Class | Source | Re-derive | Lvl | Status |
|---|---|---|---|---|---|---|---|
| torus_spin_c_rating | Torus Spin (flywheel) is rated 10C, which Torus calls 20x the power-to-energy ratio of traditional battery storage. | 10C | TORUS_PUBLISHED | https://www.torus.co/torus-flywheel ; `../clearlane-raw/torus-text/torus-nova.txt` | C11 url term `10C` | 2 | VERIFIED. Checked by verifier (Oct 27): live Spin page re-fetched; it states 10C and 20 times the power-to-energy ratio of traditional BESS; torus-nova.txt line 13 says 20x higher than traditional BESS |
| torus_spin_discharge_min | Spin completes a full discharge in 6 minutes. | 6 min | TORUS_PUBLISHED | https://www.torus.co/torus-flywheel | C11 term `6-minute` | 2 | VERIFIED. Checked by verifier (Oct 27): live Spin page re-fetched |
| torus_spin_cycle_min | Spin can discharge and recharge in 12 minutes, for loads that spike in series. | 12 min | TORUS_PUBLISHED | same | C11 term `12 minutes` | 2 | VERIFIED. Checked by verifier (Oct 27): live Spin page re-fetched |
| torus_spin_cycles | Spin cycle life. | 25,000 | TORUS_PUBLISHED | same; `torus-nova.txt` | C11 term `25,000` | 2 | VERIFIED. Checked by verifier (Oct 27): live Spin page re-fetched; torus-nova.txt lines 15, 29 and 83 |
| torus_spin_peak_use | The Spin page lists flattening the highest 15-minute peak each billing cycle. | 15-minute peak | TORUS_PUBLISHED | same | C11 term `15-minute` | 2 | VERIFIED. Checked by verifier (Oct 27): live Spin page re-fetched |
| torus_pulse_c_rating | Torus Pulse (LFP battery) spec table: C-rating 0.5C. | 0.5C | TORUS_PUBLISHED | https://www.torus.co/torus-nova-pulse | C11 term `0.5C` | 2 | VERIFIED. Checked by verifier (Oct 27): live Pulse page re-fetched (spec table) |
| torus_pulse_cycles | Pulse cycle life. | 7,500 | TORUS_PUBLISHED | same; `torus-nova.txt` (spec table "25,000 Spin, 7,500 Pulse") | C11 term `7,500` | 2 | VERIFIED. Checked by verifier (Oct 27): live Pulse page re-fetched; torus-nova.txt line 83 |
| torus_lifespan_yr | The 25-year lifespan is listed for Torus Station as a whole, not for Pulse. Note: synthesis says "Pulse 0.5C, 7,500 cycles, 25-year life". Say "Station lifespan 25 years". | 25 years | TORUS_PUBLISHED | `../clearlane-raw/torus-text/torus-nova.txt` (Specs: Lifespan 25 years) vs `docs/plan/synthesis.json` (Engine prompt) | C12 file `torus-nova` term `Lifespan` | 2 | CONFLICT. Checked by verifier (Oct 27): torus-nova.txt lines 80-81 put Lifespan 25 years under Station specs; the live Pulse spec table has no lifespan, and the Pulse page mentions repowering |
| torus_station_specs | Torus Station: modular up to 100+ MW; 12-16 weeks contract to commissioning; designed for 99.9% uptime; certifications include UL 9540, IEEE 1547 and IEEE 2030.5. | see claim | TORUS_PUBLISHED | `torus-nova.txt` (https://www.torus.co/torus-nova) | C12 terms `100+`, `12-16`, `2030.5` | 2 | VERIFIED. Checked by verifier (Oct 27): C12 re-run (torus-nova.txt lines 18, 57, 64, 79, 85, 91) |
| torus_facility_sqft | Torus gives three sizes for its Salt Lake City factory: the Station page says 545,000 sq ft in one section and 582,000 sq ft in its FAQ, and the Sept 2025 Magnetar release and the Dec 2025 wrap-up call GigaOne 540,000 square feet. Do not quote any of them. | 545,000 vs 582,000 vs 540,000 | TORUS_PUBLISHED | `torus-nova.txt` lines 66 and 100; Magnetar release; wrap-up | C12 term `sq`; C11 term `540,000` | 2 | CONFLICT (verifier Oct 27: added the 540,000 figure found on both live news pages) |
| torus_utilities_claims | The utilities page says enrolled assets ramp to full power in under 30 seconds, offers "Deploy 200 MW in 12 months", and calls 10C "20x the power density of a typical battery at 0.5C". | under 30 s | TORUS_PUBLISHED | `../clearlane-raw/torus-text/utilities-electrical-utilities.txt` (https://www.torus.co/utilities-electrical-utilities) | C12 terms `30 seconds`, `200 MW`, `0.5C` | 2 | VERIFIED. Checked by verifier (Oct 27): C12 re-run (lines 8, 33, 36) |
| lasso_dispatch_ms | Torus Lasso dispatch response. | sub-250 ms | TORUS_PUBLISHED | `../clearlane-raw/torus-text/torus-lasso.txt` (https://www.torus.co/torus-lasso) | C12 term `250` | 2 | VERIFIED. Checked by verifier (Oct 27): C12 re-run (lines 7, 22) |
| lasso_inputs | Lasso's ML models use "facility load patterns, weather data, and grid signals", and its FAQ adds rate schedules. A carbon or emissions input is not advertised. Do not claim Lasso lacks one. | load, weather, grid signals, rate schedules | TORUS_PUBLISHED | `torus-lasso.txt` | C12 terms `weather`, `rate schedules`, `carbon` (no hit) | 2 | VERIFIED. Checked by verifier (Oct 27): C12 re-run (lines 13, 35); no hit for carbon or emission |
| rmp_customers | Rocky Mountain Power serves 1.2 million customers in Utah, Wyoming and Idaho. | 1.2 million | TORUS_PUBLISHED | `../clearlane-raw/torus-text/cs-case-studies-rocky-mountain-power.txt` (https://www.torus.co/case-studies/case-studies-rocky-mountain-power) | C12 term `1.2 million` | 2 | VERIFIED. Checked by verifier (Oct 27): C12 re-run |
| rmp_primary_use | The RMP case study names Fast Frequency Response as the primary use case; RMP sends unplanned dispatch signals when frequency drops. | Fast Frequency Response | TORUS_PUBLISHED | same | C12 term `Frequency` | 2 | VERIFIED. Checked by verifier (Oct 27): C12 re-run |
| rmp_events_2025 | Torus-published 2025 event count for RMP. Note: the case study and its heatmap image say 359 VPP events in 2025; Torus's 2025 wrap-up says it "responded to more than 360 unplanned demand response events" across customer sites. Say "359 events in 2025 (Torus, RMP case study)". | 359 | TORUS_PUBLISHED | case study txt; heatmap image; https://www.torus.co/news/2025-wrap-up-and-look-ahead-to-2026 | C12 term `359`; C11 wrap-up term `360` | 2 | CONFLICT. Checked by verifier (Oct 27): case study text and heatmap image both say 359; the live wrap-up says more than 360 |
| events_2024 | Torus dispatched 137 demand response events in 2024, responding within 250 ms, with 8.7 s round trips and 99.9% uptime (Mar 18 2025 release). Say "137 in 2024" and "359 in 2025" as Torus reports them. | 137 | TORUS_PUBLISHED | https://www.torus.co/news/torus-receives-commercial-energy-storage-approval-for-rocky-mountain-power-s-watt | C11 term `137` | 2 | VERIFIED. Checked by verifier (Oct 27): live release re-fetched. Date note: the page header reads 3.18.2025 and the dateline March 19, 2025 |
| rmp_dispatches_18mo | PacifiCorp's Shawn Grant, quoted on the case study: commercial Torus sites were dispatched 520 times over 18 months, unscheduled. | 520 | TORUS_PUBLISHED | case study txt | C12 term `520` | 2 | VERIFIED. Checked by verifier (Oct 27): C12 re-run |
| rmp_hours_share | RMP dispatches during peak grid events in less than 1% of hours per year. | under 1% | TORUS_PUBLISHED | case study txt | C12 term `1% of hours` | 2 | VERIFIED. Checked by verifier (Oct 27): C12 re-run |
| wattsmart_hours_2024 | Torus's Wattsmart page says systems were used "less than 1% of the year" in 2024, and in another place "only utilized 1% of the time". Say "less than 1%". | under 1% | TORUS_PUBLISHED | https://www.torus.co/wattsmart | `grep -o -i "[^.]*1% of[^.]*" "$W/p.html"` after C11 | 2 | CONFLICT. Checked by verifier (Oct 27): live page re-fetched; both wordings are on it |
| torus_uptime_2025 | Case study: "359 unplanned events. 99.9% uptime." and the image card "Critical Path Uptime 99.9%". The wrap-up gives both: 99.9% uptime in its summary line and 99.99% uptime across customer sites in its body. Say "99.9% (RMP case study)". | 99.9% | TORUS_PUBLISHED | case study txt and heatmap image vs wrap-up | C12 term `uptime`; C11 wrap-up terms `99.9`, `99.99` | 2 | CONFLICT (verifier Oct 27: both wrap-up figures found on the live page; case study and image re-read) |
| rmp_heatmap_by_hour | 2025 "VPP Event Time Slots", events by clock hour 12am to 11pm: 9, 41, 5, 4, 1, 3, 4, 14, 23, 26, 25, 20, 15, 33, 19, 14, 14, 8, 6, 4, 5, 34, 24, 8. Sums to 359. No time zone is shown. | counts | TORUS_PUBLISHED | https://www.datocms-assets.com/93357/1778881001-vpp-events-rmp.jpg | C13, then C10 prints the sum | 2 | VERIFIED. Checked by verifier (Oct 27): image re-downloaded and read; its Total row matches every count; C10 sum 359 |
| rmp_heatmap_by_weekday | Same chart by weekday, Mon to Sun: 50, 57, 43, 57, 53, 45, 54. Sums to 359. | counts | TORUS_PUBLISHED | same image | C13 | 2 | VERIFIED. Checked by verifier (Oct 27): same image; its Total column matches |
| rmp_event_ramp_s | One published unplanned frequency response event: ramp 19 s against a 30 s target. The case study also says assets ramp in under 20 s. | 19 s vs 30 s | TORUS_PUBLISHED | https://www.datocms-assets.com/93357/1778882593-unplanned-ffr-rmp-1.jpg ; case study txt | C13 | 2 | VERIFIED. Checked by verifier (Oct 27): image re-downloaded and read; case study text says under 20 seconds |
| rmp_event_target_pct | Same event: 102% of target power delivered, against a 90-100% target band. The 2025 summary card also shows "Target Power 102%". | 102% | TORUS_PUBLISHED | both images | C13 | 2 | VERIFIED. Checked by verifier (Oct 27): both images re-read |
| rmp_event_kw | Same event: effective power 3,828 kW against a 3,349.14-4,093.39 kW target. Caveat: the chart's y-axis tops out near 400 kW, so quote the label, not the axis. | 3,828 kW | TORUS_PUBLISHED | event image | C13 | 2 | VERIFIED. Checked by verifier (Oct 27): image re-read; its y-axis labels run -100 to 400 kW |
| rmp_event_minutes | Same event, measured against the chart's 1-minute ticks (about 224 px a minute): the shaded event window runs from about 12:59:44 to 1:05:22 AM, and Torus output stays above half power from about 12:59:53 to 1:05:31 AM. Both spans are about 5.6 minutes. No time zone is shown. RMP program sources also say frequency events last about 5 minutes (research note, not reopened). | about 5.6 min (5.5 to 5.7 by edge) | TORUS_PUBLISHED | event image; `research/notes/torus-cases-a.findings.md:8` | C13, then measure pixel positions against the axis ticks | 2 | VERIFIED (corrected by verifier Oct 27: was "about 5.5 min, just before 1:00 AM to about 1:05:30 AM") |
| rmp_event_timing_2024 | Torus's CEO described 2024 events as mostly late-afternoon and evening load (Utility Dive). The 2025 heatmap peaks at 1am (41), 9pm (34) and 1pm (33), in an unstated time zone. Do not describe call timing as "mostly evening". | see claim | REAL | `research/notes/utah-grid.findings.md:19`, `torus-cases-a.findings.md:13` vs heatmap image | N; C13 | 2 | CONFLICT. Checked by verifier (Oct 27): heatmap side re-read (1am 41, 9pm 34, 1pm 33); the Utility Dive side was not reopened |
| torus_500mw | Case study: RMP "deploys Torus to create 500 MW of flexible capacity", "being deployed". Sept 2025 release: an MOU "covering up to 500 megawatts". Say "an MOU for up to 500 MW", always a ceiling, never installed capacity. | up to 500 MW | TORUS_PUBLISHED | case study txt vs https://www.torus.co/news/torus-raises-200-million-from-magnetar-deployment-of-modular-power-plants | C12 term `500 MW`; C11 term `500` | 2 | CONFLICT. Checked by verifier (Oct 27): case study text and live Magnetar release re-read; the live wrap-up also says the 70 MW MOU expanded to 500 MW in September 2025 |
| mou_70mw | Torus and RMP signed a 70 MW demand-response MOU in January 2025; Torus says it was filled within six months. | 70 MW | TORUS_PUBLISHED | Magnetar release (Sept 9 2025); wrap-up; approval release | C11 terms `70 MW`, `six months` | 2 | VERIFIED. Checked by verifier (Oct 27): live Magnetar release says the 70 MW agreement was filled within six months; live wrap-up confirms the January 2025 MOU; the approval release names the MOU but not the six months |
| mou_70mw_feb2025 | About one-third of the 70 MW was filled by Feb 2025, per the CEO in Utility Dive. | about 1/3 | REAL | `research/notes/utah-grid.findings.md:18` | N | 1 | UNCHECKED |
| magnetar_raise | Torus raised $200M from Magnetar, announced Sept 9 2025, when the PacifiCorp MOU expanded to up to 500 MW. | $200M | TORUS_PUBLISHED | Magnetar release | C11 term `200 million` | 2 | VERIFIED. Checked by verifier (Oct 27): live release re-fetched; the page header reads 9.5.2025 and the dateline September 9, 2025 |
| torus_gwh_2025 | By the end of 2025 Torus had more than 2 GWh of facility-managed power in operation. | 2 GWh | TORUS_PUBLISHED | wrap-up (Dec 22 2025) | C11 term `gigawatt-hours` | 2 | VERIFIED. Checked by verifier (Oct 27): live wrap-up re-fetched (crossed 2 gigawatt-hours; dated 12.22.2025) |
| torus_pge_work | The wrap-up names new work with Portland General Electric in 2025; no program name or MW is given. | no MW | TORUS_PUBLISHED | wrap-up | C11 term `Portland` | 2 | VERIFIED. Checked by verifier (Oct 27): live wrap-up re-fetched |
| wattsmart_approval | Mar 18 2025: Torus approved as one of only two commercial battery providers for RMP's Wattsmart Battery Program, for systems of 30 kW to 1.2 MW; 99% telemetry uptime in certification; met IEEE 2030.5 requirements. | 30 kW to 1.2 MW | TORUS_PUBLISHED | approval release | C11 terms `1.2 MW`, `2030.5`, `99 percent` | 2 | VERIFIED. Checked by verifier (Oct 27): live release re-fetched; same date note as events_2024 (header 3.18.2025, dateline March 19, 2025) |
| wattsmart_price | Through Wattsmart, Torus systems are offered from $549 a month by subscription. | from $549/month | TORUS_PUBLISHED | https://www.torus.co/wattsmart | C11 term `549` | 2 | VERIFIED. Checked by verifier (Oct 27): live page re-fetched (as little as $549/month; monthly subscription) |
| demand_charge_share | Torus says peak demand charges are about 50% of a commercial power bill. | about 50% | TORUS_PUBLISHED | same | C11 term `50%` | 2 | VERIFIED. Checked by verifier (Oct 27): live page re-fetched (~50% of your power bill) |
| creekstone_load_smoothing | Creekstone's Delta, Utah AI campus page lists "Torus Load Smoothing", installed Dec 29 2025. Creekstone describes the campus as over 10 GW (its claim). This is Creekstone's page, not a Torus data-center product. | installed 2025-12-29 | REAL | https://www.creekstone.energy/delta | C11 term `Torus` | 2 | VERIFIED. Checked by verifier (Oct 27): live page re-fetched (Torus Load Smoothing; installed December 29, 2025; >10 GW) |
| cto_freeway | Torus CTO/CISO Trenton Bond (May 5 2026 post) asks readers to think of power like "a freeway at 5 pm on a Friday", in a passage about congestion and getting electrons close to the load. | quote, 8 words | TORUS_PUBLISHED | https://www.torus.co/news/the-dispatch-security-isnt-a-feature-its-how-we-work | C11 term `freeway` | 2 | VERIFIED (corrected by verifier Oct 27: the quote is 8 words, not 9; live page re-fetched, dated 5.5.2026) |
| torus_dc_pages_404 | Torus's data-center pages (/data-centers-industry, /ai-ups, /ai-load-management, /speed-to-power) return HTTP 404 today; the Wayback Machine shows them returning 200 through Aug 6 2026. Note: synthesis says they "returned 404 from Aug 4". Say "offline as of Oct 26 2026"; the start date is unknown. | 404 on 2026-10-26 | REAL | C14 this pass; `research/notes/torus-intel.findings.md:12` vs `docs/plan/synthesis.json` (torus_tie) | C14 on each URL | 2 | CONFLICT. Checked by verifier (Oct 27): C14 re-run Oct 27 about 12:10am MT, 404 on all four; Wayback CDX (Jul 1 to Oct 27) shows one capture each of /data-centers-industry and /ai-load-management, HTTP 200 on Aug 6 2026 |
| torus_homepage_headline | The Aug 4 2026 homepage headline read "Smarter power for AI, industry, and the grid" and its subhead named hyperscalers; the Oct 26 capture reads "Smarter power for industries and the grid" and its subhead no longer names hyperscalers. | wording change | TORUS_PUBLISHED | `../clearlane-raw/torus-text/home-20260804.txt:4,10` vs `home.txt:4,10` | C12 term `Smarter power` | 2 | VERIFIED (verifier Oct 27: both raw captures re-read; reworded, since the headline named AI and the subhead named hyperscalers) |
| rowe_asks | Torus's letter to ROWE (dated Jun 12 2026, in ROWE's consolidated spring workshop comments) makes six recommendations. The four points used here, paraphrased: treat controllable hybrid storage as its own resource class; give controlled dispatch credit in accreditation; set behind-the-meter dispatch standards that allow for scheduled and utility-set operating envelopes; and, asked as a question, say clearly how System Critical Hours will be defined. The letter also says Torus has deployments across the PacifiCorp and PGE service territories. | 6 recommendations; 4 points used | TORUS_PUBLISHED | `../clearlane-raw/dl/wraap.txt` lines 107-156 and 237-241, the text of `wraap.pdf` (https://rowesternenergy.org/wp-content/uploads/2026/06/Consolidated-Spring-Workshop-Comments_06222026.pdf); `research/notes/torus-intel.findings.md:14` | C12 on `../clearlane-raw/dl/wraap.txt`, terms `resource class`, `operating envelopes`, `System Critical Hours` | 2 | VERIFIED (upgraded by verifier Oct 27: read in the raw copy; the System Critical Hours point is a question in section A, not one of the six bullets) |
| rowe_audience | The demo script (Beat 5) calls the envelope "the artifact Torus asked Utah regulators to standardize in June", and the plan's project context repeats "Utah regulators". The letter is addressed to ROWE (Regional Organization for Western Energy) about its resource adequacy program for the EDAM and WEIM footprint, not to Utah regulators; the word Utah does not appear in the raw text of the consolidated comments. Say "that Torus asked for in its June 2026 comments to ROWE". | wording | TORUS_PUBLISHED | `docs/plan/synthesis.json` demo_script (Beat 5) vs `../clearlane-raw/dl/wraap.txt` lines 107-118 | C12 on `wraap.txt`, terms `ROWE` (121 hits), `Utah` (no hit) | 2 | CONFLICT (verifier Oct 27: confirmed in the raw copy; Lvl raised from 1 to 2) |
| nova_pulse_size | Utility Dive, citing Torus, gives Nova Pulse sizes of 270 kWh to 2.2 MWh, expandable to 40 MWh. | 270 kWh to 2.2 MWh | REAL | `research/notes/torus-cases-a.findings.md:24` | N | 1 | UNCHECKED |

## Storage physics and the Wattsmart program

| Key | Claim | Value | Class | Source | Re-derive | Lvl | Status |
|---|---|---|---|---|---|---|---|
| spin_kwh_per_kw | At 10C, Spin holds a tenth of an hour of its rated power: 0.1 kWh of energy per kW. | 0.1 kWh/kW | DERIVED | torus_spin_c_rating, torus_spin_discharge_min | C10 | 3 | VERIFIED. Checked by verifier (Oct 27): C10 re-run |
| spin_recharge_min | Spin recharges in about 6 minutes: the published 12-minute discharge-and-recharge less the 6-minute discharge. Our reading, assuming the two halves are equal. | about 6 min | DERIVED | torus_spin_cycle_min | arithmetic | 3 | VERIFIED. Checked by verifier (Oct 27): arithmetic re-walked; 12 minutes re-read on the live Spin page |
| call_duration_s | Simulated RMP calls last 330 s (5.5 min), from the one published event. Verifier note: that event measures about 5.6 minutes on the chart (rmp_event_minutes), so 330 s runs about 10 to 15 s short; 340 s would match the chart. The derived rows below still hold at 340 s. | 330 s | ASSUMPTION | rmp_event_minutes | n/a | 2 | VERIFIED (as the plan's assumption; verifier Oct 27 checked it against the re-measured event) |
| spin_covers_call | A 5.5-minute call at full power fits inside Spin's 6-minute discharge, so Spin sized to the enrolled kW can answer one call with no help from Pulse. The engine pins this in its crash test. | 5.5 of 6 min | DERIVED | call_duration_s, torus_spin_discharge_min | C10; engine crash test | 3 | VERIFIED. Checked by verifier (Oct 27): re-walked; also holds at the re-measured 5.6 to 5.7 minutes (rmp_event_minutes), with about 20 s of margin |
| pulse_share_per_call | If Pulse answered one 5.5-minute call at its rated power instead, it would use 4.6% of its energy (0.5C means 2 hours at full power). Verifier note: deck slide 4 says "A six-minute call at 0.5C uses about 4.6% of a Pulse"; a 6-minute call uses 5.0% and a 5.6-minute call 4.7%. Say "about 5%". | 4.6%, "about 5%" | DERIVED | torus_pulse_c_rating, call_duration_s; `docs/plan/synthesis.json` pitch_outline slide 4 | C10 | 4 | VERIFIED (verifier Oct 27: C10 re-run, 4.58%) |
| call_hours_2025 | 359 calls of 5.5 minutes add up to about 33 hours, 0.38% of the year. Consistent with Torus's "less than 1% of hours". | 32.9 h, 0.38% | DERIVED | rmp_events_2025, call_duration_s | C10 | 4 | VERIFIED. Checked by verifier (Oct 27): C10 re-run; at the re-measured 5.6 minutes it is 33.5 h, 0.38% |
| pulse_cycle_budget | Spread over the 25-year Station lifespan, Pulse's 7,500 cycles allow 300 a year, 0.82 a day. A fixed nightly cycle uses 365 a year and would spend 7,500 cycles in 20.5 years. Assumes Pulse is not repowered. | 300/yr, 0.82/day | DERIVED | torus_pulse_cycles, torus_lifespan_yr | C10; C2 | 4 | VERIFIED. Checked by verifier (Oct 27): C10 and C2 re-run. The live Pulse page mentions repowering, so the 25-year divisor is our assumption; say 'if Pulse lasts the Station's 25-year life' |
| spin_cycle_budget | Spin's 25,000 cycles over 25 years allow 1,000 a year; 359 calls use about 36% of that. At 359 a year Spin would last 70 years of calls alone. | 1,000/yr; 36% | DERIVED | torus_spin_cycles | C10; C2 | 4 | VERIFIED. Checked by verifier (Oct 27): C10 and C2 re-run (69.6 years) |
| pulse_eq_cycles_calls | If Pulse answered all 359 calls itself, they would cost about 16 equivalent full cycles a year. | about 16 | DERIVED | pulse_share_per_call | C10 | 4 | VERIFIED. Checked by verifier (Oct 27): C10 re-run prints 16.5; at the re-measured 5.6 minutes it is 16.8, so 'about 16 to 17' |
| ref_station | Reference station for the race: 1 MW / 2 MWh battery (0.5C), round-trip efficiency 0.88. | 1 MW, 2 MWh, RTE 0.88 | ASSUMPTION | `research/analysis/demo-story/habit.py` | read the script | 2 | VERIFIED. Checked by verifier (Oct 27): habit.py re-read (RTE = 0.88, E = 2.0, comment '1 MW / 2 MWh') |
| reserve_floor | Battery-only plan reserve for calls: 0.1 MWh energy floor plus 25% power headroom. | 0.1 MWh, 25% | ASSUMPTION | `research/analysis/demo-story/fix.py:57` | read the script | 2 | VERIFIED. Checked by verifier (Oct 27): fix.py:57-58 re-read (soc_min=0.1, dis_cap=0.75) |
| wattsmart_telemetry | Wattsmart batteries must support IEEE 2030.5 with 30-second interval telemetry. IEEE 2030.5 is confirmed in the Torus approval release; the 30-second figure is from RMP pages not reopened. | 30 s | REAL | `research/notes/utah-grid.findings.md:16`, `torus-cases-a.findings.md:6` | N | 1 | UNCHECKED |
| wattsmart_incentives | Wattsmart commercial incentive $200/kW up to 30 kW; larger systems need pre-approval and a custom offer. Residential: $400/kW upfront, capped at $2,000 (10 kW and up) or $1,000. | $200/kW | REAL | `research/notes/utah-grid.findings.md:16` (rockymountainpower.net) | N | 1 | UNCHECKED |
| utah_dr_2025 | RMP's 2025 Utah DR results: Wattsmart Batteries 6,388 batteries, 35.16 MW at site; Cool Keeper 269 MW realized, 282 events (268 of them 5-minute frequency response); Wattsmart Business DR 68 sites, about 30-31 MW, 10 events. | see claim | REAL | `research/notes/utah-grid.findings.md:14` (PacifiCorp 2025 Utah report PDF) | N | 1 | UNCHECKED |
| rmp_ci_tariff | RMP C&I demand charge values. OpenEI shows $13.27 and $11.74 per kW with seasons lost. Not verified against a tariff sheet. Do not show. | not verified | REAL | `docs/plan/synthesis.json`; Grok lane tariff research | pending tariff check | 1 | UNCHECKED |
| demand_interval_min | Demand billing interval for the host meter. Torus's Spin page targets the highest 15-minute peak; RMP's interval for each C&I schedule is not verified (notes say 15 or 30 minutes). | 15 min (Torus page) | ASSUMPTION | torus_spin_peak_use; `research/notes/torus-cases-b.findings.md:28` | C11 | 2 | UNCHECKED |

## Value math: the race and the 70 MW scale

Every dollar figure here is value to RMP's system at day-ahead prices (energy arbitrage at the PACE price). It is not Torus revenue, host savings or anyone's bill. Reference race method: Cg = 2/sqrt(0.88) MWh bought, valued at the mean charge-hour price; Dg = 2 x sqrt(0.88) MWh delivered, valued at the mean discharge-hour price.

| Key | Claim | Value | Class | Source | Re-derive | Lvl | Status |
|---|---|---|---|---|---|---|---|
| fixed_usd_mw_day | Battery on the fixed off-peak rule (a simulated rule, not Torus practice): charge HB 1am-4am at $39.53, discharge HB 6pm-7pm at $55.62. | $20.06/MW-day | DERIVED | C1 | C1, C10 | 4 | VERIFIED. Checked by verifier (Oct 27): C1 and C10 re-run (20.0647) |
| clearlane_usd_mw_day | Clearlane's reference timetable: charge HB 1pm-3pm at $21.55, same discharge. Reference race value; if numbers.json uses this key for the engine's 15-minute DP value instead, it must be re-pinned and this row updated. | $58.41/MW-day | DERIVED | C1 | C1, C10 | 4 | VERIFIED. Checked by verifier (Oct 27): C1 and C10 re-run (58.4053) |
| race_ratio | Timetable value over fixed rule value. | 2.91x, "2.9x" | DERIVED | C1 | C1 | 4 | VERIFIED. Checked by verifier (Oct 27): C1 and C10 re-run (2.911) |
| fixed_70 | Fixed rule at Torus's 70 MW, assuming every MW behaves like the reference station and the fleet does not move prices. | $1,405/day | DERIVED | C1 | C1 | 4 | VERIFIED. Checked by verifier (Oct 27): C1 re-run; C10 1,404.5 |
| clearlane_70 | Timetable at 70 MW, same assumptions. | $4,088/day | DERIVED | C1 | C1 | 4 | VERIFIED. Checked by verifier (Oct 27): C1 re-run; C10 4,088.4 |
| fixed_500 | Fixed rule at the 500 MW MOU ceiling. | $10,032/day | DERIVED | C1 | C1 | 4 | VERIFIED. Checked by verifier (Oct 27): C1 and C10 re-run |
| clearlane_500 | Timetable at the 500 MW ceiling. | $29,203/day | DERIVED | C1 | C1 | 4 | VERIFIED. Checked by verifier (Oct 27): C1 and C10 re-run |
| charge_co2_race | Charge-hour CO2: fixed rule 696 g/kWh, timetable 446 g/kWh; discharge hours 651 g/kWh (Oct 1-25 profile, hour beginning h uses HE h+1). | g/kWh | DERIVED | C1 | C1, C10 | 4 | VERIFIED. Checked by verifier (Oct 27): C1 re-run (696, 446); discharge 651 walked by hand from HE19 629 and HE20 673 |
| co2_fixed_t_per_mw_day | Net CO2 of the fixed rule per MW-day (negative means more emitted). Note: the engine pin in synthesis says "-0.263"; C10 gives -0.2625 and C1 prints -0.262. Both pass the +-0.002 tolerance; pin -0.2625. | -0.2625 t | DERIVED | C1, C10 vs `docs/plan/synthesis.json` (Engine pinned tests) | C1, C10 | 4 | CONFLICT. Checked by verifier (Oct 27): C10 -0.2625 and C1 -0.262 re-run |
| co2_timetable_t_per_mw_day | Net CO2 avoided by the timetable per MW-day. | +0.270 t | DERIVED | C1 | C1, C10 | 4 | VERIFIED. Checked by verifier (Oct 27): C1 and C10 re-run (+0.2698) |
| co2_added_70 | At 70 MW the fixed rule adds about 18.4 t of CO2 a day (average-emissions estimate). | 18.4 t/day | DERIVED | C1 | C1 | 4 | VERIFIED. Checked by verifier (Oct 27): C1 re-run; C10 -18.37 |
| co2_avoided_70 | At 70 MW the timetable avoids about 18.9 t a day (average-emissions estimate). | 18.9 t/day | DERIVED | C1 | C1 | 4 | VERIFIED. Checked by verifier (Oct 27): C1 re-run; C10 18.89 |
| co2_500 | At 500 MW: fixed rule adds 131.2 t a day; timetable avoids 134.9 t. | t/day | DERIVED | C1 | C1 | 4 | VERIFIED. Checked by verifier (Oct 27): C1 re-run |
| price_only_usd_mw_day | Hourly DP that chases price with no wear cost and no reserve, Oct 27, start and end at 0.1 MWh. Discharges 3.85 MWh per MW (about 1.9 cycles). | $65.79/MW-day | DERIVED | C2, C3 | C3 | 4 | VERIFIED. Checked by verifier (Oct 27): C2 and C3 re-run; C3 prints 3.85 MWh per MW discharged |
| wear10_usd_mw_day | Same DP with a $10/MWh wear price: active hours HB 8am, 1pm-3pm, 6pm-7pm; 1.88 MWh discharged per MW (0.94 cycles). $15 gives the same plan. | $57.54/MW-day | DERIVED | C3 | C3 | 4 | VERIFIED. Checked by verifier (Oct 27): C3 re-run |
| battery_only_reserve_usd | Wear-10 plan when the battery itself must hold the call reserve (reserve_floor). | $55.56/MW-day | DERIVED | C3 | C3 | 4 | VERIFIED. Checked by verifier (Oct 27): C3 re-run |
| reserve_cost_pct | Holding the call reserve in the battery costs this share of its value; Spin holding it costs Pulse nothing. | 3.4% | DERIVED | C3 | C10 | 4 | VERIFIED. Checked by verifier (Oct 27): C3 inputs re-run, C10 arithmetic (3.44%) |
| price_only_season | Price-only DP mean per day: July $51.74 (30 days), Oct 1-25 $48.68 (25 days). | $/MW-day | DERIVED | C2 | C2 | 4 | VERIFIED. Checked by verifier (Oct 27): C2 re-run |
| wear10_season | Wear-10 DP mean per day: July $48.52, Oct 1-25 $39.71. Daily means only; do not annualize (see Do not say). | $/MW-day | DERIVED | C3 | C3 | 4 | VERIFIED. Checked by verifier (Oct 27): C3 re-run |
| price_only_fleet | Price-only DP at 70 MW $4,605/day and 500 MW $32,896/day. Ignores the call reserve and wear; not a stage number. | $/day | DERIVED | C2 | C2 | 4 | VERIFIED. Checked by verifier (Oct 27): C2 re-run |

## Reserve and call math

| Key | Claim | Value | Class | Source | Re-derive | Lvl | Status |
|---|---|---|---|---|---|---|---|
| call_rate_per_day | Simulated calls are Poisson with mean 359/365 a day, hours weighted by the 2025 heatmap, weekdays by its weekday counts, fixed seed. | 0.98/day | SIMULATED | `docs/plan/synthesis.json` (Engine prompt, backtest) | n/a | 2 | VERIFIED. Checked by verifier (Oct 27): synthesis Engine prompt, item 6 (Event sampler), re-read |
| heatmap_readings | Each call result is run twice: heatmap read as Mountain time, and read as UTC (6-hour shift under MDT). C3 also shows a 7-hour (MST) shift. | 2 readings | ASSUMPTION | rmp_heatmap_by_hour | C3 | 4 | VERIFIED. Checked by verifier (Oct 27): C3 re-run |
| calls_unanswerable_price_only | The price-only plan cannot answer calls in 15 of 24 hours. Share of 2025 call times in those hours: 77% (Mountain reading), 52% (UTC, MDT), 43% (UTC, MST). | 77% / 52% / 43% | DERIVED | C3 | C3 | 4 | VERIFIED. Checked by verifier (Oct 27): C3 re-run; hour sums walked by hand (276, 186 and 156 of 359) |
| calls_unanswerable_wear10 | Same for the wear-10 plan: 40% (Mountain), 18% (UTC, MDT), 14% (UTC, MST). | 40% / 18% / 14% | DERIVED | C3 | C3 | 4 | VERIFIED. Checked by verifier (Oct 27): C3 re-run (142, 65 and 51 of 359) |
| calls_missed_range_pct | Synthesis says a price-only plan "misses 14% to 77% of calls" and that the range depends on the time-zone reading. C3 shows 77% is the price-only plan read as Mountain and 14% is the wear-10 plan read as UTC with a 7-hour shift. Say: "a battery chasing price alone could not answer 43% to 77% of last year's call times, depending on how the heatmap's hours are read". | 43% to 77% | DERIVED | C3 vs `docs/plan/synthesis.json` | C3 | 4 | CONFLICT. Checked by verifier (Oct 27): C3 re-run |
| crash_call_minutes | The demo script says "the 6-minute call" and "a six-minute call", and deck slide 4 says "A six-minute call". The published event lasted about 5.6 minutes (verifier measurement, rmp_event_minutes); 6 minutes is Spin's full discharge. Say "a call of about five and a half minutes" or "a call of under six minutes". | about 5.6 min | TORUS_PUBLISHED | `docs/plan/synthesis.json` demo_script (Beat 3) and pitch_outline slide 4 vs rmp_event_minutes | C13 | 2 | CONFLICT (verifier Oct 27: value updated from 5.5 to 5.6 minutes; wording to use unchanged) |
| numbers_py_crash_bug | `numbers.py`'s own crash section prints 72%, 55% and 52%. It reads snapshot index 0 as midnight, which is wrong (index 0 is HB 1am). Use C3. | superseded | DERIVED | `research/analysis/demo-story/fix.py:9` (fixes the index) | C2 vs C3 | 4 | VERIFIED (verifier Oct 27: C2 and C3 re-run; line reference corrected from fix.py:10 to fix.py:9) |

## Option 2: time versus place

| Key | Claim | Value | Class | Source | Re-derive | Lvl | Status |
|---|---|---|---|---|---|---|---|
| campus_usd | A SIMULATED 100 MW AI campus moves 25 MW for 3 hours (75 MWh) from the three priciest hours (HB 6pm-8pm) to the three cheapest daytime hours (HB 1pm-3pm) on Oct 27. No storage losses. | $2,551/day | SIMULATED | C2; engine pinned test in `docs/plan/synthesis.json` | C10, C2 | 4 | VERIFIED. Checked by verifier (Oct 27): C2 and C10 re-run (2,550.75) |
| campus_mwh | Energy moved in campus_usd. | 75 MWh | SIMULATED | same | arithmetic | 3 | VERIFIED. Checked by verifier (Oct 27): arithmetic |
| time_vs_space_oct | Oct 1-27, EDAM nodes only (PACE, PACW, PGE), 27 days, a 4-hour job block. Baseline $48.1/MWh. Move in space: $44.4 (8% saved). Move in time: $28.5 (41%). Both: $27.9 (42%). | 41% vs 8% | DERIVED | `research/analysis/option2/where_vs_when_output.txt` | C5b | 4 | VERIFIED. Checked by verifier (Oct 27): C5b re-run, output identical |
| time_shift_pct_range | The plan's "40-41%" combines two runs: 41% (C5b, 27 days) and 40% (C5c, 23 days that have all 24 hours of prices and EIA-930 fuel mix for every node). Say "about 40 percent". | about 40% | DERIVED | C5b, C5c | C5b, C5c | 4 | VERIFIED (verifier Oct 27: both re-run; the 23-day filter is in run() of carbon_tradeoff.py; wording corrected from "complete days with PGE data") |
| pace_cheapest_share | PACE was the cheapest EDAM node in 81% of October hours. Adding SP15: 62%, with space 11% and both 57%. | 81% | DERIVED | where_vs_when_output.txt | C5b | 4 | VERIFIED. Checked by verifier (Oct 27): C5b re-run |
| time_vs_space_jul | July: time saves 51%, space 13%. | 51% vs 13% | DERIVED | same | C5b | 4 | VERIFIED. Checked by verifier (Oct 27): C5b re-run. July nodes are PACE, PACW and SP15 (PGE joined EDAM Oct 1), so July space includes California |
| carbon_tradeoff_oct | 23 days: stay $48.3/MWh at 520 g/kWh; time only $29.0 (40%) at 392 g/kWh; space $44.2 (8%); break-even carbon price median $31/t. Uses lifecycle intensity (option2_ci_basis). | see claim | DERIVED | `research/analysis/option2/carbon_tradeoff_output.txt` | C5c | 4 | VERIFIED. Checked by verifier (Oct 27): C5c re-run; output identical apart from where the known traceback prints |
| oct_congestion_share | Why place barely matters: congestion was 6.9% of PACE's October price. | 6.9% | DERIVED | C8 | C8 | 4 | VERIFIED. Checked by verifier (Oct 27): C8 (Oct 1-25) and C5b (Oct 1-27) re-run, both 6.9% |

## Headroom

Duke-style method on PACE EIA-930 hourly demand, window 2025-10-26 01:00 to 2026-10-26 00:00 (hour ending, local), one bad hour cleaned, peak 10,173 MW. Headroom is the constant new load PACE could add if that load is curtailed whenever total demand would pass the ceiling, at the given share of its yearly energy.

| Key | Claim | Value | Class | Source | Re-derive | Lvl | Status |
|---|---|---|---|---|---|---|---|
| headroom_05_mw | Annual-peak ceiling, 0.5% curtailment: 1,265 MW. 184 curtailed hours in 47 events (mean 3.91 h, max 11 h); June 9 h, July 124 h, August 51 h; in 90% of those hours at most half the new load is curtailed. | 1,265 MW | DERIVED | `research/analysis/depth/headroom_output.txt` | C6 | 4 | VERIFIED. Checked by verifier (Oct 27): C6 re-run, output identical |
| headroom_025_mw | Annual ceiling, 0.25% curtailment. | 1,016 MW | DERIVED | same | C6 | 4 | VERIFIED. Checked by verifier (Oct 27): C6 re-run |
| headroom_1_mw | Annual ceiling, 1% curtailment. | 1,616 MW | DERIVED | same | C6 | 4 | VERIFIED. Checked by verifier (Oct 27): C6 re-run |
| headroom_seasonal_05_mw | Seasonal-peak ceiling, 0.5% curtailment. Same number as Torus's 500 MW by coincidence; never link the two. | 500 MW | DERIVED | same | C6 | 4 | VERIFIED. Checked by verifier (Oct 27): C6 re-run |
| headroom_2602_mw | Adding all 2,602 MW of Utah data centers under construction as flat load would mean 3.0% curtailment against the annual ceiling. | 3.0% | DERIVED | `research/analysis/depth/extras_output.txt` | C6 with `extras.py` | 4 | VERIFIED. Checked by verifier (Oct 27): C6 extras re-run (3.003%); extras_output.txt has two extra lines the script no longer prints |
| headroom_duke_pace | Duke's Feb 2025 study shows PACE at about 1.5 GW at 0.5% (parsed from a chart). Ours is 1,265 MW on a later window. Say "Duke's method on the latest year of data"; do not present the two as one figure. | 1.5 GW vs 1,265 MW | DERIVED | `research/notes/prior-art.findings.md:6` vs C6 | N; C6 | 1 | CONFLICT |
| mou_share_of_peak | The 500 MW MOU ceiling is about 8% of the Oct 27 day-ahead PACE peak forecast (6,024 MW) and about 5% of the 10,173 MW 16-month peak. | 8.3%; 4.9% | DERIVED | load_peak_oct27_mw, pace_peak_16mo_mw | C10 | 4 | VERIFIED. Checked by verifier (Oct 27): C10 re-run |
| utah_dc_load | A 2026 Utah legislative brief counts 48 operating data centers (about 920 MW) and seven under construction adding 2,602 MW, 1,700 MW of it behind the meter or off-grid. | 920 MW; 2,602 MW | REAL | `research/notes/utah-grid.findings.md:22` (le.utah.gov/interim/2026/pdf/00003188.pdf) | N | 1 | UNCHECKED |
| sb132_contract | Utah's first SB 132 large-load contract (PSC docket 26-035-05, approved Apr 10 2026) gives over 100 MW of firm service and credits system costs hourly at the EDAM price near the load. The customer's own tariff is confidential. | over 100 MW | REAL | `research/notes/utah-grid.findings.md:21` (pscdocs.utah.gov) | N | 1 | UNCHECKED |

## Prior art

| Key | Claim | Value | Class | Source | Re-derive | Lvl | Status |
|---|---|---|---|---|---|---|---|
| emerald_phoenix | Emerald AI's Phoenix test (256 NVIDIA A100s, Salt River Project, EPRI DCFlex) cut cluster power 25% for 3 hours on May 3 2025 with software only, no storage. | 25% for 3 h | REAL | `research/notes/prior-art.findings.md:1` (https://arxiv.org/abs/2507.00909) | N | 1 | UNCHECKED |
| emerald_power_cap | Capping A100s at 300 W kept 86-95% of throughput in Emerald's public sweep. | 86-95% | REAL | `docs/plan/concepts.json`; `research/notes/prior-art.findings.md` | N | 1 | UNCHECKED |
| duke_headroom_us | Duke "Rethinking Load Growth" (Feb 2025), 22 balancing areas: 76 GW at 0.25% curtailment, 98 GW at 0.5%, 126 GW at 1%. | 76 / 98 / 126 GW | REAL | `research/notes/prior-art.findings.md:5` | N | 1 | UNCHECKED |
| eurosys_2024 | Sukprasert et al. (EuroSys 2024, 123 regions): practical savings from shifting jobs in space and time are modest, and simple policies capture most of them. | modest | REAL | `research/notes/prior-art.findings.md:25` (https://dl.acm.org/doi/10.1145/3627703.3650079) | N | 1 | UNCHECKED |
| watttime_free | WattTime's marginal-emissions data is free only for CAISO_NORTH; PACE needs a paid plan, so Clearlane uses EIA average emissions. | CAISO_NORTH only | REAL | `research/notes/prior-art.findings.md:26` | N | 1 | UNCHECKED |
| carbon_router_count | About nine near-identical carbon-aware job-routing hackathon entries were found; none touches storage or anything faster than a minute. Say "about nine". | about 9 | REAL | `research/notes/prior-art.findings.md:28` | N | 1 | UNCHECKED |

## Event logistics

| Key | Claim | Value | Class | Source | Re-derive | Lvl | Status |
|---|---|---|---|---|---|---|---|
| event_name_hosts | Hard Tech Hackathon at Aernata; sponsors Torus, Nucleus, Kickstart and the University of Utah. | names | REAL | `../clearlane-raw/event/s1.png` | C15 | 2 | VERIFIED. Checked by verifier (Oct 27): s1.png re-read |
| event_judges | Judges: Ryan Byrd (former CTO of Entrata, Aptive and Pattern), Angela Smith (COO, Nucleus Fund), Nicole Witmyer (Torus), Scott Holley (Lassonde Center), Tanner Potter (Kickstart). | 5 judges | REAL | `../clearlane-raw/event/s2.png` | C15 | 2 | VERIFIED. Checked by verifier (Oct 27): s2.png re-read (Nicole Witmyer is listed as Strategic Events Leader of Torus) |
| event_kickoff | Kickoff Mon Oct 26 2026, 4 to 5pm MT. | 2026-10-26 | REAL | `../clearlane-raw/event/s6.png` | C15 | 2 | VERIFIED. Checked by verifier (Oct 27): s6.png re-read; the slide states no time zone |
| event_judging | Judging Wed Oct 28 2026, 5 to 6pm MT. | 2026-10-28 | REAL | s6 | C15 | 2 | VERIFIED. Checked by verifier (Oct 27): s6.png re-read |
| event_winners | Winners announced Thu Oct 29 2026 on the Zero Gravity Summit main stage. The summit agenda puts it at 9:05 AM on Day 2. | 2026-10-29 | REAL | s6; `research/notes/torus-intel.findings.md:21` (zerogravitysummit.com/agenda) for the time | C15; N | 2 | VERIFIED. Checked by verifier (Oct 27): s6.png re-read; live agenda re-fetched lists the announcement 9:05-9:15 AM in the 10.29.2026 AM session |
| event_venue | Aernata, 250 E 200 S, Ste 320, Salt Lake City. | address | REAL | s6 | C15 | 2 | VERIFIED. Checked by verifier (Oct 27): s6.png re-read |
| torus_bounty_title | Torus bounty title "ENERGY x AI INFRASTRUCTURE". Seen only in plan text, not on a slide or an organizer page. | title | REAL | `docs/plan/synthesis.json` (lane prompts) | find the organizer's bounty page | 1 | UNCHECKED |
| torus_bounty_amount | Torus bounty prize amount. UNVERIFIED: not on any slide or in the repo. Do not state it. | UNVERIFIED | REAL | none found | find the organizer's bounty page | 1 | UNCHECKED |
| submission_deadline | Submission deadline. UNVERIFIED: not on any slide. Our own code freeze is Wed Oct 28 2pm MT (plan milestone, not an event rule). | UNVERIFIED | ASSUMPTION | `docs/plan/synthesis.json` (milestones) | ask the organizers | 1 | UNCHECKED |
| entry_scope | Clearlane is entered for the Torus bounty only. The Nucleus x Startup State bounty (s4) is not entered. | Torus only | REAL | team decision, Oct 26 2026; `../clearlane-raw/event/s4.png` | n/a | 2 | VERIFIED. Checked by verifier (Oct 27): s4.png re-read (separate $10K Nucleus x Startup State bounty with its own judges) |

## Placeholders the engine will produce

Never type these. The engine CLIs write them to `public/derived/numbers.json`, `backtest.json` and `envelope_<day>.json`; MEASURED values are timed live and never stored. When the Oct 28 bundle lands (prices available by about 9:16pm MT Tue Oct 27), every Oct 27 row above is re-run on `bundle_2026-10-28.json` and the date on screen changes with it.

| Key | Claim | Value | Class | Source | Re-derive | Lvl | Status |
|---|---|---|---|---|---|---|---|
| share_days_beating | Share of days May 1 to Oct 27 on which Clearlane beat the fixed off-peak rule. | % of days | DERIVED | `engine/cli/backtest.ts` -> `public/derived/backtest.json` | `npx tsx engine/cli/backtest.ts` | 1 | PENDING-ENGINE |
| clearlane_p10 | 10th percentile of Clearlane's daily value over the backtest. | $/MW-day | DERIVED | same | same | 1 | PENDING-ENGINE |
| clearlane_p50 | Median daily value over the backtest. | $/MW-day | DERIVED | same | same | 1 | PENDING-ENGINE |
| clearlane_p90 | 90th percentile of daily value over the backtest. | $/MW-day | DERIVED | same | same | 1 | PENDING-ENGINE |
| backtest_days | Number of days in the backtest and the list of missing days. | days | DERIVED | same; `public/data/hist_2026-05-01_2026-10-27.json` | same | 1 | PENDING-ENGINE |
| cycles_per_year_by_policy | Full-equivalent Pulse cycles a year under each of the three policies. | cycles/yr | DERIVED | same | same | 1 | PENDING-ENGINE |
| calls_answered_pct | Share of simulated calls Spin answered in full. Must say which heatmap reading it uses, and show both. | % | SIMULATED | same | same | 1 | PENDING-ENGINE |
| calls_missed_by_policy | Calls missed under each policy and each heatmap reading (backtest card). | counts | SIMULATED | same | same | 1 | PENDING-ENGINE |
| wear_usd_mwh | Wear price, bisected in $0-60/MWh so Clearlane uses at most 300 cycles a year (research start: $10). | $/MWh | DERIVED | same | same | 1 | PENDING-ENGINE |
| clearlane_dp_usd_mw_day | The engine's 15-minute DP value for the day, if it differs from the reference $58.41. | $/MW-day | DERIVED | `engine/cli/numbers.ts` | `npx tsx engine/cli/numbers.ts <bundle>` | 1 | PENDING-ENGINE |
| peak_hour_mt | Hour beginning, Mountain time, of the day's priciest hour (beat 1 caption; read, never typed). | hour | DERIVED | `engine/cli/numbers.ts` | `npx tsx engine/cli/numbers.ts <bundle>` | 1 | PENDING-ENGINE |
| trough_hour_mt | Hour beginning, Mountain time, of the day's cheapest hour. | hour | DERIVED | `engine/cli/numbers.ts` | `npx tsx engine/cli/numbers.ts <bundle>` | 1 | PENDING-ENGINE |
| cycles_today | Pulse cycles used in today's plan, shown against the 0.82-a-day budget. | cycles | DERIVED | same | same | 1 | PENDING-ENGINE |
| enrolled_kw | Enrolled kW of the simulated Torus-style site, shown in the call banner. | kW | SIMULATED | same | same | 1 | PENDING-ENGINE |
| host_ceiling_kw | Simulated host's 15-minute meter ceiling. | kW | SIMULATED | same | same | 1 | PENDING-ENGINE |
| meter_peak_refill_kw | Host meter peak while Spin refills after a call; must stay at or under host_ceiling_kw. | kW | SIMULATED | engine crash | engine tests | 1 | PENDING-ENGINE |
| second_call_shortfall_kw | Shortfall when a second call lands inside Spin's refill window, if any. | kW | SIMULATED | engine crash | engine tests | 1 | PENDING-ENGINE |
| sch_hours_today | The day's System Critical Hours in the envelope. | hours | DERIVED | `engine/src/envelope.ts` | same | 1 | PENDING-ENGINE |
| solve_ms | Time to solve the day's plan, timed live with performance.now() on the demo machine. | ms | MEASURED | browser | live only | 1 | PENDING-ENGINE |
| replan_ms | Time to re-plan after the crash, timed live. | ms | MEASURED | browser | live only | 1 | PENDING-ENGINE |

## Do not say

| Do not say | Why | Say instead |
|---|---|---|
| Anything framing Clearlane for the Nucleus x Startup State bounty, the "Nucleus slide" (pitch outline slide 9) or the `nucleus_fit` field in synthesis | We entered the Torus bounty only (entry_scope). | Keep Utah impact facts (headroom, SB 132) as Torus Q&A backups if asked. |
| "Torus lacks X", "Torus can't", "Lasso doesn't" | We only know what Torus publishes. | "not advertised" (for example, a carbon input is not advertised for Lasso). |
| Any dollar figure as Torus revenue, host savings or a bill cut | The race values are arbitrage at PACE day-ahead prices. | "value to RMP's system at day-ahead prices". |
| The fixed overnight rule as what Torus or Lasso does | It is our simulated comparison rule. Lasso schedules from load, weather, grid signals and rate schedules. | "a battery on a fixed off-peak rule". |
| Torus logos, or our stations as real Torus units | Stations on screen are simulated. | "simulated Torus-style station". |
| "500 MW installed", "Torus runs 500 MW", or linking the 500 MW MOU to the 500 MW seasonal headroom | 500 MW is an MOU ceiling (torus_500mw). | "an MOU for up to 500 MW". |
| CO2 as marginal emissions, or as a measured outcome | It is EIA average emissions on an October profile. | "estimated, using average emissions". |
| A heatmap result with one time-zone reading | The chart states no time zone. | Show Mountain and UTC readings side by side. |
| "Price-only misses 14% to 77% of calls" or "the range is only the time zone" | Mixes two plans and a 7-hour shift (calls_missed_range_pct). | "43% to 77%, depending on how the hours are read". |
| numbers.py's 72%, 55% or 52% call figures | Index bug (numbers_py_crash_bug). | C3 figures. |
| "$14,496 to $17,708 per MW-year" or any annualized value | Multiplies a mean day by 365; retired. | Daily values, and the backtest P10-P90 once it exists. |
| "Prices post at 9:16pm" | We only know they were available by then. | "available by 9:16pm the night before". |
| "Torus's data-center product", or reasons Torus took pages down | Pages are offline; the reason is unknown. | Creekstone's page lists Torus Load Smoothing (creekstone_load_smoothing). |
| "404 since Aug 4" | Wayback shows 200 through Aug 6. | "offline as of Oct 26 2026". |
| "A six-minute call" | The published event ran about 5.6 minutes (rmp_event_minutes); 6 minutes is Spin's full discharge. | "a call of about five and a half minutes" or "a call of under six minutes". |
| "A six-minute call uses 4.6% of a Pulse" | A 6-minute call at 0.5C uses 5.0%; 4.6% is the 5.5-minute figure (pulse_share_per_call). | "about 5% of a Pulse". |
| "The off-peak rule charges overnight at $38.71" (or "$39" from {overnight_avg}) | $38.71 is the 1am-6am mean; the rule charges 1am-5am at a mean of $39.53 (overnight_avg). | "$39.53". |
| "Clearlane charges at $22.83" (or "$22" or "$23" from {midday_avg}) | $22.83 is the 9am-5pm mean; the timetable charges 1pm-4pm at a mean of $21.55 (midday_avg). | "$21.55". |
| "27 of 30 July days" | C5a prints 28 of 30 (jul_step_hour_spread). | "28 of 30". |
| "Torus asked Utah regulators" | The June 2026 comments went to ROWE. | "Torus's June 2026 comments to ROWE". |
| "Pulse has a 25-year life" | 25 years is the Station lifespan. | "Station lifespan 25 years". |
| "Utah's grid" when quoting PACE hourly CO2 or fuel mix | PACE covers Utah, Wyoming and Idaho. | "PacifiCorp East (Utah, Wyoming, Idaho)". |
| "Record peak" for 10,173 MW | Only the maximum of our 16-month pull. | "highest hour in 16 months of EIA data". |
| "Most RMP calls come in the evening" | The 2025 heatmap does not show that (rmp_event_timing_2024). | Show the heatmap with both readings. |
| The Torus bounty prize amount or a submission deadline | UNVERIFIED. | Nothing until the organizer page is checked. |
| The RMP C&I demand charge dollar values | Not verified against a tariff sheet (rmp_ci_tariff). | Talk about the 15-minute peak, not $/kW. |
| Any figure attributed to a page that is not ours or Torus's without its URL, or a quote of 15 words or more | Public repo. | Short quote plus URL, or a paraphrase. |
| Any Torus factory size (540,000, 545,000 or 582,000 sq ft) | Torus's own pages give all three (torus_facility_sqft). | Leave it out. |

## Appendix A: arith.py

Save as `$W/arith.py` and run C10. It reads only the snapshot and prints the derived Oct 27 numbers used above.

```python
import csv, math, sys
rows = list(csv.DictReader(open(sys.argv[1], encoding="utf-8")))
hb = {int(r["local_mt"][-5:-3]): r for r in rows}          # hour beginning MT
p = {h: float(hb[h]["da_lmp_elap_pace"]) for h in hb}
num = lambda h, k: float(hb[h][k])
net = {h: num(h, "da_load_fcst_pace_mw") - num(h, "edam_solar_fcst_pace_mw") - num(h, "edam_wind_fcst_pace_mw") for h in hb}
lo, hi = min(p.values()), max(p.values())
print("min", lo, "max", hi, "ratio %.3f" % (hi / lo), "mean %.2f" % (sum(p.values()) / 24))
print("clear<= %.2f jam>= %.2f" % (lo + 0.25 * (hi - lo), hi - 0.25 * (hi - lo)))
print("clear hours", sorted(h for h in p if p[h] <= lo + 0.25 * (hi - lo)), "jam hours", sorted(h for h in p if p[h] >= hi - 0.25 * (hi - lo)))
m = lambda hs: sum(p[h] for h in hs) / len(hs)
print("HB1-5 %.2f HB9-16 %.2f HB18-21 %.2f" % (m([1, 2, 3, 4, 5]), m(range(9, 17)), m([18, 19, 20, 21])))
print("net 15 %.2f net 18 %.2f climb %.2f max net %.1f at HB %s" % (net[15], net[18], net[18] - net[15], max(net.values()), max(net, key=net.get)))
for k in ["da_congestion_pace", "da_lmp_elap_pacw", "da_lmp_elap_pge", "da_lmp_th_sp15_gen", "da_load_fcst_pace_mw"]:
    v = [float(r[k]) for r in rows]
    print(k, min(v), max(v))
print("solar HB16 %.2f HB18 %.2f" % (num(16, "edam_solar_fcst_pace_mw"), num(18, "edam_solar_fcst_pace_mw")))
print("500 MW share of 6,024: %.1f%%  of 10,173: %.1f%%" % (500 / 6024 * 100, 500 / 10173 * 100))
cg, dg = 2 / math.sqrt(0.88), 2 * math.sqrt(0.88)
fx = dg * m([18, 19]) - cg * m([1, 2, 3, 4])
tt = dg * m([18, 19]) - cg * m([13, 14, 15])
print("fixed %.4f timetable %.4f ratio %.3f  70MW %.1f %.1f  500MW %.0f %.0f" % (fx, tt, tt / fx, fx * 70, tt * 70, fx * 500, tt * 500))
co2 = {1: 697, 2: 697, 3: 695, 4: 694, 5: 698, 6: 704, 7: 709, 8: 698, 9: 623, 10: 534, 11: 485, 12: 461,
       13: 455, 14: 450, 15: 443, 16: 446, 17: 464, 18: 531, 19: 629, 20: 673, 21: 676, 22: 682, 23: 684, 24: 693}
c = lambda hs: sum(co2[h + 1] for h in hs) / len(hs)                # HB h uses HE h+1
fxc = (dg * c([18, 19]) - cg * c([1, 2, 3, 4])) / 1000
ttc = (dg * c([18, 19]) - cg * c([13, 14, 15])) / 1000
print("co2 fixed %.4f t timetable %.4f t  70MW %.2f %.2f" % (fxc, ttc, fxc * 70, ttc * 70))
top3 = sorted(p, key=p.get, reverse=True)[:3]
cheap3 = sorted(range(8, 17), key=lambda h: p[h])[:3]
print("campus from", sorted(top3), "to", sorted(cheap3), "usd %.2f" % (75 * (m(top3) - m(cheap3))))
print("pulse share of one 5.5-min call %.2f%%" % (5.5 / 60 / 2 * 100), "call hours %.1f share of year %.3f%%" % (359 * 5.5 / 60, 359 * 5.5 / 60 / 8760 * 100))
print("spin kWh per kW %.2f" % (6 / 60), "pulse cycles/yr %.0f per day %.2f spin cycles/yr %.0f calls share %.0f%% pulse-eq %.1f" % (7500 / 25, 7500 / 25 / 365, 25000 / 25, 359 / 1000 * 100, 359 * 5.5 / 60 / 2))
print("heatmap by-hour sum", sum([9, 41, 5, 4, 1, 3, 4, 14, 23, 26, 25, 20, 15, 33, 19, 14, 14, 8, 6, 4, 5, 34, 24, 8]), "weekday sum", sum([50, 57, 43, 57, 53, 45, 54]))
print("reserve cost %.1f%%" % ((57.54 - 55.56) / 57.54 * 100), "calls per day %.3f" % (359 / 365))
```

## Verifier report

Adversarial check run Tue Oct 27 2026 (Mountain Time) by a second agent. Method: every VERIFIED row, and every row the six demo beats or the deck use, was re-derived by re-running its command with `python -I` (C1 to C10, the one-off for pace_dam_history_start) or by re-opening its source (live Torus pages, the raw Torus text, the ROWE comments text, the case-study images, the kickoff slides). A value counted as confirmed only when the re-run printed it or the source showed it. Rows confirmed unchanged carry "Checked by verifier (Oct 27)" in their Status cell with the evidence. UNCHECKED rows that no beat or slide uses were left as they were.

### Values or wording corrected

| Key | Old | New | Why |
|---|---|---|---|
| jul_step_hour_spread | "27 of 30" days between HB 1pm and HB 8pm | "28 of 30" | C5a prints HB 1pm 2, 2pm 5, 3pm 1, 4pm 3, 5pm 1, 6pm 6, 7pm 7, 8pm 3 (28); the other two days are HB 6am and HB 11pm. |
| rmp_event_minutes | about 5.5 min, "just before 1:00 AM to about 1:05:30 AM" | about 5.6 min (5.5 to 5.7 by edge); window about 12:59:44 to 1:05:22 AM, output above half power about 12:59:53 to 1:05:31 AM | Re-measured against the chart's 1-minute ticks (about 224 px a minute). |
| crash_call_minutes | about 5.5 min | about 5.6 min; adds deck slide 4 and "a call of under six minutes" | Follows rmp_event_minutes; the deck also says six minutes. Status stays CONFLICT. |
| cto_freeway | quote, 9 words | quote, 8 words | Counted on the live post (dated 5.5.2026). |
| numbers_py_crash_bug | source `fix.py:10` | `fix.py:9` | The index fix is on line 9. |
| time_shift_pct_range | "23 complete days with PGE data" | "23 days that have all 24 hours of prices and EIA-930 fuel mix for every node" | That is the filter in carbon_tradeoff.py run(). |
| co2_overnight_avg | claim "the fixed overnight charge window" | "the same window as overnight_avg", plus a note that the rule charges HE2-5 at 696 g/kWh | Same mislabel as overnight_avg. Value 698 confirmed. |
| torus_facility_sqft | 545,000 vs 582,000 | 545,000 vs 582,000 vs 540,000 | The Magnetar release and the Dec 2025 wrap-up call GigaOne 540,000 square feet. The Do not say row now lists all three. |
| torus_uptime_2025 | "The wrap-up says 99.99% uptime across customer sites" | the wrap-up gives both 99.9% (summary line) and 99.99% (body) | Both figures are on the live page. Value 99.9% and status CONFLICT unchanged. |
| torus_homepage_headline | "Aug 4 2026 homepage headline named AI and hyperscalers" | Aug 4 headline "Smarter power for AI, industry, and the grid", its subhead named hyperscalers; Oct 26 headline "Smarter power for industries and the grid" | The headline named AI; hyperscalers were in the subhead. Re-read both raw captures. |
| call_duration_s | 330 s, no note | 330 s, with a note that the event measures about 5.6 min, so 330 s is 10 to 15 s short and 340 s would match | Assumption kept; derived rows still hold at 340 s. |
| pulse_share_per_call | 4.6%, "about 5%", no deck note | value unchanged; adds that deck slide 4 says "A six-minute call at 0.5C uses about 4.6% of a Pulse" | 6 minutes is 5.0% and 5.6 minutes is 4.7%, so say "about 5%". New Do not say row. |

### Status downgraded

| Key | Old | New | Why |
|---|---|---|---|
| overnight_avg | VERIFIED, "the hours the fixed overnight rule charges in" | CONFLICT; claim corrected | $38.71 is the HB 1am-5am mean (1am to 6am). The rule charges HB 1am-4am at a mean of $39.53 (C1). Beat 2 pairs {overnight_avg} with the rule.. Window mean only: never quote it as a charge price; the charge-price keys are fixed_rule_charge_usd_mwh and timetable_charge_usd_mwh (#19, item 6) |
| midday_avg | VERIFIED | CONFLICT | The timetable charges HB 1pm-3pm at a mean of $21.55 (C1), but Beat 2 says "Clearlane charges at {midday_avg} [$22]", and $22.83 rounds to $23.. Window mean only: never quote it as a charge price; the charge-price keys are fixed_rule_charge_usd_mwh and timetable_charge_usd_mwh (#19, item 6) |
| fixed_rule_charge_usd_mwh | Mean price of the hours the fixed off-peak rule charges in (HB 1am-4am, 1am to 5am) on Oct 27. The beat 2 charge price for the off-peak rule. | $39.53 | DERIVED | C1 (the engine writes this key in Core 12) | C1 | 1 | UNCHECKED (value as the verifier's C1 run is quoted in the overnight_avg row; not re-run this pass; added in #19) |
| timetable_charge_usd_mwh | Mean price of the hours Clearlane's reference timetable charges in (HB 1pm-3pm) on Oct 27. The beat 2 charge price for Clearlane. | $21.55 | DERIVED | C1 (the engine writes this key in Core 12) | C1 | 1 | UNCHECKED (value as the verifier's C1 run is quoted in the midday_avg row; not re-run this pass; added in #19) |

### Status or level raised (each confirmed by the verifier)

| Key | Old | New | Evidence |
|---|---|---|---|
| edam_go_live | UNCHECKED, Lvl 1 | VERIFIED, Lvl 2 | PacifiCorp's EDAM go-live release and CAISO's PGE release, URLs now in the row. |
| pace_dam_history_start | UNCHECKED, Lvl 1 | VERIFIED, Lvl 4 | The caiso7 file from an Apr 25 query holds 552 PACE hours, the first at 2026-05-01T07Z. |
| rowe_asks | UNCHECKED, Lvl 1, "4 asks" | VERIFIED, Lvl 2, "6 recommendations; 4 points used" | Read in `../clearlane-raw/dl/wraap.txt` lines 107-156 and 237-241. The System Critical Hours point is a question, not one of the six bullets. |
| rowe_audience | CONFLICT, Lvl 1 | CONFLICT, Lvl 2 | Same file: the letter is addressed to ROWE about its EDAM and WEIM footprint program, and the word Utah does not appear in it. |

### Notes added without a status change

- events_2024 and wattsmart_approval: the live release header reads 3.18.2025 and its dateline March 19, 2025.
- magnetar_raise: header 9.5.2025, dateline September 9 2025.
- mou_70mw: the "within six months" wording comes from the Magnetar release only.
- time_vs_space_jul: the July nodes are PACE, PACW and SP15, so July "space" includes California.
- torus_lifespan_yr: the live Pulse page lists no lifespan and mentions repowering.
- pulse_cycle_budget: the 25-year divisor is our assumption; say "if Pulse lasts the Station's 25-year life".
- call_hours_2025 and pulse_eq_cycles_calls: at 5.6 minutes they become 33.5 h (0.38%) and 16.8; say "about 16 to 17".
- torus_dc_pages_404: re-checked Oct 27 about 12:10am MT, 404 on all four; Wayback shows HTTP 200 on Aug 6 2026 only.
- event_winners: the live agenda lists the announcement at 9:05-9:15 AM on 10.29.2026.

### Not confirmed by the verifier

- oct27_prices_available_mt: that the file stamp is Pacific time comes from the research note; not checked on its own.
- rmp_event_timing_2024: the heatmap side was re-read; the Utility Dive side was not reopened.
- All UNCHECKED and PENDING-ENGINE rows not named above are unchanged and were not checked.
