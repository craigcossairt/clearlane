# Utah grid context (PACE)

Reference for the pitch lane and judge Q&A. Every number below cites a repo file or a URL. Paths are relative to the repo root. Where something could not be checked it says UNVERIFIED.

Curated 2026-10-26 (Mountain) from `research/notes/utah-grid.findings.md`, `research/notes/data-option1.findings.md`, `research/notes/prior-art.findings.md` and the scripts and outputs under `research/analysis/`. The analyses quoted here were re-run on 2026-10-26 and reproduced the stored outputs.

## How to read the numbers

- **Clock.** All hours are Mountain Daylight Time (MDT, UTC-6) and **hour beginning** unless marked. "6pm" means 6:00 to 7:00pm MDT, written HB18. EIA files label hours by the end of the hour (HE); HE19 is the same hour as HB18. DST ends Sun Nov 1 2026; nothing below crosses it.
- **Provenance.** REAL = a published number from CAISO or EIA. DERIVED = our arithmetic on REAL data. ASSUMPTION = a factor we chose. SIMULATED = a modeled scenario.
- **CO2.** Every CO2 figure here is an **average** emissions rate for the electricity PACE generated in that hour. None of them is a marginal rate (the emissions of the next MWh). Say "average-emissions estimate" whenever a CO2 number is shown.
- **Value.** Dollar figures from price shifting are value to Rocky Mountain Power's system at day-ahead prices. They are not Torus revenue.

## 1. PACE and the EDAM market

- **PacifiCorp East (PACE)** is Rocky Mountain Power's balancing area, which includes its Utah service territory (`research/notes/prior-art.findings.md`). Its area-wide price in CAISO data is the load aggregation point `ELAP_PACE-APND`; its EIA-930 respondent id is `PACE`.
- **EDAM went live May 1 2026** with CAISO, PACE and PacifiCorp West (PACW). Portland General Electric joined Oct 1 2026, and LADWP, BANC and others plan to join in 2027. REAL. Sources: https://www.caiso.com/documents/2026-second-quarter-report-on-market-issues-and-performance.pdf and https://www.pacificorp.com/about/newsroom/news-releases/extended-day-ahead-market-live.html
- CAISO reports **more than $11 million** in participant benefits from EDAM's first two months. At launch PacifiCorp did not enable convergence (virtual) bidding. Source: https://www.caiso.com/about/news/news-releases/extended-day-ahead-market-expanded-to-include-portland-general-electric
- Before EDAM, PacifiCorp was in the real-time Western Energy Imbalance Market (WEIM). Cumulative WEIM benefits reached **$8.62B** by Q1 2026, and PacifiCorp's Q1 2026 share was **$60.48M**. Source: https://www.caiso.com/about/news/news-releases/western-energy-imbalance-market-continues-to-deliver-with-over-8-6-billion-in-total-benefits-to-date. The Nov 1 2014 WEIM start date was seen only in a search summary (UNVERIFIED).
- **Why it matters for Clearlane:** since May 1 2026 PACE has had a public, hourly day-ahead price that is set the afternoon or evening before each operating day. That price is the "timetable" the product reads. Our history starts May 1 2026: the first EDAM operating day in `research/data/caiso7/` is 2026-05-01.
- **Peak hour.** PACE's highest demand hour from Jul 2025 to Oct 25 2026 was **10,173 MW on Jul 20 2026, 4-5pm MDT** (HE17). Summer (Jun-Sep) mean demand was 6,724 MW. The winter peak was only 7,270 MW (Dec 30 2025, 8-9am MST), so PACE peaks in summer. REAL. Source: `research/analysis/pace_analysis_output.txt`. Do not call 10,173 MW a record: the window is only 16 months.

## 2. The demo day: Oct 27 2026, day-ahead

The day-ahead price, load forecast and EDAM wind and solar forecast for PACE were all published before Oct 27 began. REAL. Source: `research/data/pace_snapshot_2026-10-27.csv` (built by `research/analysis/scripts/snapshot.py` from `research/data/caiso2`-`caiso5`). Net load = load forecast minus solar forecast minus wind forecast (DERIVED).

