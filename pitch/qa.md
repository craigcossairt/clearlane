# Judge Q&A

Cards are grouped by the judge most likely to ask. Every answer is two sentences or fewer, every number is a key, and every card names its source. Judges and affiliations are from `docs/JUDGING.md`.

## Ryan Byrd, former CTO of Entrata, Aptive and Pattern (depth and correctness)

### Why a DP and not machine learning?

Judge: Ryan Byrd

A: Day-ahead prices are known the evening before, so the price leg needs no forecast, and an exact plan over the day's steps is auditable. It solves in `{solve_ms}` on this machine, and forecasting the host stays Lasso's job.

Source: FACTS `solve_ms`, `lasso_inputs`

### Why is the engine's own plan worth less than the race card?

Judge: Ryan Byrd

A: Two things put the engine's 15-minute plan, at `{clearlane_dp_usd_mw_day}`, below the timetable's `{clearlane_usd_mw_day}` per MW-day: it plans against a wear price on every cycle, which the timetable ignores, so it cycles less, and it moves stored energy in coarse fixed steps. The steps account for a little over half the gap and the wear price for the rest, and every fleet figure on stage is built from the timetable.

Source: FACTS `clearlane_usd_mw_day`, `clearlane_dp_usd_mw_day`, `wear_usd_mwh`; `engine/src/limits.ts` (`PULSE_LEVELS`); Data's re-check after the cycle fix on the engine-review issue (steps versus a continuous plan at the new wear price)

### Is the timetable's `{clearlane_usd_mw_day}` before wear?

Judge: Ryan Byrd

A: Yes: the timetable and the off-peak rule are both scored at day-ahead prices before wear, so the race compares like with like. The engine's 15-minute plan is scored the same way; the wear price only shapes its schedule.

Source: FACTS `clearlane_usd_mw_day`, `fixed_usd_mw_day`; `engine/src/reference.ts` (both race legs), `engine/src/plan.ts` (plan value)

### Average or marginal emissions?

Judge: Ryan Byrd

A: Average: EIA hourly generated-basis CO2 for PacifiCorp East (Utah, Wyoming, Idaho), and the card says "estimated, using average emissions". We do not lead with CO2, because marginal emissions can differ.

Source: FACTS `co2_overnight_avg`, `co2_midday_avg`

### What does this do to Pulse's cycle life?

Judge: Ryan Byrd

A: The backtest prices wear at `{wear_usd_mwh}`, set so Clearlane uses at most `{pulse_cycle_budget}` cycles a year, a budget built from Torus's published `{torus_pulse_cycles}` cycles over the Station life of `{torus_lifespan_yr}` (applying that life to Pulse is our assumption). A cycle is one equivalent full cycle of energy drawn out of Pulse, and a busy day like the one on screen uses `{cycles_today}`, which the meter shows.

Source: FACTS `wear_usd_mwh`, `pulse_cycle_budget`, `torus_pulse_cycles`, `torus_lifespan_yr`, `cycles_today`

### How do you know when the calls happen?

Judge: Ryan Byrd

A: Torus's 2025 heatmap gives counts by hour, and Torus told us the hours are Mountain time (Torus, message to Craig Cossairt, Oct 27 2026). A battery chasing price alone could not answer `{calls_unanswerable_price_only_mt}` of those call times.

Source: FACTS `calls_unanswerable_price_only_mt`, `rmp_heatmap_by_hour`

### What happens if a second call comes during the refill?

Judge: Ryan Byrd

A: Spin answers the first call, then refills under the host's ceiling. A second press inside that window shows the shortfall, `{second_call_shortfall_kw}` kW on average over the call, on the card.

Source: FACTS `second_call_shortfall_kw`

### Do your System Critical Hours predict RMP's calls?

Judge: Ryan Byrd

A: No: they mark the grid's tightest hours, and Torus's 2025 calls were spread across the day, so our rule flags call hours no better than chance. Spin keeps its full reserve in every hour, not only those, and in the backtest Clearlane missed `{calls_missed_by_policy_clearlane_mt}` of calls.

Source: `science/sch_study.json` (lift against the 2025 heatmap, Mountain reading); FACTS `calls_missed_by_policy_clearlane_mt`; `reserve_kw` is the full enrolled kW in all 24 hours of `public/derived/envelope_2026-10-27.json`

### Isn't this just arbitrage?

Judge: Ryan Byrd

A: The price leg is, worth `{clearlane_usd_mw_day}` per MW-day against `{fixed_usd_mw_day}` for a fixed off-peak rule. The rest is keeping Spin ready for RMP's calls, which price alone does not do: in the backtest a price-only plan misses `{calls_missed_by_policy_price_only_mt}` of calls and Clearlane `{calls_missed_by_policy_clearlane_mt}`.

