# Stage script, presenter mode

For presenter mode (`?ff=presenter`): eight screens, clicked through with Next or the named button. A clicker works as Next. Craig speaks the quoted lines; the app shows the rest. The spoken lines are the six-beat script's, re-cued to the screens, with two changes on the race screen: the CO2 line is gone, because the race screen does not show CO2, and "Same battery, same evening sale." stands in for it, because the screen says so. Every result is a key in braces. About two minutes and forty-five seconds.

The race screen reads the reference timetable, `{clearlane_usd_mw_day}` per MW-day, the same set the scale screen multiplies. The engine's own 15-minute plan is a Q&A answer, not a stage line.

Next runs a screen's buttons in order before it leaves the screen, so Next alone walks the whole talk. Back lands on the previous screen with its buttons already run.

## Screen 1, title (0:00 to 0:06)

> This is Utah's traffic report for the day on screen, published the evening before.

| Craig's cue                                | Screen                                                       |
| ------------------------------------------ | ------------------------------------------------------------ |
| Open on the title                          | Wordmark, the one-line pitch, the operating day and the node |
| "published the evening before", then Start | Traffic screen                                               |

## Screen 2, traffic (0:06 to 0:25)

> The road is clear at midday. Then net load climbs `{net_load_climb_mw}` MW in three hours, and the 6pm price is `{peak_over_trough}` the day's low. In October that jump landed at 5pm or 6pm on `{oct_step_hour_days_at_5_or_6}` of `{oct_step_hour_days_total}` days.

| Craig's cue           | Screen                                                     |
| --------------------- | ---------------------------------------------------------- |
| On arrival            | The price ribbon, each hour labeled Clear, Shoulder or Jam |
| "net load climbs"     | Point at the evening hours; no click                       |
| End of the line, Next | Race screen                                                |

## Screen 3, race (0:25 to 0:55)

> Left, a battery on a fixed off-peak rule. That rule is ours, not Torus practice. It buys at `{fixed_rule_charge_usd_mwh}`. Right, a simulated Torus-style station on Clearlane, buying in the clear lane at `{timetable_charge_usd_mwh}`. Same battery, same evening sale. Off-peak is worth `{fixed_usd_mw_day}` per MW-day, Clearlane `{clearlane_usd_mw_day}`. At `{mou_70mw}` MW that is `{clearlane_70}` a day, as value to RMP's system at day-ahead prices.

| Craig's cue                       | Screen                                                                         |
| --------------------------------- | ------------------------------------------------------------------------------ |
| On arrival, Replay the day        | Both plans play the day in 15 seconds; Next during the replay jumps to its end |
| "It buys at"                      | Left card, Buys row                                                            |
| "buying in the clear lane at"     | Right card, Buys row                                                           |
| "Same battery, same evening sale" | Both Sells rows; say no number for the sale price, the MWh or the subtotals    |
| "Off-peak is worth"               | Both Net rows, the large figures                                               |
| End of the line, Next             | Call screen                                                                    |

## Screen 4, call (0:55 to 1:32)

> Rocky Mountain Power calls for `{enrolled_kw}` kW, now. Spin answers. A call of about five and a half minutes fits inside Spin's discharge, and the host meter stays under `{host_ceiling_kw}` kW while Spin refills. Press again inside that window, and the second call delivers `{second_call_delivered_pct}` of it, `{second_call_shortfall_kwh}` kWh short. The card says so. The event card is Torus's own 2025 report: `{rmp_events_2025}` events, all unplanned calls. Our trace is simulated. The two stay apart.

| Craig's cue                             | Screen                                                                   |
| --------------------------------------- | ------------------------------------------------------------------------ |
| "now", Rocky Mountain Power calls now   | Call at 6:40pm; Spin carries it, Pulse keeps its plan                    |
| "Press again", Call again during refill | Second call during the refill; delivered share and kWh short on the card |
| "Torus's own 2025 report"               | Event card, labeled Torus-published, beside our simulated trace          |
| End of the line, Next                   | Re-plan screen                                                           |

## Screen 5, re-plan (1:32 to 1:47)

> The rest of the day is re-solved from the state of charge after the call, in `{replan_ms}`, measured on this machine. The meter shows Pulse's cycles for the day beside its yearly budget.

| Craig's cue                     | Screen                                                           |
| ------------------------------- | ---------------------------------------------------------------- |
| On arrival                      | Dashed plan from the morning, solid re-plan from the call minute |
| Read the time off the screen    | MEASURED solve time; never a number from a file                  |
| "yearly budget", Resume the day | The day plays on from the call minute                            |
| End of the line, Next           | Envelope screen                                                  |

## Screen 6, envelope (1:47 to 2:22)

> An hourly envelope: System Critical Hours, reserve kW, and charge and discharge limits. It is a format Clearlane proposes, and the hours rule is our proposal: we found no Utah or Wyoming docket that defines it. The backtest, in Mountain time: calls missed, Clearlane `{calls_missed_by_policy_clearlane_mt}`, battery-only `{calls_missed_by_policy_price_only_mt}`. The battery-only plan earns more on paper, but runs `{cycles_per_year_by_policy_price_only}` cycles a year against a `{pulse_cycle_budget}` budget and breaks the host ceiling. Clearlane is the plan a host and RMP would allow.

| Craig's cue                       | Screen                                                        |
| --------------------------------- | ------------------------------------------------------------- |
| On arrival                        | Envelope strip, System Critical Hours marked                  |
| "The backtest", Show the backtest | Backtest card, calls missed by policy in Mountain time        |
| "earns more on paper"             | Battery-only plan row; say no number for the ceiling breaches |
| End of the line, Next             | Scale screen                                                  |

Show the envelope flips back from the backtest, for Q&A only.

## Screen 7, scale (2:22 to 2:34)

> An MOU for up to `{torus_500mw}` MW, not installed capacity, and the fleet is assumed not to move prices: `{clearlane_500}` a day.

| Craig's cue                               | Screen                                             |
| ----------------------------------------- | -------------------------------------------------- |
| On arrival, the `{torus_500mw}` MW button | Fleet at the MOU ceiling, the caveat line under it |
| End of the line, Next                     | Close screen                                       |

The `{mou_70mw}` MW button goes back to the smaller MOU, for Q&A only.

## Screen 8, close (2:34 to 2:45)

> Compute moves in time, not in space. Fill up when the road is clear, keep Spin ready for the crash. Ask: pilot the envelope.

| Craig's cue             | Screen                                    |
| ----------------------- | ----------------------------------------- |
| "in time, not in space" | Campus card (Option 2), labeled simulated |
| Close line              | The ask: pilot the envelope               |

Stay on this screen for Q&A. The Sources button opens every screen's source line.
