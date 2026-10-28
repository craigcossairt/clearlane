# Intervals on the backtest headline numbers

Flag: off_backtest_intervals (not read by the stage app)

Issue #111. A median over about 180 days still has sampling error, and neighboring days are
correlated (weather, fuel mix and hydro run in spells). This note puts 90% intervals on the backtest
headline numbers with block bootstraps that keep runs of consecutive days together. All dollar values
are value to RMP's system at day-ahead prices, in $/MW-day; none is Torus revenue or a host saving, and
none is annualized. The fixed overnight rule is our comparison rule, not Torus practice.

Script: `python -I science/backtest_intervals.py`. Input: `public/derived/backtest_days.json` (engine,
DERIVED from REAL PACE day-ahead prices). Point values are compared with `public/derived/backtest.json`.
Output: `science/backtest_intervals.json` (sorted keys; same seed, identical bytes). Every number below
the results marker is printed by that script and names its input file.

## Method and tolerances (written before computing)

Written Wed Oct 28 2026 by the science-stretch session, before any interval was computed. Reads before
this section: the `BacktestResult` summary in `public/derived/backtest.json` (the pinned points) and the
first two rows of `public/derived/backtest_days.json` (to learn the layout).

### Data

- One value per day and policy: `usd_per_mw_day` for `fixed_overnight`, `price_only` and `clearlane`
  from `backtest_days.json`, in date order. The three policies of a day are resampled together, so the
  bootstrap keeps the link between policies on the same day.
- The days must be consecutive calendar days with all three policies present; any gap or missing policy
  is listed, and blocks are drawn over the days present in date order.

### Statistics

