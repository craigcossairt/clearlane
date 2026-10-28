# Research index

Everything under `research/`, what it holds, who needs it, and what kind of file it is. Written Mon Oct 26 2026 from a directory walk. If you add a file here, add its line here too.

## Start here

1. `docs/FACTS.md`: every on-stage number with its value, provenance class and source file.
2. `research/TORUS.md`: what Torus publishes (Spin, Pulse, Lasso, Wattsmart, the June 2026 ROWE comments) and what it does not.
3. `research/GRID.md`: PacifiCorp East, EDAM, the 6pm rush hour, prices and CO2.
4. `research/DATA-SOURCES.md`: every feed we pull, its limits, and how to refresh a bundle.
5. `docs/GLOSSARY.md`: plain meanings of the terms you will meet in code, UI copy and Q&A.

Next: `research/PRIOR-ART.md` (landscape for Q&A), `docs/JUDGING.md`, `docs/STRETCH.md`. Plan of record: `docs/plan/synthesis.json`.
These curated files are being written in parallel. If one is missing, fall back to the matching `notes/*.md` summary listed below.
Rules that apply to everything here: provenance classes REAL, DERIVED, SIMULATED, TORUS_PUBLISHED, ASSUMPTION, MEASURED; never invent a Torus fact; no copied page text in git.

## Kinds of file

| Kind | What it means |
|---|---|
| Summary | Short `notes/<topic>.md` from the Oct 26 research sweep: SUMMARY, IMPLICATIONS, RISKS, OPEN QUESTIONS (some add ENDPOINTS). |
| Detailed findings | `notes/<topic>.findings.md`: one claim per line, tagged `[read-on-source]`, `[ran-it]`, `[inferred]` or `[unverified]`, each with its URL or file. |
| Script | Python that produced a number. Run as `python -I <script> <args>`. |
| Script output | Saved stdout of a script, kept so numbers can be checked without rerunning. |
| Raw public data | Small public extracts (CAISO OASIS, EIA) saved as downloaded, or a copy of a public dataset's documentation. |

Lane names: Integration, Engine, Data, UI, Pitch, Science. "All" means every lane.

## Curated docs (in research/)

| File | Kind | What it holds | Lanes |
|---|---|---|---|
| `README.md` | Index | This file. | All |
| `TORUS.md` | Curated summary | Torus products, specs, programs and published numbers, one source per number. | All |
| `GRID.md` | Curated summary | Utah grid and Western market facts (being written in parallel). | All |
| `DATA-SOURCES.md` | Curated summary | Feeds, endpoints, limits and refresh steps (being written in parallel). | Data, Engine, Integration |
| `PRIOR-ART.md` | Curated summary | Landscape of related work and how Clearlane differs, with a citation per claim. | Pitch, Integration, Science |

## notes/

