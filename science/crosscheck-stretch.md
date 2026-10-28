# Second-method check of the stretch numbers

Flag: off_science_methods (not read by the stage app)

Issue #112. The stretch outputs that merged on Wed Oct 28 2026 are checked here by a second method,
written in Python under `science/`, separately from the engine (TypeScript) and the data lane's
`prep/`. Each check either reproduces a published number from the raw input by our own code, or tests
it against a different estimator or a closed form. Every result is `match`, `mismatch` or
`not cross-checked` (with the reason). A missing check is never shown as passed.

Script: `python -I science/crosscheck_stretch.py`. Output: `science/crosscheck_stretch.json` (sorted
keys). A second run is byte-identical. Every number below the results marker is printed by that script
and names its input file. CO2 values are estimates from EIA's hourly data. Call checks read the 2025
heatmap in Mountain time, as Torus confirmed (FACTS `heatmap_readings`); the UTC reading is a
sensitivity only and is never for stage.

## Scope and the 9pm cutoff

The issue says anything merged after 9pm Tue Oct 27 gets "not cross-checked". All five outputs below
merged between 1:48am and 2:04am MT Wed Oct 28, and the orchestrator's #112 brief (Wed 2:06am MT) named
exactly these five for checking, so they are checked. Checked tree: `origin/main` at `3a37c63`.

| Output                                            | PR   | Owner lane |
| ------------------------------------------------- | ---- | ---------- |
| `public/derived/sensitivity.json`                 | #238 | engine     |
| `public/derived/call_ledger.json`                 | #225 | engine     |
| `public/data/response_tables.json` (marginal CO2) | #234 | data       |
| `public/derived/scale_curve.json`                 | #240 | engine     |
| `public/derived/rt_replay.json`                   | #227 | engine     |

## Definitions and tolerances (written before computing)

Written Wed Oct 28 2026, about 2:40am MT, by the science-stretch session, before any check was
computed. Reads before this section: the layout (keys, first rows) of the five outputs above, of
`public/derived/backtest.json`, `public/derived/backtest_days.json`, `public/data/bundle_2026-10-27.json`,
`public/data/rt_2026-05-01_2026-10-27.json`, `public/data/hist_2026-05-01_2026-10-27.json`,
`public/derived/site_default.json` and `prep/data/eia_pace_hourly.csv` (header and first two rows);
the documented rules (comments, notes and the bad-hour and pairing rules) in `engine/src/ledger.ts`,
`engine/src/crash.ts`, `engine/src/scale.ts`, `engine/src/sensitivity.ts` and `prep/response_tables.py`;
and FACTS rows `fixed_usd_mw_day`, `clearlane_usd_mw_day`, `spin_recharge_min` and `heatmap_readings`.
No engine or prep code is imported or copied. The published values were read as layout, not computed.

General rule. A reproduction from the same input by our own code should agree to float noise (`1e-9`
unless a row says otherwise); a miss means the definitions differ or the code has a bug, and the
results say which. A second method (a different estimator or a closed form) has its own tolerance,
fixed below.

### 1. Sensitivity base case vs the backtest (`sensitivity.json`, `backtest.json`)

- `base.gap.usd_per_mw_day` = clearlane `usd_per_mw_day.mean` minus fixed_overnight's, from
  `backtest.json`. Same for `co2_t_per_mw_day`. `calls_unanswerable_pct_points` = clearlane minus
  fixed_overnight `calls_unanswerable_pct.heatmap_as_mt`. Tolerance `1e-9` each.
- Every axis's `gap_base` equals `base.gap`; the `daily_spread` scan at x = 1 and the `wear_usd_mwh`
  scan at x = W (the file's `wear_usd_mwh`) equal `base.gap.usd_per_mw_day`. Tolerance `1e-9`.
- By-day spread (second method). Daily spread = max minus min of the 24 hourly day-ahead prices of the
  Mountain day in the hist file. The rule "ties or wins" on a day when clearlane's `usd_per_mw_day` in
  `backtest_days.json` is at or below fixed_overnight's that day (a value comparison, not the
  `beats_fixed_overnight` flag). Bands: [0, 15), [15, 25), [25, 50), [50, open) $/MWh. Match: the
  day count, the ties count, and each band's days and ties all equal the file's (exact), and the mean
  daily spread equals `base_mean_daily_spread_usd_mwh` within `1e-9`.

