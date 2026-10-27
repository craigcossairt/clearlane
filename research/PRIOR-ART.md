# Prior art: who else works on this, and how Clearlane differs

For Q&A prep and the pitch lane. Every claim has one source line under it. Tags come from the findings files: `[read-on-source]` (someone read the page), `[ran-it]` (we ran or downloaded it), `[inferred]` (our reasoning), `UNVERIFIED` (not confirmed). Our own computed numbers are tagged with a provenance class (DERIVED, SIMULATED, ASSUMPTION). Repo paths are from the repo root.

Rules that bind this page: say "not advertised", never "Torus lacks"; stations are simulated Torus-style; the fixed overnight schedule is our baseline, not Torus practice; value is "to RMP's system at day-ahead prices", not Torus revenue; CO2 figures are average-emissions estimates.

## Short answer

- **Carbon-aware job routers** move compute to a cleaner place or hour. Published evaluations find the savings modest, and dozens of hackathon entries build the same demo. Clearlane does not move compute at all.
- **Flexible compute** (Emerald AI, Google, the AI Energy Management Alliance) cuts data center load in software. Storage is named as complementary but left open. Clearlane is about the storage Torus already has in the field in Utah.
- **Utility load-flex studies** (Duke, EPRI, Camus) size how much flexible load a grid can absorb. Clearlane works one day ahead and one station at a time.
- **Battery and VPP software** (Stem, Tesla, Fluence, Enel X, Torus Lasso) forecasts and optimizes dispatch. What Clearlane adds is a public, reproducible plan built from the free EDAM day-ahead price for PacifiCorp East, power held open for Rocky Mountain Power's unscheduled calls, a wear price tied to rated cycles, and a published operating envelope, the arrangement Torus asked Western regulators to recognize in June 2026.

## 1. Carbon-aware job routers

- [read-on-source] Sukprasert et al. (EuroSys 2024) studied 123 regions and found practical spatial and temporal shifting savings modest. Simple policies capture most of them, and gains shrink as grids get cleaner.
  Source: https://dl.acm.org/doi/10.1145/3627703.3650079 (via `research/notes/prior-art.findings.md`)
- [read-on-source] A follow-up paper found that average and marginal carbon signals can point to conflicting decisions.
  Source: https://dl.acm.org/doi/10.1145/3632775.3661953 (via `research/notes/prior-art.findings.md`)
- [read-on-source] CarbonScaler reports 51% carbon savings over carbon-agnostic runs by scaling jobs up and down over time.
  Source: https://arxiv.org/abs/2302.08681 (via `research/notes/prior-art.findings.md`)
- [read-on-source] Google's carbon-intelligent computing platform sets next-day hourly capacity limits per cluster from carbon forecasts ("Virtual Capacity Curves").
  Source: https://ieeexplore.ieee.org/abstract/document/9770383 (via `research/notes/prior-art.findings.md`)
- [read-on-source] The Green Software Foundation Carbon Aware SDK (MIT license, v1.8.0, May 2025) offers a Web API and CLI for best time and place. Its data sources are WattTime, Electricity Maps and a static JSON file.
  Source: https://carbon-aware-sdk.greensoftware.foundation/docs/tutorial-extras/configuration (via `research/notes/data-option2.findings.md`)
- [read-on-source] Azure's carbon-aware-keda-operator (MIT) caps Kubernetes KEDA replicas by carbon-intensity thresholds.
  Source: https://github.com/Azure/carbon-aware-keda-operator (via `research/notes/data-option2.findings.md`)
- [read-on-source] WattTime's absolute marginal-emissions data is free to preview only for CAISO_NORTH; history and forecasts are for subscribers. Its 0-100 signal index is free in all covered regions.
  Source: https://docs.watttime.org/ (via `research/notes/data-option2.findings.md`)
- [read-on-source] Electricity Maps' API is paid after a 14-day trial; the free tier is non-commercial. The exact price is UNVERIFIED.
  Source: https://help.electricitymaps.com/en/articles/13335550-how-can-i-access-the-electricity-maps-api-and-are-there-any-restrictions (via `research/notes/prior-art.findings.md`)