| HB (MDT) | Price $/MWh | Load fcst MW | Solar fcst MW | Wind fcst MW | Net load MW |
|---|---|---|---|---|---|
| 0 | 30.22 (see note) | not in repo | not in repo | not in repo | not in repo |
| 1 | 44.17 | 4,947 | 0 | 2,075 | 2,872 |
| 2 | 43.01 | 4,893 | 0 | 2,370 | 2,523 |
| 3 | 35.50 | 4,888 | 0 | 2,647 | 2,241 |
| 4 | 35.44 | 4,965 | 0 | 2,969 | 1,996 |
| 5 | 35.43 | 5,161 | 0 | 3,202 | 1,959 |
| 6 | 44.09 | 5,520 | 0 | 3,227 | 2,293 |
| 7 | 44.35 | 5,897 | 2 | 3,195 | 2,700 |
| 8 | 44.73 | 5,984 | 596 | 3,211 | 2,177 |
| 9 | 28.61 | 5,930 | 1,943 | 3,259 | 728 |
| 10 | 23.23 | 5,875 | 2,216 | 3,294 | 365 |
| 11 | 22.12 | 5,819 | 2,151 | 3,327 | 341 |
| 12 | 21.97 | 5,784 | 2,088 | 3,298 | 398 |
| 13 | 21.55 | 5,756 | 2,082 | 3,258 | 416 |
| 14 | 21.71 | 5,730 | 2,141 | 3,184 | 405 |
| 15 | 21.38 | 5,745 | 2,189 | 2,951 | 605 |
| 16 | 22.08 | 5,777 | 2,056 | 2,502 | 1,220 |
| 17 | 34.03 | 5,823 | 987 | 1,916 | 2,920 |
| **18** | **55.78** | 5,937 | 36 | 1,642 | **4,259** |
| 19 | 55.45 | 6,024 | 0 | 1,397 | 4,627 |
| 20 | 55.44 | 5,980 | 0 | 1,271 | 4,709 |
| 21 | 54.57 | 5,815 | 0 | 1,292 | 4,523 |
| 22 | 54.10 | 5,578 | 0 | 1,318 | 4,260 |
| 23 | 52.42 | 5,329 | 0 | 1,355 | 3,974 |

Note on HB0: the snapshot file holds one CAISO operating day, which starts at 1am Mountain. Its last row is Oct 28 at midnight ($46.11). The Oct 27 midnight hour ($30.22857 rounded to $30.22) comes from CAISO operating day Oct 26, hour ending 24, in `research/analysis/option2/oct/20260930_20261028_PRC_LMP_DAM_20261026_20_37_47_v12.csv` (row start 2026-10-27T06:00Z). The two files agree on all 24 shared hours (checked 2026-10-26). See `research/DATA-SOURCES.md` § Joining Mountain days.

Headline facts (DERIVED from the table):

- **3pm $21.38 vs 6pm $55.78: 2.6x.** The price nearly triples in three hours.
- Solar falls from 2,056 MW (HB16) to 987 MW (HB17) to 36 MW (HB18).
- Net load climbs from 604.6 MW at 3pm to 4,259.1 MW at 6pm, **+3,654.5 MW in three hours**.
- Averages: 1-6am (HB1-5) $38.71; 9am-5pm (HB9-16) $22.83; 6-10pm (HB18-21) $55.31.
- 24-hour mean for the Mountain day Oct 27 (HB0 from operating day Oct 26, HB1-23 from operating day Oct 27): $37.56. The snapshot file's own 24-row mean, which runs 1am Oct 27 to 1am Oct 28, is $38.22.
- **Oct 27 is a windy forecast day.** Its EDAM wind forecast is about 3,300 MW from 8am to 2pm. EIA's October 2026 average PACE wind at the same hours was 1,168-1,544 MW (`research/analysis/pace_analysis_output.txt`, October table). Over Jul 1 to Oct 26 2026, EIA PACE wind averaged 1,197 MW and topped 3,000 MW in 131 of 2,808 hours (DERIVED from `research/data/eia930/PACE_EIA930_BALANCE_2026_Jul_Dec.csv`). So the midday net load trough on Oct 27 is deeper than usual. The timing of the evening step is typical (§3); its depth is not. If a judge asks whether Oct 27 was cherry-picked: it was chosen because it was the next operating day, and §3 shows the 5-6pm step on 24 of 27 October days.