| File | Kind | What it holds | Lanes |
|---|---|---|---|
| `notes/utah-grid.md` | Summary | PACE demand, the evening net-load peak, DA price by hour, fossil share, RMP flexibility programs, SB 132, Utah data centers. | Pitch, Data, Engine |
| `notes/utah-grid.findings.md` | Detailed findings | The claims behind the above: EDAM dates, PACE peak hour, congestion share, Wattsmart incentives, SB 132 contract, data center counts. | Pitch, Data |
| `notes/data-option1.md` | Summary | Option 1 data stack with no keys: CAISO OASIS node ELAP_PACE-APND, EIA-930, PACE.xlsx CO2, Open-Meteo; fetch limits; snapshot plan. | Data, Engine, Integration |
| `notes/data-option1.findings.md` | Detailed findings | Tested endpoints and results: Oct 27 DA prices, LMP components, OASIS 31-day cap and rate limit, EIA CO2 method and units, time-zone handling. | Data, Engine |
| `notes/data-option2.md` | Summary | Option 2 data stack: EIA-930 fuel mix, Open-Meteo, GPU job traces (Alibaba, Azure, Philly), AI power profiles (NLR), carbon APIs. Contains a stray Firecrawl tool banner line that should be cleaned. | Science, Data |
| `notes/data-option2.findings.md` | Detailed findings | NASA POWER lag, NLR rename, PVWatts, AI power-swing research (Microsoft/OpenAI/NVIDIA, NERC, ERCOT, DOE), trace licenses. | Science, Pitch |
| `notes/prior-art.md` | Summary | Carbon-aware routers, Emerald AI, Google, power smoothing, hybrid storage, and the open gaps. Written before the concept was chosen; still mentions the dropped Nucleus bounty. | Pitch, Integration |
| `notes/prior-art.findings.md` | Detailed findings | The claims, with URLs, behind the prior-art summary. Source for `PRIOR-ART.md`. | Pitch, Science |
| `notes/torus-intel.md` | Summary | Torus business model, revenue engine (utility demand response), data center pages going 404, hiring, what to pitch. | Pitch, Integration |
| `notes/torus-intel.findings.md` | Detailed findings | Lasso, the ROWE comments, the Magnetar raise, Creekstone Delta, the 404 pages. | Pitch |
| `notes/torus-cases-a.md` | Summary | RMP case study (359 events, 19 s ramp), five Utah C&I case studies, the RMP to Torus signal path. | Pitch, Engine, UI |
| `notes/torus-cases-a.findings.md` | Detailed findings | The 2025 event heatmap counts by hour and weekday (no time zone stated), event durations, DBGMS, IEEE 2030.5, Wattsmart Business DR. Feeds the event sampler. | Engine, Pitch |
| `notes/torus-cases-b.md` | Summary | Five more case studies and nine product pages: Spin, Pulse, Lasso, Overwatch, Shield, utilities page. | Pitch, Engine |
| `notes/torus-cases-b.findings.md` | Detailed findings | Published specs (Spin 10C, 25,000 cycles; Pulse 0.5C, 7,500 cycles; 25-year life), Lasso inputs, 15-minute demand peak language. | Engine, Pitch, UI |
| `notes/tooling.md` | Summary | What each harness can do (Claude Code, Cursor, Codex, Grok Build, OpenCode, Claude Science). OpenCode is no longer used. | Integration, Science |
| `notes/tooling.findings.md` | Detailed findings | Claims behind the tooling summary, including how Claude Science is enabled and what it produces. | Integration, Science |
| `notes/trellis-eval.md` | Summary | Whether to scaffold from the Trellis template (verdict: stripped subset). | Integration |
| `notes/trellis-eval.findings.md` | Detailed findings | What Trellis wires per harness and which parts fit a 44-hour build. | Integration |
| `notes/data.txt` | Duplicate | Byte-identical concatenation of `data-option1.md` and `data-option2.md` (checked with cmp). Read the `.md` files. | None |
| `notes/other.txt` | Duplicate | Byte-identical concatenation of `prior-art.md`, `tooling.md` and `trellis-eval.md`. Read the `.md` files. | None |
| Alibaba GPU cluster trace docs (2020 README, v2026 schema) | Third-party docs, local only | Verbatim copies kept out of git in `../clearlane-raw/third-party-docs/`. Source: https://github.com/alibaba/clusterdata | Science |

## analysis/ (top level)

| File | Kind | What it holds | Lanes |
|---|---|---|---|
| `analysis/pace_analysis_output.txt` | Script output | From `scripts/pace_analysis.py`: PACE EIA-930 demand Jul 2025 to Oct 2026, the 10,173 MW Jul 20 peak, seasonal stats, net-load ramps, fossil share, EIA forecast error. | Pitch, Data |
| `analysis/lmp_analysis_output.txt` | Script output | From `scripts/lmp_analysis.py`: PACE DA LMP by Mountain hour beginning for July 1-30 and Oct 1-25 2026, daily spreads, congestion counts. | Pitch, Engine, Data |
| `analysis/join_analysis_output.txt` | Script output | From `scripts/join_analysis.py`: price vs fossil share correlation, cheapest and priciest 10% of hours, Jul 20 hourly table. | Pitch, Science |
| `analysis/eia_nokey.txt` | Script output (probe) | EIA API v2 reply to a request with no key (API_KEY_MISSING). Proof the bulk files are the no-key path. | Data |
| `analysis/pvwatts_headers.txt` | Script output (probe) | HTTP headers from a PVWatts v8 DEMO_KEY call (rate limit header 10). | Data |

## analysis/demo-story/ (the stage numbers)

| File | Kind | What it holds | Lanes |
|---|---|---|---|
| `analysis/demo-story/habit.py` | Script | Fixed overnight schedule vs midday timetable for 1 MW / 2 MWh at RTE 0.88 (ASSUMPTION): $20.06 vs $58.41 per MW-day; $1,405 vs $4,088 a day at 70 MW; CO2 per day. Reference the engine must match to the cent. | Engine, Pitch, Integration |
| `analysis/demo-story/numbers.py` | Script | Oct 27 snapshot table with net load, a single-day battery DP, a July/October backtest, crash calls vs a price-only plan, cycle wear, fleet scale-ups, the 100 MW campus shift. | Engine, Pitch |
| `analysis/demo-story/fix.py` | Script | Imports `numbers.py`; cost of holding the call reserve in the battery (about 3.4%), hours a price-only plan cannot answer, wear-price sweep. | Engine |
| `analysis/demo-story/co2.py` | Script | Reads EIA `PACE.xlsx` (stdlib zip and XML) and prints hourly generated-basis CO2 by local hour ending. Needs `../clearlane-raw/eia/PACE.xlsx`. | Data, Science |