- [read-on-source] Hackathon entries converge on one pattern: enter a job and a deadline, get the cleanest region or hour, see CO2 saved. Examples are GridWise AI, GreenOps Autopilot, GreenQueue, GridCarbon Guardian, Eco Router, CACO, clusy.io, VerdantFlow and CarbonHack22 (395 participants). None we found touches storage, power quality, or anything faster than a minute.
  Source: the nine Devpost, GitHub and DoraHacks URLs in `research/notes/prior-art.findings.md`
- [inferred] They look alike because one free carbon API call plus a deadline is enough for a demo, and the hour-scale shift is the part research rates weakest.
  Source: `research/notes/prior-art.findings.md` (inference from the entries plus Sukprasert et al.)

### Our own check: inside EDAM, "when" beats "where" for Utah

We tested the router idea on real day-ahead prices before rejecting it. A 4-hour evening block (5-9pm MDT) at PACE is the baseline. All figures DERIVED from CAISO OASIS day-ahead LMPs.

- Oct 1-27 2026, EDAM PacifiCorp and PGE nodes: moving in place only saves 8%, moving in time only saves 41%, both together save 42%.
  Source: `research/analysis/option2/where_vs_when_output.txt`
- Adding California's SP15 hub: place only 11%, time only 41%, both 57%. July (with SP15): place 13%, time 51%, both 56%.
  Source: `research/analysis/option2/where_vs_when_output.txt`
- PACE was the cheapest of the EDAM PacifiCorp and PGE nodes in 81% of 648 October hours. At PACE's priciest hour of the day, the median gain from moving to the cheapest node was $0.1/MWh, against a median within-PACE daily spread of $23.5/MWh.
  Source: `research/analysis/option2/where_vs_when_output.txt`
- Price and carbon disagree on place: the cheapest node was also the cleanest balancing area in only 15% of October hours (EDAM set).
  Source: `research/analysis/option2/where_vs_when_output.txt`
- October, EDAM set: shifting in time alone cut cost 40% and CO2 25%. Chasing the cleanest area at the same hours cut CO2 47% but raised cost 17%. Median break-even carbon price, PACE vs PACW: $31/t (p25 $5, p75 $84); July $2/t.
  Source: `research/analysis/option2/carbon_tradeoff_output.txt` (a positive printed % means lower than the baseline; the trailing traceback is from an extra block, the tables are complete)
- Caveat: CO2 here is an average-emissions estimate from the EIA-930 fuel mix times IPCC AR5 lifecycle medians taken from a secondary source, with oil and "other" factors as ASSUMPTION. It is not marginal emissions.
  Source: `research/analysis/option2/edam_where_vs_when.py`

## 2. Emerald AI and other flexible-compute work

- [read-on-source] Emerald AI's Phoenix test (256 NVIDIA A100 GPUs at an Oracle site, Salt River Project, under EPRI DCFlex) cut cluster power 25% for 3 hours during a real peak on May 3, 2025, with software only: no hardware changes and no storage.
  Source: https://arxiv.org/abs/2507.00909
- [read-on-source] Emerald's Nature Energy paper says its method needs no on-site generation or storage, and that such resources can add complementary flexibility. Combining them is left open.
  Source: Colangelo et al. 2025, Nature Energy (PDF URL in `research/notes/prior-art.findings.md`)
- [read-on-source] The December 2025 DCFlex test in the UK (EPRI, National Grid, Nebius, Emerald AI) dropped load up to 40% within a minute, and following 5-minute carbon signals cut emissions more than 10%. EPRI's Aurora project targets about 100 MW of flexible AI load in late 2026.
  Source: https://restservice.epri.com/publicattachment/98143
- [ran-it] Emerald's public power-cap sweep shows A100s capped at 300 W keep 86-95% of throughput, depending on workload.
  Source: https://github.com/ai-emerald/emerald-ai-demo-may-2025 (local copy `../clearlane-raw/misc/emerald/dvfs_sweep.csv`)
