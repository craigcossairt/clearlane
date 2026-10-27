# Glossary

Plain meanings of the terms used in Clearlane's code, UI copy and Q&A. Two sentences at most per term. Where a number appears, its source is in `docs/FACTS.md` or the file named. `UNVERIFIED` means we did not confirm it on a primary source.

## Markets and grid areas

**LMP (locational marginal price)**: The price of delivering one more MWh at a specific point on the grid in a specific interval, in $/MWh. CAISO splits it into energy (MCE), congestion (MCC), losses (MCL) and greenhouse gas (MGHG) parts that add up to the total.

**Congestion component**: The part of an LMP caused by transmission limits (OASIS type MCC, item `LMP_CONG_PRC`); it is negative when a point sits on the cheap side of a constraint. At PACE it was about 0.8% of price in July 2026 and 6.9% in October (`research/notes/utah-grid.findings.md`).

**Day-ahead vs real-time market**: The day-ahead market sets a price for every hour of the next operating day, posted the evening before. The real-time market prices 5-minute intervals to settle differences from the day-ahead plan; Clearlane plans on day-ahead prices.

**EDAM (Extended Day-Ahead Market)**: CAISO's day-ahead market opened to other Western balancing areas. It went live May 1 2026 with PacifiCorp (PACE and PACW), and Portland General Electric joined Oct 1 2026 (`research/notes/utah-grid.findings.md`).

**WEIM (Western Energy Imbalance Market)**: CAISO's real-time market for other Western balancing areas. PacifiCorp was its first participant, from Nov 1 2014 (date seen only in a search summary, UNVERIFIED).

**Balancing area**: A region where one operator keeps supply and demand matched every moment. PACE and PACW are PacifiCorp's two.

**PACE (PacifiCorp East)**: The balancing area that covers Rocky Mountain Power's service in Utah, Wyoming and Idaho. Its CAISO price node is `ELAP_PACE-APND`.

**PACW (PacifiCorp West)**: PacifiCorp's western balancing area, the other half of PacifiCorp in EDAM. Its CAISO price node is `ELAP_PACW-APND`.

**ELAP node**: The CAISO price point that stands for a whole EDAM or WEIM area's load, such as `ELAP_PACE-APND`. The expansion usually given is "EIM Load Aggregation Point" (UNVERIFIED).

**OASIS**: CAISO's public data site and API for prices, load forecasts and wind and solar forecasts, free with no key. Queries are capped at 31 days and about one request every 5 seconds.

**EIA-930**: The US Energy Information Administration's hourly report of demand, demand forecast, generation by fuel and interchange for every balancing area. Its files use local hour ending, plus a UTC column.

**ROWE**: The Regional Organization for Western Energy, the body running the Western resource adequacy program whose spring 2026 workshop drew Torus's June 2026 comments. Local copy: `../clearlane-raw/dl/wraap.pdf`.

