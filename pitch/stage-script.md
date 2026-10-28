# Stage script

About two minutes and forty-five seconds. Craig speaks the quoted lines; the app shows the rest. The operating day is on screen the whole time, so the script says "the day on screen", never a date. Every result is a key in braces.

Beats 2 and 6 say the reference timetable, `{clearlane_usd_mw_day}` per MW-day, the same set the beat 6 slider scales. The engine's own 15-minute plan is a Q&A answer, not a stage line.

## Beat 1, traffic report (0:00 to 0:25)

> This is Utah's traffic report for the day on screen, published the evening before. The road is clear at midday. Then net load climbs `{net_load_climb_mw}` MW in three hours, and the 6pm price is `{peak_over_trough}` the day's low. In October that jump landed at 5pm or 6pm on `{oct_step_hour_days_at_5_or_6}` of `{oct_step_hour_days_total}` days.

| Craig's cue                        | Screen                                                 |
| ---------------------------------- | ------------------------------------------------------ |
| Open on beat 1 (press 1 if needed) | The price ribbon, clear lane at midday, the jam at 6pm |
| "net load climbs"                  | Net load line rising into the evening                  |

## Beat 2, the race (0:25 to 0:55)

> Left, a battery on a fixed off-peak rule. That rule is ours, not Torus practice. It charges at `{fixed_rule_charge_usd_mwh}`. Right, a simulated Torus-style station on Clearlane, charging in the clear lane at `{timetable_charge_usd_mwh}`. Off-peak is worth `{fixed_usd_mw_day}` per MW-day, Clearlane `{clearlane_usd_mw_day}`. At `{mou_70mw}` MW that is `{clearlane_70}` a day, as value to RMP's system at day-ahead prices. CO2 is estimated, using average emissions.

| Craig's cue                       | Screen                                                                     |
| --------------------------------- | -------------------------------------------------------------------------- |
| Right arrow to beat 2, then Space | Both stations play the day side by side                                    |
| "Clearlane"                       | End cards: the off-peak rule and Clearlane, per MW-day and at the MOU size |
| "CO2"                             | CO2 line under the cards, added and avoided tons a day                     |

## Beat 3, the crash (0:55 to 1:35)

> Rocky Mountain Power calls for `{enrolled_kw}` kW, now. Spin answers. A call of about five and a half minutes fits inside Spin's discharge, and the host meter stays under `{host_ceiling_kw}` kW while Spin refills. Press again inside that window, and the second call delivers `{second_call_delivered_pct}` of it, `{second_call_shortfall_kwh}` kWh short. The card says so. The event card is Torus's own 2025 report: `{rmp_events_2025}` events, all unplanned calls. Our trace is simulated. The two stay apart.

| Craig's cue                   | Screen                                                          |
| ----------------------------- | --------------------------------------------------------------- |
| Right arrow to beat 3, then C | Call at 6:40pm; Spin carries it, Pulse keeps its plan           |
| "Press again", then C         | Second call during the refill; delivered share and kWh short on the card |
| "Torus's own 2025 report"     | Event card, labeled Torus-published, beside our simulated trace |

## Beat 4, re-plan (1:35 to 1:50)

> The rest of the day is re-solved from the state of charge after the call, in `{replan_ms}`, measured on this machine. The meter shows Pulse's cycles for the day beside its yearly budget.

| Craig's cue                  | Screen                                                           |
| ---------------------------- | ---------------------------------------------------------------- |
| Right arrow to beat 4        | Dashed plan from the morning, solid re-plan from the call minute |
| Read the time off the screen | MEASURED solve time; never a number from a file                  |
| Space                        | The day plays on from the call minute                            |

## Beat 5, envelope and proof (1:50 to 2:25)

> An hourly envelope: System Critical Hours, reserve kW, and charge and discharge limits. It is a format Clearlane proposes, and the hours rule is our proposal: we found no Utah or Wyoming docket that defines it. The backtest, in Mountain time: calls missed, Clearlane `{calls_missed_by_policy_clearlane_mt}`, battery-only `{calls_missed_by_policy_price_only_mt}`. The battery-only plan earns more on paper, but runs `{cycles_per_year_by_policy_price_only}` cycles a year against a `{pulse_cycle_budget}` budget and breaks the host ceiling. Clearlane is the plan a host and RMP would allow.

| Craig's cue                   | Screen                                                                  |
| ----------------------------- | ----------------------------------------------------------------------- |
| Right arrow to beat 5, then E | Envelope strip, System Critical Hours marked                            |
| "The backtest", then B        | Backtest card, May 1 to Oct 27, calls missed by policy in Mountain time |
| "earns more on paper"         | Battery-only plan row on the backtest card; say no number for the ceiling breaches |

## Beat 6, scale and close (2:25 to 2:45)

> An MOU for up to `{torus_500mw}` MW, not installed capacity, and the fleet is assumed not to move prices: `{clearlane_500}` a day. Compute moves in time, not in space. Fill up when the road is clear, keep Spin ready for the crash. Ask: pilot the envelope.

| Craig's cue                     | Screen                                                    |
| ------------------------------- | --------------------------------------------------------- |
| Right arrow to beat 6, then End | Fleet slider at the MOU ceiling, the caveat line under it |
| "in time, not in space"         | Campus card (Option 2)                                    |
| Close line                      | Close card                                                |