Source: FACTS `clearlane_usd_mw_day`, `fixed_usd_mw_day`, `calls_missed_by_policy_price_only_mt`, `calls_missed_by_policy_clearlane_mt`

### Why plan the day ahead instead of re-planning on real-time prices?

Judge: Ryan Byrd

A: We replayed `{rt_replay_days}` real days on CAISO real-time prices for PacifiCorp East: holding the day-ahead plan beat re-planning every hour on `{rt_hold_beats_replan_days}` days, and re-planning added `{rt_replan_regret_increase}` to the shortfall against perfect hindsight. That replay used a simple forecast, no RMP calls, and a settlement rule we assumed and have not verified for EDAM, so it says the day-ahead plan is a good anchor, not that real-time correction cannot help.

Source: FACTS `rt_replay_days`, `rt_hold_beats_replan_days`, `rt_replan_regret_increase`; `public/derived/rt_replay.json` (summary, settlement.status UNVERIFIED)

## Angela Smith, COO of Nucleus Fund (path to reality)

### Is the reference day cherry-picked?

Judge: Angela Smith

A: The backtest card covers May 1 to Oct 27, `{backtest_days}` days, with Clearlane between `{clearlane_p10}` and `{clearlane_p90}` per MW-day. October is the clean case, with the biggest price jump at 5pm or 6pm on `{oct_step_hour_days_at_5_or_6}` of `{oct_step_hour_days_total}` days.

Source: FACTS `backtest_days`, `clearlane_p10`, `clearlane_p90`, `oct_step_hour_days`

### Does Clearlane win every day?

Judge: Angela Smith

A: No: on Oct 28 overnight power cost about the same as noon, and the fixed off-peak rule almost tied. Across the backtest Clearlane beats that rule on `{share_days_beating}` of days, with a median day of `{clearlane_p50}` per MW-day.

Source: FACTS `share_days_beating`, `clearlane_p50`; Oct 28 CAISO day-ahead prices, Integration's story check on the Oct 28 refresh PR

### Is Utah allowed to cycle these daily?

Judge: Angela Smith

A: We found no Utah rule on it in the tariff sheets we read, and we make no claim either way. Torus's June 2026 ROWE comments ask for credit for scheduled dispatch and standards for operating envelopes, which is where that question gets settled.

Source: `pitch/research-tariff.md`; https://rowesternenergy.org/wp-content/uploads/2026/06/Consolidated-Spring-Workshop-Comments_06222026.pdf

### Do Utah's tariffs agree with the market?

Judge: Angela Smith

A: Partly, and it depends on the schedule: Schedule 6 has no on-peak window, Schedule 6A's on-peak is 6pm to 10pm weekdays, and Schedule 8's summer on-peak starts at 3pm. So the tariff hours do not match the market's 6pm jump on every sheet.

Source: `pitch/research-tariff.md` (Rocky Mountain Power tariff sheets)

### What is real and what is simulated?

Judge: Angela Smith

A: Prices, forecasts and CO2 come from CAISO and EIA, and the Spin and Pulse specs and 2025 event counts are Torus-published, quoted with Torus's permission. The stations, host load and call times are simulated Torus-style, and solve times are measured live.

Source: FACTS `torus_quote_permission`; deck slide 10

### Who defines System Critical Hours?

Judge: Angela Smith

A: Nobody yet: Torus asked ROWE for a transparent definition, and we found no Utah or Wyoming docket that defines it. Our rule is our proposal, and the envelope marks `{sch_hours_today}` such hours on the day on screen.

Source: FACTS `sch_hours_today`; `pitch/research-tariff.md`

## The Torus judge, Strategic Events Leader at Torus (fit with Torus and Lasso)

### Isn't this what Lasso already does?

Judge: The Torus judge

A: Lasso forecasts and dispatches in under `{lasso_dispatch_ms}`, and that is Torus-published. A day-ahead timetable keyed to EDAM prices and an hourly envelope are not advertised, and the envelope is a format Clearlane proposes.

Source: FACTS `lasso_dispatch_ms`, `lasso_inputs`; `research/TORUS.md` section 7

### How sure are you this is not already inside Lasso?

Judge: The Torus judge

A: We are not sure, so we say "not advertised", from Torus's own pages. Torus does not know whether Lasso's API accepts an outside schedule or envelope (Torus, message to Craig Cossairt, Oct 27 2026).

Source: `research/TORUS.md` section 7; FACTS `lasso_external_schedule_api`

### What did Torus tell you?

Judge: The Torus judge

A: That the 2025 heatmap hours are Mountain time, that all `{rmp_events_2025}` events in 2025 were unplanned calls, and that we may quote the published Spin and Pulse specs and event data with attribution. Whether Lasso's API takes an outside envelope is unknown to Torus too (Torus, message to Craig Cossairt, Oct 27 2026).