## analysis/depth/ (Q&A depth, not on the stage path)

| File | Kind | What it holds | Lanes |
|---|---|---|---|
| `analysis/depth/headroom.py` | Script | Duke-style curtailment headroom on PACE EIA-930 demand (our implementation), annual and seasonal ceiling rules. Uses numpy. | Pitch, Science |
| `analysis/depth/headroom_output.txt` | Script output | About 1,016 / 1,265 / 1,616 MW of headroom at 0.25 / 0.5 / 1% curtailment (annual ceiling), 359 / 500 / 649 MW (seasonal), event months and hours. | Pitch, Science |
| `analysis/depth/bandsplit.py` | Script | SIMULATED 300 MW AI campus at 50 Hz: Spin / Pulse / compute band split, cycle counts, band energy. Uses numpy and scipy. From the set-aside Crossover concept. | Science |
| `analysis/depth/bandsplit_output.txt` | Script output | Crossover sweep table, Pulse life if it absorbs the fast band (about 7 years) vs not (about 19), band rms before and after. | Science, Pitch |
| `analysis/depth/extras.py` | Script | Event calendar for a 902 MW new-load cohort and the cost of raising a GPU power floor at PACE DA prices. Uses numpy. | Science |
| `analysis/depth/extras_output.txt` | Script output | 22 curtailment events for the 902 MW cohort, power-floor costs, Pulse coverage of events. | Science, Pitch |

## analysis/option2/ (where vs when)

| File | Kind | What it holds | Lanes |
|---|---|---|---|
| `analysis/option2/edam_where_vs_when.py` | Script | Compares moving a block in time (within PACE) vs in place (PACW, PGE, SP15) on real DA prices; derived CO2 from EIA-930 mix and IPCC AR5 medians. Also provides the loaders the other two scripts import. | Science, Pitch |
| `analysis/option2/where_vs_when_output.txt` | Script output | October and July results: time-shift saves 41-51%, place-shift 8-13%; PACE cheapest EDAM PacifiCorp/PGE node in 81% of October hours; mean PACE net load by hour. | Pitch, Science |
| `analysis/option2/carbon_tradeoff.py` | Script | Cost vs CO2 for a 4-hour deferrable block under ten policies, and the break-even carbon price PACE vs PACW. | Science, Pitch |
| `analysis/option2/carbon_tradeoff_output.txt` | Script output | The policy tables. A positive "% cost" or "% CO2" means lower than the stay-in-PACE 5-9pm baseline. Ends in a traceback from a final extra block; the tables above it are complete. | Science, Pitch |
| `analysis/option2/step_hours.py` | Script | For each day, which hour holds the largest upward PACE DA price step. | Pitch, Science |
| `analysis/option2/step_hours_output.txt` | Script output | October: 5pm or 6pm on 24 of 27 days, median step $15.1. July: spread from 1pm to 8pm, median $10.1. | Pitch, UI |
| `analysis/option2/oct/...PRC_LMP_DAM...v12.csv` | Raw public data | OASIS DA LMP and components, Oct 1-27 2026, nodes ELAP_PACE, ELAP_PACW, ELAP_PGE, TH_SP15_GEN. | Science, Data |
| `analysis/option2/jul/...PRC_LMP_DAM...v12.csv` | Raw public data | OASIS DA LMP and components, July 2026, nodes ELAP_PACE, ELAP_PACW, TH_SP15_GEN (PGE joined EDAM Oct 1). | Science, Data |

## analysis/scripts/ (research sweep helpers)