- [read-on-source] Google first delivered demand response by flexing ML workloads under 2025 agreements with Indiana Michigan Power and TVA, and had signed 1 GW of data center demand response by March 2026.
  Source: https://blog.google/innovation-and-ai/infrastructure-and-cloud/global-network/demand-response-data-center-milestone
- [read-on-source] Emerald AI, Google and NVIDIA launched the AI Energy Management Alliance on Sep 16, 2026. Its toolbox covers shifting workloads, discharging storage and paired generation.
  Source: https://blogs.nvidia.com/blog/ai-energy-management-alliance
- [read-on-source] Microsoft, OpenAI and NVIDIA found AI training power concentrates at 0.2-3 Hz and recommend GPU power smoothing plus rack-level storage, noting that sizing storage for full ramps is costly.
  Source: https://arxiv.org/html/2508.14318v1
- [read-on-source] NVIDIA's GB300 NVL72 power shelves combine a power cap, capacitors (65 J per GPU) and a GPU "power burner"; they cut peak grid demand 30% on a Megatron run.
  Source: https://developer.nvidia.com/blog/how-new-gb300-nvl72-features-provide-steady-power-for-ai/
- [inferred] 65 J per GPU across 100,000 GPUs is about 1.8 kWh, so rack capacitors bridge only sub-second swings.
  Source: arithmetic on NVIDIA's figure, `research/notes/data-option2.findings.md`
- [read-on-source] NERC documented a fault that dropped about 1,500 MW of voltage-sensitive load, mostly data centers, and a data center that produced a 1 Hz forced oscillation. Its May 2026 guideline asks large loads to share ramp limits and use smoothing and rack storage.
  Source: https://www.nerc.com/globalassets/who-we-are/standing-committees/rstc/3_doc_white-paper-characteristics-and-risks-of-emerging-large-loads.pdf
- [read-on-source] An ERCOT deck (Aug 2025) says AI sites can swing from about 40% to 100% load within fractions of a second, and shows a Siemens Energy E-STATCOM as one fix (competing technology for Torus).
  Source: https://www.ercot.com/files/docs/2025/08/13/Impact-of-AI-workload-and-E-Statcom-as-a-mitigation-measure.pdf
- [read-on-source] DOE (May 2026) warns that standard phasor filtering can miss or distort high-frequency AI load oscillations.
  Source: https://www.energy.gov/oe/articles/monitoring-oscillations-large-data-centers
- [read-on-source] Tesla says AI training swings reach 90% of load at up to 30 Hz. xAI took 168 Megapacks for Colossus 2, and Tesla booked $430M of Megapack sales to xAI in 2025.
  Source: https://x.com/Tesla_Megapack/status/1989073638273012133 ; https://www.cnbc.com/2026/01/29/tesla-sold-430-million-worth-of-its-megapack-batteries-to-xai-in-2025.html
- [read-on-source] Academic hybrid storage for AI sites pairs a battery with a supercapacitor (arXiv 2512.08076, 2606.04869), not a flywheel, and includes no compute control.
  Source: https://arxiv.org/abs/2512.08076 ; https://arxiv.org/abs/2606.04869
- [read-on-source] Torus has pitched AI load volatility on a data center page, but its data center pages returned 404 from Aug 4 to Oct 26 2026. Torus does not advertise routing or scheduling compute.
  Source: `research/notes/torus-intel.findings.md`

Where this leaves Clearlane: the AI-load work above is about very large single sites. Clearlane plans the C&I stations Torus has today. The SIMULATED 100 MW campus card (move 25 MW for 3 hours from 6-9pm to 1-4pm, 75 MWh, $2,551 at PACE day-ahead prices) is a Q&A extension, not the core.
Source: `docs/plan/synthesis.json`

## 3. Utility load-flex studies

