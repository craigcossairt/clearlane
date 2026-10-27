# Operator stage script

What the operator presses and checks during the 2:45 demo. The spoken lines are in [`pitch/stage-script.md`](../pitch/stage-script.md); this file never repeats them. Keys come from [`demo/keymap.md`](keymap.md).

Every value on screen is a `{key}` from `public/derived/numbers.json`, shown with its provenance chip. The state names (`loading`, `ready`, `playing`, `paused`, `call`, `replanned`, `failed`) are the `data-state` values on `document.body` (`docs/lanes/ui.md` section 6.10).

**Before the clock starts.** Browser full screen at 1920x1080, Wi-Fi off, the app open at beat 1 with `data-state="ready"`. The backup video is open in a second window, paused at 0:00.

**Recovery, in this order, for any beat:**

1. Press R, then the beat number, then repeat the beat's keys.
2. If the beat is still wrong, press the next beat's number and keep talking.
3. If the app is frozen or blank, switch to the backup video at that beat's timestamp below.

## Beat 1, traffic report (0:00 to 0:25)

- **Keys:** none; the beat opens on load.
- **Expect:** `data-beat="1"`, `data-state="ready"`.
- **On screen:** `{price_min_oct27}`, `{peak_price}`, `{peak_over_trough}`, `{peak_hour_mt}`, `{net_load_climb_mw}`, `{lane_clear_max_usd}`, `{lane_jam_min_usd}`.
- **The judge must see:** the road is clear at midday and jammed after the evening step.
- **Video timestamp:** 0:00.

## Beat 2, the race (0:25 to 0:55)

- **Keys:** Space to play the race.
- **Expect:** `data-beat="2"`, `data-state` goes `playing`, then `paused` at the end.
- **On screen** (the reference set only): `{fixed_usd_mw_day}`, `{clearlane_usd_mw_day}`, `{race_ratio}`, `{fixed_70}`, `{clearlane_70}`, `{fixed_rule_charge_usd_mwh}`, `{timetable_charge_usd_mwh}`.
- **The judge must see:** the same battery on two timetables, and Clearlane earns more per MW-day.
- **Video timestamp:** 0:25.

## Beat 3, the crash (0:55 to 1:40)

- **Keys:** C for the 6:40pm call. C again during Spin's refill for the second call.
- **Expect:** `data-beat="3"`, `data-state="call"` after each press.
- **On screen:** `{enrolled_kw}`, `{call_duration_s}`, `{rmp_events_2025}`, `{rmp_event_ramp_s}`, `{reserve_cost_pct}`, `{meter_peak_refill_kw}`, `{second_call_shortfall_kw}`.
- **The judge must see:** Spin answers the call alone. The battery-only ghost misses it or gives up its evening block. The second call shows an honest shortfall.
- **Rehearsal trim:** if the run is long, skip the second C press first.
- **Video timestamp:** 0:55.

## Beat 4, re-plan (1:40 to 2:00)

- **Keys:** Right.
- **Expect:** `data-beat="4"`, `data-state="replanned"`.
- **On screen:** `{pulse_cycle_budget}`, `{cycles_today}`, and the re-plan time, which is MEASURED live on this laptop and never stored.
- **The judge must see:** the rest of the day re-solved from the actual state of charge, timed on this machine.
- **Video timestamp:** 1:40.

## Beat 5, envelope and proof (2:00 to 2:25)

- **Keys:** E for the envelope, then B for the backtest card.
- **Expect:** `data-beat="5"`, `data-state="ready"` with the envelope, then the backtest card open.
- **On screen:** `{sch_hours_today}`, `{share_days_beating}`, `{clearlane_p50}`, `{backtest_days}`, `{calls_answered_pct}` (both heatmap readings), `{clearlane_dp_usd_mw_day}` labeled as the engine's plan.
- **The judge must see:** an hourly operating envelope with System Critical Hours, then May 1 to Oct 27 across three policies.
- **Video timestamp:** 2:00.

## Beat 6, scale and close (2:25 to 2:45)

- **Keys:** + to step the fleet slider (End jumps to the MOU ceiling), then Right for the close.
- **Expect:** `data-beat="6"`.
- **On screen:** `{mou_70mw}`, `{fixed_500}`, `{clearlane_500}`, `{torus_500mw}` with its MOU-ceiling caveat, then `{time_shift_pct_range}`.
- **The judge must see:** the value at the MOU size and at the MOU ceiling, then "compute follows the sun in time, not in space".
- **Video timestamp:** 2:25.

## After the run

Press R once to reset to beat 1. Log the run time and anything that broke in [`demo/run-of-show.md`](run-of-show.md).
