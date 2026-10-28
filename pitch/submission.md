# Clearlane: submission draft

Draft for Integration, which owns `README.md` and submits. The submission method and format are not stated (`docs/JUDGING.md` section 6).

## Summary

Clearlane is a day planner for simulated Torus-style stations on Utah's grid. It reads the CAISO day-ahead price for PacifiCorp East the evening before and fills Pulse, the battery, in the midday clear lane. It keeps Pulse off the road in the 6pm jam and holds Spin, the flywheel, ready for Rocky Mountain Power's calls. A call of about five and a half minutes lands, Spin answers, and the rest of the day is re-solved from the state of charge after the call. The output is an hourly operating envelope with System Critical Hours, a format Clearlane proposes. On the day on screen the plan is worth `{clearlane_usd_mw_day}` per MW-day against `{fixed_usd_mw_day}` for a fixed off-peak rule, as value to RMP's system at day-ahead prices, not Torus revenue. A May 1 to Oct 27 backtest checks it, with the 2025 call heatmap in Mountain time.

## Run the six beats offline

1. Check out the tag: `git checkout v1-stage`.
2. Install and start: `npm ci`, then `npm run dev`. The app reads committed data only (`DATA_MODE=snapshot`), so no network is needed.
3. Keys: 1 to 6 jump to a beat, Right steps, Space plays the day, C sends the call, E shows the envelope, B the backtest card, End moves the fleet slider to the MOU ceiling, and ? shows the key map.

## What is real

| Class | What it covers |
|---|---|
| REAL | CAISO day-ahead prices and load forecasts for PacifiCorp East, EIA fuel mix and hourly CO2 |
| DERIVED | The clear lane and the jam, net load, the race, the backtest, the envelope |
| SIMULATED | The stations, the host load, the call times, the campus block |
| TORUS_PUBLISHED | Spin and Pulse specs, the 2025 RMP event data, the MOU; quoted with Torus's permission and attribution |
| ASSUMPTION | Round-trip efficiency, the Station life applied to Pulse, the System Critical Hours rule |
| MEASURED | Solve time and re-plan time, timed live on the demo machine |

Every number on screen comes from `public/derived/numbers.json` or the engine and carries one of these classes. `docs/FACTS.md` lists each number with its source and status.

## How it was built

One founder ran six agent lanes at once: Integration, Engine, Data, UI, Pitch and Science, each in its own worktree and model harness. Every task was a GitHub issue, every change a pull request, and only Integration merged. A shared fact ledger and a copy checker kept each number on stage tied to its source.

## Files

- Deck: `clearlane-deck.pdf`, attached to the submission release.
- One-pagers: `one-pager-host.pdf` and `one-pager-rmp.pdf`, attached to the same release.
- Source: `pitch/deck.md`, `pitch/one-pager-host.md`, `pitch/one-pager-rmp.md`; build with `node pitch/build.mjs`.