- [read-on-source] Duke's "Rethinking Load Growth" (Feb 2025) found 76 / 98 / 126 GW of headroom across 22 balancing areas at 0.25 / 0.5 / 1% curtailment, with average events of 1.7 / 2.1 / 2.5 hours; 88% of curtailment hours keep at least half the new load running.
  Source: https://nicholasinstitute.duke.edu/sites/default/files/publications/rethinking-load-growth.pdf
- [read-on-source] Duke's chart puts PACE at about 1.5 GW at 0.5% curtailment. This was parsed from chart labels and is UNVERIFIED visually.
  Source: same Duke PDF, Figure 8 (via `research/notes/prior-art.findings.md`)
- DERIVED: our Duke-style rerun on PACE EIA-930 demand gives about 1,016 / 1,265 / 1,616 MW at 0.25 / 0.5 / 1% with an annual peak ceiling, and 359 / 500 / 649 MW with a seasonal ceiling. At 0.5% (annual), all 184 curtailment hours fall in June to August. Our own implementation, Q&A depth only.
  Source: `research/analysis/depth/headroom_output.txt`
- [read-on-source] EPRI Flex MOSAIC (March 2026) groups flexibility by notice time, duration, frequency, depth, ramp and availability into five classes. We could not extract the class table.
  Source: https://restservice.epri.com/publicattachment/98143 (via `research/notes/prior-art.findings.md`)
- [read-on-source] Camus Energy, encoord and Princeton ZERO Lab describe flexible interconnection with operating limits forecast 48 hours ahead and updated hourly; the site's own controls dispatch batteries or generators to stay under the cap.
  Source: https://www.camus.energy/blog/how-flexible-interconnections-can-help-data-centers-connect-faster-without-overloading-the-grid
- [read-on-source] Rocky Mountain Power's 2025 Utah results: Cool Keeper realized 269 MW over 282 events, 268 of them 5-minute frequency response; Wattsmart Batteries had 6,388 batteries at 35.16 MW; Wattsmart Business DR had 68 sites at 30-31 MW and 10 events.
  Source: https://www.pacificorp.com/content/dam/pcorp/documents/en/pacificorp/environment/dsm/utah/UT_Energy_Efficiency_and_Peak_Reduction_Report_2025.pdf
- [read-on-source] Cadmus (2021) describes RMP's Distributed Battery Grid Management System (DBGMS), tied into RMP's energy management system, with a dashboard to schedule dispatches and set outage reserve (residential batteries held at least 20% state of charge).
  Source: https://www.rockymountainpower.net/content/dam/pcorp/documents/en/rockymountainpower/savings-energy-choices/wattsmart-batteries/Utah_Wattsmart_Battery_Program_Grid_Benefits_Analysis.pdf
- [read-on-source] The first Utah SB 132 large-load contract (PSC docket 26-035-05, approved Apr 10, 2026) credits system net power costs each hour at the customer's hourly use times the average EDAM LMP near the load. It is the closest Utah precedent for valuing load hour by hour at EDAM prices.
  Source: https://pscdocs.utah.gov/ (docket 26-035-05; full URL in `research/notes/utah-grid.findings.md`)
- [read-on-source] Torus's June 2026 comments to ROWE ask regulators to recognize scheduled dispatch programs, utility-directed operating envelopes and aggregated dispatch, and to define System Critical Hours explicitly with stakeholder input.
  Source: https://rowesternenergy.org/wp-content/uploads/2026/06/Consolidated-Spring-Workshop-Comments_06222026.pdf (local copy `../clearlane-raw/dl/wraap.pdf`)

## 4. Battery scheduling and VPP products

- [read-on-source] Stem Athena, Tesla Opticaster and Autobidder, Fluence Mosaic and Enel X DER.OS describe the same recipe: forecast load and prices, then optimize battery dispatch for demand charges, time of use, demand response and markets. None of the materials we read describes a flywheel and battery split or compute control.
  Source: product URLs in `research/notes/prior-art.findings.md`
- [read-on-source] Torus Lasso routes each event between Spin and Pulse, forecasts with machine learning on load, weather and grid signals, dispatches in under 250 ms, and offers an API for SCADA, DERMS and ADMS. Compute integration is not advertised.
  Source: https://www.torus.co/torus-lasso
