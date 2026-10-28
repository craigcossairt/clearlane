# Step-hour statistics: is the 5pm to 6pm price step real?

Flag: off_step_stats (not read by the stage app)

Issue #108. Exact tests on REAL PacifiCorp East (PACE) day-ahead prices from
`public/data/hist_2026-05-01_2026-10-27.json` (data lane, `HistDay[]`). Code written apart from
`research/analysis/option2/step_hours.py`, which was not opened. The step-hour definition is
`science.crosscheck.step_hour`, the science function that cores 2 and 3 already test.

Script: `python -I science/step_stats.py`. Output: `science/step_stats.json` (sorted keys; same seed,
identical bytes). Every number below the results marker is printed by that script and names its
input file.

## Tolerances, statistics and null hypotheses (written before computing)

Written Wed Oct 28 2026 by the science-stretch session, before any step hour was computed from the hist
file. Reads before this section: the `HistDay` type in `contracts/types.ts`, the first row of the hist
file and its sidecar `public/data/hist_2026-05-01_2026-10-27.meta.json` (to learn the layout and the
missing day), and the pinned values in `docs/FACTS.md` and `public/derived/numbers.json`.

### Definitions

- Day: one `HistDay` row, a Mountain operating day (`operating_day_mt`), prices by hour beginning MT
  (`lmp_usd_mwh`). A day in the window May 1 to Oct 27 2026 that is absent from the file or has other
  than 24 prices is skipped and listed, never filled.
- Step hour (`docs/lanes/science.md` 6.4): step(h) = p[h] minus p[h-1] for h = 1 to 23. The step hour is
  the h with the largest step, ties to the earliest h. The step amount is that largest value. No
  cross-midnight step.
- Windows. October is Oct 1 to 27 (FACTS `oct_step_hour_days`). July is Jul 1 to 30 (FACTS
  `jul_step_hour_spread` and the core 3 chart), so the tests use the same days the stage and the chart
  count. Jul 1 to 31 is reported beside it as a sensitivity. Monthly lines use each calendar month as
  present in the file (May starts at May 2; October ends at Oct 27).
- Target set: {HB 5pm, HB 6pm} = {17, 18}.

### Reproduction checks

| Check (FACTS key)                                      | Pinned                                                       | Tolerance                                                                | Test               | A mismatch would mean                                                                      |
| ------------------------------------------------------ | ------------------------------------------------------------ | ------------------------------------------------------------------------ | ------------------ | ------------------------------------------------------------------------------------------ |
| oct_step_hour_days (count)                             | 24 of 27 in HB 5pm or 6pm; HB 5pm 9, HB 6pm 15               | counts exact                                                             | equality           | the step definition, tie rule, day set or hist prices differ from the raw-OASIS derivation |
| oct_step_hour_days_at_5_or_6, oct_step_hour_days_total | numbers.json 24 and 27                                       | exact                                                                    | equality           | same, against the engine                                                                   |
| oct_step_hour_days (median step)                       | $15.1; numbers.json oct_step_median_usd                      | rounds equal to $15.1 at 1 dp; within $0.00001 of numbers.json           | abs diff           | median of 27 values taken differently, or prices differ                                    |
| jul_step_hour_spread                                   | 28 of 30 in HB 1pm to 8pm; median $10.1                      | count exact; median rounds equal at 1 dp (mean of the two middle values) | equality, abs diff | as above, July                                                                             |
| hist vs raw OASIS step hours                           | `science/charts/step_hours_oct_jul.json` (core 3, raw OASIS) | counts by hour equal at every hour, October and July                     | equality           | the hist file and raw OASIS disagree on a step                                             |

If the October count is not 24 of 27, the mismatch is filed for Integration as a core issue
(`lane:integration`, `tier:core`) with both values. A result is never adjusted to match.

### Test 1: exact binomial, October and July separately

- Null hypothesis H0: each day's step hour is uniform on {1, ..., 23} and independent across days, so a
  day lands in {17, 18} with probability p0 = 2/23.
- Alternative: more days land in {17, 18} than under H0 (one-sided, upper tail).
- Statistic: k = number of days whose step hour is 17 or 18, out of n days.
- p-value: P(X >= k) for X ~ Binomial(n, 2/23), summed exactly in rational arithmetic
  (`fractions.Fraction`) and converted to a float only at the end. The expected count n x 2/23 is shown.
- Reported for October (Oct 1 to 27), July (Jul 1 to 30) and the July sensitivity (Jul 1 to 31).
- Reading: a small p says step hours are not spread evenly over the day. It does not say 5pm to 6pm is
  special against other afternoon hours; Test 2 asks the October versus July question.

### Test 2: permutation test, October vs July (the one to quote)

- H0: October and July step hours come from one distribution (the month labels are exchangeable).
- Statistic, fixed in advance: total variation distance between the two empirical step-hour
  distributions, TVD = 1/2 x sum over h = 1 to 23 of |f_oct(h) minus f_jul(h)|, where f is the share of
  that month's days with step hour h. Larger means more different.
- Secondary statistic on the same permutations (reported, not quoted): share of days in {17, 18},
  October minus July.
- Procedure: pool the October (Oct 1 to 27) and July (Jul 1 to 30) step hours; for each of B = 100,000
  permutations, shuffle the pool with one `random.Random(108)` instance and split it into the first 27
  (October) and the remaining 30 (July). p = (1 + number of permutations with statistic >= observed) /
  (1 + B), the add-one estimate that is never 0. The Monte Carlo standard error
  sqrt(p (1 minus p) / B) is reported.
- The July sensitivity (Jul 1 to 31) repeats the test with the same seed.
- Two identical samples give an observed TVD of 0, so every permutation ties or exceeds it and p = 1.

### Monthly lines, May to October

One line per month: days, modal step hour (if several hours share the top count, all are listed),
the count at the mode, and the median step in $/MWh.

### Tolerances on the statistics themselves

- Binomial p-values are exact; two runs give the same value.
- Permutation p-values depend on the seed. The seed (108), B and the per-day step hours are in the JSON,
  so a rerun with the same seed gives identical bytes. A second seed is not part of the result.

### Limits, stated before computing

- Days are not independent: weather and the fuel mix persist for several days. Both tests treat days as
  exchangeable, so their p-values are smaller than a test that models that persistence would give.
- One season of prices: public PACE day-ahead prices start May 1 2026 (EDAM), so no multi-year claim.
- These are day-ahead prices, not real-time or metered values.

## Results

<!-- results:start -->

Not computed yet.
<!-- results:end -->
