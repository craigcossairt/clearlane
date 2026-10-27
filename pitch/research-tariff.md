# Tariff, System Critical Hours, heatmap time zone

Checked Mon Oct 26, 2026, about 12:30am MT. Each claim is verified against the page named, or marked not verified. Quotes stay under 15 words. Nothing here is a stage number until it is a `{key}` in `public/derived/numbers.json`.

Host one-pagers stay in kW. The demand charges below are context for judges, not a bill saving. Clearlane does not show a host dollar figure.

## (a) Rocky Mountain Power Utah Schedules 6, 6A and 8

Verified against the tariff sheets Rocky Mountain Power posts, P.S.C.U. No. 52, Docket No. 26-035-T08, filed August 5, 2026, effective August 10, 2026. The Utah price summary "in effect as of September 25, 2026" matches these base rates. Downloaded Oct 26, 2026.

Sheets:

- Schedule 6: https://www.rockymountainpower.net/content/dam/pcorp/documents/en/rockymountainpower/rates-regulation/utah/rates/006_General_Service_Distribution_Voltage.pdf
- Schedule 6A: https://www.rockymountainpower.net/content/dam/pcorp/documents/en/rockymountainpower/rates-regulation/utah/rates/006A_General_Service_Energy_Time_of_Day_Option.pdf
- Schedule 8: https://www.rockymountainpower.net/content/dam/pcorp/documents/en/rockymountainpower/rates-regulation/utah/rates/008_Large_General_Service_1_000_kW_and_Over_Distribution_Voltage.pdf
- Price summary: https://www.rockymountainpower.net/content/dam/pcorp/documents/en/rockymountainpower/rates-regulation/utah/Utah_Price_Summary.pdf

Index of all posted sheets: https://www.rockymountainpower.net/about/rates-regulation/utah-rates-tariffs.html

These are base rates. Schedule 80 and other riders adjust the bill. A host dollar claim would need those riders. We do not make one.

### Schedule 6, General Service, Distribution Voltage

Loads that have not registered 1,000 kW more than once in the preceding 18 months. No on-peak window. Demand is the 15-minute period of greatest use at any time in the month.

| Charge           | Summer (June-September) | Winter (October-May) |
| ---------------- | ----------------------- | -------------------- |
| Customer service | $58.00 per month        | $58.00 per month     |
| Facilities       | $4.36 per kW            | $4.36 per kW         |
| Power            | $14.49 per kW           | $12.82 per kW        |

### Schedule 6A, Energy Time-of-Day Option

Same availability as Schedule 6. No power charge in $/kW. Demand shows up as Facilities kW inside an energy block: the first 50 kWh per kW, then a lower rate, plus an off-peak credit. Facilities kW is the 15-minute period of greatest use at any time in the month.

On-peak: 6:00 p.m. to 10:00 p.m., Monday through Friday, except holidays. Off-peak: all other times.

Energy charges, cents per kWh:

| Block               | June-September | October-May |
| ------------------- | -------------- | ----------- |
| First 50 kWh per kW | 27.6525        | 24.4712     |
| Additional kWh      | 10.1255        | 8.9606      |
| Off-peak credit     | 2.9695         | 2.6279      |

### Schedule 8, Large General Service, 1,000 kW and over

Facilities kW is the 15-minute period of greatest use at any time in the month. The power charge is on-peak only.

| Charge           | June-September   | October-May      |
| ---------------- | ---------------- | ---------------- |
| Customer service | $76.00 per month | $76.00 per month |
| Facilities       | $5.15 per kW     | $5.15 per kW     |
| Power, on-peak   | $16.84 per kW    | $14.90 per kW    |
| Power, off-peak  | none             | none             |

On-peak hours, Monday through Friday, except holidays:

- October through May: 6:00 a.m. to 9:00 a.m. and 6:00 p.m. to 10:00 p.m.
- June through September: 3:00 p.m. to 10:00 p.m.

### What this means for the pitch

- The 15-minute interval is verified for Facilities kW on all three schedules, and for Power on Schedules 6 and 8. The host ceiling in the demo matches the billing interval.
- Schedule 6 has no time-of-day window. A midday charge sets the same demand charge as a 6pm charge. The host value of Clearlane on Schedule 6 is "the meter does not set a new 15-minute peak," not "charging moved off-peak."
- Schedule 6A's on-peak is 6pm to 10pm weekdays, all year. That is not the 7am to 11pm window in the 2020 ChargePoint filing. The 2020 window is not the current sheet.
- Schedule 8's summer on-peak starts at 3pm, which includes the clear-lane hours the timetable charges in. Winter on-peak includes a morning window the timetable does not use, and 6pm to 10pm, which it does.
- OpenEI's $13.27 and $11.74 per kW are not on the current sheets. Those sheets show $14.49 and $12.82 for Schedule 6 power, plus a separate facilities charge. Do not quote the OpenEI pair.

## (b) System Critical Hours

Not verified as a defined term in any Utah or Wyoming docket.

Checked Oct 26, 2026:

- Utah PSC document search for the exact phrase returned no docket that defines it. Older Utah filings use "critical hours" for loss-of-load studies. That is a different phrase.
- Wyoming PSC search for the phrase returned no match.
- The June 2026 ROWE consolidated comments use the phrase. Torus's section 6.4 says the design document references SCH and that the methodology "remains an area for further development." Torus asks the work group to say whether SCH is a fixed number of highest-stress hours, a probabilistic envelope, or another approach, and says it "does not advocate for a specific SCH definition at this stage." PDF page 12 of https://rowesternenergy.org/wp-content/uploads/2026/06/Consolidated-Spring-Workshop-Comments_06222026.pdf
- WRAP uses "Capacity Critical Hours," a different term, in its Business Practice Manual 104. Not the same phrase.

Say: "our proposed rule for the hours Torus asked ROWE to define." Do not say a Utah or Wyoming commission has defined System Critical Hours.

## (c) Heatmap time zone

Not verified. The chart states no time zone.

Image: https://www.datocms-assets.com/93357/1778881001-vpp-events-rmp.jpg from https://www.torus.co/case-studies/case-studies-rocky-mountain-power

Read Oct 26, 2026. The hour axis is labeled 12am through 11pm. No zone, no offset, no "MT" or "UTC." The bottom row sums to 359, matching the "359 Events" header. Weekday totals Monday to Sunday are 50, 57, 43, 57, 53, 45, 54.

Show both readings. Do not pick one.
