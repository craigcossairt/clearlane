

######## utah-grid
## SUMMARY
Utah's grid has a real, measurable rush hour, and in 2026 it got a public day-ahead price for the first time. I pulled 16 months of hourly EIA-930 data for PacifiCorp East (PACE, which covers Utah, Wyoming and Idaho) and 55 days of CAISO day-ahead prices for PACE.

What the data shows:
- **The evening is the problem.** Summer demand peaks around 4-6pm MDT. The highest hour in my pull was 10,173 MW on Jul 20, 2026. But once solar fades, net load (demand minus solar and wind) peaks at 8-9pm, and fossil share climbs from about 46% at noon to about 73% by 9pm.
- **The expensive hours are the dirty hours.** In July 2026 the 8-9pm hour averaged $46.7/MWh against $19.0 at 8-9am (2.45x). In October, 6-7pm averaged $57.0 against $28.6 at 11am. The priciest 10% of hours ran 76-85% fossil; the cheapest 10% ran 40-52%.
- **Transmission congestion barely shows in the area-wide price** (0.8% of price in July, 6.9% in October). Feeder-level Wasatch Front data is not public. So "when" is strongly provable with public data; "where inside Utah" would need simulated data, labeled as such.

Policy and program context, read on source:
- EDAM went live May 1, 2026 with PacifiCorp; Portland General joined Oct 1.
- Utah's first SB 132 large-load contract (PSC docket 26-035-05, approved Apr 10, 2026; firm service over 100 MW, described as a data center customer) values the customer's energy hour by hour at the EDAM price near the load.
- Data centers: 920 MW operating and 2,602 MW under construction (1,700 MW of that behind the meter or off-grid). A legislative brief calls data center load non-interruptible.
- Rocky Mountain Power already pays for flexibility through Wattsmart Batteries (6,388 batteries, about 37 MW), Wattsmart Business Demand Response ($100/kW listed) and Cool Keeper (269 MW realized).
- **Torus is inside that program.** It is one of two approved commercial battery vendors, has a 70 MW demand-response MOU with Rocky Mountain Power, and logged 137 demand-response events in 2024.
- Wildfire shutoff watches in June 2026 included Delta, where the largest AI campuses are being built.

