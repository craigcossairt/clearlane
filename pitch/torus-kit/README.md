# Torus kit

`sample-envelope.json` is the reference day's hourly operating envelope, copied unchanged from `public/derived/envelope_2026-10-27.json`. It follows `clearlane.envelope/v1`, defined field by field in `pitch/envelope-packet.md` and in `contracts/envelope.v1.schema.json`. It describes one simulated Torus-style station; it is a working example, not a filing, and Torus has not reviewed or endorsed it.

## How it could sit beside Lasso

Lasso already forecasts and dispatches from facility load patterns, weather data, grid signals and rate schedules (Torus-published). The envelope could be one more grid signal next to those: a day-ahead statement, written the evening before, of which hours are System Critical under our proposed rule, how much power to hold back for Rocky Mountain Power's calls, and where the host's meter limits charging. Lasso would still make every dispatch decision; the envelope only says what the next day looks like from the grid's side. It is not a Lasso replacement, and whether Lasso's API accepts an outside schedule or envelope is an open question, so this is a proposal, not a claim.
