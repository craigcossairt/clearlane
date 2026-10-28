# Talk track, presenter mode

For presenter mode (`?ff=presenter`): eight screens. Every result is a key in braces; the screen shows the same number.

**The slot.** Group 4 (Torus) at 5:20pm, five minutes for setup, the talk and Q&A together. Finals, 6:15 to 6:45pm, are the same talk to the full panel.

**The spine.** About two and a half minutes of talk, 2:45 at most with both optional parts: fourteen presses, and about 31 seconds of the screen animating (the race replay and the call traces). Talk over the animation; never wait for it. One story: prices are a traffic report, filling at midday is worth more, the flywheel answers the utility's call, the plan heals itself, the station publishes an hourly envelope, the backtest passes the rules battery-only fails, it scales, and the ask.

**Running long? Two optional cuts, in this order.**

1. **The second call** (Screen 4, about 8 seconds). Skip "Call again during refill" and its optional line; click Re-plan in the progress bar at the top instead of Next, because Next would run the second call.
2. **The `{torus_500mw}` MW press** (Screen 7, about 10 seconds). Skip the Scale screen and its line; click Close in the progress bar at the top instead of Next.

Each screen has four parts:

- **Say:** the quoted lines, in plain words. A line marked _Optional_ is a cut.
- **Point at:** where to put the judges' eyes.
- **Press:** the button to click, or Next. A clicker works as Next. Next alone walks the whole talk, because it presses each screen's buttons in order before it leaves the screen.
- **If asked:** the hard question most likely on that screen, with the one-line answer from `pitch/drill.md`'s five hard questions. The full card is in `pitch/qa.md`.

## Screen 1, title (0:00 to 0:10)

> Clearlane is a day plan for simulated Torus-style stations on Utah's grid. Pulse is the battery, Spin the flywheel, and RMP the local utility.

- **Point at:** the three definitions on the title screen; "Presented by Craig Cossairt" is on the screen, so no need to say it.
- **Press:** Start.
- **If asked:** none of the five lands here.

## Screen 2, traffic (0:10 to 0:30)

> This is the price of power for the day on screen, hour by hour, set the evening before. Midday is cheap: the road is clear. The road jams in the evening: by 6pm power costs `{peak_over_trough}` the day's low.

- **Point at:** the green bars at midday, then the red bars in the evening jam, then the "Price jumps" caption under the chart.
- **Press:** Next.
- **If asked:** none of the five lands here.

## Screen 3, race (0:30 to 1:00)

> Two identical batteries. The left one follows a fixed off-peak rule. That rule is ours, not Torus practice. It buys power at `{fixed_rule_charge_usd_mwh}`. The right one is a simulated Torus-style station on Clearlane, buying at midday at `{timetable_charge_usd_mwh}`. Both sell in the same evening hours. Off-peak nets `{fixed_usd_mw_day}` per MW a day, Clearlane `{clearlane_usd_mw_day}`. That is value to RMP's system at day-ahead prices.

- **Point at:** each card's Buys row, then both Sells rows (say no number for the sale), then the two large Net figures.
- **Press:** Replay the day; talk over the 15-second replay. Then Next.
- **If asked:** "Your race says `{race_ratio}` but the engine says `{dp_race_ratio}`." The race is the reference timetable; the engine's 15-minute plan prices wear and moves energy in coarse steps.

## Screen 4, call (1:00 to 1:35)

> Now RMP calls for `{enrolled_kw}` kW, right now. Spin, the flywheel, answers, and the host building's meter stays under its `{host_ceiling_kw}` kW limit while Spin refills. A battery-only plan chases price alone and keeps nothing back. The card beside it is Torus's own 2025 record: `{rmp_events_2025}` calls, all unplanned. Our trace is simulated. We keep the two apart.
>
> _Optional:_ If a second call comes during the refill, only `{second_call_delivered_pct}` of it is delivered, `{second_call_shortfall_kwh}` kWh short.

- **Point at:** the gray line (what Rocky Mountain Power asked for) and the blue Spin line under it; then the card headed Torus's published record, separate from this simulation.
- **Press:** Rocky Mountain Power calls now; talk over the trace. Then Call again during refill (optional), then Next.
- **If asked:** none of the five lands here.

## Screen 5, re-plan (1:35 to 1:50)

> After the call, Clearlane re-plans the rest of the day in `{replan_ms}`, timed on this laptop. The new plan sits almost on top of this morning's plan.

- **Point at:** "Re-planned in" and the time beside it, read off the screen, never from a file; then the re-plan lying almost on top of this morning's plan.
- **Press:** Resume the day, then Next.
- **If asked:** none of the five lands here.

## Screen 6, envelope (1:50 to 2:20)

> We hand RMP this: each hour, how much the station may charge, and the power it keeps ready for calls. It is a format Clearlane proposes. Marked hours are the grid's tightest; that rule is our proposal. Since May, the battery-only plan earns more on paper, but runs `{cycles_per_year_by_policy_price_only}` cycles a year against a `{pulse_cycle_budget}` budget and misses `{calls_missed_by_policy_price_only_mt}` of simulated calls. Clearlane misses `{calls_missed_by_policy_clearlane_mt}`.

- **Point at:** the System Critical Hours marked on the strip; after the press, the scorecard's Battery-only column against Clearlane's, row by row: wear, meter ceiling, calls. Say no number for the ceiling breaks.
- **Press:** Show the backtest at "Since May", then Next. Show the envelope flips back, for Q&A only.
- **If asked:** "Your battery-only plan out-earns Clearlane." On paper it does; it runs `{cycles_per_year_by_policy_price_only}` cycles a year against a `{pulse_cycle_budget}` budget, breaks the host ceiling and misses `{calls_missed_by_policy_price_only_mt}` of calls.
- **Or:** "So your System Critical Hours predict calls?" No. They mark the tightest hours, and no rule we tested catches call hours better than chance.

## Screen 7, scale (2:20 to 2:30)

> _Optional:_ An MOU for up to `{torus_500mw}` MW, not installed capacity. If the fleet does not move prices: `{clearlane_500}` a day.

- **Point at:** the arithmetic, one station's value per MW-day times the fleet, then the caveat line under it.
- **Press:** the `{torus_500mw}` MW button, then Next. The `{mou_70mw}` MW button is for Q&A only.
- **If asked:** "Is `{clearlane_70}` a day real?" It assumes every enrolled MW is an arbitrage battery and the fleet does not move prices; the MOU is demand-response capacity, some of it maybe Spin.

## Screen 8, close (2:30 to 2:45)

> The same planner can move AI compute into the clear lane, in time, not in space. Fill up when the road is clear, keep Spin ready for Rocky Mountain Power's calls. Our ask: pilot this envelope.

- **Point at:** the ask and the Wattsmart line under it, then the three "What you saw" figures. The repo line is on screen for anyone who wants the code.
- **Press:** nothing. Stay here for Q&A; the Sources button opens every screen's source line.
- **If asked:** "Isn't this Lasso?" Lasso forecasts and dispatches; a day-ahead timetable and an hourly envelope are not advertised, and the envelope is a format Clearlane proposes.
