# Science methods: equations, inputs and limits

Flag: off_science_methods (not read by the stage app)

For every science output on the tree: what it reads, how it computes, and where it stops being valid.
Each output's own md holds its tolerances (written before computing) and results; this note holds no
results. Constants are named as in the scripts.

## Shared rules

- **Code.** Python 3.13 standard library only, run as `python -I science/<script>.py`; shared helpers
  in `science/common.py`.
- **Time.** Mountain day D runs from local midnight (D 06:00Z under MDT). `common.mountain_offset_hours`
  writes the US rule: MDT from the second Sunday of March 09:00Z to the first Sunday of November
  08:00Z. OASIS times come from `INTERVALSTARTTIME_GMT`; EIA files are hour ending (UTC start = end
  minus one hour). A day without 24 prices is skipped and listed, never filled.
- **Percentiles.** Hyndman-Fan type 7 (linear interpolation) unless an output says otherwise:
  with sorted values v and n of them, h = (n - 1) q and P(q) = v[floor h] + (h - floor h)(v[floor h + 1] -
  v[floor h]). Nearest rank is reported beside it where the method was not pinned.
- **Reproducibility.** Seeded `random.Random(SEED)`, seeds and input sha256s in the output, sorted-key
  JSON, no timestamps. A test proves each second run is byte-identical.
- **Provenance.** REAL (OASIS, EIA), TORUS_PUBLISHED (heatmap, Spin timings), DERIVED, SIMULATED,
  ASSUMPTION, as the source. The heatmap is read in Mountain time, as Torus confirmed (FACTS
  `heatmap_readings`); the UTC reading is a labeled sensitivity, never on stage.

## 1. Cross-check of the Oct 27 pins (`crosscheck.py`, `crosscheck.md`, #102)

- **Inputs**: raw OASIS day-ahead LMP for `ELAP_PACE-APND` and peers, the CAISO load and EDAM solar and wind
  forecasts for Oct 27, EIA-930 PACE balance files, all under `research/data/` and
  `research/analysis/option2/`.
- **Reference race** (FACTS `ref_station`): a 1 MW, 2 MWh station with round-trip efficiency 0.88
  split as a square root on each leg. Charge energy Cg = 2 / sqrt(0.88) MWh, discharge Dg =
  2 x sqrt(0.88) MWh, value = Dg x mean(price over discharge hours) minus Cg x mean(price over charge
  hours). Fleet lines multiply by MW.
- **Step hour**: step(h) = p[h] minus p[h - 1] for h = 1 to 23; the step hour is the arg max, ties to
  the earliest h; no cross-midnight step.
- **Fossil share**: (max(coal, 0) + max(gas, 0)) / sum of max(x, 0) over the listed fuels, joined to
  OASIS on UTC start; hours ranked by price (ties by time) and cut into deciles of n / 10.
- **Net load and lanes**: net load = load forecast minus max(0, solar forecast) minus wind forecast.
  Clear lane: price at or under min + 25% of the day's range; jam: at or over max minus 25%.
- **Limits.** One day. Forecast net load, not metered. Average fuel shares, not marginal emissions.

## 2. Backtest re-derivation (`crosscheck.py`, `dp.py`, #107)

- **Inputs**: `public/data/hist_2026-05-01_2026-10-27.json`, `public/derived/backtest.json`,
  `public/derived/backtest_days.json`, `public/derived/site_default.json`.