- [read-on-source] The Pulse FAQ says Lasso schedules charge and discharge automatically.
  Source: https://www.torus.co/torus-nova-pulse (via `research/notes/torus-cases-b.findings.md`)
- [read-on-source] Lasso logs every dispatch (commands, response times, power delivered, availability) as an auditable record for program approvals and IRP filings.
  Source: https://www.torus.co/demand-management
- [read-on-source] Larger utilities send Torus real-time dispatch signals by zone; smaller utilities and co-ops let Torus schedule against forecasts through Lasso.
  Source: https://www.torus.co/congestion-relief
- [read-on-source] The Lasso inputs Torus names are load patterns, weather, rate schedules and grid signals. A carbon input is not advertised on the 14 pages read (an absence on marketing pages, not proof).
  Source: `research/notes/torus-cases-b.findings.md`
- [read-on-source] Published Torus Station specs: Spin 10C and 25,000 cycles, Pulse 0.5C and 7,500 cycles, 25-year life.
  Source: https://www.torus.co/torus-nova
- [read-on-source] In the RMP case study, Torus systems answered 359 VPP events in 2025 with about a 19-second ramp; the primary use is fast frequency response.
  Source: https://www.torus.co/case-studies/case-studies-rocky-mountain-power
- [read-on-source] Flywheel plus battery research splits the power signal by frequency. A TU Darmstadt predictive-control study cut factory peak costs 47% with a perfect forecast, 22.7% with a machine-learning forecast and 14% with a median profile.
  Source: https://www.mdpi.com/1996-1073/18/8/2055
- [read-on-source] TU Graz simulated about 16% more battery life with a flywheel; Barelli et al. report the battery working more than 64% less.
  Source: URLs in `research/notes/prior-art.findings.md` (TU Graz PDF; Springer chapter 10.1007/978-3-031-97755-8_6)
- [read-on-source] Real hybrid plants exist: Almelo, Netherlands (8.8 MW batteries plus 3 MW flywheels, 2020; converted to a 4-hour Tesla battery in 2025) and Schwungrad in Ireland.
  Source: https://www.s4-energy.com/projects/almelo
- [read-on-source] Beacon Power flywheels on NYISO frequency regulation run 3,000-5,000 full cycles a year.
  Source: https://beaconpower.com/stephentown-new-york
- [read-on-source] Counter-evidence on wear: a Vertiv test taking about 20% off each AI load step for over 300 hours found no battery degradation.
  Source: Vertiv article URL in `research/notes/prior-art.findings.md`

## 5. What we considered and set aside

- Four concepts were scored by four judge personas: Clearlane 8.15, RampMeter 7.03, Crossover 6.44, Soft Landing 5.95.
  Source: `docs/plan/verdicts.json`
- Crossover (Spin / Pulse / compute band split for an AI campus) and Soft Landing (route deferrable AI work across EDAM) were set aside. Crossover's headroom card and Soft Landing's where-vs-when card survive as Q&A material.
  Source: `docs/plan/concepts.json`, `docs/plan/synthesis.json`
- The CTO-persona review called the planner a standard arbitrage DP and warned that the baseline could be a strawman, the dollars are wholesale value no host is paid, and the crash test could not fail. The plan answers with grafts from RampMeter: an operating envelope with System Critical Hours, a reserve held in kW not kWh, and a three-policy backtest.
  Source: `docs/plan/verdicts.json`, `docs/plan/synthesis.json`

## 6. How Clearlane differs, exactly

1. **It reads tomorrow's public Western day-ahead market, not a carbon API.** Inputs are the EDAM day-ahead LMP at ELAP_PACE-APND, the CAISO load forecast and the EDAM wind and solar forecast, all free with no key.
   Source: `research/notes/data-option1.findings.md`
