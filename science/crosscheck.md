# Cross-check of the pinned Oct 27 numbers

Issue #102. Independent re-derivation from raw public files in the repo. Code written from the
definitions in `docs/lanes/science.md` sections 6.1 to 6.6 and the claim text in `docs/FACTS.md`,
without reading `research/analysis/**` scripts, `prep/**`, `engine/**` or FACTS Appendix A.
Until #19 merges, `docs/review/crosscheck-2026-10-27.md` overrides the brief; item 13 sets the
true Oct 27 HB 0 price to $30.21857 ($30.22), not $30.22857.

Script: `python -I science/crosscheck.py`. Output: `science/crosscheck.json`.

## Tolerances (written before computing)

Written Tue Oct 27 2026, before any real input was read for a number. The only real-file read
before this section was the header and first row of one OASIS CSV, to confirm its column layout.

General rule. A re-derivation from the same raw file should match exactly; a miss means the
definitions differ (window, filter, join key, tie rule) or the input file differs, and the md says
which. "Rounds equal" means the science value rounded to the number of decimals the pinned value
is written with equals the pinned value. Test statistic for every row: the absolute difference
`|science - pinned|` (reported), plus the rounding comparison where stated.

| Check (FACTS key) | Pinned | Tolerance | Test | A mismatch would mean |
|---|---|---|---|---|
| fixed_usd_mw_day | 20.0647 | rounds equal at 4 decimals, and within $0.01 | abs diff | charge or discharge window, RTE split or price series differs |
| clearlane_usd_mw_day | 58.4053 | rounds equal at 4 decimals, and within $0.01 | abs diff | timetable hours (HB 1pm to 3pm) or price series differs |
| race_ratio | 2.911 | rounds equal at 3 decimals | abs diff | follows from the two rows above |
| fixed_70 | 1,404.5 | rounds equal at 1 decimal | abs diff | scaling (x70) or the base value differs |
| clearlane_70 | 4,088.4 | rounds equal at 1 decimal | abs diff | same |
| fixed_500 | 10,032 | rounds equal at 0 decimals | abs diff | scaling (x500) or the base value differs |
| clearlane_500 | 29,203 | rounds equal at 0 decimals | abs diff | same |
| oct_step_hour_days | 24 of 27; HB 5pm 9, HB 6pm 15 | counts exact (27 days, 24, 9, 15) | equality | step definition, tie rule, day grouping (06:00Z start) or node differs |
| oct_step_hour_days (median step) | $15.1 | rounds equal at 1 decimal | abs diff | same; or median of an even count handled differently (27 is odd) |
| jul_step_hour_spread | 28 of 30 in HB 1pm to 8pm | counts exact (30 days, 28) | equality | as above; July window Jul 1 to 30 |
| jul_step_hour_spread (median step) | $10.1 | rounds equal at 1 decimal (30 days: mean of the two middle values) | abs diff | median convention differs |
| fossil_priciest_oct | top decile $67.3 at 85.1%; bottom $23.0 at 39.8% | dollars round equal at 1 decimal; shares within 0.1 percentage point; n = 600, deciles of 60 | abs diff | join key (UTC start), hour-ending shift, column set, clamp, or a blank column |
| fossil_priciest_jul | top $65.2 at 76.3%; bottom $12.9 at 52.2% | same; n and decile size reported | abs diff | same; also which July days have prices |
| net_load_climb_mw | 604.6 at HB 3pm; 4,259.1 at HB 6pm; climb 3,654.51 | within 0.1 MW each; the raw path and the snapshot path within 0.1 MW of each other at every hour | abs diff | row filter on caiso3/caiso4, sub-hourly averaging, solar clamp, or hour alignment |
| lane_clear_max_usd | 29.98 | rounds equal at 2 decimals | abs diff | day window (snapshot order vs Mountain day) or the 25% rule |
| lane_jam_min_usd | 47.18 | rounds equal at 2 decimals | abs diff | same |
| clearlane_p50 | PENDING-ENGINE | none | status `pending` | not computed in this issue (core 7) |
| share_days_beating | PENDING-ENGINE | none | status `pending` | not computed in this issue (core 7) |

HB 0. Any pinned number that the snapshot's HB 0 row (Oct 28 00:00 MT, $46.11) can touch is
computed both ways: over the snapshot's 24 rows, and over the true Mountain day Oct 27 with
HB 0 = $30.21857 from `research/analysis/option2/oct/`. Of the rows above only the lane
thresholds (day min and max) can depend on HB 0; both values are reported.

A status is `match` only for a value this script computed and that passes its tolerance.

## Note, Tue Oct 27 2026 about 3am MT (after the real run)

The tolerance section above is unchanged since its hash was logged (sha256 aa20b753...).