| File | Kind | What it holds | Lanes |
|---|---|---|---|
| `analysis/scripts/snapshot.py` | Script | Builds `data/pace_snapshot_2026-10-27.csv` from `caiso2`, `caiso3`, `caiso4`, `caiso5` and Open-Meteo `fc.json` (in `../clearlane-raw/misc/openmeteo`). The model for the data lane's bundle builder. | Data |
| `analysis/scripts/pace_analysis.py` | Script | PACE EIA-930 demand, fuel mix, ramps and forecast error. Writes `pace_analysis_output.txt`. | Data |
| `analysis/scripts/lmp_analysis.py` | Script | PACE DA LMP by hour of day. Writes `lmp_analysis_output.txt`. | Data |
| `analysis/scripts/join_analysis.py` | Script | Joins EIA-930 fuel share with OASIS prices. Writes `join_analysis_output.txt`. | Data |
| `analysis/scripts/cong.py` | Script | Congestion component (MCC) share of LMP from OASIS CSVs. | Data |
| `analysis/scripts/pace930.py` | Script | Quick probe of the latest PACE rows in an EIA-930 file and a rough CO2 intensity. | Data |
| `analysis/scripts/pace_co2.py` | Script | Pulls hourly CO2 columns from `PACE.xlsx` for chosen dates. | Data |
| `analysis/scripts/pace_co2_units.py` | Script | Checks `PACE.xlsx` units (emissions in metric tons, intensity in lb/kWh). | Data |
| `analysis/scripts/xlsx_peek.py` | Script | Lists sheets and headers of an xlsx with the standard library only. | Data |
| `analysis/scripts/html2text.py` | Script | Strips saved HTML pages to text for reading (used on the Torus page snapshots). | Integration |

## analysis/byrd/ (duplicates)

| File | Kind | What it holds | Lanes |
|---|---|---|---|
| `analysis/byrd/t1.txt` | Duplicate | Byte-identical `torus-intel.findings.md` plus `utah-grid.findings.md`. Appears to be input for the CTO-judge review in `docs/plan/verdicts.json` (inferred from the folder name). | None |
| `analysis/byrd/t2.txt` | Duplicate | Byte-identical `data-option1.findings.md` plus `data-option2.findings.md`. | None |
| `analysis/byrd/t3.txt` | Duplicate | Byte-identical copy of `prior-art.findings.md`. | None |

## data/ (small public extracts, all REAL)

| File | Kind | What it holds | Lanes |
|---|---|---|---|
| `data/pace_snapshot_2026-10-27.csv` | Raw public data (joined) | The Oct 27 fixture: 24 rows, `local_mt` is hour beginning MT (1am Oct 27 to midnight), PACE congestion, DA LMP at four nodes, PACE load forecast, EDAM solar and wind forecast, SLC weather. | All |
| `data/caiso1/...PRC_INTVL_LMP_RTM...csv` | Raw public data | Real-time 5-minute PACE LMP and components, Oct 25 07:00-09:00 UTC. | Data |
| `data/caiso2/...PRC_LMP_DAM...v12.csv` | Raw public data | PACE DA LMP, energy, congestion, loss and GHG parts for operating day Oct 27. | Data, Engine |
| `data/caiso3/...SLD_FCST_DAM...csv` | Raw public data | CAISO day-ahead load forecast for 36 areas (PACE, PACW, PGE among them), Oct 27. | Data |
| `data/caiso4/...EDAM_WND_SLR_FORECAST...xml` | Raw public data | EDAM hourly wind and solar forecast for CISO, PACE, PACW and PGE, Oct 27. | Data |
| `data/caiso5/...PRC_LMP_DAM...v12.csv` | Raw public data | DA LMP and components for ELAP_PACE, ELAP_PACW, ELAP_PGE and TH_SP15_GEN, Oct 27. | Data, UI |
| `data/caiso6/...PRC_LMP_DAM....xml` | Raw public data (error) | OASIS error 1004 reply: a query longer than 31 days is refused. | Data |
| `data/caiso7/...PRC_LMP_DAM...v12.csv` | Raw public data | PACE DA LMP for the first EDAM days, from May 1 2026 (552 hours). | Data |
| `data/oasis/dam_jul/...csv` | Raw public data | PACE DA LMP and components, July 2026 (720 hours). | Data, Engine |
| `data/oasis/dam_oct/...csv` | Raw public data | PACE DA LMP and components, Oct 1-25 2026 (600 hours). | Data, Engine |
| `data/oasis/dam_0720/...csv` | Raw public data | PACE DA LMP for Jul 20 2026, the highest-demand day in our pull. | Data, Pitch |
| `data/eia930/PACE_EIA930_BALANCE_2025_Jul_Dec.csv` | Raw public data | PACE rows of the EIA-930 six-month balance file (hourly demand, forecast, generation by fuel, interchange; local hour ending plus UTC). | Data, Science |
| `data/eia930/PACE_EIA930_BALANCE_2026_Jan_Jun.csv` | Raw public data | Same, Jan-Jun 2026. | Data, Science |
| `data/eia930/PACE_EIA930_BALANCE_2026_Jul_Dec.csv` | Raw public data | Same, Jul 1 to Oct 26 2026 (the final row, Oct 26 hour 24, holds only the demand forecast). | Data, Science |
| `data/eia930api/pace_d_df.json` | Raw public data | EIA grid monitor JSON (undocumented, no key): PACE demand, DA forecast, net generation, interchange, UTC, Oct 25-27. | Data |