**Price-taker**: The assumption that our own charging and discharging does not change the market price. It holds for a small fleet; at 500 MW (about 8% of PACE's Oct 27 peak load forecast of 6,024 MW) it would not.

## Time

**Operating day**: CAISO's trading day, midnight to midnight Pacific time, which is 1am to 1am Mountain. OASIS labels each hour with `OPR_DT` (the operating day) and `OPR_HR` (Pacific hour ending, 1 to 24).

**Hour beginning vs hour ending**: Hour beginning (HB) names an hour by its start and hour ending (HE) by its end, so 6-7pm is HB18 or HE19. OASIS `OPR_HR` is Pacific hour ending and EIA uses local hour ending; Clearlane shows Mountain hour beginning everywhere.

**Mountain day**: Clearlane's day: the 24 hours from midnight Mountain time (06:00 UTC while daylight time lasts, until Nov 1 2026). Its first hour (midnight to 1am) comes from the previous CAISO operating day.

**2025 event heatmap**: Torus's published count of 2025 Rocky Mountain Power events by hour and weekday. It states no time zone, so Clearlane always shows both readings, Mountain and UTC.

### Time crosswalk for Oct 27 2026 (MDT, UTC-6)

| UTC interval start | OASIS `OPR_DT` / `OPR_HR` | Mountain hour beginning | PACE day-ahead LMP |
|---|---|---|---|
| 07:00Z Oct 27 | 2026-10-27 / 1 | 1am Oct 27 | $44.17 |
| 15:00Z Oct 27 | 2026-10-27 / 9 | 9am | $28.61 |
| 21:00Z Oct 27 | 2026-10-27 / 15 | 3pm | $21.38 |
| 00:00Z Oct 28 | 2026-10-27 / 18 | 6pm | $55.78 |
| 06:00Z Oct 28 | 2026-10-27 / 24 | midnight (start of Oct 28) | $46.11 |

During daylight time, `OPR_HR` n equals Mountain hour beginning n. The 6pm hour is EIA local hour ending 7pm. Worked LMP example for the 6pm hour: $55.78409 = energy $58.02097 + congestion -$2.15565 + losses -$0.08123 + GHG $0. Source: `research/data/caiso2/`.

## Load

**Net load**: Demand minus wind and solar output, the part other plants must serve. Clearlane computes it as CAISO's PACE load forecast minus the EDAM wind and solar forecast (DERIVED); on Oct 27 it climbs 3,654.5 MW between 3pm and 6pm Mountain.

**Clear lane, jam, shoulder**: Clearlane's names for the day's hours by price: clear lane hours are at or below the day's low plus 25% of its range, jam hours at or above the high minus 25%, and shoulder hours are the rest. The planner fills up in clear lanes and empties in jams.

**kW vs kWh**: kW is a rate (power); kWh is an amount (energy). Clearlane holds kW open for utility calls because a call asks for power fast, not for a lot of energy.

## Storage

**C-rate**: Power as a multiple of energy capacity: 1C empties a full battery in one hour, 0.5C in two hours, 10C in six minutes. Torus publishes 10C for Spin and 0.5C for Pulse.

**Round-trip efficiency (RTE)**: The share of energy put into storage that comes back out. Clearlane assumes 0.88 (ASSUMPTION), applied as its square root on the way in and again on the way out.

**State of charge (SoC)**: How full a battery is, as a share of its usable energy. Clearlane's planner tracks it in 41 levels and must end the day at least as full as it started.

**Full-equivalent cycle (FEC)**: Total energy discharged divided by usable capacity, so two half discharges count as one cycle. Pulse is rated for 7,500 cycles, so 300 a year lasts its 25-year life.

**Wear price**: A charge in $/MWh the planner adds to every MWh it moves through the battery, standing in for the cycle life that use spends. Clearlane tunes it between $0 and $60/MWh so the battery runs near 300 full-equivalent cycles a year.

**$/MW-day**: Value per MW of station power per day, so stations of different sizes compare. In `research/analysis/demo-story/habit.py` the fixed overnight schedule (our baseline, not Torus practice) earns $20.06 and the midday timetable $58.41 (DERIVED, value to RMP's system at day-ahead prices).

## Customer bills and programs

**Demand charge**: The part of a commercial electric bill set by the customer's highest power draw (kW) in the billing period, not by energy used. Torus says peak demand charges are about 50% of a commercial bill (https://www.torus.co/wattsmart).

**15-minute interval peak**: The highest average power over any 15-minute window in a billing period; Torus's manufacturing page says one such window sets the month's demand charge. Clearlane treats the host's 15-minute peak as a hard ceiling the plan may never raise.

**Wattsmart Battery**: Rocky Mountain Power's program that pays customers for batteries RMP can dispatch for grid needs. Torus is one of two approved commercial vendors (30 kW to 1.2 MW), and batteries must support IEEE 2030.5 with 30-second telemetry.

**Fast frequency response**: Very fast power injection when grid frequency drops, usually after a large generator trips. It is the primary use in Torus's RMP case study, which reports 359 events in 2025 and about a 19-second ramp.

**RMP (Rocky Mountain Power)**: PacifiCorp's utility in Utah, Wyoming and Idaho, and the utility that calls events on Torus systems in PACE. Value in Clearlane is stated as value to RMP's system at day-ahead prices.

**MOU**: A memorandum of understanding, a non-binding agreement; Torus and RMP signed one in January 2025 for up to 70 MW of C&I demand response. Torus's RMP case study later describes 500 MW being deployed, which Clearlane treats as a ceiling, not installed capacity.

## Control and standards

**IEEE 2030.5**: A communication standard utilities use to send controls to, and read data from, distributed resources such as batteries. RMP requires it for Wattsmart batteries; how Clearlane's envelope fields map onto it is UNVERIFIED.

**DERMS**: A distributed energy resource management system, utility software that monitors and dispatches many small resources at once. Lasso's API lists DERMS among the utility systems it connects to.

**DBGMS**: Rocky Mountain Power's Distributed Battery Grid Management System, tied into its energy management system to schedule and dispatch enrolled batteries (Cadmus 2021). The full path from RMP to a Torus station is our inference, not stated on any one page.

**Virtual power plant (VPP)**: Many distributed resources, such as batteries at customer sites, dispatched together as if they were one plant. Torus's RMP case study counts its responses as VPP events.

**Operating envelope**: Limits set ahead of time on how much a site may import or export in each interval, with the utility keeping the right to dispatch within them. Torus's June 2026 ROWE comments ask regulators to recognize utility-directed envelopes; Clearlane publishes one per station as `clearlane.envelope/v1`.

**Scheduled dispatch**: Running a resource on a plan agreed in advance rather than only on live signals. Torus's June 2026 ROWE comments ask regulators to credit scheduled dispatch programs, alongside operating envelopes and aggregated dispatch.

**System Critical Hours (SCH)**: A term in ROWE's resource adequacy design that Torus's June 2026 regulator comments ask to have defined explicitly; its definition is not yet standardized. Clearlane's working definition, labeled as our proposal, is the day's 4 highest net-load hours plus every jam hour.

**Torus Station, Spin, Pulse, Lasso**: Torus's behind-the-meter system (Station) pairs a flywheel (Spin: 10C, 25,000 cycles) with an LFP battery (Pulse: 0.5C, 7,500 cycles), run by Torus software (Lasso). Stations in Clearlane are simulated Torus-style, built from these published specs (TORUS_PUBLISHED).

**Crash test (call replay)**: Clearlane's SIMULATED utility call, 330 seconds at the enrolled kW with a 19-second ramp, replayed against each plan to check it can still answer. In the model Spin holds 0.1 kWh per enrolled kW and recharges in about 6 minutes.

## Emissions

**Average vs marginal emissions**: Average emissions are total CO2 from all generation in an hour divided by the MWh generated; marginal emissions are the CO2 change from one more MWh, set by whichever plant responds. Clearlane's CO2 figures are average-emissions estimates and carry that caveat on screen.

**Generated vs consumed basis**: EIA's generated basis counts emissions from plants inside the balancing area per MWh they produce; consumed basis adjusts for imports and exports. Clearlane uses generated basis because consumed lags about 2 days, and PACE exports in most hours, so the two differ.

## Statistics and provenance

**P10 / P50 / P90**: Percentiles across backtest days: 10% of days fall below P10, P50 is the median, and 10% of days land above P90. Clearlane reports all three for May 1 to Oct 27 2026.

**Provenance classes**: Every on-screen number carries one. REAL is public data as published, DERIVED is computed from REAL data, SIMULATED is modeled, TORUS_PUBLISHED is a figure from Torus's own pages, ASSUMPTION is a value we chose, and MEASURED is timed live on the machine running the demo, such as solve time.