- Race rows. From raw OASIS prices (5 decimals) the reference race gives fixed
  20.06513 and timetable 58.40968 $/MW-day. The pinned
  20.0647 and 58.4053 come back exactly when the same formula runs on the snapshot's prices, which are
  rounded to cents (`second_path` in the JSON: 20.06475 and
  58.40534). So the definitions agree; the pinned values
  were computed from cent-rounded prices. At the pinned rounding this moves `fixed_usd_mw_day` from
  $20.06 to $20.07, `clearlane_70` from $4,088 to $4,089, `fixed_500` from $10,032 to $10,033 and
  `clearlane_500` from $29,203 to $29,205. `race_ratio` matches either way. These rows are reported as
  mismatches under the tolerances written first, and filed for Integration to choose which price
  precision the stage pins.
- HB 0. Raw OASIS gives Oct 27 HB 0 = $30.21857, as crosscheck item 13 says. The snapshot's last row is
  Oct 28 00:00 MT at $46.11. The lane thresholds come out the same both ways because the day's minimum
  (HB 3pm) and maximum (HB 6pm) are not at HB 0. No race window uses HB 0.
- Net load. The filter that makes the raw files agree with the snapshot is caiso3
  `TAC_AREA_NAME == "PACE"` and `MARKET_RUN_ID == "DAM"` (24 rows), with caiso4 `BAA_GRP_ID == "PACE"`.
  caiso4 was already hourly. Both paths cover the CAISO trade day (07:00Z Oct 27 to 06:00Z Oct 28),
  so Oct 27 HB 0 load is not in the raw files; HB 3pm and HB 6pm are unaffected.
- Independence. No code in `research/analysis/**`, `research/**/scripts`, `prep/**`, `engine/**` or FACTS
  Appendix A was read, before or after the run. The mismatch was explained from the data files alone.
- Dependency #38 (data lane reference oracles) was still open. This check does not use the oracles,
  so it went ahead.

## Tolerances for #107: backtest and history (written before computing)