### 2. Call ledger (`call_ledger.json`)

- Recount from `rows` (exact): calls, days with calls and max calls in one day per reading; the hour
  and weekday label counts equal `heatmap_by_hour` and `heatmap_by_weekday` (TORUS_PUBLISHED) for each
  reading; per reading and policy, the 90%-delivered share, unanswerable calls (below 90%), shortfall
  calls (shortfall above `1e-6` kWh) and shortfall kWh (tolerance `1e-9`); and `replay_density`
  (calls per day = 359 over the window days, the 2025 rate = 359 over 365, and their ratio).
- Overlap count, closed form (the reserve-risk model, at the ledger's density). A call is "inside the
  prior refill window" when it starts on the same Mountain day, before the previous call's Spin is full
  again. Placement as the ledger documents it: each call keeps its hour label, its weekday label is a
  random permutation of the weekday counts, its day is drawn uniformly from the window days with that
  weekday, and its minute is uniform on 0 to 59. So any two calls share a day with probability
  c = sum over weekdays w of n_w (n_w - 1) / (N (N - 1)) / D_w, with n_w the weekday counts, N = 359 and
  D_w the usable window days with weekday w. Expected count E(W) = c x sum over pairs of the
  probability, over their two minutes, that the later start is before the earlier start plus W (equal
  starts count once). W is the time from a call's start to Spin full again:
  - W_full: call duration (330 s) plus the Spin energy one call uses, requested kW x (duration minus
    ramp / 2) / 3600, put back at the full refill power min(spin_kw, spin_kwh x 60 / spin_recharge_min)
    from `site_default.json`.
  - W_host: the same energy put back second by second at min(full refill power, host ceiling minus
    the host load of that 15-minute interval), with no Pulse charging; cut at the day's end.
  - W_pulse: as W_host, with Pulse charging at its full rating the whole time (room = ceiling minus
    host minus pulse_kw): the slowest refill the plan could force.
    Test: let lo be the 5th percentile of a Poisson count with mean E(W_full) and hi the 95th percentile
    with mean E(W_pulse) (smallest k whose cumulative probability reaches 0.05 and 0.95). Match if the
    ledger's Mountain `calls_inside_prior_refill_window` lies in [lo, hi]. E(W_host) is reported as the
    central estimate. The same closed form at the 2025 call rate (N scaled by 365 to the window days,
    E scaled by the square of that ratio) is reported, marked closed form only.
- Overlap recount from the ledger's own start times (second method): within each Mountain day of the
  `mt` rows, consecutive calls in start order, counted when the gap is under the window at the earlier
  call's start. Match if recount(W_full) <= the ledger's count <= recount(W_pulse).
- The UTC reading gets the same recounts as a sensitivity row only.

### 3. Marginal CO2 (`response_tables.json`, table `marginal_co2`)

Input `prep/data/eia_pace_hourly.csv` (REAL, EIA). Mountain clock hour of each UTC hour start by the US
rule written in our code (MDT from the second Sunday of March 09:00 UTC to the first Sunday of
November 08:00 UTC, MST otherwise). Pairs are consecutive UTC hours; a pair goes to the season (DJF,
MAM, JJA, SON by Mountain month) and Mountain hour of its second hour. Generated basis: x = change in
`net_gen_mw`, y = change in `co2_t`, both hours with CO2 present and net generation above 0. Consumed
basis: x = change in `demand_mw`, y = change in `co2_cons_lb_kwh` x `demand_mw` x 1000 / 2204.62262,
both hours good (demand present and above 0, forecast present and above 0, demand within 0.5 to 1.5
times the forecast) with consumed CO2 present. Slopes in g/kWh (t/MWh x 1000).

- Reproduction (our OLS with intercept, same bins): n exact; slope within 0.05 g/kWh plus `1e-9`
  (the file rounds to 0.1); R2 within 0.00005 (rounded to 4 places); `pairs_skipped` exact.
  Bootstrap intervals are not reproduced (a different random stream by design).
- Load-level second method. Per basis and season, the level of the pair's second hour (net generation
  for generated, demand for consumed) is cut into 10 equal-count bins at the deciles (Hyndman-Fan
  type 7; a value on a cut goes to the upper bin). Each load bin gets its own OLS slope with intercept
  over all hours. A (season, hour) cell's load-binned value is the average of the load-bin slopes,
  weighted by how many of that cell's pairs fall in each load bin. Test, per basis: the share of
  conclusive cells (`inconclusive` false) whose load-binned value lies inside the file's [lo, hi].
  Match if that share is at least 75%; the cells outside are listed. Inconclusive cells are reported
  and not counted.

