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
Run: `python -I science/sch_study.py`. Inputs: `public/data/hist_2026-05-01_2026-10-27.json` (sha256 cfe0c0098def...), `research/data/eia930/PACE_EIA930_BALANCE_2026_*.csv` (16cda2fdf796..., 255f922e6fdb...), `public/data/torus_published.json` (sha256 a5113a668928...), `public/data/bundle_2026-10-27.json` (sha256 390e2fc0c1d7...) and `public/derived/envelope_2026-10-27.json` (sha256 95186c70bbf7...). Every value below is DERIVED from these files.

Season: 177 Mountain days, 2026-05-02 to 2026-10-25, with 24 prices in `public/data/hist_2026-05-01_2026-10-27.json` and 24 complete hours in `research/data/eia930/PACE_EIA930_BALANCE_2026_*.csv`. Skipped and listed, never filled: 2026-05-01 (no hist row); 2026-10-26 (EIA-930 has 0 complete hours); 2026-10-27 (no EIA-930 hours).

Net-load P75 threshold over the season's hours (`research/data/eia930/PACE_EIA930_BALANCE_2026_*.csv`): 4,935.5 MW. Ties at the boundary of a top-k rule: 2 days for ours, 0 for top 6 price.

### Oct 27, from the engine's own inputs

| Row | Hours flagged (HB, Mountain) | Count | Status |
|---|---|---|---|
| ours on `public/data/bundle_2026-10-27.json` forecasts and prices: top 4 net load [19, 20, 21, 22], jam [18, 19, 20, 21, 22, 23] | [18, 19, 20, 21, 22, 23] | 6 | match |
| engine `system_critical` in `public/derived/envelope_2026-10-27.json`; FACTS sch_hours_today 6 | [18, 19, 20, 21, 22, 23] | 6 | |
| net load from `public/data/bundle_2026-10-27.json` forecasts vs its `net_load_mw` (max abs diff 0.000 MW) | | | match |
| jam threshold from `public/data/bundle_2026-10-27.json` prices: 47.1800 vs FACTS lane_jam_min_usd $47.18 | | | match |
| for contrast, top 6 price on `public/data/bundle_2026-10-27.json` | [18, 19, 20, 21, 22, 23] | 6 | |

EIA-930 values are metered actuals and differ from the CAISO day-ahead forecasts the engine plans on; the Oct 27 row uses the forecasts, the season uses the actuals. EIA-930 has no complete Oct 27 in these files.

### Hours flagged per month (source `public/data/hist_2026-05-01_2026-10-27.json` and `research/data/eia930/PACE_EIA930_BALANCE_2026_*.csv`)

| Month | Days | Ours | Top 6 price | Net load P75 | Top 4 net load | Jam hours (part of ours) |
|---|---|---|---|---|---|---|
| 2026-05 | 30 | 292 (9.7 a day) | 180 (6.0 a day) | 33 (1.1 a day) | 120 (4.0 a day) | 258 (8.6 a day) |
| 2026-06 | 30 | 194 (6.5 a day) | 180 (6.0 a day) | 129 (4.3 a day) | 120 (4.0 a day) | 149 (5.0 a day) |
| 2026-07 | 31 | 198 (6.4 a day) | 186 (6.0 a day) | 474 (15.3 a day) | 124 (4.0 a day) | 140 (4.5 a day) |
| 2026-08 | 31 | 171 (5.5 a day) | 186 (6.0 a day) | 330 (10.6 a day) | 124 (4.0 a day) | 100 (3.2 a day) |
| 2026-09 | 30 | 189 (6.3 a day) | 180 (6.0 a day) | 65 (2.2 a day) | 120 (4.0 a day) | 118 (3.9 a day) |
| 2026-10 | 25 | 174 (7.0 a day) | 150 (6.0 a day) | 31 (1.2 a day) | 100 (4.0 a day) | 115 (4.6 a day) |
| season | 177 | 1218 (6.9 a day) | 1062 (6.0 a day) | 1062 (6.0 a day) | 708 (4.0 a day) | 880 (5.0 a day) |

### Overlap with the 2025 call counts by hour (calls: `public/data/torus_published.json`, TORUS_PUBLISHED; flags: `public/data/hist_2026-05-01_2026-10-27.json` and `research/data/eia930/PACE_EIA930_BALANCE_2026_*.csv`)

Coverage is the expected share of calls landing in a flagged hour if the 2025 call hours fall on a random season day; lift is coverage divided by the share of hours flagged (1.0 is no better than random). The Mountain reading is the one FACTS records as confirmed by Torus; the UTC column is a sensitivity check only and is not for stage.

| Rule | Hours flagged a day | Share of hours | Coverage, Mountain | Lift, Mountain | Coverage, UTC (sensitivity) | Lift, UTC (sensitivity) | Jaccard with ours |
|---|---|---|---|---|---|---|---|
| ours: the 4 highest net-load hours plus every jam hour | 6.88 | 28.7% | 25.1% | 0.88 | 26.1% | 0.91 | 1.000 |
| the 6 highest-price hours | 6.00 | 25.0% | 22.4% | 0.90 | 20.0% | 0.80 | 0.584 |
| every hour at or above the season's 75th percentile of net load | 6.00 | 25.0% | 22.5% | 0.90 | 24.0% | 0.96 | 0.290 |
| the 4 highest net-load hours only (ours without the jam part) | 4.00 | 16.7% | 15.5% | 0.93 | 13.8% | 0.83 | 0.581 |

Call counts in `public/data/torus_published.json` match FACTS rmp_heatmap_by_hour: yes (sum 359).

Chart: `science/charts/sch_rules.svg` (Mountain reading only); plotted values in `science/charts/sch_rules.json`.
<!-- results:end -->

## Note, Wed Oct 28 2026 (after the real run)

The definitions and tolerance section above is unchanged since its own commit (3f4ae16).

- Oct 27 reproduction. Our rule on the bundle's own forecasts and prices flags exactly the engine's
  `system_critical` hours in `public/derived/envelope_2026-10-27.json`, the FACTS count `sch_hours_today`.
  The net load recomputed from the bundle forecasts equals the bundle's `net_load_mw`, and the jam
  threshold equals FACTS `lane_jam_min_usd`. No mismatch, so no core issue was filed.
- No rule picks the 2025 call hours better than chance. In the Mountain reading every rule, ours
  included, has a lift below 1 (see the overlap table): the 2025 calls are spread across the day, and
  every rule here flags the late afternoon and evening. Our rule is built to hold Pulse's spare power in
  the hours the system is tightest (the net-load peak and the price jam), not to predict when RMP calls.
  It should be described that way, never as a call forecast. The UTC sensitivity column does not change
  this.
- The jam part is most of our rule in May, when the jam hours are many (see the month table), and it
  is what makes ours flag more hours than the plain top 4 net-load rule. Ours and the top 6 price rule
  overlap more than ours and the net-load P75 rule (see the Jaccard column).
- A single season-wide net-load threshold flags many hours in July and August and few in May and
  October, so on shoulder-season days it says little. The per-day rules flag every day.
- In these EIA-930 files the Oct 26 demand, solar and wind cells are blank and Oct 27 is absent, so the
  season stops at Oct 25 and the study cannot put EIA actuals beside the Oct 27 forecasts.
- Independence. No engine code was read. The Oct 27 row uses only the bundle and the envelope, and the
  rule text in the envelope's `sch_rule` field and `docs/lanes/science.md` 6.6.