Implication: one PACE "grid traffic" signal (net load, price, carbon) serves both options. Pitch it as making flexible compute behave like a Torus battery that responds to Wattsmart events.
## IMPLICATIONS
- The two options overlap almost completely in Utah. One PACE grid-traffic signal (net load, the EDAM day-ahead price and fossil share by hour) is Option 1's traffic report and Option 2's when-to-run router. Build one forecast engine with two views.
- Lean on time, not place, inside Utah. Public data proves the 6-9pm rush hour with prices 2-2.5x the midday price at 1.5-2x the fossil share. Locational congestion is nearly invisible at the area-wide level (0.8-6.9% of price), so any within-Utah congestion or feeder map must use simulated data, clearly labeled.
- Strongest Torus hook: Rocky Mountain Power already pays C&I sites to be dispatchable (Wattsmart Batteries, and $100/kW listed for Business DR), and Torus is one of two approved commercial vendors with a 70 MW MOU. Pitch a scheduler that makes AI compute behave like a Torus Station: it shifts deferrable jobs out of 6-9pm, rides the ramp on Spin/Pulse storage, and answers Wattsmart events within seconds.
- Strongest policy hook: Utah's first SB 132 data center contract values the customer's energy hourly at the EDAM price near the load, and the legislative brief calls today's data center load non-interruptible. A demo that says 'this 100 MW campus, made 20% flexible, saves $X and Y tons by moving out of the evening peak' turns that statute into dollars.
- Data plan for a 44-hour build: EIA-930 bulk CSVs for hourly PACE load and fuel mix (free, no key; the API itself needs a key); CAISO OASIS PRC_LMP DAM for ELAP_PACE-APND (free, no key, 30 days per call, rate-limited, intervals in GMT); Open-Meteo for Salt Lake solar and temperature forecasts. Pre-cache everything so the live demo cannot hit a rate limit.
- Good opening stats for the pitch: the 10,173 MW Jul 20 peak hour; the 2.45x evening-to-morning price ratio in July; priciest hours running 85% fossil in October; 2.6 GW of data centers under construction against a roughly 10 GW PACE peak; and the June 2026 shutoff watch that included Delta, where the largest AI campuses are going up.
- Resilience angle for Torus: shutoffs and the evening ramp hit the same rural sites where gigawatt campuses are planned. That makes behind-the-meter storage plus flexible compute a reliability story as well as a cost story.
- On the Nucleus x Startup State $10K bounty's Utah-impact criterion (15%), the local evidence here (PACE data, SB 132, Operation Gigawatt, Delta and Eagle Mountain data centers) scores directly, so one build could be entered for both bounties.
## RISKS
- PACE is a balancing area covering Utah, Wyoming and Idaho (and Wyoming coal and wind), not Utah alone. Say 'PacifiCorp East' in the pitch, not 'Utah's grid', when quoting the hourly mix.
- My carbon figures are average lifecycle intensity using factors I chose, not marginal emissions. A grid-savvy judge may say marginal emissions are what count when you shift load. Label them as estimates, or show fossil share, which comes straight from the data.
- EIA-930 data quality: one implausible 1,137 MW hour (Jan 8, 2026), very flat wind series, and adjusted values used where present. Clean the data before charting.
- The 10,173 MW hour is the maximum in my 16-month pull only. I could not confirm it as an all-time PACE record, so do not call it a record.
- OASIS hour handling: I shifted GMT to MDT (UTC-6) for both windows. DST ends Nov 1, 2026, so any demo data after that needs UTC-7. OASIS also limits a query to under 31 days and throttles requests that come too fast.
- The settlement uses the hourly EDAM price to credit system costs. The customer's actual tariff ('Energy Charges') is confidential, so do not claim the data center pays the EDAM price itself.
- The Business DR $/kW figures and their billing period were read from a page excerpt, and the table structure was ambiguous. Check the page before quoting them.
- The parallel-search MCP hit its free-tier rate limit partway through. Several later facts came through WebSearch summaries (noted as such in the findings): the Nov 2014 WEIM start date, the old 1-8pm Schedule 2 window, and the 6,000 MW data center sensitivity.
## OPEN QUESTIONS
- What exactly is Torus's '500 MW of flexible capacity' PacifiCorp case study: the whole Wattsmart fleet, a target, or Torus assets only? The answer changes how hard we lean on Wattsmart.
- Is 10,173 MW (Jul 20, 2026) an all-time PACE or Rocky Mountain Power record? A Rocky Mountain Power release or a WECC source would settle it.
- Who is the unnamed over-100 MW data center customer in docket 26-035-05, and what share of its load could it shift?
- Is any public feeder- or substation-level loading data available for the Wasatch Front (hosting-capacity maps), so the 'where' view need not be fully simulated?
- Does Rocky Mountain Power publish Wattsmart event timing in real time, or only in annual reports? A live demo would need to simulate the event signal.
- Is there a public marginal-emissions source for PACE (WattTime free tier, Electricity Maps free tier) that satisfies the free and open-data rule without a paid key?
- Does PacifiCorp's 2027 IRP, still in progress, publish a large-load or data center forecast for Utah that we could cite?
## ENDPOINTS
* EIA-930 six-month balance files (hourly demand, forecast, net generation by fuel and interchange per balancing authority) | auth: none | tested: true | Downloaded three files and extracted 11,568 PACE hours from Jul 1, 2025 to Oct 26, 2026, including fuel mix (coal, gas, solar, wind, hydro, geothermal) and day-ahead demand forecast. Time offsets of -7 and -6 confirm local prevailing time. | limits: Large files (31-48 MB each per half-year); the EIA API v2 equivalent needs an API key; some imputed and adjusted columns and occasional bad hours | coverage: All US balancing authorities, including PACE and PACW; hourly; history to 2015/2018; local prevailing time plus UTC columns; files refreshed daily (Last-Modified Oct 26, 2026); data through Oct 25, 2026 at pull time
   req: curl -s -o EIA930_BALANCE_2026_Jul_Dec.csv https://www.eia.gov/electricity/gridmonitor/sixMonthFiles/EIA930_BALANCE_2026_Jul_Dec.csv ; then grep '^PACE,'
* CAISO OASIS PRC_LMP (EDAM and WEIM prices), node ELAP_PACE-APND | auth: none | tested: true | Got 720 July 2026 hours and 600 October 2026 hours. Mean July price $31.01/MWh, with 8-9pm MDT at $46.7 against 8-9am at $19.0. One request for exactly 31 days returned error 1004. | limits: Each query must cover under 31 days; exactly 31 returns error 1004. Returns a zipped CSV; use https with -L. OASIS throttles rapid calls, so space them a few seconds apart. | coverage: Hourly day-ahead prices for PACE since EDAM launch on May 1, 2026, split into energy, congestion and loss parts. Real-time (RTM) WEIM prices go back to 2014. Times in GMT, trading hour in Pacific time.
   req: https://oasis.caiso.com/oasisapi/SingleZip?resultformat=6&queryname=PRC_LMP&version=12&startdatetime=20261001T06:00-0000&enddatetime=20261026T06:00-0000&market_run_id=DAM&node=ELAP_PACE-APND
