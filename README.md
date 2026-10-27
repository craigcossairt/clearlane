# Clearlane

A day planner for battery and flywheel stations on Utah's grid, built for the Torus bounty (Energy x AI Infrastructure)
at the Hard Tech Hackathon, Salt Lake City, October 2026.

Clearlane reads tomorrow's day-ahead price for PacifiCorp East, charges the battery in the midday clear lane when
solar floods the grid, stays off the road in the 6pm jam, and keeps the flywheel ready for the utility's demand
response calls. It exports an hourly operating envelope that marks the hours the grid needs most.

Stations in this demo are simulated Torus-style stations. Prices and forecasts are real public data; anything
simulated is labeled on screen.

## Run it

```bash
npm ci
npm run dev
```

The demo runs offline from the committed data (`DATA_MODE=snapshot`).

## Check it

```bash
npm run check:all
```

Typecheck, unit tests, build, and the Python prep tests. CI runs the same command.

## Layout

| Path | What |
|---|---|
| `prep/` | Python that fetches and shapes public data into `public/data/` |
| `engine/` | TypeScript planner: the 15-minute dynamic program, crash replay, backtest |
| `app/` | The stage app (Vite + React) |
| `contracts/` | Every data shape that crosses a boundary |
| `research/` | The research behind every number, with sources |
| `docs/FACTS.md` | Every number we say, with its source and certainty |

## Data and licenses

CAISO OASIS (public), EIA-930 (US government, public domain) and Open-Meteo (CC BY 4.0). Sources for each file are in
`research/DATA-SOURCES.md`. Code is MIT.
