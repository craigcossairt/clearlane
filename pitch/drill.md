# Judge drill and rehearsal sheet

For Tuesday night. Twenty questions by judge, each with its answer (from `pitch/qa.md`) and the trap word to avoid. Then a stopwatch table for the six beats.

## Questions

### Ryan Byrd

1. **Why a DP and not machine learning?**

   A: Day-ahead prices are known the evening before, so the price leg needs no forecast, and an exact plan over the day's steps is auditable. It solves in `{solve_ms}` on this machine, and forecasting the host stays Lasso's job.

   Trap: solve time is read from the screen, never quoted

2. **Why is the engine's own plan worth less than the race card?**

   A: They are two plans: the race card is the hourly reference timetable at `{clearlane_usd_mw_day}` per MW-day, and the engine's 15-minute plan is `{clearlane_dp_usd_mw_day}`. Every fleet figure on stage is built from the reference, and no card mixes the two.

   Trap: "mixes": never put both dollar figures on one card

3. **What does this do to Pulse's cycle life?**

   A: The backtest prices wear at `{wear_usd_mwh}`, set so Clearlane uses at most `{pulse_cycle_budget}` cycles a year, a budget built from Torus's published `{torus_pulse_cycles}` cycles over the Station life of `{torus_lifespan_yr}` (applying that life to Pulse is our assumption). A busy day like the one on screen uses `{cycles_today}` cycles, and the meter shows it.

   Trap: "Pulse has a 25-year life": the Station life is Torus's, applying it to Pulse is ours

4. **How do you know when the calls happen?**

   A: Torus's 2025 heatmap gives counts by hour, and Torus told us the hours are Mountain time (Torus, message to Craig Cossairt, Oct 27 2026). A battery chasing price alone could not answer `{calls_unanswerable_price_only_mt}` of those call times.

   Trap: "both readings", "43% to 77%": retired

5. **What happens if a second call comes during the refill?**

   A: Spin answers the first call, then refills under the host's ceiling. A second press inside that window shows the shortfall, `{second_call_shortfall_kw}` kW on average over the call, on the card.

   Trap: "six-minute call": say about five and a half minutes

6. **Isn't this just arbitrage?**

   A: The price leg is, worth `{clearlane_usd_mw_day}` per MW-day against `{fixed_usd_mw_day}` for a fixed off-peak rule. The rest is keeping Spin ready for RMP's calls, which price alone does not do: in the backtest a price-only plan misses `{calls_missed_by_policy_price_only_mt}` of calls and Clearlane `{calls_missed_by_policy_clearlane_mt}`.

   Trap: "revenue"

7. **Average or marginal emissions?**

   A: Average: EIA hourly generated-basis CO2 for PacifiCorp East (Utah, Wyoming, Idaho), and the card says "estimated, using average emissions". We do not lead with CO2, because marginal emissions can differ.

   Trap: "marginal" as our claim; we use average

### Angela Smith

8. **Is the reference day cherry-picked?**

   A: The backtest card covers May 1 to Oct 27, `{backtest_days}` days, with Clearlane between `{clearlane_p10}` and `{clearlane_p90}` per MW-day. October is the clean case, with the biggest price jump at 5pm or 6pm on `{oct_step_hour_days_at_5_or_6}` of `{oct_step_hour_days_total}` days.

   Trap: "today": say the day on screen

9. **Is Utah allowed to cycle these daily?**

   A: We found no Utah rule on it in the tariff sheets we read, and we make no claim either way. Torus's June 2026 ROWE comments ask for credit for scheduled dispatch and standards for operating envelopes, which is where that question gets settled.

   Trap: "Utah regulators"

10. **Who defines System Critical Hours?**

   A: Nobody yet: Torus asked ROWE for a transparent definition, and we found no Utah or Wyoming docket that defines it. Our rule is our proposal, and the envelope marks `{sch_hours_today}` such hours on the day on screen.

   Trap: "no Utah docket has": say we found no docket

11. **What is real and what is simulated?**

   A: Prices, forecasts and CO2 come from CAISO and EIA, and the Spin and Pulse specs and 2025 event counts are Torus-published, quoted with Torus's permission. The stations, host load and call times are simulated Torus-style, and solve times are measured live.

   Trap: "Torus stations": they are simulated Torus-style

### Nicole Witmyer

12. **Isn't this what Lasso already does?**

   A: Lasso forecasts and dispatches in under `{lasso_dispatch_ms}`, and that is Torus-published. A day-ahead timetable keyed to EDAM prices and an hourly envelope are not advertised, and the envelope is a format Clearlane proposes.

   Trap: "lacks", "Lasso does not": say not advertised

13. **How sure are you this is not already inside Lasso?**

   A: We are not sure, so we say "not advertised", from Torus's own pages. Torus does not know whether Lasso's API accepts an outside schedule or envelope (Torus, message to Craig Cossairt, Oct 27 2026).

   Trap: "Lasso accepts": Torus does not know

