# Stage script

About two minutes and forty-five seconds. Operating day on screen the whole time. Every result is a placeholder.

## Beat 1, traffic report (0:00 to 0:25)

This is the traffic report for the day on screen, for Utah's grid, published the evening before by the western day-ahead market. The road is clear at midday. Then net load climbs `{net_load_climb_mw}` in three hours, and the price at 6pm is `{peak_over_trough}` the day's low of `{price_min_oct27}`. In October that jump landed at 5pm or 6pm on `{oct_step_hour_days_at_5_or_6}` of `{oct_step_hour_days_total}` days.

## Beat 2, the race (0:25 to 0:55)

Left, a battery on a fixed off-peak rule. That rule is ours, not Torus practice. Right, a simulated Torus-style station on Clearlane.

The off-peak rule is worth `{fixed_usd_mw_day}` per MW-day. Clearlane is worth `{clearlane_usd_mw_day}`. At `{mou_70mw}` MW, that is `{fixed_70}` a day against `{clearlane_70}` a day, as value to RMP's system at day-ahead prices.

CO2 is estimated, using average emissions: the off-peak rule adds `{co2_added_70}` a day at that scale, and the timetable avoids `{co2_avoided_70}`.

## Beat 3, the crash (0:55 to 1:40)

Rocky Mountain Power call, `{enrolled_kw}`, now. Spin answers it. A call of about five and a half minutes fits in Spin's six-minute discharge.

The host meter stays under `{host_ceiling_kw}` while Spin refills. A second press inside that window shows the shortfall, if there is one.

The event card is Torus's own 2025 report: `{rmp_events_2025}` events. Our trace is simulated. The two stay apart.

## Beat 4, re-plan (1:40 to 2:00)

The rest of the day is re-solved from the state of charge after the call. Re-planned in `{replan_ms}`. That time is measured on this machine.

## Beat 5, envelope and proof (2:00 to 2:25)

An hourly envelope with System Critical Hours, reserve kW, and charge and discharge limits. The rule is our proposal. Torus asked ROWE to define the term. We found no Utah or Wyoming docket that defines it.

The backtest card covers May 1 to Oct 27. Clearlane's range is `{clearlane_p10}` to `{clearlane_p90}` per MW-day. Both heatmap readings are on the card.

## Beat 6, scale and close (2:25 to 2:45)

The slider runs from `{mou_70mw}` MW to `{torus_500mw}` MW. The top is an MOU for up to `{torus_500mw}` MW, not installed capacity, and the fleet is assumed not to move prices.

Close: fill up when the road is clear, keep Spin ready for the crash. Ask: a day-ahead envelope into Lasso at a few Wattsmart sites this winter.