Source: FACTS `rmp_events_2025_unplanned`, `torus_quote_permission`, `lasso_external_schedule_api`

### What if the call lands during the jam?

Judge: The Torus judge

A: The call needs power, not energy, and Spin sized to the enrolled kW covers one call of about five and a half minutes. Pulse keeps its plan, and the rest of the day is re-solved from the state of charge after the call.

Source: FACTS `call_duration_s`, `enrolled_kw`

### Does midday charging blow up the host's demand charge?

Judge: The Torus judge

A: The planner treats the host's 15-minute ceiling as a hard limit, and the meter stays under `{host_ceiling_kw}` kW. We show kW, not dollars, because a host bill cut is not what we claim.

Source: FACTS `host_ceiling_kw`; `pitch/research-tariff.md`

### Does Torus earn the money on the race card?

Judge: The Torus judge

A: No: it is value to RMP's system at day-ahead prices, not Torus revenue and not a host bill cut. Torus and hosts share it only if a program credits scheduled dispatch.

Source: FACTS `clearlane_70`

## Scott Holley, Executive Director, Lassonde Center at the U of U (Utah impact)

### Why not charge overnight?

Judge: Scott Holley

A: On the day on screen the fixed off-peak rule charged at `{fixed_rule_charge_usd_mwh}` and the timetable at `{timetable_charge_usd_mwh}`. Estimated, using average emissions, PacifiCorp East ran about `{co2_overnight_avg}` overnight and `{co2_midday_avg}` at midday.

Source: FACTS `fixed_rule_charge_usd_mwh`, `timetable_charge_usd_mwh`, `co2_overnight_avg`, `co2_midday_avg`

### What about data centers?

Judge: Scott Holley

A: The same engine moves a simulated campus block in time, worth `{campus_usd}` a day on the day on screen. In October, moving in time saved about `{time_vs_space_oct_time}` and moving across EDAM nodes about `{time_vs_space_oct_space}`.

Source: FACTS `campus_usd`, `time_vs_space_oct`

### What does Utah get out of this?

Judge: Scott Holley

A: Batteries that fill when the grid is clear, stay off the road in the 6pm jam, and still answer Rocky Mountain Power's calls: Clearlane misses `{calls_missed_by_policy_clearlane_mt}` in the backtest. At `{mou_70mw}` MW that is `{clearlane_70}` a day of value to RMP's system at day-ahead prices.

Source: FACTS `calls_missed_by_policy_clearlane_mt`, `mou_70mw`, `clearlane_70`

### Does the midday lane hold up in real time?

Judge: Scott Holley

A: Not every day: real-time prices averaged lower in the evening than at midday on `{rt_evening_below_midday_days}` of `{rt_replay_days}` days, while day-ahead prices never did. Clearlane plans on the day-ahead prices published the evening before, and those kept the evening above midday on every replayed day.

Source: FACTS `rt_evening_below_midday_days`, `rt_replay_days`; `public/derived/rt_replay.json` (summary.rt_evening_below_midday_days, da_evening_below_midday_days, windows_mt)

## Tanner Potter, Partner at Kickstart (market and ask)

### Who gets the `{clearlane_70}` a day?

Judge: Tanner Potter

A: Nobody, as revenue: it is value to RMP's system at day-ahead prices. Torus and hosts share it only if a program credits scheduled dispatch.

Source: FACTS `clearlane_70`

### Does a `{torus_500mw}` MW ceiling move the price?

Judge: Tanner Potter

A: Probably, at the top of the slider: the ceiling is about `{mou_share_of_peak_oct27}` of the day's peak forecast of `{load_peak_oct27_mw}` MW. The slider says the fleet is assumed not to move prices, and `{torus_500mw}` MW is an MOU for up to that amount, not installed capacity.

Source: FACTS `mou_share_of_peak_oct27`, `load_peak_oct27_mw`, `torus_500mw`

### What would you need from Torus?

Judge: Tanner Potter

A: Three things: how Spin refills, how event delivery is baselined, and whether sites export. Then a pilot of the envelope, a format Clearlane proposes, at a few Wattsmart sites this winter.

Source: FACTS `lasso_external_schedule_api`

### What is the ask?

Judge: Tanner Potter

A: A pilot of the day-ahead envelope at a few Wattsmart sites this winter. Torus's interest in that is our assumption, so it is an ask, not an agreement.

Source: `docs/lanes/pitch.md` section 5 (close)

### Will you keep building this?

Judge: Tanner Potter

A: Craig answers this one live.

Source: none (Craig's call)

---

## Drill

Not run yet. Grades land here Tuesday night.