- P50 per policy: linear interpolation (Hyndman-Fan type 7), the method `backtest.json` uses (cross-check
  #107 found it), via `science.crosscheck.pctl_linear`.
- `days_beating_fixed_overnight_pct` per policy: 100 x share of days on which the policy's value is
  strictly greater than `fixed_overnight` on the same day; ties do not beat. `fixed_overnight` itself is
  therefore 0 on every resample.

### Bootstraps

- Resamples: B = 10,000 per method.
- Seed: 111. Each method gets its own `random.Random(111)` instance.
- Moving-block bootstrap (the headline interval): block length 7 days. The candidate blocks are the
  n minus 6 runs of 7 consecutive days (no wrap). Each resample draws ceil(n / 7) block starts uniformly
  with replacement, joins the blocks in draw order and cuts the result to n days.
- Stationary bootstrap (the second interval): mean block length 7 days. The first day is uniform over the
  n days; each next day starts a new block (a uniform day) with probability 1/7 and otherwise follows the
  previous day, wrapping from the last day to the first. Resample length n.
- Reference only: an independent-days bootstrap (block length 1), to show how much the day-to-day
  correlation widens the intervals. It is not a headline interval.
- Interval: the percentile method. The 90% interval is the 5th and 95th percentiles of the B resampled
  statistics, by the same linear interpolation.

### Checks and tolerances

| Check                                               | Pinned                                         | Tolerance                                                       | Test                   | A mismatch would mean                                                             |
| --------------------------------------------------- | ---------------------------------------------- | --------------------------------------------------------------- | ---------------------- | --------------------------------------------------------------------------------- |
| point P50 per policy, from the per-day rows         | `backtest.json` `usd_per_mw_day.p50`           | within $0.01 and rounds equal at 2 dp; the abs diff is reported | abs diff               | the summary does not come from the per-day file, or the percentile method differs |
| point `days_beating_fixed_overnight_pct` per policy | `backtest.json`                                | within 0.01 percentage point; abs diff reported                 | abs diff               | tie rule or day set differs                                                       |
| per-row `beats_fixed_overnight` flags               | the strict greater-than rule on the row values | every day agrees                                                | count of disagreements | the flag uses another tie rule                                                    |
| day set                                             | `backtest.json` `window` (days, missing days)  | days exact; consecutive dates                                   | equality               | the per-day file and the summary cover different days                             |
| interval contains its point                         | none                                           | reported, not required                                          | yes or no              | a skewed bootstrap distribution; reported, never adjusted                         |
| reproducibility                                     | none                                           | two runs give identical bytes                                   | sha256                 | a nondeterministic step                                                           |

Monte Carlo error. Interval endpoints move a little with the seed. The script also reruns each method
with seed 112 and reports the largest endpoint change as a stability check; the seed 112 intervals are
not results.

### Limits, stated before computing

- One season (May to October 2026) of day-ahead prices. The intervals describe sampling error over these
  days, not how a different year would look.
- A 7-day block keeps weekly and short weather runs together but not longer spells; the stationary
  bootstrap is the check on that choice.
- The bootstrap resamples the engine's daily values. It does not re-run the planner, so it says nothing
  about errors in the model itself.
- Percentile intervals for a median of a skewed series are approximate.

## Results

<!-- results:start -->
Run: `python -I science/backtest_intervals.py`, seed 111, 10,000 resamples per method. Input `public/derived/backtest_days.json` (sha256 b2b6f00f5ec9...); point checks against `public/derived/backtest.json` (sha256 ad4210272203...). Every value below is DERIVED from these files; dollars are $/MW-day of value to RMP's system at day-ahead prices.

Days: 179 consecutive days, 2026-05-02 to 2026-10-27 (`public/derived/backtest_days.json`); gaps: 0; days missing a policy: 0.

### Point values vs the summary

| Check | From `public/derived/backtest_days.json` | `public/derived/backtest.json` | Abs diff | Tolerance | Status |
|---|---|---|---|---|---|
| P50 fixed_overnight | 7.751021 | 7.751021 | 0 | $0.01; 2 dp | match |
| P50 price_only | 44.905881 | 44.905881 | 0 | $0.01; 2 dp | match |
| P50 clearlane | 38.686189 | 38.686189 | 0 | $0.01; 2 dp | match |
| days beating fixed overnight, fixed_overnight (%) | 0.000000 | 0.000000 | 0 | 0.01 percentage point | match |
| days beating fixed overnight, price_only (%) | 100.000000 | 100.000000 | 0 | 0.01 percentage point | match |
| days beating fixed overnight, clearlane (%) | 91.061453 | 91.061453 | 0 | 0.01 percentage point | match |
| day set | 179 days to 2026-10-27 | 179 days, missing 2026-05-01 | | exact | match |
| `beats_fixed_overnight` flags vs strict greater than | 0 disagree | | | none disagree | match |

### 90% intervals on P50, $/MW-day (source `public/derived/backtest_days.json`)

| Policy | Point P50 | 7-day moving block | Stationary, mean block 7 | Reference: independent days | Point inside both block intervals |
|---|---|---|---|---|---|
| fixed_overnight | $7.75 | $0.90 to $15.86 | $0.34 to $16.18 | $4.04 to $11.08 | yes |
| price_only | $44.91 | $39.35 to $54.06 | $39.35 to $54.32 | $41.72 to $50.45 | yes |
| clearlane | $38.69 | $33.00 to $48.25 | $32.77 to $48.90 | $34.66 to $42.59 | yes |

The 7-day moving-block intervals on P50 are 1.7 to 2.1 times as wide as the independent-days reference, so the day-to-day correlation matters.

### 90% intervals on days beating the fixed overnight rule, % of days (source `public/derived/backtest_days.json`)

| Policy | Point | 7-day moving block | Stationary, mean block 7 | Reference: independent days |
|---|---|---|---|---|
| fixed_overnight | 0.0 | 0.0 to 0.0 | 0.0 to 0.0 | 0.0 to 0.0 |
| price_only | 100.0 | 100.0 to 100.0 | 100.0 to 100.0 | 100.0 to 100.0 |
| clearlane | 91.1 | 85.5 to 95.5 | 85.5 to 96.1 | 87.7 to 94.4 |

Ties do not beat, so fixed_overnight is 0 on every resample.

Seed check (seed 112, not a result): the largest endpoint change is $1.01 and 0.00 percentage points for the moving block, $1.33 and 0.00 for the stationary bootstrap.

Quote: Clearlane's median daily value: $38.69 per MW-day of value to RMP's system at day-ahead prices, 90% interval $33.00 to $48.25; it beat a battery on a fixed off-peak rule on 91% of days (90% interval 85.5% to 95.5%). 7-day moving-block bootstrap of public/derived/backtest_days.json, seed 111; DERIVED by science/backtest_intervals.py.
<!-- results:end -->

## Note, Wed Oct 28 2026 (after the real run)

The method and tolerance section above is unchanged since its own commit (452d4bf).

- Point checks. Every row matches: the P50 and the share of days beating the fixed overnight rule, for
  each policy, come back from the per-day rows to the value in `public/derived/backtest.json` with no
  difference, the day set is the summary's, and no `beats_fixed_overnight` flag disagrees with the strict
  greater-than rule. No issue was filed.
- Every point P50 sits inside both of its block intervals. The moving-block and stationary intervals
  agree closely; the stationary one is a little wider for every policy.
- The independent-days reference is much narrower, so an interval that ignored the correlation between
  neighboring days would overstate how precisely one season pins the median.
- The share for `price_only` is a zero-width interval because it beats the fixed rule on every day, and
  `fixed_overnight` cannot beat itself, so both are degenerate by construction, not by luck.
- The quote line above is printed by the script and uses the moving-block interval, the headline method.
- Independence. No engine code was read. The bootstrap uses the engine's daily values as given; it does
  not re-solve any plan.