## Known issues before you rerun anything

- The scripts were written in a scratch folder and copied here. Findings and `docs/plan/*.json` still cite scratch paths. Map them: `scratchpad/research/*_output.txt` is `analysis/`, `SCRATCH/data/caiso*` is `data/caiso*`, `SCRATCH/scripts` is `analysis/scripts`, `scratch-opt2` is `analysis/option2`, `scratch-demo-story` is `analysis/demo-story`.
- Checked Oct 26 2026: `python -I research/analysis/demo-story/habit.py research` (run from the repo root) reproduces $20.06 and $58.41 per MW-day and $1,405 and $4,088 a day at 70 MW.
- `numbers.py` runs its first two sections, then fails at the backtest because it looks for `<root>/oasis/`, which here is `research/data/oasis/`. `fix.py` fails for the same reason.
- `depth/*.py` need numpy (`bandsplit.py` also scipy) and expect full EIA files named `EIA930_BALANCE_*.csv` under `<root>/eia930` and `<root>/data/eia930`. The repo holds PACE-only copies named `PACE_EIA930_*`; the full files are in `../clearlane-raw/eia`.
- `option2/edam_where_vs_when.py` reads EIA from `research/analysis/data/eia930/EIA930_BALANCE_2026_Jul_Dec.csv`, which does not exist here. The LMP loaders work.
- The Alibaba trace docs live in `../clearlane-raw/third-party-docs/`, and the Firecrawl referral banners are trimmed from the data-option notes (done 2026-10-26).

## The local-only raw folder

`~/Code/clearlane-raw` is NOT in git. It holds large files and third-party page snapshots that must not be published with the repo. Every worktree is a sibling of the main checkout, so every lane reaches it at `../clearlane-raw`. Read from it; never copy its page text into git (quotes under 15 words, with the URL, are fine).

| Folder | What is there |
|---|---|
| `torus-pages/` | About 36 MB of saved torus.co HTML: home (current and the Aug 4 2026 Wayback copy), Station, Lasso, Overwatch, utilities, speed-to-power, AI load management, case studies (RMP, SilencerCo, SLVECC), customer stories, two news posts, four job posts. |
| `torus-text/` | Plain-text extracts of the same 22 pages, easier to read. Still third-party text. |
| `eia/` | About 222 MB: full EIA-930 six-month balance CSVs for all balancing areas (2025 Jul-Dec, 2026 Jan-Jun, 2026 Jul-Dec), `eia930_2026H2.csv` (byte-identical to the 2026 Jul-Dec file), and `PACE.xlsx` (75 MB EIA workbook with hourly CO2 for PACE, input to `co2.py`). |
| `event/` | Hackathon slide images: kickoff title (s1), judges (s2), guest speaker (s3), the Nucleus x Startup State bounty we are not entering (s4), judging schedule (s6). No s5 is saved. |
| `dl/` | Misc downloads: Zero Gravity Summit sponsor and energy pages, a 47G hard tech page, a Utility Dive article page, a Fast Company bot-wall page with no content, and `wraap.pdf` / `wraap.txt`: the ROWE consolidated spring workshop stakeholder comments, which include Torus's June 2026 comments (System Critical Hours, operating envelopes). |
| `misc/emerald/` | Emerald AI public demo data: `dvfs_sweep.csv` (GPU power cap vs throughput), `SRP_total_power.csv`, `SRP_0503.csv`. |
| `misc/openmeteo/` | Open-Meteo forecast (`fc.json`, input to `snapshot.py`) and archive (`arch.json`) for Salt Lake City. |
| `misc/` NASA and PVWatts | `nasa_*.json` NASA POWER hourly pulls for SLC (solar lags about 3 months); `pvwatts_slc.json` PVWatts v8 8,760-hour output for a 1 MW SLC array. |
| `misc/ercot/` | ERCOT website dashboard JSON (fuel mix, supply and demand, prices; `todays-outlook.json` is a bot-wall HTML page). |
| `misc/gridstatus/` | Source files, READMEs and PyPI metadata of the gridstatus library, read to learn OASIS and EIA quirks. |
| `misc/emaps/` | Electricity Maps zone list (`zones.json`), fetched without a key. |