## 3. The October step pattern

For each day we found the hour into which the largest hour-to-hour **upward** jump in the PACE day-ahead price lands. DERIVED. Source: `research/analysis/option2/step_hours_output.txt` (script `step_hours.py`, data `research/analysis/option2/oct/` and `jul/`).

- **October 1-27 2026: the largest jump lands at 5pm (9 days) or 6pm (15 days) on 24 of 27 days.** The other three days jump at 5am, 6am and 8am. Median size of that jump: **$15.1/MWh**.
- **July 1-30 2026: the jump is spread from 1pm to 8pm** (1pm 2, 2pm 5, 3pm 1, 4pm 3, 5pm 1, 6pm 6, 7pm 7, 8pm 3, plus 6am 1 and 11pm 1). Median size: $10.1.
- October average prices (Oct 1-25) go from $38.6 at 5pm to **$57.0 at 6pm**, the highest hour of the day. Source: `research/analysis/lmp_analysis_output.txt`.
- Plain reading: in October the sun sets during the evening load and the price steps at one predictable hour. In July the price climbs through the afternoon and peaks at 8pm with no single cliff.

## 4. July vs October

Day-ahead PACE price by hour, mean $/MWh. REAL prices, DERIVED means. Source: `research/analysis/lmp_analysis_output.txt` (July 1-30, n=720 hours; Oct 1-25, n=600).

| HB | 0 | 3 | 6 | 8 | 11 | 13 | 15 | 16 | 17 | 18 | 19 | 20 | 22 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| July | 36.4 | 26.0 | 28.1 | **19.0** | 21.7 | 26.5 | 33.6 | 36.6 | 35.1 | 38.6 | 44.8 | **46.7** | 40.7 |
| October | 38.6 | 34.7 | 40.3 | 39.1 | **28.6** | 29.9 | 30.5 | 30.6 | 38.6 | **57.0** | 50.0 | 46.5 | 44.5 |

| | July 2026 | October 2026 |
|---|---|---|
| Cheapest hour (mean) | 8am, $19.0 | 11am, $28.6 |
| Priciest hour (mean) | 8pm, $46.7 | 6pm, $57.0 |
| Priciest / cheapest | 2.45x | 1.99x |
| Median daily max-min spread | $27.2 | $22.7 |
| Highest single hour | $94.5 | $108.1 (Oct 4, 6pm) |
| Hours with nonzero congestion | 213 of 720 | 390 of 600 |
| Congestion share of price magnitude | 0.8% (max $7.53) | 6.9% (max $34.31) |
| Corr(price, fossil share) | 0.31 | 0.63 |
| Priciest 10% of hours | $65.2 at 76.3% fossil, mostly 8pm | $67.3 at 85.1% fossil, mostly 6pm |
| Cheapest 10% of hours | $12.9 at 52.2% fossil, mostly 9am | $23.0 at 39.8% fossil, mostly 11am |
| Where the biggest daily step lands | 1pm-8pm, spread | 5pm or 6pm, 24 of 27 days |

Sources: `research/analysis/lmp_analysis_output.txt`, `research/analysis/scripts/cong.py` (re-run), `research/analysis/join_analysis_output.txt`, `research/analysis/option2/step_hours_output.txt`. Fossil share is from EIA-930 (coal plus gas over total net generation).

Shifting load in time beats moving it to another node. Take a 4-hour evening block at PACE (October baseline $48.1/MWh, July $41.3). Moving it to PACE's cheapest hours of the same day saves 41% in October and 51% in July. Moving it to the cheapest node in the same hours saves 8% among the EDAM PacifiCorp and PGE nodes, 11% if SP15 is included, and 13% in July (PACE, PACW, SP15). Among PACE, PACW and PGE, PACE itself was the cheapest node in 81% of October hours. DERIVED. Source: `research/analysis/option2/where_vs_when_output.txt`.

## 5. Fuel mix and CO2 by hour (average, not marginal)

