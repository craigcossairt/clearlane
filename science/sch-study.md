# System Critical Hours rule study, May to October 2026

Flag: off_sch_study (not read by the stage app)

Issue #109. Our envelope flags System Critical Hours with one proposed rule: the 4 highest net-load
hours of the day plus every jam hour. A docket reader will ask how that compares with simpler rules
over a whole season. This study answers on REAL PacifiCorp East (PACE) data and compares the flagged
hours with the TORUS_PUBLISHED 2025 call counts by hour. It is a study of rules, not a forecast of
calls, and the rule is our proposal, not an RMP or Torus definition.

Script: `python -I science/sch_study.py`. Outputs: `science/sch_study.json` (sorted keys),
`science/charts/sch_rules.svg` (1920x1080) and `science/charts/sch_rules.json` (the plotted values).
A second run is byte-identical. Every number below the results marker is printed by that script and
names its input file.

## Definitions, statistics and tolerances (written before computing)

Written Wed Oct 28 2026 by the science-stretch session, before any rule was computed. Reads before this
section: the column headers of the three `research/data/eia930/PACE_EIA930_BALANCE_*.csv` files with
their first and last time stamps and the count of blank cells in the demand, solar and wind
"(Adjusted)" columns (to fix the column choice below); the layout of `public/data/bundle_2026-10-27.json`,
`public/derived/envelope_2026-10-27.json` and `public/data/torus_published.json`; and the FACTS rows
`sch_hours_today`, `lane_jam_min_usd`, `rmp_heatmap_by_hour` and `heatmap_readings`.

### Inputs

- Prices: `public/data/hist_2026-05-01_2026-10-27.json` (REAL PACE day-ahead LMP, by hour beginning MT).
- Net load for the season: EIA-930 PACE balance files in `research/data/eia930/` (REAL, metered actuals):
  "Demand (MW) (Adjusted)" minus max(0, "Net Generation (MW) from Solar without Integrated Battery
  Storage (Adjusted)") minus "Net Generation (MW) from Wind without Integrated Battery Storage
  (Adjusted)". The "with Integrated Battery Storage" solar and wind columns are blank in every row of the
  2026 files, so they add nothing. Hour ending is converted to UTC start (end minus 1 hour), then to the
  Mountain day and hour beginning (`science/common.py`). An hour seen in two files must agree.
- Net load for the Oct 27 reproduction: the bundle's own CAISO forecasts in
  `public/data/bundle_2026-10-27.json` (`load_fcst_mw` minus max(0, `solar_fcst_mw`) minus
  `wind_fcst_mw`), and its `lmp_usd_mwh`. These are the engine's inputs. EIA-930 actuals are metered
  values and differ from these day-ahead forecasts, so the season study and the Oct 27 row use different
  net-load series on purpose.
- Engine flags: `system_critical` in `public/derived/envelope_2026-10-27.json`.
- Calls: `events_2025_by_hour` in `public/data/torus_published.json` (TORUS_PUBLISHED), which must equal
  FACTS `rmp_heatmap_by_hour` (9, 41, 5, 4, 1, 3, 4, 14, 23, 26, 25, 20, 15, 33, 19, 14, 14, 8, 6, 4,
  5, 34, 24, 8; sum 359).

### Season

Mountain days May 1 to Oct 27 2026 that have 24 hist prices and 24 complete EIA-930 hours. Any other day
is skipped and listed, with the reason, never filled. (The hist file has no May 1, and the EIA-930 file
ends before Oct 27, so the season is shorter than the window; the script says by how much.)

### Rules (all per Mountain day; N and the percentile fixed here)

1. **Ours**: the 4 highest net-load hours plus every jam hour, where jam = price at or over the day's max
   minus 25% of the day's range. Ties for 4th place go to the earlier hour, and any tie at that boundary
   is counted and reported.
2. **Top 6 price hours**: the 6 highest-price hours of the day, ties to the earlier hour. N = 6 is FACTS
   `sch_hours_today`, the size of our rule on Oct 27, so the two are the same size on the stage day.
3. **Net-load P75 threshold**: every hour whose net load is at or above the 75th percentile of all
   season hours' net load (linear interpolation, Hyndman-Fan type 7). On average that flags a quarter of
   hours, 6 a day, the same budget as rule 2, but it moves with the season.
4. **Top 4 net load only**: rule 1 without the jam part, to show what the jam hours add.

### Statistics

- Hours flagged per month per rule: total flagged hours, days, and the mean per day.
- Shape: f_R(h), the share of season days on which rule R flags hour beginning h.
- Overlap with the 2025 call counts, for each rule and reading:
  - weights w(h) = calls at hour h / 359;
  - coverage C = sum over h of w(h) x f_R(h): the expected share of calls that land in a flagged hour if
    the 2025 call hours fall on a random season day;
  - budget B = mean flagged hours per day / 24;
  - lift = C / B. A lift of 1 is no better than flagging the same number of hours at random.
- Readings: Mountain (label h is HB h MT), which FACTS `heatmap_readings` records as confirmed by Torus,
  and UTC as a sensitivity check only (MT hour = (h minus 6) mod 24 under MDT). The issue asks for the two
  together; FACTS now marks UTC as not for stage, so the UTC column is labeled as the sensitivity it is,
  the chart shows Mountain only, and nothing here is for stage.
- Agreement between rules: the Jaccard index |A and B| / |A or B| of the flagged (day, hour) sets of ours
  and each other rule.

### Checks and tolerances

| Check                                 | Pinned                                                             | Tolerance                                      | Test         | A mismatch would mean                                                                            |
| ------------------------------------- | ------------------------------------------------------------------ | ---------------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------ |
| Oct 27 SCH from the engine's inputs   | `system_critical` hours in the envelope; FACTS `sch_hours_today` 6 | the set of hours exact; count exact            | set equality | our reading of the rule (net-load definition, jam threshold, tie rule) differs from the engine's |
| Oct 27 net load from bundle forecasts | bundle `net_load_mw`                                               | within 0.01 MW every hour                      | max abs diff | the net-load definition differs                                                                  |
| Oct 27 jam threshold                  | FACTS `lane_jam_min_usd` $47.18                                    | rounds equal at 2 dp                           | abs diff     | the 25% rule or the price series differs                                                         |
| 2025 call counts                      | FACTS `rmp_heatmap_by_hour`                                        | every count exact; sum 359                     | equality     | the data file and FACTS disagree                                                                 |
| reproducibility                       | none                                                               | two runs give identical bytes for every output | sha256       | a nondeterministic step                                                                          |

If the Oct 27 row does not match the envelope, the mismatch is filed for Integration as a core issue
with both hour sets. A result is never adjusted to match.

### Chart

`science/charts/sch_rules.svg`: top panel, f_R(h) by hour beginning for each rule, one line each, labeled
in text at the line's end and drawn with distinct dash patterns, so color is never the only signal;
bottom panel, the 2025 calls by hour in the Mountain reading, as bars. All text 24px or larger. A JSON of
exactly the plotted values sits beside it.

### Limits, stated before computing

- EIA-930 values are metered actuals; the engine plans on CAISO day-ahead forecasts. The season study
  therefore describes the rules on actuals, not the engine's day-ahead flags.
- The call counts cover all of 2025 and give no dates; the season here is May to October 2026. Coverage
  assumes the 2025 hour shape holds for this season, which is an ASSUMPTION.
- One season of EDAM prices (public PACE day-ahead prices start May 1 2026).
- PACE spans Utah, Wyoming and Idaho; the rules use the whole PACE area, not a single feeder.

## Results

<!-- results:start -->

Not computed yet.
<!-- results:end -->