2. **It sorts the day into lanes.** Clear hours sit within 25% of the day's range above its low, jam hours within 25% below its high, the rest are shoulder. On Oct 27 the PACE price is $21.38 at 3pm and $55.78 at 6pm, while net load climbs from 604.6 MW at 3pm to 4,259.1 MW at 6pm.
   Source: `docs/plan/synthesis.json`; `research/data/pace_snapshot_2026-10-27.csv`
3. **It plans each simulated Torus-style station in 15-minute steps** (96 steps, 41 state-of-charge levels, 0.5C limit, host 15-minute peak as a hard ceiling, round-trip efficiency 0.88 as an ASSUMPTION).
   Source: `docs/plan/synthesis.json`
4. **It holds power open for RMP's unscheduled calls.** A SIMULATED 330-second call at enrolled kW with a 19-second ramp is replayed against every plan. Holding that reserve in the battery costs about 3.4% (ASSUMPTION: a 25% call). A price-only plan misses 14% to 77% of calls, depending on how the heatmap's unstated time zone is read (Mountain or UTC).
   Source: `research/analysis/demo-story/fix.py`; `docs/plan/synthesis.json`
5. **It prices wear.** A wear price in $/MWh is tuned so the battery stays near 300 full-equivalent cycles a year, which spends Pulse's 7,500 rated cycles over 25 years. We did not find a wear price tied to rated cycles in the product materials we read.
   Source: `docs/plan/synthesis.json`; https://www.torus.co/torus-nova
6. **It publishes the plan as an operating envelope** (schema `clearlane.envelope/v1`) with a proposed System Critical Hours set: the 4 highest net-load hours plus every jam hour. This is our proposal, offered against Torus's own request that SCH be defined. The mapping to IEEE 2030.5 fields is UNVERIFIED.
   Source: `docs/plan/synthesis.json`; ROWE comments (above)
7. **It shows its work against two baselines** over May 1 to Oct 27 2026, with P10 / P50 / P90: a fixed overnight schedule (our simple baseline, not Torus practice) and a price-only plan.
   Source: `docs/plan/synthesis.json`
8. **It states value as value to RMP's system at day-ahead prices.** For 1 MW / 2 MWh: $20.06 per MW-day for the fixed overnight schedule vs $58.41 for the midday timetable (DERIVED, RTE 0.88 ASSUMPTION).
   Source: `research/analysis/demo-story/habit.py`

## 7. What we do not claim

- That Torus lacks any of this. Lasso may do more than its pages advertise.
- That we used real Torus station data. Stations are simulated Torus-style; event counts and ramp come from Torus's published case study.
- That the dollars are Torus or host revenue. They are value to RMP's system at day-ahead prices.
- That 500 MW is installed. It is the ceiling of the RMP agreement, and at 500 MW Clearlane would no longer be a price-taker: that is about 8% of PACE's Oct 27 peak load forecast of 6,024 MW.
  Source: `docs/plan/synthesis.json`; `research/data/caiso3/`
- That the CO2 numbers are marginal. They are average-emissions estimates.
- That we are first to pair storage with flexible load. The AI Energy Management Alliance toolbox already names both.

## 8. Likely questions

- **"Isn't this carbon-aware scheduling?"** No. Those tools move compute. Clearlane plans storage that is already deployed, and our own EDAM check shows that inside PacifiCorp East the hour matters far more than the place.
- **"Doesn't Lasso already do this?"** Lasso schedules and dispatches; that is on Torus's pages. Clearlane is a public, reproducible plan from free market data, plus an envelope format that answers Torus's own June 2026 regulator request. It is built to sit beside Lasso, not to replace it.
- **"How is this different from Autobidder or Athena?"** Those optimize against tariffs and markets for the site owner. Clearlane keeps kW open for the utility's unscheduled calls and prices wear against rated cycles, and it publishes the envelope.
- **"Is the optimizer new?"** No. A dynamic program is the standard tool. What is new for this setting is the reserve rule, the wear price, the crash replay and the envelope.
- **"Would 500 MW move the price?"** Yes, at that scale the price-taker assumption breaks. We say so on screen.