**EIA's own number.** EIA publishes an hourly CO2 intensity for PACE's generated electricity in its per-area workbook (https://www.eia.gov/electricity/gridmonitor/knownissues/xls/PACE.xlsx, column "CO2 Emissions Intensity for Generated Electricity", lb/kWh; times 453.592 gives g/kWh). Re-run on 2026-10-26 with `research/analysis/demo-story/co2.py` against the raw workbook. REAL inputs, DERIVED means.

| Window (MDT) | Oct 1-25 2026 g/kWh | July 2026 g/kWh |
|---|---|---|
| 1-6am (HE2-6) | 698 | 751 |
| 9am-4pm (HE10-16) | 468 | 480 |
| 6-10pm (HE19-22) | 665 | 636 |
| Cleanest hour | 2-3pm (HE15), 443 | 11am-noon (HE12), 464 |
| Dirtiest hour | 6-7am (HE7), 709 | 5-6am (HE6), 770 |

Hour-by-hour October values: 3pm (HE16) 446; 4pm 464; 5pm 531; **6pm (HE19) 629**; 7pm 673. Single day: on Oct 25 the rate ran from 504 g/kWh at 3-4pm to 817 g/kWh at 7-8am (`research/notes/data-option1.md`).

**The fuel mix behind it.** EIA-930 hourly net generation for PACE, October 2026 to date (`research/analysis/pace_analysis_output.txt`, October table, hour ending):

- Coal runs 2,500-3,500 MW all day and is the resource that backs down at midday. Gas runs about 1,000-1,650 MW.
- Solar averages 2,218 MW at noon (HE12) and 209 MW at 6-7pm (HE19).
- Fossil share: 48.1% at 2-3pm (HE15) against 76-78% overnight and in the evening.
- Summer 2026 (Jun-Aug): fossil share is about 45-46% from 11am to 2pm and 73-75% from 9pm to midnight. Winter is 39% at 3pm and 63% at 8pm. Source: `research/notes/utah-grid.findings.md`.
- Utah statewide in 2025: coal about 47%, gas about 30%, solar about 17%. The 2024 CO2 rate was 1,322 lb/MWh, 8th highest in the US. Source: https://www.eia.gov/states/UT/analysis

**Two CO2 numbers, one shape.** The repo carries two average-emissions estimates. Never mix them on one chart without labels.

1. EIA's published intensity (above). It uses direct combustion emission factors. In 2026 rows of PACE.xlsx, column "CO2 Factor: COL" runs 2.36-2.45 lb CO2 per kWh of coal generation (1,069-1,112 g/kWh) and "CO2 Factor: NG" runs 0.94-0.96 lb/kWh (checked 2026-10-26, n=7,151 hours).
2. Our `estCI` column in `research/analysis/pace_analysis_output.txt`. It applies IPCC AR5 lifecycle medians that we chose (ASSUMPTION): coal 820, gas 490, solar 48, wind 11, hydro 24, geothermal 38 g/kWh. It reads lower than EIA's number (October 376 g/kWh at HE15 vs 581 at HE7). Summer: about 359 at noon, 539 at 8-9pm, 600 before dawn.

Both show the same pattern: midday is cleanest, evening and night are dirtiest. Caveats for Q&A:

- These are averages. Shifting load into a clean average hour does not prove a matching cut in emissions. The marginal unit could still be coal or gas. No free marginal-emissions signal exists for PACE (see `research/DATA-SOURCES.md` § Ruled out).
- PACE exports power in most hours. On Oct 25 it was a net exporter in 22 of 24 hours, up to +1,444 MW. So "generated" intensity is not what Utah customers consume. EIA's consumed-basis column lags about 2 days. Source: `research/notes/data-option1.findings.md`.
- For a future operating day there is no CO2 number yet. The demo uses the trailing hour-of-day mean (Oct 1-25) as an ASSUMPTION for Oct 27. Source: `docs/plan/synthesis.json` (data_plan).

## 6. Net load

Net load = demand minus solar minus wind. It is what coal, gas, hydro and imports must cover.

| Profile | Net-load peak | Steepest 3-hour climb | Source |
|---|---|---|---|
| Summer 2026 (Jun-Aug), EIA actuals | 5,639 MW at 8-9pm (HE21) | +1,031 MW, HE18 to HE21 | `research/analysis/pace_analysis_output.txt` |
| October 2026 to date, EIA actuals | 4,014 MW at 8-9pm (HE21); low 2,719 at 2-3pm (HE15) | +1,084 MW, HE17 to HE20 | same |
| Winter 2025-26 (Dec-Feb), EIA actuals | 3,896 MW at HE19 | +1,997 MW, HE15 to HE18 | same |
| Oct 27 2026 day-ahead forecast | 4,709 MW at 8pm (HB20); low 341 at 11am | +3,654 MW, 3pm to 6pm | `research/data/pace_snapshot_2026-10-27.csv` |

- Summer daily maximum 3-hour climb: median +1,557 MW, maximum +3,550 MW; it most often starts at HE18. Source: `research/analysis/pace_analysis_output.txt`.
- The EIA and CAISO numbers are not the same quantity. CAISO's PACE load forecast (`SLD_FCST`, area PACE) and the EDAM wind and solar forecast do not match EIA-930's demand and generation definitions one for one. For example, the Oct 27 forecast load is about 5,800 MW at midday, while EIA's October midday demand averages 6,300-6,450 MW. Use one source per chart and name it.
- EIA's own day-ahead PACE demand forecast missed actual demand by a median of 4.3% (90th percentile 11.9%, n=11,473 hours). Source: `research/analysis/pace_analysis_output.txt`.

## 7. What utility programs already say about the evening

- Rocky Mountain Power says demand typically peaks on hot summer weekday afternoons, about 3-8pm. Source: https://www.rockymountainpower.net/about/newsroom/news-releases/summer-heat-energy-tips.html
- Utah's residential time-of-use pilot (Schedule 1 TOU, opened December 2025) sets on-peak at **6-10pm** on weekdays. Source: https://utahcleanenergy.org/want-lower-electric-bills-heres-how-a-new-program-can-help/. The old Schedule 2 window of 1-8pm comes only from a search summary (UNVERIFIED).
- 2025 Utah demand response results. Source for all: https://www.pacificorp.com/content/dam/pcorp/documents/en/pacificorp/environment/dsm/utah/UT_Energy_Efficiency_and_Peak_Reduction_Report_2025.pdf
  - Cool Keeper: 113,519 customers, 269 MW realized of 299 MW potential, 282 events (268 of them 5-minute frequency response).
  - Wattsmart Batteries: 6,388 batteries, 35.16 MW at the site (37.39 MW at generation).
  - Wattsmart Business DR: 68 sites, 30-31 MW, 10 events, including Jul 10, 14 and 15 at 7-8:45pm MDT.
  - Irrigation load control events ran 4-9pm MDT.
- Torus facts belong to the Torus lane. Use only what `research/TORUS.md` states. Say "not advertised" rather than "Torus lacks". The 500 MW MOU figure is a ceiling, not installed capacity. The 2025 Torus event heatmap states no time zone, so show both the Mountain and UTC readings.

## 8. Large loads and data centers in Utah

From a 2026 Utah legislative data brief (https://le.utah.gov/interim/2026/pdf/00003188.pdf), REAL:

- **48 operating data centers, about 920 MW.**
- **7 under construction, adding 2,602 MW,** of which 1,700 MW is behind the meter or off-grid. That leaves about 902 MW that would draw on the grid (DERIVED: 2,602 - 1,700).
- Large projects: Joule HP Compute Campus in Delta (1,400 MW, under construction), QTS Eagle Mountain II (650 MW), Creekstone Delta Gigasite phase 1 (300 MW).
- The brief says data center load adds to peak demand without flexibility for curtailment, and cites NERC projecting elevated grid risk for Utah in 2031.
- 2026 laws: HB 76 (water reporting for new large data centers) and HB 507 (no local incentives for data centers of 100 MW or more outside regionally significant zones). The research found **no 2026 bill on data center load flexibility or curtailment**.

Other context:

- Stratos Project, Box Elder County: 11 data center clusters with a co-located 7.5 GW reciprocating-engine plant; phase 1 is 3 GW, full buildout 9 GW. The developer says it will add no demand to the grid. Source: https://www.ksl.com/article/51637099/stratos-project-water-application-reveals-new-details-on-massive-data-center
- Operation Gigawatt (Gov. Cox, Oct 8 2024) aims to double Utah's power production in 10 years. Source: https://governor.utah.gov/press/news-release-gov-cox-unveils-operation-gigawatt. Example: the 400 MW Green River Energy Center (solar plus storage, Emery County) came online June 2026. Source: https://www.ksl.com/article/51538319/utahs-largest-solar-battery-farm-now-online-in-emery-county
- Transmission: Gateway South (416 miles, 500 kV, Wyoming to Clover near Mona) was completed November 2024. PacifiCorp's 2027 IRP lists Wasatch Front transmission options of about 433 MW by 2029 and 1,098 MW by 2033. Sources: https://www.pacificorp.com/transmission/transmission-projects/energy-gateway/gateway-south.html and https://www.pacificorp.com/content/dam/pcorp/documents/en/pacificorp/energy/integrated-resource-plan/2027-irp/PacifiCorp_2027_IRP_PIM_7.pdf
- Wildfire shutoffs: on Jun 26 2026 Rocky Mountain Power cut power in parts of southern Utah, about 7,735 customers in the event area. The Jun 25 watch areas included Delta, where the largest new data center campus is being built. Source: https://www.rockymountainpower.net/about/newsroom/news-releases/rmp-initiates-public-safety-power-shutoffs-utah.html

### SB 132 and the first large-load contract

- **SB 132 (2025), Electric Utility Amendments, is Utah Code 54-26, effective May 7 2025.** A large-scale request (secondary sources say 100 MW or more within five years) must be served under a PSC-approved large-load contract. The customer pays its incremental costs and posts financial security. The utility has about 90 days to study a request. If it cannot serve, the customer may contract with a large-scale generation provider or build a closed private system. Sources: https://le.utah.gov/Session/2025/bills/enrolled/SB0132.pdf and https://law.justia.com/codes/utah/title-54/chapter-26/part-3/section-301
- **First contract: PSC docket 26-035-05**, filed Feb 10 2026 and approved Apr 10 2026. More than 100 MW of firm service, with no network transmission upgrades needed. Source: https://pscdocs.utah.gov/electric/26docs/2603505/3447332603505oasadmfatmdrao4-10-2026.pdf
  - **The settlement prices the customer's energy hour by hour against EDAM.** System net power costs are reduced each hour by the customer's actual hourly use times the average EDAM price near the load. Rocky Mountain Power buys market energy at first and adds capacity within two years.
  - The customer's tariff is confidential. The customer was not named; the Feb 6 2026 announcement called it a data center. Source: https://www.utahbusiness.com/press-releases/2026/02/06/rocky-mountain-power-advances-utah-operation-gigawatt-landmark-energy-agreement
  - Why it matters: the first Utah large-load contract already ties a data center's hourly cost to the same EDAM price Clearlane reads. That is the pitch's bridge from "price signal" to "contract term". Whether the contract rewards shifting load is not public (UNVERIFIED; tariff confidential).

## 9. PACE headroom for flexible load (DERIVED)

We re-ran the Duke "Rethinking Load Growth" method on one year of PACE EIA-930 demand (Oct 26 2025 to Oct 26 2026, 8,759 hours, 1 bad hour cleaned). This is our implementation, not Duke's code. Headroom is the new load PACE could add without raising its peak, if the new load accepts curtailment in a given share of its hours. Source: `research/analysis/depth/headroom_output.txt` (script `research/analysis/depth/headroom.py`).

| Curtailment rate | Headroom (annual peak ceiling) | Curtailed hours | Events | Hours needing at most 50% curtailment |
|---|---|---|---|---|
| 0.25% | 1,016 MW | 93 | 32 | 88% |
| **0.5%** | **1,265 MW** | 184 (124 in July) | 47 | 90% |
| 1.0% | 1,616 MW | 311 | 58 | 88% |

- With a stricter ceiling (each season's own peak), headroom drops to 359, 500 and 649 MW at the same rates.
- At 0.5% the curtailed hours fall between 11am and 10pm, mostly 2pm to 7pm (HE15-19), and only in June to August.
- The roughly 902 MW of grid-tied data center load under construction would need curtailment in **61 hours a year (22 events, mean 2.8 h, curtailment rate 0.17%)** under the annual ceiling. If all 2,602 MW were grid-tied it would need **827 curtailed hours** (101 events, curtailment rate 3.0%).
- Curtailment rate here means curtailed energy divided by the new load running every hour of the year, as in Duke.
- Cross-check: Duke's Figure 8 shows PACE at about **1.5 GW at 0.5%**. That value was read from chart labels and should be confirmed visually. Duke's 22-area totals are 76 / 98 / 126 GW at 0.25 / 0.5 / 1%. Source: https://nicholasinstitute.duke.edu/sites/default/files/publications/rethinking-load-growth.pdf via `research/notes/prior-art.findings.md`.
- Caveats: one year of data, demand only (no transmission or local substation limits), and EIA-930 demand is a balancing-area total.

## 10. Value of reading the timetable (DERIVED, with ASSUMPTIONS)

`research/analysis/demo-story/habit.py`, re-run 2026-10-26, on the Oct 27 day-ahead prices. ASSUMPTIONS: a 1 MW / 2 MWh battery, 88% round-trip efficiency, and October average CO2 by hour standing in for Oct 27.

| Plan | Charge | Discharge | Value at day-ahead prices | CO2 (average-emissions estimate) |
|---|---|---|---|---|
| Habit | 1-5am | 6-8pm | $20.06 per MW-day | adds 0.262 t per MW-day |
| Timetable | 1-4pm | 6-8pm | $58.41 per MW-day (2.9x) | avoids 0.270 t per MW-day |

- At 70 MW (the size of the January 2025 Torus MOU for C&I demand response, per https://www.utilitydive.com/news/torus-rocky-mountain-power-mou-demand-response-dr/740616): habit $1,405 a day and +18.4 t CO2 a day; timetable $4,088 a day and -18.9 t CO2 a day. These are values to Rocky Mountain Power's system at day-ahead prices, not Torus revenue.
- Why the sign flips: overnight power is coal-heavy (about 698 g/kWh), so charging at night and discharging at 6pm raises average emissions. Charging at 1-4pm (about 450 g/kWh) and discharging at 6-8pm lowers them.

## 11. What the research could not verify

- When CAISO publishes the next day's EDAM prices. We saw Oct 27 prices available at 03:16Z Oct 27 (9:16pm MDT Oct 26). That is an upper bound, not the publish time. The EDAM wind and solar forecast was stamped 16:10Z (10:10am MDT) on Oct 26. Source: `research/notes/data-option1.findings.md`, `research/data/caiso4/`.
- Marginal CO2 for PACE. WattTime's full marginal signal is free only for CAISO_NORTH, and Electricity Maps needs a paid key. All CO2 here is average.
- The Duke PACE figure of about 1.5 GW, which was read from a chart.
- Whether the SB 132 contract (docket 26-035-05) rewards load shifting, since the tariff is confidential. The customer's identity is also not public.
- The Western Resource Advocates figure of about 6,000 MW of Utah data center load in 2030 appeared only in a search summary. The fact sheet (https://westernresourceadvocates.org/wp-content/uploads/2025/08/2025_DataCenter_FactSheet_UT.pdf) lists resources needed by 2038 but the 6,000 MW sensitivity was not found in its text.
- The Schedule 2 1-8pm on-peak window (search summary only).
- The WEIM Nov 1 2014 start date (search summary only).
- The 2025 Torus event heatmap's time zone (not stated, so show Mountain and UTC readings).
- How CAISO labels the 25-hour fall-back day (Nov 1 2026). It falls after judging and nothing here depends on it.
- PACE utility-scale solar locations. We assumed southern Utah and did not check it. This is why Salt Lake City weather is a poor solar proxy.
- Why EIA's PACE demand peak in October lands at 1-2pm (HE14, 6,452 MW) in `research/analysis/pace_analysis_output.txt`, while CAISO's Oct 27 load forecast peaks at 7pm. Not investigated; another sign that EIA and CAISO load are different series.
