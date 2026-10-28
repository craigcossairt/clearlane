## For judges

Clearlane plans a day for simulated Torus-style stations on Utah's grid. It fills Pulse in the midday clear lane, stays off the road in the 6pm jam, keeps Spin ready for Rocky Mountain Power's calls, and writes an hourly envelope with System Critical Hours, a format Clearlane proposes.

Run it offline: `git checkout v1-stage`, `npm ci`, `npm run dev`. Press ? for the keys.

Every number on screen is read from `public/derived/numbers.json` or the engine and is tagged REAL, DERIVED, SIMULATED, TORUS_PUBLISHED, ASSUMPTION or MEASURED. `docs/FACTS.md` gives each one's source. Dollar figures are value to RMP's system at day-ahead prices, not Torus revenue. CO2 is estimated, using average emissions.

The deck and both one-pagers are attached to the release as PDFs.
