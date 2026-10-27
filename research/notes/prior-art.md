

######## prior-art
## SUMMARY
The usual entry in this space is a carbon-aware job scheduler: you give it a job and a deadline and it returns the greenest time or region and the CO2 saved. I found at least nine nearly identical ones (GridWise AI, GreenOps Autopilot, GreenQueue, GridCarbon Guardian, Eco Router, CACO, clusy.io, VerdantFlow, CarbonHack22 entries). Research also weakens that pitch. Sukprasert et al. (EuroSys 2024) found the practical savings are modest, simple policies get most of them, and the benefit shrinks as grids get cleaner. Average and marginal carbon signals can also point in opposite directions.

The serious work is already done, and the pieces are held by different players:
- Emerald AI (with Oracle, NVIDIA and EPRI DCFlex) flexes software only: 25% for 3 hours in Phoenix, and up to 40% in under a minute in London.
- Google flexes ML workloads under 1 GW of demand-response contracts.
- Microsoft, OpenAI and NVIDIA smooth training power swings with GPU firmware plus rack storage.
- Tesla smooths with Megapacks and cites Duke's 0.25% curtailment headroom.
- Academic papers split the AI load between a battery and a supercapacitor.
- Torus Lasso already routes each grid event between the flywheel (Spin) and the battery (Pulse).

The open space is a three-way split. No public work I found co-dispatches a fast flywheel, a slower battery and the AI compute itself, with the dividing lines set by the wear cost of each resource. Torus already describes this exact problem on its data-center page (AI swings of tens of MW, sub-synchronous oscillations, Texas SB6 curtailment readiness). The pieces map like this:
- Sub-second swings, which concentrate at 0.2-3 Hz, go to Spin.
- Curtailment events, which average 1.7-2.5 hours in the Duke study, go to Pulse.
- Anything longer goes to the compute: power caps priced with Emerald's public throughput-versus-cap data, or moving and deferring jobs (Option 2).

That design covers Option 1 and Option 2 in one build. It also has a Utah angle: Duke's chart puts PacifiCorp East (Rocky Mountain Power's area) at about 1.5 GW of headroom at 0.5% curtailment.
## IMPLICATIONS
- Do not build a plain carbon-aware job router or a carbon-intensity dashboard. Judges have likely seen many, the research undercuts the savings headline, and it does not touch Torus hardware.
- Build the combined Option 1 plus Option 2 concept as a three-way flexibility stack for an AI campus behind a Torus Station: Spin takes the fast band, Pulse the curtailment-length band, and compute flex (power caps or deferring and moving jobs) takes the rest. That needs both the flywheel and the battery by design, and it extends Torus Lasso's existing split by adding compute, rather than claiming to invent the split.
- Make the headline insight a wear-priced cutoff: one control or slider showing battery equivalent full cycles per year, Pulse lifetime, compute throughput lost, and grid-side spectral and ramp compliance as the split points move. That is a number a Torus judge can take to a sales call.
- Use real data where it exists and label the rest synthetic. Real: Emerald's power-cap sweep for the compute cost curve, Emerald's 1-minute SRP trace, Duke's method on PACE EIA-930 hourly data, Open-Meteo weather for stress-hour forecasts. Synthetic (labeled): a 10-100 Hz training oscillation trace with a 0.2-3 Hz fundamental, because the public traces are 1-minute (Emerald) or 100 ms (MIT Supercloud) at best.
- Frame it in Torus and Rocky Mountain Power language: PACE headroom, Wattsmart virtual power plant events (359 in 2025, less than 1% of hours), Texas SB6 curtailment readiness, sub-synchronous oscillation, fast frequency response. The Utah headroom angle also fits the Nucleus x Startup State bounty (15% of its score is Utah impact).
- A 44-hour build is feasible as a Python simulator plus a web dashboard: filter-based split with an optional small optimizer, cycle counting for the battery, FFT for compliance, and the Duke curtailment calculation for headroom. No hardware or live control is needed.
## RISKS
- Torus Lasso already routes events between Spin and Pulse. Pitching the flywheel/battery split itself as new would be wrong in front of a Torus judge; the new parts are the compute layer, wear pricing and the compliance and headroom analysis.
- The AI Energy Management Alliance (Sep 2026) already frames flexibility as workloads plus storage plus generation, and Tesla's deck already ties batteries to Duke's 0.25% headroom. The concept is not new; only the three-way co-dispatch and the flywheel-specific analysis are.
- The battery-wear argument has contrary evidence: Vertiv saw no degradation over 300+ hours at about 20% smoothing. An honest cycle count may show a smaller benefit than Torus's marketing claims, so present it as a measured result, not a sales pitch.
- S4 Energy's Almelo flywheel-battery hybrid was converted to a 4-hour Tesla battery in 2025. A judge may know of hybrid flywheel projects that did not last.
- High-frequency AI power data is scarce in public. The flywheel band will rest on synthetic data and must be labeled that way per the rules.
- Torus marketing numbers vary across pages (10C, '20x battery power', '10x faster', 'lasts twice as long'). Quote one source per number.
- The Tesla data-center deck is marked 'Proprietary and Confidential' even though it sits at a public Tesla URL. Cite with care, or rely on the Tesla X post and the NERC workshop slides instead.
- Data access: WattTime absolute marginal-emissions data is free only for CAISO_NORTH, the Electricity Maps free tier is non-commercial, and the EIA API needs a free key that I did not register (bulk EIA-930 CSV downloads may avoid the key; not verified).
## OPEN QUESTIONS
- What is the energy capacity (kWh) of one Torus Spin unit? It sets how long the flywheel band can last and where the flywheel-to-battery cutoff can physically sit. Not found on the pages I read.
- Is Torus's 25,000-cycle rating for full cycles, and how does Spin wear under 1-30 Hz micro-cycling?
- Does Torus Lasso already talk to GPU or workload schedulers (Slurm, Kubernetes, GPU power capping)? If it does, the compute layer is less novel. Worth asking the Torus judge.
- Is any public log of Rocky Mountain Power Wattsmart dispatch events available to drive a realistic demo, or must events be synthesized from PACE EIA-930 peaks?
- Can the EIA-930 bulk CSV files for PACE through 2026 be downloaded without an API key? Not tested.
- What are the Flex MOSAIC class definitions (A-E)? The EPRI table did not extract; it is needed to label which class a Torus plus compute site would qualify for.
- Do the public MIT Supercloud or training-power-trace-explorer traces show the 0.2-3 Hz training oscillation clearly enough to drive the flywheel band, or is synthetic data unavoidable?