14. **What did Torus tell you?**

   A: That the 2025 heatmap hours are Mountain time, that all `{rmp_events_2025}` events in 2025 were unplanned calls, and that we may quote the published Spin and Pulse specs and event data with attribution. Whether Lasso's API takes an outside envelope is unknown to Torus too (Torus, message to Craig Cossairt, Oct 27 2026).

   Trap: naming the Torus person

15. **Does Torus earn the money on the race card?**

   A: No: it is value to RMP's system at day-ahead prices, not Torus revenue and not a host bill cut. Torus and hosts share it only if a program credits scheduled dispatch.

   Trap: "revenue" without "not"

### Scott Holley

16. **Why not charge overnight?**

   A: On the day on screen the fixed off-peak rule charged at `{fixed_rule_charge_usd_mwh}` and the timetable at `{timetable_charge_usd_mwh}`. Estimated, using average emissions, PacifiCorp East ran about `{co2_overnight_avg}` overnight and `{co2_midday_avg}` at midday.

   Trap: "overnight average" as the rule's charge price

17. **What about data centers?**

   A: The same engine moves a simulated campus block in time, worth `{campus_usd}` a day on the day on screen. In October, moving in time saved about `{time_vs_space_oct_time}` and moving across EDAM nodes about `{time_vs_space_oct_space}`.

   Trap: "Torus data-center product"

### Tanner Potter

18. **Who gets the `{clearlane_70}` a day?**

   A: Nobody, as revenue: it is value to RMP's system at day-ahead prices. Torus and hosts share it only if a program credits scheduled dispatch.

   Trap: "revenue"

19. **Does a `{torus_500mw}` MW ceiling move the price?**

   A: Probably, at the top of the slider: the ceiling is about `{mou_share_of_peak_oct27}` of the day's peak forecast of `{load_peak_oct27_mw}` MW. The slider says the fleet is assumed not to move prices, and `{torus_500mw}` MW is an MOU for up to that amount, not installed capacity.

   Trap: "500 MW installed", "record peak"

20. **What is the ask?**

   A: A pilot of the day-ahead envelope at a few Wattsmart sites this winter. Torus's interest in that is our assumption, so it is an ask, not an agreement.

   Trap: "agreement": it is an ask

## Stopwatch, per beat

Fill in during the 11:30pm run. Budget is 2.5 words a second; the script is 361 words against 400.

| Beat | Budget | Run 1 | Run 2 | Run 3 | Over? Cut what |
|---|---|---|---|---|---|
| 1, traffic report | 0:25 | | | | |
| 2, the race | 0:30 | | | | |
| 3, the crash | 0:45 | | | | |
| 4, re-plan | 0:20 | | | | |
| 5, envelope and proof | 0:25 | | | | |
| 6, scale and close | 0:20 | | | | |
| Total | 2:45 | | | | |

## Grade, played as each judge (Tue Oct 27, 6:20pm MT)

Grades are A to D on whether the script and cards would hold up to that judge's likely follow-up.

**Ryan Byrd, depth and correctness: B.** The script is careful, but two things will draw a follow-up. Beat 2 says the reference timetable while the app's beat 2 card shows the engine's 15-minute plan until #184 lands; if it has not landed, Craig must not read the dollar off the screen. The cycle-life card was the weakest: the day on screen uses more than the budget's daily share, so the rewrite leads with the backtest's wear price.

**Angela Smith, path to reality: B minus.** "Is Utah allowed to cycle daily" had a non-answer; the rewrite says what we checked and where the question gets settled. The ask is one line and stays an ask. Gap: no answer yet on who would pay for a pilot.

**Nicole Witmyer, Torus and Lasso: B plus.** Every Lasso line now says "not advertised" or "a format Clearlane proposes", and Torus's answers carry the source line without naming anyone. Risk: Craig paraphrasing Torus's message on stage beyond the four answered points.

**Scott Holley, Utah impact: C plus.** Only three cards. "What does Utah get" was vague; the rewrite ties it to calls answered and the system value. Gap: nothing on students or the Lassonde Center; Craig should have one honest sentence ready.

**Tanner Potter, market and ask: B.** Strong on whose money it is. "Will you keep building this" is Craig's call and is still open.

## The five weakest answers, rewritten

All five are rewritten in `pitch/qa.md`; every number in them is a key and was re-checked against `docs/FACTS.md` (status VERIFIED unless noted).

1. Cycle life (Byrd): now leads with the wear price (`wear_usd_mwh`, VERIFIED) and says the busy day's `cycles_today` openly. `torus_lifespan_yr` is a CONFLICT row; the card keeps its "Station life" wording.
2. The two dollar figures (Byrd): retitled "Why is the engine's own plan worth less than the race card?" and no longer gives a reason we have not checked.
3. Arbitrage (Byrd): now gives both calls-missed figures (`calls_missed_by_policy_price_only_mt`, `calls_missed_by_policy_clearlane_mt`, VERIFIED).
4. Utah daily cycling (Smith): says what we read and cites Torus's ROWE comments.
5. Utah impact (Holley): ties to `calls_missed_by_policy_clearlane_mt` and `clearlane_70` (VERIFIED).

## After rehearsal

Paste the beat times Craig posts on #5 into the stopwatch table, then cut words in any beat that ran over.
