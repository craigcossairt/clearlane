# Judge Q&A

Answers are at most two sentences. A number is a `{key}` or it is not said. The Tuesday-night drill appends grades below the line.

## Isn't this what Lasso already does?

Lasso forecasts and dispatches, and that is Torus-published. A day-ahead timetable keyed to EDAM prices, and an exportable envelope, are not advertised, and Lasso could take both as one more grid signal.

## Who gets the `{clearlane_70}` a day?

Nobody, as revenue. It is value to RMP's system at day-ahead prices, and Torus and hosts share it only if a program credits scheduled dispatch.

## Is the reference day cherry-picked?

The backtest card covers May 1 to Oct 27 and shows `{clearlane_p10}` to `{clearlane_p90}`. October is the clean case, with the biggest jump at 5pm or 6pm on `{oct_step_hour_days_at_5_or_6}` of `{oct_step_hour_days_total}` days.

## Why not charge overnight?

On the reference day the overnight hours averaged `{overnight_avg}` and the midday hours averaged `{midday_avg}`. Estimated average CO2 for PacifiCorp East was about `{co2_overnight_avg}` overnight and `{co2_midday_avg}` at midday.

## What if the call lands during the jam?

The call needs power, and Spin sized to the enrolled kW covers one call of about five and a half minutes. A second call inside the refill window is the shortfall the card shows.

## Does midday charging blow up the demand charge?

The planner treats the host's 15-minute ceiling as a hard constraint, and the meter line does not cross `{host_ceiling_kw}`. We show kW because the rider-adjusted tariff dollars are not what we claim.

## Average or marginal emissions?

Average: EIA hourly generated-basis CO2 for PacifiCorp East, and the card says so. We do not lead with CO2.

## What does this do to cycle life?

Torus publishes `{torus_pulse_cycles}` Pulse cycles, and the Station lifespan is `{torus_lifespan_yr}`, so our budget is `{pulse_cycle_budget}` a year. Applying the Station life to Pulse is our assumption, and the meter shows the day's cycles against it.

## How do you know when the calls happen?

The 2025 heatmap gives counts by hour and states no time zone, so we run both readings. A battery chasing price alone could not answer `{calls_unanswerable_price_only_utc_mst}` to `{calls_unanswerable_price_only_mt}` of those call times, depending on how the heatmap's hours are read.

## Is Utah allowed to cycle these daily?

Not verified from the tariff sheets we read. The envelope and the ROWE ask are where that question belongs, not a claim.

## What is real and what is simulated?

Prices, forecasts and CO2 come from CAISO and EIA. Specs and the 2025 counts are Torus-published, and the stations, host load and call times are simulated.

## Does a `{torus_500mw}` MW MOU ceiling move the price?

Probably, at the top of the slider: the ceiling is about `{mou_share_of_peak_oct27}` of the day's peak forecast of `{load_peak_oct27_mw}`. The slider says the fleet is assumed not to move prices, and `{torus_500mw}` MW is an MOU ceiling, not installed capacity.

## Why a DP and not machine learning?

Day-ahead prices are known the evening before, so the price leg needs no forecast. An exact plan over the day's steps is auditable, and forecasting the host stays Lasso's job.

## What about data centers?

The same engine moves a simulated block in time, worth `{campus_usd}` on the reference day. In October, time-shifting beat place-shifting, about `{time_vs_space_oct_time}` against `{time_vs_space_oct_space}`.

## Do Utah's tariffs agree with the market?

Partly, and it depends on the schedule. Schedule 6 has no on-peak window, Schedule 6A's on-peak is 6pm to 10pm, and Schedule 8's summer on-peak starts at 3pm, so the hours do not match the market's 6pm jump on every sheet.

## What would you need from Torus?

Four things: how Spin refills, how delivery is baselined, whether sites export, and whether Lasso accepts an external envelope. Then a pilot at a few Wattsmart sites.

---

## Drill

Not run. Due Tue 10pm MT, after the deck is the copy of record. Grades land here.
