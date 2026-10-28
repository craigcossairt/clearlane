

######## torus-cases-a
## SUMMARY
I read all six case studies in full, plus Torus's utility, Lasso and news pages, the Rocky Mountain Power (RMP) Wattsmart Battery pages, a 2021 Cadmus study RMP commissioned, and Utility Dive. I also opened the two chart images on the RMP case study and read them.

**The C&I cases (JD Machine, Waterford, Schaeffer, American Packaging, SLVECC)**
- All five are in Utah.
- All five got their system at no capital cost through RMP's Wattsmart Battery Program and pay a monthly subscription.
- All five list the same two problems: demand charges from short spikes they cannot avoid, and power quality (brownouts, voltage sags, nuisance trips, poor power factor).
- None of the six pages gives a kW or kWh size.
- Most outcomes are projections. The page descriptions say these customers "expect" savings. Waterford's 14% is the only percentage.

**The RMP 500 MW case**
- The 500 MW is an MOU ceiling being deployed, not installed capacity.
- RMP's energy management system sends an unplanned dispatch signal when grid frequency drops. Torus ramps in under 20 seconds and holds for about 5 to 6 minutes.
- Torus reports 359 such events in 2025, against 137 in 2024.
- Torus's own hour-by-weekday chart puts events at every hour. The busiest hours are 1am (41 events), 9pm (34) and 1pm (33). The busiest months are April and September, not July.
- So most events are contingency events caused by generator trips across the Western grid. Weather or local load cannot forecast them.

**Where Torus software fits.** Torus Lasso is the control layer. It claims machine-learning forecasting, millisecond dispatch, IEEE 2030.5 links to the utility, and an event-by-event audit log. Torus says smaller utilities let Lasso schedule against forecasts, while large ones send real-time signals.

**Best hackathon fit (my inference):** the dual-use decision every Torus host site faces each hour. The planner would:
- predict the facility's demand-charge peaks and the grid's stress windows (EIA-930 data for PacifiCorp East plus Open-Meteo weather);
- treat frequency calls as random risk, using Torus's published 2025 hour-by-hour pattern as the simulator (labeled simulated);
- decide how much charge to hold for RMP and how much to spend on peak shaving;
- produce a customer savings report and a utility "verified capacity" report.

This maps directly to Option 1. A flexible AI-compute load class would bring in Option 2, since Torus is targeting data centers.
## IMPLICATIONS
- Option 1 ('rush hour for electrons') fits Torus's real workflow best. Torus's whole C&I business sits between a facility's own rush hour (demand-charge spikes) and the grid's rush hour (RMP dispatch). Frame the project as the decision layer between those two.
- Recommended core build is a 'dual-use dispatch planner' for a simulated Torus site. Inputs: a forecast of the facility's peaks, a grid-stress forecast for PacifiCorp East (EIA-930 hourly demand and interchange, plus Open-Meteo temperature and solar for the Wasatch Front), and an hourly probability of an unplanned RMP call. Output: an hourly charge-reservation plan (hold for the utility versus spend on peak shaving), plus two reports: customer savings and utility verified capacity.
- Drive the event simulator from Torus's own published 2025 hour-by-weekday distribution (359 events, about 5-6 minutes each, 19-second ramp), clearly labeled as simulated. Torus judges will recognize their own data. The insight to pitch is that peak and congestion stress can be forecast, while frequency calls cannot and must be reserved for as risk. That speaks to the 'clarity of insight' criterion.
- Use public case-study archetypes as demo personas, labeled simulated and not presented as real customer data: a Wasatch Front precision machine shop (CNC/EDM spikes, brownouts), a steel fabricator (welding/rolling spikes, power factor penalties), a school with geothermal heat pumps, and a 24/7 emergency dispatch center.
- Option 2 overlap: Torus is targeting data centers, where it would smooth AI load. Add a 'flexible compute' load class to the same planner. Movable training jobs shift out of grid-stress windows, and the Torus Station covers ramps and stays available for RMP calls. One stress forecast serves both options.
- Position the project as complementary to Torus Lasso, not as a replacement. Lasso already claims ML forecasting, dispatch and event logging. Pitch an open what-if and planning layer: event-readiness forecasting, customer-facing savings stories, and siting or expansion cases for program managers and IRP filings.
- Make the demo visuals match Torus's own charts (an event ramp trace and an event heatmap) so judges immediately see the link to their operations.
## RISKS
- Case-study outcomes are marketing and mostly projections: page descriptions say customers 'expect' savings, and Waterford's 14% is the only percentage. Do not present them as measured results.
- The 500 MW is an MOU target or deployment in progress, not installed capacity. Say 'up to 500 MW under MOU'.
- There is no public Torus site telemetry, RMP dispatch log or real-time WECC frequency feed (the frequency feed point is unverified). Site loads, event arrivals and battery behavior must be simulated and labeled.
- My reading of the heatmap and monthly chart comes from a marketing image. It has no legend for the yearly comparison and no stated time zone, so the 1 AM peak could be a UTC artifact. Monthly values are approximate.
- Torus pages contain template errors (a stray Schaeffer $25k paragraph on the Waterford page, JD Machine named on the Schaeffer and SLVECC pages). Never attribute the $25k to Waterford.
- Lasso already claims AI forecasting and event logging. A judge may ask what is new, so the pitch needs a sharp answer, such as the explicit utility-versus-customer reservation decision under random calls, made visible.
- RMP demand-charge tariff numbers (for example Schedule 6/8) were not checked in this research. Verify them before using any dollar figure.
- Shawn Grant's title differs between sources (Customer Solutions Director at PacifiCorp on the case study; Wattsmart Program Manager in the March 2025 release). Avoid citing a title, or say 'PacifiCorp's Shawn Grant'.
## OPEN QUESTIONS
- Does RMP give Torus any advance notice or day-ahead indication for any event class (peak management, congestion), or are all 359 events in 2025 unplanned with no notice?
- How much state of charge must a Torus C&I site hold for RMP calls, and who decides: RMP through DBGMS, or Torus Lasso?
- Were the 359 events all frequency/contingency events, or do they include scheduled peak-management and congestion dispatches? The 2024 CEO description (evening loads) and the 2025 heatmap (all hours) point in different directions.
- What time zone does the heatmap use, and why is 1 AM the busiest hour?
- Is the dual-use conflict real for Torus? Has an RMP call ever cost a host site its monthly demand-charge peak? Worth asking a Torus judge at kickoff.
- Would Torus judges prefer the utility-side story (verified capacity, siting) or the customer-side story (savings report, peak protection)? The Torus judge is Torus's events lead, not an engineer, so a crisp visual story matters.
- Is EIA-930 data for PacifiCorp East (PACE) available at hourly granularity with demand forecasts via the free EIA API? Not tested here.
- Is there public RMP feeder or hosting-capacity data for a Utah congestion or siting map? Not researched.
