# Pitch review log

Findings the pitch lane reports and does not fix. Each row is file:line in the commit reviewed. Pitch owns `pitch/` only.

Reviewed: `origin/main` at `86f98c0`. Close-out Tue Oct 27 2:26AM MT. Files read: `contracts/types.ts`, `contracts/fixtures/bundle_2026-10-27.json`, `tools/make_fixture.py`, `AGENTS.md`, `docs/FACTS.md` (Hour conventions).

Severity: **fix** means settle before the freeze. **note** means a wording or shape choice that will not break a consumer if left as written.

## Train 1, contract review (issue 7)

### Withdrawn

1. **`tools/make_fixture.py:61`. CO2 hour map. Withdrawn Tue Oct 27 2:26AM MT.**
   The first review said `CO2_HOUR_ENDING[h + 1]` was one hour late. That was wrong. Hour beginning h runs from h:00 to the next hour, which is EIA hour ending h+1 (`docs/FACTS.md`, Hour conventions: "Hour beginning h uses HE h+1"). The builder is correct, and so is `habit.py:8`.
   Worked example: fixture hour 0 (12am to 1am) is HE1, 697 g/kWh. Fixture hour 13 (1pm to 2pm) is HE14, 450 g/kWh. Re-pinning the race CO2 to -0.395 and +0.130 t/MW-day would break correct data. No change asked.

### Fix before the freeze

2. **`tools/make_fixture.py:44-47` and fixture note 2. Hour 0's price is the next midnight, labeled REAL.**
   The research snapshot starts at `2026-10-27T07:00:00Z` (1am MT) and ends at `2026-10-28T06:00:00Z` (midnight MT, $46.11). The builder copies that last row into hour 0 and stamps it `2026-10-27T06:00:00Z`. The note says the hour is borrowed. The hour's `prov.lmp` is still `REAL`, which reads as "this is the Oct 27 midnight price."
   Checked: snapshot row 24 is `10-28 00:00` at $46.11; fixture hour 0 is $46.11 at `2026-10-27T06:00:00Z`.
   Ask: Data's real bundle must fetch the previous CAISO operating day for hour 0 (`contracts/types.ts:52` already says a Mountain day starts at 06:00Z). Until that bundle replaces the fixture, Engine and UI should not treat fixture hour 0 as an Oct 27 price. Pitch will not quote an hour 0 price from the fixture.

3. **`contracts/types.ts:82`. `pulse_life_yr` names the wrong life.**
   The field comment says 25. Torus publishes a 25-year lifespan for the Station, not for Pulse. Pulse's published cycle life is 7,500. The 300-cycles-a-year budget (`contracts/types.ts:95`) divides 7,500 by that 25, so the budget is an assumption about Station life, not a Pulse spec.
   Ask: Integration renames the field to `station_life_yr` before the freeze, or keeps the name and marks the 300-a-year budget ASSUMPTION in the comment. Pitch says "Station lifespan 25 years" and never "Pulse has a 25-year life."

### Notes, no freeze block

4. **`contracts/types.ts:193`. The heatmap UTC reading does not say how many hours it shifts.**
   `calls_unanswerable_pct` has `heatmap_as_mt` and `heatmap_as_utc`. MDT is UTC-6; MST is UTC-7. A single UTC field can hide which shift was used. The source chart states no time zone (`contracts/types.ts:71`).
   Ask: Engine records the shift in hours next to the UTC figure (in `numbers.json` or a note on `BacktestResult`). Pitch always shows both readings and names the shift.

5. **`contracts/types.ts:47`. The SP15 node id is a prose comment, not a value.**
   Research uses `TH_SP15_GEN-APND` (`research/analysis/option2/edam_where_vs_when.py:15`). The fixture already uses that id. A later bundle could pick a different SP15 node and still type-check.
   Ask: Data keeps `TH_SP15_GEN-APND` and says so in the bundle notes. No contract change required if the real bundle matches the fixture.

6. **`contracts/types.ts:42`. `co2_kind` has no trailing-window length for the operating day.**
   `eia_profile_avg_30d` names 30 days. The fixture is the Oct 1-25 mean (25 days), which the note states. A reader of the field alone would think the window was 30.
   Ask: Data sets `co2_kind` to match the window it actually used, or puts the window in `notes`. Pitch quotes the window from the bundle notes, not from the field name.

7. **`contracts/types.ts:206-214`. `StageNumber` cannot carry a non-numeric claim.**
   `value` is a number. Shares such as "24 of 27", both heatmap readings, and "not verified" have to be split into numeric keys or left out of `numbers.json`. That is fine if Engine writes one key per number and the deck never types a result. No change asked.

8. **`AGENTS.md:16`. The lane brief now exists.**
   `docs/lanes/pitch.md` is on `origin/main` (commit `626acbd`). The review at `86f98c0` was written before that commit. Not a contract gap.

### Checked, no finding

- Units are in the field names. Prices are `$/MWh`, power is kW, energy is kWh, CO2 is g/kWh. `value_usd` is described as system value, not revenue (`contracts/types.ts:134`).
- Times are interval starts in UTC, with `*_utc` ending in `Z`. The fixture's 24 hours are ordered, `hour_mt` is 0 through 23, and each `net_load_mw` equals load minus solar minus wind within a cent.
- Provenance covers REAL, DERIVED, SIMULATED, TORUS_PUBLISHED, ASSUMPTION and MEASURED. `solve_ms` is MEASURED and not a stored constant (`contracts/types.ts:140`).
- `AGENTS.md` states the guardrails the deck has to keep: "not advertised", simulated stations, the overnight rule as our baseline, value to RMP's system, and no em dashes in judge-facing copy.