### 4. Scale curve (`scale_curve.json`)

- Slopes: every `slopes.hours` entry equals the `price_response` bin for its hour in
  `response_tables.json` (slope, lo, hi, n exact); `used` is the slope clamped at 0, `used_lo` and
  `used_hi` likewise.
- Fixed schedules, second method (`fixed_overnight` and `clearlane`). Per MW: charge 2 MWh / sqrt(0.88)
  spread evenly over the charge hours, discharge 2 MWh x sqrt(0.88) spread evenly over the discharge
  hours (the reference station of FACTS `fixed_usd_mw_day`: charge HB 1am to 4am, discharge HB 6pm to
  7pm; `clearlane_usd_mw_day`: charge HB 1pm to 3pm, same discharge). Prices: the bundle's 24 hourly
  `lmp_usd_mwh` for Oct 27. Each hour is repriced at fleet F as p - used x F x q and valued as
  (p - used x F x q) x q, summed hour by hour (no closed-form shortcut). Match: the price-taker value,
  each point's `usd_per_mw_day` (using `used`), `band_low` (using `used_hi`) and `band_high` (using
  `used_lo`) all within $0.01/MW-day; `usd_per_day` = point x F within $0.01; `traded_hb` equals the
  hours with nonzero volume; `discharged_mwh_per_mw` within `1e-9`.
- DP series (`dp_price_only`, `dp_wear10`): "not cross-checked: a re-planning DP with price impact
  has no second method here".

### 5. Real-time replay (`rt_replay.json`)

- Hold identity: holding the day-ahead plan has zero deviation, so its settlement is the day-ahead
  value. Match if every day's `settled_usd_per_mw_day.hold` equals clearlane's `usd_per_mw_day` for the
  same day in `backtest_days.json` within `1e-6`, and `deviation_mwh_per_mw.hold` is 0.
- Regret identities per day: regret = foresight net minus the policy's net, within `1e-9`, and never
  below minus `1e-9`.
- Summary recount: p10, p50, p90 (Hyndman-Fan type 7) and mean of each per-day series equal `summary`
  within `1e-9`; `regret_sum_usd_per_mw` within `1e-6`; `replan_recovers_pct` = (hold sum minus replan
  sum) / hold sum x 100 within `1e-9`; day counts of replan above, below and equal to hold (on net
  value) exact.
- Prices from the REAL files by our own code: per day, the mean RT price over the 15-minute intervals
  of `windows_mt` midday and evening hours (`rt_2026-05-01_2026-10-27.json`), and the mean DA price over
  the same hours (hist file). Each within `1e-6`; the `rt_evening_below_midday` flags and both summary
  day counts exact.

### 6. Wear rainflow and fleet envelope

- Rainflow cycle counts vs wear-rainflow: no rainflow output or Pulse trace file is on the checked
  tree, so this reads "not cross-checked: no trace file".
- Fleet envelope sum vs the fleet envelope: `public/derived/fleet_2026-10-27.json` is not on the
  checked tree (the API example for it is a 404), so this reads "not cross-checked: no fleet file".

### Also not cross-checked

`response_tables.json` tables `price_response` and `forecast_residuals` get no second method here, and
`sensitivity.json` axes other than the base-case rows above and the `two_way` grid are not re-run.

<!-- results:start -->
<!-- results:end -->
