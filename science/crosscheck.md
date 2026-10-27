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
