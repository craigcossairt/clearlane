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

Not computed yet.
<!-- results:end -->
