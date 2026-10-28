

######## torus-cases-b
## SUMMARY
I read all 14 assigned Torus pages in full: 5 case studies and 9 product or solution pages.

Case studies: four of the five (Central Valley Machine, SilencerCo, National Vision, Cumming) were funded through Rocky Mountain Power's Wattsmart Battery Program, with $0 upfront capital and a monthly subscription. La Diana was funded by a Salt Lake City solar program and a grant. The problems repeat: voltage sags and nuisance trips that scrap parts, and demand charges set by one 15-minute peak. None of the five publishes a system size in kW/kWh or a dollar figure for savings. Outcomes are qualitative, apart from one quoted $30,000 spindle failure at National Vision. Only La Diana describes the grid-side behavior the hackathon prompt is about: Lasso "sharing power back to the surrounding neighborhood when the grid is strained."

Software: Lasso is the energy management software that controls every Torus Station. Torus says its ML models forecast from three inputs: facility load patterns, weather data and grid signals. Lasso routes each event to Spin (the flywheel) or Pulse (the LFP battery), dispatches in under 250ms, and connects to SCADA, DERMS and ADMS through an API library. Utility operators see VPP event performance across the fleet. Overwatch is a staffed 24/7 command center that uses AI anomaly detection and predictive maintenance on millions of data points per system per day. Shield is the security layer; it keeps every station on its own isolated network, with Starlink and LTE links.

The utilities page lines up almost exactly with Option 1. It names the problems as congestion stranding power, peaks outpacing demand response, and capacity outpaced by load. It sells a fleet that serves the host facility between utility dispatch events and redeploys to the next constraint.

Option 2 connects only through two FAQ lines: Spin covering data centers' "AI training cycles," and Pulse scaling "from fab shops to hyperscalers."

Gaps Torus does not advertise on any page I read:
- carbon or marginal-emissions signals as an input
- a grid-wide congestion forecast built from open data
- a recommender for where to site or redeploy assets
- plain-language explanations of dispatch decisions
- quantified results in the case studies
- self-serve sizing
- scheduling of flexible AI compute as a load
## IMPLICATIONS
- Go with Option 1 as the spine. Torus's own utility language (congestion relief, thermal limits, peaks outpacing demand response, dispatchable flexible capacity, non-wires alternative) already reads like the 'rush hour for electrons' brief, so a Torus judge will hear their pitch reflected back with a new capability on top.
- Pitch the build as an add-on that plugs into Lasso's API (SCADA/DERMS/ADMS-style), not as a rebuilt Lasso. Lasso already claims ML forecasting and sub-250ms dispatch, so 'we built an EMS' invites the response that they already have one. Fill an advertised gap instead: a grid-wide 'traffic report' for tomorrow's congestion and rush hour from open data, plus a planner that decides how much charge each simulated Torus Station holds back for the utility's event versus shaving the host facility's own 15-minute peak.
- Add carbon. No page I read lists marginal emissions as a Lasso input, so a 'clean-hour' signal from open fuel-mix data that changes the dispatch plan and reports CO2 avoided is a visible, low-risk addition. It also covers Option 1's 'schedule around clean power' example.
- Use the Option 2 overlap as a second act, not a separate product. Treat a flexible AI training cluster as one more controllable load next to Spin and Pulse: shift or throttle jobs out of the rush hour, and let Spin (which Torus already pitches for 'AI training cycles') absorb the fast power swings. One demo can then answer both prompts.
- Make the demo speak Torus's vocabulary: Torus Station, Spin, Pulse, Lasso, Overwatch, 10C, millisecond response, sub-250ms dispatch, flexible capacity, VPP event, dispatch signal, host facility, load profile, demand limit or ceiling, peak shaving, load shifting, rate schedule, congestion relief, thermal limits, end-of-line feeders, non-wires alternative, IRP gap, 'redeploy to the next constraint', verified performance.
- Fill the case studies' missing numbers. A panel showing simulated kW shaved, demand-charge dollars avoided, MW of feeder relief and CO2 avoided, all labeled as simulated, gives Torus the quantified outcome its marketing does not publish today.
- An optional quick win: a sizing view that takes 15-minute interval data and returns a recommended Spin and Pulse mix and the expected savings. It mirrors the SilencerCo story, where existing-site data models the new Riverton site, but it is less on-theme than congestion, so only build it if time allows.
- Base the simulated fleet on the real program shape: Utah C&I sites (machining, grocery, Class-A office) under an RMP Wattsmart-style partnership, where the utility can call VPP events and the host keeps demand-charge savings between them. This matches four of the five case studies.
## RISKS
- Rebuilding Lasso: Torus already claims AI forecasting, autonomous dispatch, routing between Spin and Pulse, and VPP performance views. A demo framed as 'smart battery dispatch' may read as reinventing their core product rather than adding to it.
- Torus telemetry is proprietary and stations run on an isolated network (Shield FAQ), so every Torus Station in the demo must be simulated and labeled as such. Do not imply integration with customer IT networks; that contradicts Torus's stated security design.
- Do not use Torus logos, copy their branding, or present the demo as a Torus product. Use their vocabulary in the pitch, but brand the project as its own tool.
- Absence on marketing pages is not absence in the product. Lasso may already use carbon or congestion signals internally. Say 'not advertised', never 'Torus lacks'.
- The Torus site contradicts itself (545k vs 582k sq ft; 99% vs 99.9% uptime; Nova vs Station naming). Do not quote these numbers in the pitch without checking, or use the body text rather than the meta descriptions.
- The judging panel is mixed: per the brief, the Torus judge is Torus's events lead, and the others are a CTO, investors and an academic. The story must land without grid expertise, so lead with a visual traffic-report or map metaphor.
- Making Option 2 the main concept risks a weaker link to Torus: compute routing is not a Torus business line, and their only data-center tie is two FAQ sentences.
## OPEN QUESTIONS
- Not read in this task: the RMP '500 MW of flexible capacity' case study (https://www.torus.co/case-studies/case-studies-rocky-mountain-power). It likely explains how the utility dispatches the Wattsmart fleet and is the most relevant unread page for Option 1.
- Not read: the congestion-relief, demand-management, frequency-stability, expanded-capacity, peak-shaving and load-shifting solution pages linked from the utilities and industrial pages. Also unread: any data-center or AI-infrastructure page Torus may have.
- Not read: case studies for American Packaging, SLVECC, JD Machine, Waterford School, Schaeffer Industries and Portland General Electric. One of them may publish actual sizes or savings figures.
- Does Torus publish any public Lasso API docs or data schema we could imitate in our interface? None were linked from the pages I read.
- Which grid signals does Lasso actually use: LMP, utility event calls, frequency, carbon? The pages only say 'grid signals'.
- Under the Wattsmart Battery Program, how much stored energy can RMP call, and how often? This sets the realistic reserve-versus-host-savings tradeoff the planner would model.
- Which open data covers Utah best: EIA-930 for the PacifiCorp East balancing authority, plus Open-Meteo for solar and temperature? I am going on prior knowledge here and did not check either source in this task.
