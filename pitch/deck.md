# Clearlane deck

On stage: slide 1, the live demo, then the close. The slides between are Q&A backups. Every result is a placeholder from `public/derived/numbers.json`. Provenance sits on the key, not in a typed number.

Operating day on every slide: the day in the bundle. If Tuesday's refresh misses, say the date on screen.

No Torus logo. Stations are simulated Torus-style.

## 1. Title

Clearlane. Fill up when Utah's grid is clear. Keep Spin ready for the crash.

Torus bounty, Energy x AI Infrastructure. Option 1 is the spine. Option 2 is one card: in time, not in space.

Notes: on stage, this slide, then the live demo, then the close. Every slide between is a Q&A backup.

## 2. Utah's rush hour is 6pm

Ribbon of the operating day. Three numbers: 1am to 6am average `{overnight_avg}`, 9am to 5pm average `{midday_avg}`, 6pm price `{peak_price}`. These are window averages, not what any schedule paid.

The day's low was `{price_min_oct27}`. The 6pm hour was `{peak_over_trough}` that low.

Caption: the biggest price jump landed at 5pm or 6pm on `{oct_step_hour_days_at_5_or_6}` of `{oct_step_hour_days_total}` October days.

Line: in October the cheapest hours were also the cleanest on PacifiCorp East (Utah, Wyoming, Idaho): `{fossil_priciest_oct_cheapest}` fossil in the cheapest tenth of hours, `{fossil_priciest_oct_priciest}` in the priciest tenth. Estimated from EIA fuel mix, not marginal emissions.

## 3. Live demo

Six beats, about two minutes and forty-five seconds. Traffic report, race, crash, re-plan, envelope and proof, scale and close. Script: `pitch/stage-script.md`.

## 4. Power, not energy

A call of about five and a half minutes, answered at `{torus_pulse_c_rating}` by Pulse alone, uses `{pulse_share_per_call}` of a Pulse.

`{rmp_events_2025}` events in 2025 (Torus, RMP case study) add up to about `{call_hours_2025}`.

Spin at `{torus_spin_c_rating}` holds `{spin_kwh_per_kw}` kWh per kW, enough for one call, and refills in about six minutes under the host's ceiling. Six minutes is our reading of Torus's published twelve-minute discharge and recharge.

## 5. Not one good day

Backtest, May 1 to Oct 27, three policies. P10 to P90 of dollars per MW-day: Clearlane `{clearlane_p10}` to `{clearlane_p90}`, median `{clearlane_p50}`.

Share of days Clearlane beat the fixed off-peak rule: `{share_days_beating}`.

Cycles per year against the `{pulse_cycle_budget}` budget, counted as equivalent full cycles of energy drawn out of Pulse. That budget divides Torus's published `{torus_pulse_cycles}` Pulse cycles by the Station lifespan of `{torus_lifespan_yr}`. The Station life is Torus's figure. Applying it to Pulse is our assumption.

Calls missed in the backtest, with the 2025 heatmap in Mountain time (Torus, message to Craig Cossairt, Oct 27 2026): Clearlane `{calls_missed_by_policy_clearlane_mt}`, the fixed overnight rule `{calls_missed_by_policy_fixed_overnight_mt}`, price-only `{calls_missed_by_policy_price_only_mt}`. Clearlane answered `{calls_answered_pct_mt}` of simulated calls in full.

## 6. The envelope Torus asked for

An hourly envelope beside three asks from Torus's June 2026 comments to ROWE: credit for controlled and scheduled dispatch, standards for operating envelopes, and a transparent definition of System Critical Hours.

Source: https://rowesternenergy.org/wp-content/uploads/2026/06/Consolidated-Spring-Workshop-Comments_06222026.pdf

Our System Critical Hours rule is our proposal. We found no Utah or Wyoming docket that defines it. The envelope is a format Clearlane proposes. See `pitch/research-tariff.md`.

## 7. Where it plugs in

Lasso forecasts from load, weather, grid signals and rate schedules, and dispatches in under `{lasso_dispatch_ms}` (Torus-published). Clearlane adds what is not advertised: a day-ahead timetable keyed to EDAM prices, and an hourly envelope, a format Clearlane proposes. Torus does not know whether Lasso's API accepts an outside schedule or envelope (Torus, message to Craig Cossairt, Oct 27 2026).

Value to RMP's system at day-ahead prices, not Torus revenue. RMP's customers capture it today. Torus and hosts share it only if scheduled dispatch is credited.

## 8. Compute follows the sun, in time

Moving a four-hour evening block in time saved about `{time_vs_space_oct_time}`. Moving it across EDAM nodes saved about `{time_vs_space_oct_space}`. PacifiCorp East was the cheapest of those nodes in `{pace_cheapest_share}` of October hours.

A simulated campus shift on the operating day: `{campus_usd}` a day. Simulated. Not a Torus data-center product. Those pages were offline as of Oct 26, 2026.

## 9. Scale, and the caveat

`{mou_70mw}` MW is the demand-response agreement Torus says it filled. `{torus_500mw}` MW is an MOU for up to that amount, not installed capacity. At that ceiling the reference timetable is `{clearlane_500}` a day against `{fixed_500}` for the off-peak rule, as value to RMP's system at day-ahead prices.

The ceiling is about `{mou_share_of_peak_oct27}` of the operating day's peak load forecast (`{load_peak_oct27_mw}` MW). The slider says the fleet is assumed not to move prices. That assumption gets weaker as the fleet grows.

## 10. What is real

| Class           | What it covers                                                         |
| --------------- | ---------------------------------------------------------------------- |
| REAL            | CAISO day-ahead prices and forecasts, EIA fuel mix and hourly CO2      |
| DERIVED         | Lanes, net load, the race, the backtest, the envelope                  |
| SIMULATED       | Stations, host load, call times, the campus block                      |
| TORUS_PUBLISHED | Spin and Pulse specs, the 2025 event counts, the MOU                   |
| ASSUMPTION      | Round-trip efficiency, the cycle budget applied to Pulse, export limit |
| MEASURED        | Solve time and re-plan time, timed live                                |

What Torus told us (Torus, message to Craig Cossairt, Oct 27 2026): the 2025 heatmap hours are Mountain time, and all `{rmp_events_2025}` events were unplanned calls. Whether Lasso's API accepts an outside envelope is unknown to Torus too. Questions we have not asked Torus yet: how Spin refills, how event delivery is baselined, and whether sites export.

## 11. Close

Clearlane: fill up when the road is clear, keep Spin ready for the crash.

Ask: pilot the day-ahead envelope, a format Clearlane proposes, at a few Wattsmart sites this winter.
