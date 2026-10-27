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

## Results

<!-- results:start -->
Not run yet.
<!-- results:end -->