- **Fixed rule** per day: the race formula above with the rule's fixed hours, on the hist prices.
- **Price-only DP** (`dp.py`, written from the planner spec, never from engine code): Pulse state of
  charge on a grid of levels; each 15-minute step moves at most the spec's levels up or down at the
  meter; one-way efficiency sqrt(RTE) on each leg; the day ends at or above its start level. Bellman
  recursion V_t(s) = max over feasible s' of [p_t x g(s, s') + V_t+1(s')], with g the grid energy of
  the move (positive when sold).
- **Dominance test**: Clearlane's plan is feasible for the price-only problem, so its daily value is
  at or below price-only's, and so are its P10, P50 and P90. A violation is a mismatch.
- **Limits.** No host ceiling, wear, envelope or Spin reserve: an upper bound, not a second planner.

## 3. Charts (`chart_step_hours.py` #103, `chart_price_co2.py` #104, `chart_backtest.py` #106)

SVG through `science/svgplot.py` (1920 by 1080, text 24px or larger, palette tokens, a footer naming
sources and provenance), with a `.json` of exactly the plotted values; `.light.svg` for print.

- **Step hours, October vs July**: counts of each day's step hour (section 1) from the OASIS files.
- **October price vs CO2 intensity**: mean PACE day-ahead price by hour beginning over Mountain days
  Oct 1 to 25, against EIA's average CO2 intensity of generated electricity from `PACE.xlsx`
  (lb/kWh x 453.592 = g/kWh; hour beginning h uses hour ending h + 1), with the hist file's
  `co2_g_kwh`, then FACTS `co2_profile_he_oct`, as fallbacks.
- **Backtest spread**: per policy, the P10 to P90 bar, the P50 tick and the mean dot of
  `usd_per_mw_day`, read from `backtest.json` and never recomputed (section 2 checks them).
- **Limits.** CO2 is an estimated average intensity, not the marginal effect of a station. The
  backtest chart inherits every engine assumption.

## 4. Step-hour statistics (`step_stats.py`, `step-stats.md`, #108)

- **Inputs**: the hist file and the raw OASIS files for October and July.
- **Binomial test**: under the null that the step hour is uniform over the 23 possible hours, the
  chance it lands on HB 5pm or 6pm is p0 = 2 / 23. With k such days of n, the one-sided p value is
  P(X >= k) = sum over j from k to n of C(n, j) p0^j (1 - p0)^(n - j), computed exactly with fractions.
- **Permutation test**: total variation distance between the October and July step-hour
  distributions, TVD = 1/2 x sum over h of |a_h / n_a minus b_h / n_b|, compared with `PERMS` random
  relabelings of the pooled days; add-one p value (1 + number at or above the observed) / (1 + `PERMS`).
- **Limits.** Days are not independent (weather persists), so both p values overstate the evidence:
  a pattern far from chance, not a forecast.

## 5. Backtest intervals (`backtest_intervals.py`, `backtest-intervals.md`, #111)

- **Inputs**: `public/derived/backtest_days.json` and `backtest.json`.
- **Statistics**: each policy's P50 of daily `usd_per_mw_day`, and the share of days beating the fixed
  rule, counted strictly (ties do not beat).
- **Moving-block bootstrap** (the headline): ceil(n / `BLOCK`) blocks of `BLOCK` consecutive days, each
  starting uniformly among the n - `BLOCK` + 1 runs, joined and cut to n days. **Stationary bootstrap**
  (Politis-Romano): each next day is a fresh uniform day with probability 1 / `BLOCK`, else the
  following day, wrapping. An iid bootstrap is a reference only. `RESAMPLES` draws each; the interval
  is the type 7 percentile pair at (1 - `LEVEL`) / 2 and 1 minus that. All policies are resampled on
  the same days, so paired comparisons hold.
- **Limits.** One season at one simulated site. Block length is a choice; the stationary check shows
  how much it matters. Values are to RMP's system at day-ahead prices and are never annualized.

## 6. System Critical Hours rule study (`sch_study.py`, `sch-study.md`, #109)

- **Inputs**: EIA-930 PACE balance files (demand, solar and wind, "(Adjusted)"), the hist prices, the Oct 27
  bundle and envelope, and the 2025 heatmap in `public/data/torus_published.json`.
- **Rules** per Mountain day: ours (the 4 highest net-load hours plus every jam hour), the top 6 price
  hours, a season net-load P75 threshold, and the top 4 net-load hours alone. Ties go to the earlier
  hour.
- **Overlap with the heatmap**: f_h = share of days that flag hour h; w_h = share of 2025 calls at hour
  h. Coverage = sum over h of f_h x w_h (the chance a random call falls in a flagged hour); budget =
  mean flagged hours per day / 24; lift = coverage / budget. Lift 1 is what random flags of the same
  size would score. Jaccard similarity between rules' flagged (day, hour) sets.
- **Reproduction row**: on Oct 27, with the engine's own forecast inputs, our rule must equal the
  envelope's flags exactly.
- **Limits.** The heatmap is 2025 and the rules run on 2026 days; EIA actuals differ from the CAISO
  forecasts the engine uses. A lift below 1 means the rule is not a call forecast, and the study is
  read that way.

## 7. Second-method check of the stretch numbers (`crosscheck_stretch.py`, `crosscheck-stretch.md`, #112)

- **Inputs**: the five stretch outputs and their own inputs (backtest files, hist and RT prices,
  `site_default.json`, the Oct 27 bundle, `torus_published.json`, `prep/data/eia_pace_hourly.csv`).
- **Sensitivity**: base gap = mean(Clearlane) minus mean(fixed rule) in `backtest.json`; daily spread =
  max minus min of the 24 hourly prices; the rule "ties or wins" when Clearlane's value is at or below.
- **Refill-window overlaps (reserve risk)**: a call is inside the prior refill window when it starts
  on the same Mountain day before the previous call's Spin is full again. Two calls share a day with
  probability c = sum over weekdays w of n_w (n_w - 1) / (N (N - 1)) / D_w (n_w weekday counts, N calls,
  D_w window days with that weekday). With hour labels from the heatmap and uniform whole minutes,
  E(W) = c x sum over call pairs of P(later start minus earlier start < W(earlier start)). W = call
  duration plus the time to put back requested kW x (duration minus ramp / 2) / 3600 kWh at
  min(full refill power, host ceiling minus host load minus any Pulse charge). The replay's count must
  lie between the Poisson 5th percentile at the fastest refill and the 95th at the slowest.
- **Marginal CO2**: per (season, hour) cell, OLS of the hourly change in CO2 on the hourly change in
  net generation (or demand, for consumed CO2): slope = S_xy / S_xx, R2 = S_xy^2 / (S_xx S_yy), in g/kWh
  (t/MWh x 1000). Second method: one slope per load-level decile bin over all hours, and each cell takes
  the pair-weighted mean of its bins' slopes.
- **Scale curve**: each fixed schedule is repriced hour by hour, value(F) = sum over h of
  (p_h minus s_h x F x q_h) x q_h, with q_h the reference station's net injection per MW (charge
  2 / sqrt(0.88) spread over the charge hours, discharge 2 x sqrt(0.88) over the discharge hours) and
  s_h the clamped price-response slope.
- **Real-time replay**: hold has no deviation, so it settles at its day-ahead value; regret =
  foresight net minus the policy's net, never below zero.
- **Limits.** Checks only what each output exposes. The re-planning DP series, the price-response and
  forecast-residual tables, the other sensitivity axes, wear rainflow and the fleet envelope are not
  cross-checked, and say so. Marginal CO2 factors are estimates that depend on the estimator (#248).

The judge brief (`science/brief.md`) is not on this tree and is not described; its sources list is
its method.