Written Tue Oct 27 2026 about 5:45pm MT by a stand-in science session, before any #107 number was
computed. Reads before this section: the `BacktestResult` summary in `public/derived/backtest.json`
(it was plotted, not recomputed, for #106), the first three rows of `public/derived/backtest_days.json`
and the first row of the hist file, to learn their layout. One by-hand check of the May 2 fixed
overnight value was done to confirm the rule reading below.

Definitions, from `contracts/types.ts`, `docs/lanes/engine.md` section 6.4, `docs/plan/synthesis.json`
and `backtest.json` only (no engine code read):

- fixed_overnight: starts at 0 kWh, charges evenly over HB 1 to 4 to full (500 kWh stored), discharges
  evenly over HB 18 and 19 to 0; no DP and no Spin. Per MW this is the reference race: sell
  2 x sqrt(0.88) MWh at the mean HB 18 to 19 price, buy 2 / sqrt(0.88) MWh at the mean HB 1 to 4 price.
- price_only: an independent stdlib DP (`science/dp.py`). 96 fifteen-minute steps, each hourly price held
  for 4 steps; 41 levels of 12.5 kWh (Pulse 500 kWh); sqrt(0.88) on each leg; charge at the meter at most
  `pulse_kw` 250 kW; discharge at the meter at most `min(pulse_kw, host + export_limit_kw)` with export
  limit 0 and host load from `public/derived/site_default.json`; no wear, no host ceiling, no SCH rule,
  no Spin; start at level 2 (25 kWh) and end at or above it. Value per MW-day = sum of price x grid MWh,
  divided by 0.25 MW.
- Percentiles: nearest-rank and linear interpolation (Hyndman-Fan type 7) are both computed; the one
  `backtest.json` used is named. `share_days_beating` counts strictly greater than fixed_overnight.

| Check | Pinned | Tolerance | Test | A mismatch would mean |
|---|---|---|---|---|
| backtest_fixed_overnight (P10, P50, P90, mean) | `backtest.json` fixed_overnight | $0.01/MW-day each, under the method that matches | abs diff | the rule reading (hours, swing, RTE split) or the day set differs |
| backtest_fixed_overnight (per day) | `backtest_days.json` fixed_overnight | $0.01/MW-day every day; max abs diff reported | max abs diff | same, on a named day |
| backtest_price_only_p50 | `backtest.json` price_only P50 | $0.01/MW-day | abs diff | the DP spec, the limits, the start and end level, or the price hold differs |
| backtest_price_only (per day) | `backtest_days.json` price_only | $0.01/MW-day every day; max abs diff and count over reported | max abs diff | same, on a named day |
| percentile_method | engine.md says linear (numpy default) | the matching method is the one within $0.01 on all three fixed_overnight percentiles | equality | the engine used another method |
| backtest_dominance | clearlane P10, P50, P90 at or below price_only's | each `<=` (no tolerance) | inequality | the clearlane plan is not feasible for the price-only problem, or the value accounting differs |
| clearlane_p50 | FACTS $39.21; numbers.json 39.2137 | recomputed from `backtest_days.json` clearlane rows: within $0.01 of `backtest.json`, rounds equal to $39.21; at or below the science price_only P50 | abs diff | the summary does not come from the per-day file, or the percentile method differs |
| share_days_beating | FACTS 96%; numbers.json 95.5307 | recomputed from per-day values, strict greater than: within 0.01 percentage point; rounds equal at 0 dp | abs diff | tie rule or day set differs |
| backtest_days | FACTS 179; missing 2026-05-01 | days exact; missing list exact; from the hist file and raw OASIS (a day without 24 prices) | equality | the window or the 24-hour rule differs |
| hist_vs_raw_prices | raw OASIS, ELAP_PACE-APND | every hour of May 1 to 23, Jul 1 to 30, Oct 1 to 27 within $0.00001; hours compared reported | max abs diff | node, LMP type, Mountain-day grouping or rounding differs |
| bundle_oct27_hb0 | raw 30.21857 (crosscheck item 13; the issue's "$30.22857" is that item's typo) | within the bundle's stored precision of 30.21857 (cents: 30.22) and not 46.11 | abs diff | the bundle borrowed Oct 28's hour |

## Results

<!-- results:start -->
| FACTS key | Pinned | Science | Tolerance | Status |
|---|---|---|---|---|
| fixed_usd_mw_day | 20.0647 | 20.06513 (snapshot cents: 20.06475, passes) | rounds equal at 4 dp and within 0.01 | mismatch |
| clearlane_usd_mw_day | 58.4053 | 58.40968 (snapshot cents: 58.40534, passes) | rounds equal at 4 dp and within 0.01 | mismatch |
| race_ratio | 2.911 | 2.911 (snapshot cents: 2.91084, passes) | rounds equal at 3 dp | match |
| fixed_70 | 1404.5 | 1404.559 (snapshot cents: 1404.532, passes) | rounds equal at 1 dp | mismatch |
| clearlane_70 | 4088.4 | 4088.677 (snapshot cents: 4088.374, passes) | rounds equal at 1 dp | mismatch |
| fixed_500 | 10032 | 10032.564 (snapshot cents: 10032.373, passes) | rounds equal at 0 dp | mismatch |
| clearlane_500 | 29203 | 29204.839 (snapshot cents: 29202.671, passes) | rounds equal at 0 dp | mismatch |
| lane_clear_max_usd | 29.98 | mountain_day 29.98036; snapshot_rows 29.98 | rounds equal at 2 dp (both ways) | match |
| lane_jam_min_usd | 47.18 | mountain_day 47.18285; snapshot_rows 47.18 | rounds equal at 2 dp (both ways) | match |
| oct_step_hour_days | days 27; hb17_or_18 24; hb17 9; hb18 15; median_step 15.1 | days 27; hb17_or_18 24; hb17 9; hb18 15; median_step 15.09984; skipped_days none | counts exact; median rounds equal at 1 dp | match |
| jul_step_hour_spread | days 30; hb13_to_20 28; median_step 10.1 | days 30; hb13_to_20 28; median_step 10.09922; skipped_days none | counts exact; median rounds equal at 1 dp | match |
| fossil_priciest_oct | top_lmp 67.3; top_share_pct 85.1; bottom_lmp 23.0; bottom_share_pct 39.8 | top_lmp 67.33642; top_share_pct 85.08028; bottom_lmp 23.02664; bottom_share_pct 39.75382; n_hours 600; unmatched_hours 0; blank_fuel_cells 600 | LMP rounds equal at 1 dp; shares within 0.1 point | match |
| fossil_priciest_jul | top_lmp 65.2; top_share_pct 76.3; bottom_lmp 12.9; bottom_share_pct 52.2 | top_lmp 65.19189; top_share_pct 76.28715; bottom_lmp 12.90268; bottom_share_pct 52.21035; n_hours 720; unmatched_hours 0; blank_fuel_cells 720 | LMP rounds equal at 1 dp; shares within 0.1 point | match |
| net_load_climb_mw | hb15 604.6; hb18 4259.1; climb 3654.51 | raw_hb15 604.62; raw_hb18 4259.13; raw_climb 3654.51; snapshot_hb15 604.62; snapshot_hb18 4259.13; snapshot_climb 3654.51; max_abs_diff_raw_vs_snapshot_mw 0.0; hours_compared 24 | within 0.1 MW each; paths within 0.1 MW at every hour | match |
| clearlane_p50 | PENDING-ENGINE | n/a | n/a | pending |
| share_days_beating | PENDING-ENGINE | n/a | n/a | pending |

Scoreboard: 8 match, 6 mismatch, 2 pending.

Notes:

- Mountain day 2026-10-27 HB 0 from raw OASIS = 30.21857; snapshot HB 0 row is 10-28 00:00 MT = 46.11000.
- Raw OASIS vs snapshot, HB 1 to 23: max abs difference 0.00487 $/MWh.
- caiso4 rows are hourly; no sub-hourly averaging was needed.
- caiso3 filter: TAC_AREA_NAME == PACE and MARKET_RUN_ID == DAM (24 rows, LOAD_TYPE 1). caiso4 filter: BAA_GRP_ID == PACE.
<!-- results:end -->
