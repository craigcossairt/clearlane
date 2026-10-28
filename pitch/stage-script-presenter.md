# Talk track, presenter mode

For presenter mode (`?ff=presenter`): eight screens. About two minutes and forty-five seconds. Every result is a key in braces; the screen shows the same number.

Each screen has four parts:

- **Say:** the quoted lines, in plain words. Say them slowly; each screen has room to spare.
- **Point at:** where to put the judges' eyes.
- **Press:** the button to click, or Next. A clicker works as Next. Next alone walks the whole talk, because it presses each screen's buttons in order before it leaves the screen.
- **If asked:** the hard question most likely on that screen, with the one-line answer from `pitch/drill.md`'s five hard questions. The full card is in `pitch/qa.md`.

Three words to have ready: **Spin** is Torus's flywheel, for short, sharp calls. **Pulse** is its battery, for moving energy across the day. **RMP** is Rocky Mountain Power, Utah's utility.

## Screen 1, title (0:00 to 0:08)

> Clearlane is a traffic report for Utah's power grid, and a day plan for simulated Torus-style stations.

- **Point at:** the operating day under the title.
- **Press:** Start.
- **If asked:** none of the five lands here.

## Screen 2, traffic (0:08 to 0:30)

> This is the price of power for the day on screen, hour by hour, set the evening before. Midday is cheap: the road is clear. By 6pm power costs `{peak_over_trough}` the day's low. In October that jump came at 5pm or 6pm on `{oct_step_hour_days_at_5_or_6}` of `{oct_step_hour_days_total}` days.

- **Point at:** the Clear hours at midday, then the Jam hours in the evening.
- **Press:** Next.
- **If asked:** none of the five lands here.

## Screen 3, race (0:30 to 1:00)

> Two identical batteries. The left one follows a fixed off-peak rule. That rule is ours, not Torus practice. It buys power at `{fixed_rule_charge_usd_mwh}`. The right one is a simulated Torus-style station on Clearlane, buying at midday at `{timetable_charge_usd_mwh}`. Both sell in the same evening hours. Off-peak nets `{fixed_usd_mw_day}` per MW a day, Clearlane `{clearlane_usd_mw_day}`. That is value to RMP's system at day-ahead prices.

- **Point at:** each card's Buys row, then both Sells rows (say no number for the sale), then the two large Net figures.
- **Press:** Replay the day. It plays in 15 seconds; Next during the replay jumps to the end. Then Next.
- **If asked:** "Your race says `{race_ratio}` but the engine says `{dp_race_ratio}`." The race is the reference timetable; the engine's 15-minute plan prices wear and moves energy in coarse steps.

## Screen 4, call (1:00 to 1:35)

> Now Rocky Mountain Power calls for `{enrolled_kw}` kW, right now. Spin, the flywheel, answers, and the host building's meter stays under its `{host_ceiling_kw}` kW limit while Spin refills. If a second call comes during the refill, it gets `{second_call_delivered_pct}`, `{second_call_shortfall_kwh}` kWh short, and the card says so. The card beside it is Torus's own 2025 record: `{rmp_events_2025}` calls, all unplanned. Our trace is simulated. We keep the two apart.

- **Point at:** the call line on the chart, then the second-call card, then the Torus record card.
- **Press:** Rocky Mountain Power calls now, then Call again during refill, then Next.
- **If asked:** none of the five lands here.

## Screen 5, re-plan (1:35 to 1:50)

> After the call, Clearlane re-plans the rest of the day in `{replan_ms}`, timed on this laptop. The meter shows the battery's cycles today against its yearly budget.

- **Point at:** the solve time, read off the screen, never from a file; then the dashed morning plan against the solid re-plan.
- **Press:** Resume the day, then Next.
- **If asked:** none of the five lands here.

## Screen 6, envelope (1:50 to 2:25)

> This is what we hand RMP: for each hour, how much the station may charge or discharge, and how much it holds back for calls. It is a format Clearlane proposes. Outlined hours are the grid's tightest; that rule is our proposal. Across every day since May, a battery-only plan earns more on paper, but it runs `{cycles_per_year_by_policy_price_only}` cycles a year against a `{pulse_cycle_budget}` budget, breaks the host's limit, and misses `{calls_missed_by_policy_price_only_mt}` of calls. Clearlane misses `{calls_missed_by_policy_clearlane_mt}`.

- **Point at:** the outlined hours on the strip; after the press, the battery-only row against Clearlane's. Say no number for the limit breaks.
- **Press:** Show the backtest at "Across every day", then Next. Show the envelope flips back, for Q&A only.
- **If asked:** "Your battery-only plan out-earns Clearlane." On paper it does; it runs `{cycles_per_year_by_policy_price_only}` cycles a year against a `{pulse_cycle_budget}` budget, breaks the host ceiling and misses `{calls_missed_by_policy_price_only_mt}` of calls.
- **Or:** "So your System Critical Hours predict calls?" No. They mark the tightest hours, and no rule we tested catches call hours better than chance.

## Screen 7, scale (2:25 to 2:35)

> An MOU for up to `{torus_500mw}` MW, not installed capacity. If the fleet does not move prices: `{clearlane_500}` a day.

- **Point at:** the fleet figure, then the caveat line under it.
- **Press:** the `{torus_500mw}` MW button, then Next. The `{mou_70mw}` MW button is for Q&A only.
- **If asked:** "Is `{clearlane_70}` a day real?" It assumes every enrolled MW is an arbitrage battery and the fleet does not move prices; the MOU is demand-response capacity, some of it maybe Spin.

## Screen 8, close (2:35 to 2:45)

> Compute moves in time, not in space. Fill up when the road is clear, keep Spin ready for the crash. Our ask: pilot this envelope.

- **Point at:** the ask.
- **Press:** nothing. Stay here for Q&A; the Sources button opens every screen's source line.
- **If asked:** "Isn't this Lasso?" Lasso forecasts and dispatches; a day-ahead timetable and an hourly envelope are not advertised, and the envelope is a format Clearlane proposes.
