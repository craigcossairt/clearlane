# Torus dossier

The shared brief on Torus for every lane and for Q&A prep. Checked Oct 26, 2026 (Mountain time).

**House rules for this file.** The repo goes public, so nothing here is copied page text. Facts are paraphrased, each with a URL. Section 5 holds the file's one verbatim quote; elsewhere, a few short names of terms Torus uses appear in quotation marks as terms, not as quotes. Every number keeps its provenance class (TORUS_PUBLISHED, REAL, DERIVED, SIMULATED, ASSUMPTION). Anything we could not trace to a source is marked UNVERIFIED.

**Where each fact was read.** The "In hand" column says where the source sits:
- **S**: a local page snapshot in `../clearlane-raw/torus-pages/` (plain text in `../clearlane-raw/torus-text/`). Local only, never in git.
- **R**: read on source during the research sweep. The detail is in `research/notes/` (torus-intel, torus-cases-a, torus-cases-b, utah-grid, prior-art and their `.findings.md` files).
- **R2**: secondary source, a search snippet or a third party quoting Torus. Confirm it before using it on stage.

---

## 1. Company snapshot

| Topic | Fact | Source | In hand |
|---|---|---|---|
| What Torus sells | Torus Station, which combines a flywheel (Spin) with an LFP battery (Pulse), plus Lasso software, Shield security and Overwatch monitoring, all from one vendor. It is sold behind the meter or at the grid edge. | https://www.torus.co/torus-nova | S |
| Business model | Energy as a service by subscription. Through utility partnerships, RMP, Pacific Power and PGE customers pay $0 up front. Pricing starts at $549 a month. | https://www.torus.co/industrial-advanced-manufacturing ; https://www.torus.co/wattsmart | R |
| Where it operates | Its utility partners are Rocky Mountain Power, Pacific Power and Portland General Electric. Its 2026 focus is those three territories. | https://www.torus.co/utility_programs ; https://www.torus.co/news/2025-wrap-up-and-look-ahead-to-2026 | R |
| Leadership | Nate Walkingshaw is CEO and co-founder, and Gilbert Lee is co-founder and CMO. Dan Fermon is COO, Trenton Bond is CTO/CISO, Cara Baldwin is Chief Legal Officer and Head of Product Operations, and Rebecca McOmber is Chief People Officer. Dave Rackham was CXO of Software and Embedded Systems as of Mar 2025. Neil Tiwari of Magnetar sits on the board. | see research/notes/torus-intel.findings.md for the URL of each | R |
| Headcount | It grew from 88 to nearly 200 during 2025 and was a team of about 200 in Feb 2026. It was nearly 300 by Jul 2026. | https://www.torus.co/news/2025-wrap-up-and-look-ahead-to-2026 ; https://www.torus.co/news/rep-celeste-maloy-visits-torus-gigaone-facility-highlighting-american-made-grid-i ; https://www.torus.co/news/torus-gigaone-sets-production-records-six-months-after-coming-online | R, S |
| Factory | GigaOne is in Salt Lake City. Torus gives its size three ways: 540,000 sq ft (Feb 2026 news), 545,000 (Station page body) and 582,000 (Station page FAQ). It was a fifteen-fold expansion over the 37,000 sq ft South Salt Lake site, and the goal is a gigawatt of nameplate capacity a year. | https://www.torus.co/news/rep-celeste-maloy-visits-torus-gigaone-facility-highlighting-american-made-grid-i ; https://www.torus.co/torus-nova ; https://www.torus.co/news/torus-gigaone-sets-production-records-six-months-after-coming-online | S, R |
| Funding | Torus has raised over $267M from investors including Magnetar, Mercado, ICONIQ and Origin Ventures. | https://ats.rippling.com/torus/jobs/51d28630-3b66-442e-a826-249dad4d3153 | S |
| Hiring | 35 roles were open at the research sweep, none in software, data, ML or controls. Two are Overwatch roles. What the "Flexie" department name means is not known. | https://www.torus.co/careers ; https://ats.rippling.com/torus/jobs | S, R |
| Identity | Torus puts security first (the CTO also holds the CISO role) and has a national-security angle. It was a presenting partner of the 2025 Zero Gravity Summit. | https://www.torus.co/news/the-dispatch-security-isnt-a-feature-its-how-we-work ; https://utahpolicy.com/news-release/75237-47g-to-host-annual-zero-gravity-summit | S, R |
| Positioning shift | On Aug 4, 2026 the homepage headline named AI, and the page listed hyperscalers among the customers it serves. The Oct 26 headline drops both and names industries and the grid. Its data-center pages return 404 on the live site (Section 2.7). Why is not known. | https://web.archive.org/web/20260804234758id_/https://www.torus.co/ ; https://www.torus.co/ | S |
| Grid metaphor | In a May 2026 blog post, CTO/CISO Trenton Bond compares the grid to a freeway at 5 pm on a Friday. The aim he describes is to store electrons near the load while the road is clear. | https://www.torus.co/news/the-dispatch-security-isnt-a-feature-its-how-we-work | S |

---

## 2. Products and published specs

All values are TORUS_PUBLISHED marketing claims. None is independently verified.

### 2.1 Torus Station (URL slug `torus-nova`)

| Spec | Value | Source | In hand |
|---|---|---|---|
| What it is | A modular power plant: Spin plus Pulse, with the software, security, monitoring and maintenance built in | https://www.torus.co/torus-nova | S |
| Spin discharge rating | 10C, which Torus says is 20x a traditional BESS | https://www.torus.co/torus-nova | S |
| Cycle life | 25,000 Spin, 7,500 Pulse | https://www.torus.co/torus-nova | S |
| Lifespan | 25 years | https://www.torus.co/torus-nova | S |
| System size | Modular, scales to 100+ MW | https://www.torus.co/torus-nova | S |
| Contract to commissioning | 12-16 weeks | https://www.torus.co/torus-nova | S |
| Uptime | Designed for 99.9% (the page meta description still says 99%) | https://www.torus.co/torus-nova | S, R |
| Response time | Milliseconds (the meta description says sub-250ms) | https://www.torus.co/torus-nova | S, R |
| Certifications | UL 9540, UL 9540A, UL 1741 SB, UL 1973, UN 38.3, IEEE 1547, UL 1741 SA, IEEE 2030.5 | https://www.torus.co/torus-nova | S |
| Install outage | A brief scheduled outage, about 2 hours, to connect to the line-side bus | https://www.torus.co/torus-nova | S |
| Naming | The meta text still says "Torus Nova". The product line appears to have been renamed Station, Spin and Pulse. | https://www.torus.co/torus-nova | S, R |

### 2.2 Torus Spin (flywheel)

| Spec | Value | Source | In hand |
|---|---|---|---|
| Rating | 10C; 20x the power-to-energy ratio of a traditional BESS | https://www.torus.co/torus-flywheel | R |
| Full discharge | 6 minutes | https://www.torus.co/torus-flywheel | R |
| Discharge and recharge | 12 minutes, for loads that spike in series | https://www.torus.co/torus-flywheel | R |
| Cycle life | 25,000; zero capacity degradation | https://www.torus.co/torus-flywheel | R |
| Uses named | Flattening the highest 15-minute peak each billing cycle; voltage sag correction; per the FAQ, AI training cycles at data centers | https://www.torus.co/torus-flywheel | R |
| Recognition | R&D 100 winner; on a Time best-inventions list | https://www.torus.co/torus-flywheel | R |
| Homepage claim | 20x the power of a battery, absorbing the sharp events that wear chemistry down | https://www.torus.co/ | S |
| kWh per unit | Not published. We could not find it on any page read (UNVERIFIED). | n/a | n/a |
| Clearlane derivation | 10C means a full discharge in 0.1 hour, so we size Spin at 0.1 kWh per enrolled kW. This is DERIVED, not a Torus spec. | our arithmetic | n/a |

### 2.3 Torus Pulse (LFP battery)

| Spec | Value | Source | In hand |
|---|---|---|---|
| Rating | 0.5C | https://www.torus.co/torus-nova-pulse | R |
| Cycle life | 7,500 | https://www.torus.co/torus-nova-pulse ; https://www.torus.co/torus-nova | R, S |
| Form | Pre-assembled pods that scale from fab shops to hyperscalers | https://www.torus.co/torus-nova-pulse | R |
| Role with Spin | Spin absorbs spikes so Pulse can discharge steadily, which means less battery repowering | https://www.torus.co/torus-nova-pulse | R |
| Uses named (FAQ) | Peak shaving, load shifting, power factor correction, backup, voltage correction, capacity expansion, demand response | https://www.torus.co/torus-nova-pulse | R |
| How it is scheduled | Per the FAQ, Lasso schedules charge and discharge from facility load, rate schedules and grid signals | https://www.torus.co/torus-nova-pulse | R |
| Size range (old "Nova Pulse" name) | 270 kWh to 2.2 MWh, expandable to 40 MWh, per Utility Dive citing Torus's site | https://www.utilitydive.com/news/torus-rocky-mountain-power-mou-demand-response-dr/740616 | R2 |
| Clearlane derivation | 7,500 cycles over 25 years is about 300 a year. This is DERIVED, our arithmetic; Torus may rate or repower differently. | our arithmetic | n/a |

### 2.4 Torus Lasso (software)

| Claim | Value | Source | In hand |
|---|---|---|---|
| Role | The software layer that controls every Station; predicts facility demand and grid conditions | https://www.torus.co/torus-lasso | S |
| Speed | Millisecond data refresh; sub-250ms dispatch; 99.9% asset uptime | https://www.torus.co/torus-lasso | S |
| Forecast inputs | ML models on facility load patterns, weather data and grid signals | https://www.torus.co/torus-lasso | S |
| Routing | Routes each event to Spin or Pulse ("true DER orchestration") | https://www.torus.co/torus-lasso | S |
| Integration | API library to SCADA, DERMS, ADMS and more | https://www.torus.co/torus-lasso | S |
| Operation | Runs autonomously; adjusts from facility patterns, rate schedules and grid signals (FAQ) | https://www.torus.co/torus-lasso | S |
| Access | Role-based: a facility sees its own site, and utility operators see and control the whole fleet | https://www.torus.co/torus-lasso | S |
| Fleet scheduling | AI-driven dispatch and scheduling across distributed fleets (Station page tile) | https://www.torus.co/torus-nova | S |
| Event audit log | Logs every dispatch event: commands, response times, power delivered, availability | https://www.torus.co/demand-management | R |
| Forecast scheduling | Large utilities send real-time signals to zones; smaller utilities and co-ops let Torus schedule against forecasts | https://www.torus.co/congestion-relief | R |

### 2.5 Torus Shield (security)

| Claim | Value | Source | In hand |
|---|---|---|---|
| Controls | Zero Trust access; Layer 7 stateful firewall with IDS/IPS; TLS 1.3 and AES; endpoint detection and response; 4K cameras with AI motion analysis; tamper sensors | https://www.torus.co/torus-nova-shield | R |
| Alignment stated | IEC 62443, NERC CIP, NIST 800-171, CMMC | https://www.torus.co/torus-nova-shield | R |
| Comms | Starlink with LTE failover, on Torus's own isolated network. The only link to the host facility is electrical. | https://www.torus.co/torus-nova-shield | R |
| Attack surface | Torus says command and control has no internet-facing attack surface | https://www.torus.co/torus-nova | S |

### 2.6 Torus Overwatch (monitoring service)

| Claim | Value | Source | In hand |
|---|---|---|---|
| What it is | Certified operators and analysts in the Torus Overwatch Command Center, using AI-powered tooling | https://www.torus.co/torus-overwatch | S |
| Scale | Millions of data points per system per day; sub-second behavioral analysis | https://www.torus.co/torus-overwatch | S |
| Coverage | Hardware, firmware, software, cybersecurity, physical security; rotor dynamics in Spin, voltage and thermal behavior in Pulse | https://www.torus.co/torus-overwatch | S |
| Grid support | Checks that each station responds to frequency or voltage variations on time; operators step in when one underperforms | https://www.torus.co/torus-overwatch | S |

### 2.7 Other offers and pages

| Item | What Torus says | Source | In hand |
|---|---|---|---|
| Torus Station Core | Listed on RMP's Wattsmart Battery residential qualifying list. RMP's commercial list names Torus and Sonnen. | https://www.rockymountainpower.net/savings-energy-choices/wattsmart-battery-program.html | R |
| Utilities page | Congestion relief, distributed capacity, demand management, frequency and voltage support. Torus says it can deploy 200 MW in 12 months, at 12-16 weeks per install, ramping to full power in under 30 seconds, and positions itself as a non-wires alternative. It compares 10C with a typical battery at 0.5C. | https://www.torus.co/utilities-electrical-utilities | S |
| Frequency stability | Full discharge in under 20 seconds after a utility signal (search excerpt only) | https://www.torus.co/frequency-stability | R2 |
| Industrial pages | Demand charges are billed on the single highest 15- or 30-minute interval; storage sets a demand ceiling. On-peak rates run 2-4x off-peak. Target sites run 500 kW to 15 MW peak. | https://www.torus.co/industrial-landing-page ; https://www.torus.co/industrial-advanced-manufacturing | R |
| Utility programs | Peak demand charges are about 50% of a C&I bill | https://www.torus.co/utility_programs | R |
| AI load management (404 live) | GPU swings of tens of MW in seconds; damping sub-synchronous oscillations; 10C; an ERCOT and Texas SB6 compliance claim | https://web.archive.org/web/20260806id_/https://www.torus.co/ai-load-management | S (archive copy) |
| Speed to power (404 live) | A 12-week install; behind-the-meter headroom while interconnection queues run 18-36 months; substation deployments to free capacity | https://web.archive.org/web/20260806id_/https://www.torus.co/speed-to-power | S (archive copy) |
| Data-centers page (404 live) | 800V DC native design; a claim that AI workloads wear out chemical batteries in 3-5 years; a flywheel UPS page also existed | https://www.torus.co/data-centers-industry ; https://www.torus.co/ai-ups | R |
| Availability | Those data-center pages returned 200 in the Wayback Machine from May to Aug 6, 2026 and return 404 on the live site now | web.archive.org CDX; live check | R |

---

## 3. Rocky Mountain Power, Wattsmart Battery, and Torus's 2025 record

### 3.1 The program

- **The utility.** Rocky Mountain Power serves 1.2 million customers in Utah, Wyoming and Idaho (https://www.torus.co/case-studies/case-studies-rocky-mountain-power, S).
- **Torus's place in it.** In March 2025 Torus became one of two approved commercial vendors for Wattsmart Battery, for systems of 30 kW to 1.2 MW. It passed IEEE 2030.5 certification with 30-second interval telemetry at 99% telemetry uptime (https://www.torus.co/news/torus-receives-commercial-energy-storage-approval-for-rocky-mountain-power-s-watt, R).
- **Incentives.** Commercial batteries get $200/kW up to 30 kW. Larger systems need pre-approval and a custom offer (https://www.rockymountainpower.net/savings-energy-choices/wattsmart-battery-program.html, R). The Torus case studies say RMP covers the full upfront cost, so Torus-scale deals look custom (inferred).
- **Program size, 2025 Utah report.** 6,388 batteries and 35.16 MW potential at site, or 37.39 MW at generation (https://www.pacificorp.com/content/dam/pcorp/documents/en/pacificorp/environment/dsm/utah/UT_Energy_Efficiency_and_Peak_Reduction_Report_2025.pdf, R). The report does not say whether Torus's C&I fleet is in that count.
- **Signal path (inferred).** RMP's EMS sends to its Distributed Battery Grid Management System, then over IEEE 2030.5 to Lasso and the Station. No single page states this chain for Torus. RMP's DBGMS dashboard can schedule dispatches and set a battery reserve; this comes from a 2021 Cadmus study of residential batteries (https://www.rockymountainpower.net/content/dam/pcorp/documents/en/rockymountainpower/savings-energy-choices/wattsmart-batteries/Utah_Wattsmart_Battery_Program_Grid_Benefits_Analysis.pdf, R).
- **Event types.** Frequency events last about 5 minutes. Contingency reserve events run 15-30 minutes; that figure is stated for RMP's Cool Keeper program (https://pscdocs.utah.gov/electric/25docs/2503536/339923RdctdRMPDSM2024EnrgyEfcncyPkLdRdctnRprt5-27-2025.pdf, R).
- **Daily cycling.** The Wyoming DSM plan allows Wattsmart Battery dispatch for daily load cycling, along with DR, reserves and backup, every day of the year (https://www.rockymountainpower.net/content/dam/pcorp/documents/en/rockymountainpower/savings-energy-choices/wattsmart-business/wyoming/WY_3-Year_DSM_Plan.pdf, R). The Utah plan does not say so.
- **A separate program.** Wattsmart Business Demand Response with Enel X is load curtailment, not batteries (https://www.rockymountainpower.net/savings-energy-choices/business/demand-response.html, R).
- **How Torus describes RMP's VPP.** On the case study, Torus cites the U.S. Department of Energy as calling RMP's VPP one of the most advanced in the country (S).

### 3.2 MOU sizes

| Date | Size | Source | Note |
|---|---|---|---|
| Jan 27, 2025 | 70 MW C&I demand-response MOU, announced at Utah Tech Week and tied to Operation Gigawatt | https://www.businesswire.com/news/home/20250127668054/en/Rocky-Mountain-Power-and-Torus-Announce-Strategic-Partnership | R |
| Sept 2025 | Expanded to up to 500 MW; the 70 MW was filled within six months | https://www.torus.co/news/torus-raises-200-million-from-magnetar-deployment-of-modular-power-plants | R |
| Case study | Describes 500 MW of flexible capacity as being deployed | https://www.torus.co/case-studies/case-studies-rocky-mountain-power | S |

**500 MW is a ceiling under the MOU, not installed capacity.**

### 3.3 Torus's event record

| Fact | Value | Source | In hand |
|---|---|---|---|
| Events in 2025 | 359 VPP events (case study); more than 360 unplanned events (wrap-up post) | https://www.torus.co/case-studies/case-studies-rocky-mountain-power ; https://www.torus.co/news/2025-wrap-up-and-look-ahead-to-2026 | S, R |
| Events in 2024 | 137 | https://www.torus.co/news/torus-receives-commercial-energy-storage-approval-for-rocky-mountain-power-s-watt | R |
| PacifiCorp's view | PacifiCorp's Shawn Grant: commercial Torus sites were dispatched 520 times over 18 months, all unscheduled, and answered every call | https://www.torus.co/case-studies/case-studies-rocky-mountain-power | S |
| Primary use case | Fast frequency response. When frequency drops, RMP sends an unplanned dispatch signal and Torus ramps to full power in seconds. | https://www.torus.co/case-studies/case-studies-rocky-mountain-power | S |
| Ramp | Under 20 seconds, with a target power of about 100% | https://www.torus.co/case-studies/case-studies-rocky-mountain-power | S |
| How often | Less than 1% of hours a year | https://www.torus.co/case-studies/case-studies-rocky-mountain-power | S |
| Uptime | 99.9% (case study); 99.99% (wrap-up post) | same two URLs | S, R |
| Event trace image | 19 s ramp against a 30 s target; 102% delivered against a 90-100% band; 3,828 kW effective against a band of 3,349.14-4,093.39 kW. The event runs from about 1:00 to about 1:05:30 AM. The kW axis (0-400) does not match the 3,828 kW label. | https://www.datocms-assets.com/93357/1778882593-unplanned-ffr-rmp-1.jpg | R |
| 2024 description | The CEO told Utility Dive that program events mostly managed late-afternoon and evening load | https://www.utilitydive.com/news/torus-rocky-mountain-power-mou-demand-response-dr/740616 | R |

### 3.4 The 2025 event heatmap: by hour and by weekday

Source: Torus's "VPP Event Time Slots" image on the RMP case study, https://www.datocms-assets.com/93357/1778881001-vpp-events-rmp.jpg (R). Both rows sum to 359.

**The source states no time zone.** Always show both readings. The "If UTC" columns are our arithmetic: MDT is UTC-6 (Mar 9 to Nov 2, 2025) and MST is UTC-7.

| Label on chart | Events | If Mountain | If UTC, as MDT | If UTC, as MST |
|---|---|---|---|---|
| 12am | 9 | 12am | 6pm | 5pm |
| 1am | 41 | 1am | 7pm | 6pm |
| 2am | 5 | 2am | 8pm | 7pm |
| 3am | 4 | 3am | 9pm | 8pm |
| 4am | 1 | 4am | 10pm | 9pm |
| 5am | 3 | 5am | 11pm | 10pm |
| 6am | 4 | 6am | 12am | 11pm |
| 7am | 14 | 7am | 1am | 12am |
| 8am | 23 | 8am | 2am | 1am |
| 9am | 26 | 9am | 3am | 2am |
| 10am | 25 | 10am | 4am | 3am |
| 11am | 20 | 11am | 5am | 4am |
| 12pm | 15 | 12pm | 6am | 5am |
| 1pm | 33 | 1pm | 7am | 6am |
| 2pm | 19 | 2pm | 8am | 7am |
| 3pm | 14 | 3pm | 9am | 8am |
| 4pm | 14 | 4pm | 10am | 9am |
| 5pm | 8 | 5pm | 11am | 10am |
| 6pm | 6 | 6pm | 12pm | 11am |
| 7pm | 4 | 7pm | 1pm | 12pm |
| 8pm | 5 | 8pm | 2pm | 1pm |
| 9pm | 34 | 9pm | 3pm | 2pm |
| 10pm | 24 | 10pm | 4pm | 3pm |
| 11pm | 8 | 11pm | 5pm | 4pm |

| Weekday | Mon | Tue | Wed | Thu | Fri | Sat | Sun |
|---|---|---|---|---|---|---|---|
| Events | 50 | 57 | 43 | 57 | 53 | 45 | 54 |

**Why the reading matters (DERIVED).**
- Under the Mountain reading, the hours beginning 5pm, 6pm and 7pm hold 18 events, the quietest stretch of the day.
- Under the UTC reading, read as MDT, the same Mountain hours hold 58, and the 1am peak becomes 7pm MDT. That fits the CEO's 2024 description of evening events.
- We cannot tell which is right. Question 3 in Section 9 asks Torus.

**Monthly chart (approximate).** The same image has a "VPP Events Yearly Comparison" bar chart with two series and no legend. The darker series, which we read as 2025, sums to about 356. Read off the bars:

| Jan | Feb | Mar | Apr | May | Jun | Jul | Aug | Sep | Oct | Nov | Dec |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 4 | 13 | 35 | 49 | 41 | 34 | 16 | 36 | 54 | 38 | 22 | 17 |

The peaks fall in April and September, not July. The year labels are our inference.

**What the record implies (inferred).** Most 2025 events look like unplanned frequency or contingency events. Weather or local load cannot predict them, so Clearlane treats calls as random risk and holds the reserve in power (Spin), not in a scheduled block of energy.

---

## 4. Case studies

None of the C&I pages gives a system size in kW or kWh. Most outcomes are worded as expected or qualitative, not measured. All are TORUS_PUBLISHED.

| Customer | One line | URL | In hand |
|---|---|---|---|
| Rocky Mountain Power | Utility, UT/WY/ID: 500 MW of flexible capacity being deployed, 359 events in 2025, fast frequency response | https://www.torus.co/case-studies/case-studies-rocky-mountain-power | S |
| JD Machine | Pleasant View precision machining: brownouts halting EDMs and CNC spikes; critical-load backup, up to 15 minutes of backup per meter; Wattsmart, $0 capital | https://www.torus.co/case-studies/case-studies-jd-machine | R |
| Waterford School | Sandy K-12 school: an all-electric science building with heat pumps and VFD HVAC; demand charges cut an average of 14% a month (the headline says 14% bill savings, an inconsistency) | https://www.torus.co/case-studies/the-waterford-school | R |
| Schaeffer Industries | Lindon steel fabricator: demand spikes from welding, cutting and rolling, plus power factor penalties; headline of 0 nuisance trips. Schaeffer supplies the steel for Torus Stations. | https://www.torus.co/case-studies/case-studies-schaeffer-industries | R |
| American Packaging Corp | Cedar City lamination plant: overlapping equipment peaks and brownout shutdowns; custom-sized across two meters | https://www.torus.co/case-studies/case-studies-american-packaging-corporation | R |
| SLVECC | West Valley 911 center for 19 agencies, open 24/7: voltage sags and demand spikes; headline of 0 power quality faults. The page meta title wrongly reads JD Machine. | https://www.torus.co/case-studies/case-study-slvecc | S |
| Central Valley Machine | Logan precision machining: nuisance trips scrapping parts; voltage correction across two buildings | https://www.torus.co/case-studies/case-studies-central-valley-machine | R |
| SilencerCo | West Valley City suppressor maker running nearly 24 hours a day: peaks, sags and low power factor. Data from this site is a model for sizing its new Riverton site. | https://www.torus.co/case-studies/case-studies-silencerco | S |
| La Diana Market | SLC west-side grocery: cold-chain backup; Lasso shares power back to the neighborhood when the grid is strained. Funded by an SLC solar program and a grant, not Wattsmart. | https://www.torus.co/case-studies/case-study-la-diana | R |
| National Vision | South Salt Lake lens maker: voltage swings up to 15% damaging spindles; one quoted $30,000 spindle failure; Spin provides ride-through | https://www.torus.co/case-studies/case-study-national-vision | R |
| Cumming Capital Management | Sandy Class-A office pair: voltage instability shutting down HVAC and tenant IT; one system per building | https://www.torus.co/case-studies/case-study-cumming | R |
| Creekstone Delta (third party) | A behind-the-meter AI data-center campus in Delta, Utah. It names Torus as its grid stability partner and says "Torus Load Smoothing" was installed Dec 29, 2025. | https://www.creekstone.energy/delta | R |

**Do not cite these:**
- The landing page at https://www.torus.co/case-studies (S) shows three cards that link to placeholder pages (`fpo-case-study-3`, `-4`, `-5`). They are a POWDR Snowbird card with "100% uptime" and an Ash Grove card with "$3.7M estimated monthly savings". The live list of 11 is at https://www.torus.co/customer-stories (S).
- The Waterford page carries a stray paragraph with Schaeffer's projected $25,000 a year in demand-charge savings. Never attribute it to Waterford.

---

## 5. Torus's June 2026 comments to ROWE

**What and where.** Torus filed a comment letter dated Jun 12, 2026 with the Regional Organization for Western Energy (ROWE). It responds to ROWE's resource adequacy program design for the EDAM and WEIM footprint. ROWE posted it in a consolidated comments file dated Jun 22, 2026: https://rowesternenergy.org/wp-content/uploads/2026/06/Consolidated-Spring-Workshop-Comments_06222026.pdf (local copy `../clearlane-raw/dl/wraap.txt`, S).

**This is a regional filing, not a Utah PSC docket.** Say "Torus's June comments to the Western resource adequacy program (ROWE)", never "Torus asked Utah regulators". Whether Torus made a matching Utah filing is UNVERIFIED.

**What Torus asks for (paraphrased):**
1. Treat controllable hybrid energy storage as a distinct resource class.
2. Accredit resources on their controlled dispatch profile.
3. Set behind-the-meter dispatchability standards that count three arrangements as dispatchable: scheduled dispatch programs, utility-directed operating envelopes and aggregated dispatch arrangements.
4. Base deliverability studies on controlled dispatch, not on worst-case uncontrolled export.
5. Address front-of-meter hybrid storage explicitly.
6. Calibrate the demand response program design to modern controllable resources.

**System Critical Hours (SCH).** Torus asks ROWE to define SCH explicitly and transparently, with stakeholder input. That means saying whether SCH is a fixed count of the highest-stress hours or a probabilistic envelope, whether it varies by season, and how it is updated. **Torus says it does not advocate a specific SCH definition.** So Clearlane's SCH method is ours (DERIVED) and must be labeled that way, not as Torus's or ROWE's.

**The one verbatim quote in this file.** Torus asks the program to "Define BTM dispatchability standards that recognize scheduled and utility-directed operating envelopes" (Torus, ROWE comments, Jun 2026, URL above).

**Terms the letter uses** (usable on stage as terms): "controllable hybrid energy storage", "controlled dispatch", "scheduled dispatch programs", "utility-directed operating envelopes", "aggregated dispatch arrangements", "System Critical Hours".

**Other facts in the letter.** Torus says it has deployments in the PacifiCorp and Portland General Electric territories. In a footnote, it defines "hybrid energy storage system" to include battery-plus-flywheel.

**How Clearlane maps to it.** The `clearlane.envelope/v1` export is a worked example of a utility-directed operating envelope: hourly reserve kW, maximum charge and discharge kW, and shaded SCH hours. That is evidence Torus could bring to the docket, not something Torus endorsed.

---

## 6. News, funding and milestones

| Date | Event | Source | In hand |
|---|---|---|---|
| Apr 2024 | A $67M package of equity, converted notes and a loan facility | https://yespress.io/torus | R2 |
| 2024 | 137 DR events; <250 ms response; 8.7 s round trip | https://www.torus.co/news/torus-receives-commercial-energy-storage-approval-for-rocky-mountain-power-s-watt | R |
| Jan 27, 2025 | 70 MW MOU with RMP | https://www.businesswire.com/news/home/20250127668054/en/Rocky-Mountain-Power-and-Torus-Announce-Strategic-Partnership | R |
| Mar 2025 | Approved as one of two commercial Wattsmart Battery vendors, 30 kW to 1.2 MW | https://www.torus.co/news/torus-receives-commercial-energy-storage-approval-for-rocky-mountain-power-s-watt | R |
| Sept 2025 | $200M from Magnetar; MOU expanded to up to 500 MW. A correction changed "have adopted" to "are designing" for several named customers. | https://www.torus.co/news/torus-raises-200-million-from-magnetar-deployment-of-modular-power-plants | R |
| Sept 2025 | Cicero MGT independent report on Torus (122 pages, not read). The post is listed as 9.23.2026 but its dateline reads Sept 22, 2025. | https://www.torus.co/news/cicero-mgt-releases-independent-report-on-torus-technology | R |
| Dec 2025 | 2025 wrap-up: more than 360 unplanned DR events, over 2 GWh of facility-managed power, 2026 priorities | https://www.torus.co/news/2025-wrap-up-and-look-ahead-to-2026 | R |
| Dec 29, 2025 | Creekstone says Torus Load Smoothing was installed at Delta | https://www.creekstone.energy/delta | R |
| Feb 2026 | Rep. Celeste Maloy tours GigaOne | https://www.torus.co/news/rep-celeste-maloy-visits-torus-gigaone-facility-highlighting-american-made-grid-i | S |
| Apr 2026 | Trinity Capital commits up to $35M in equipment financing | https://yespress.io/torus (an Equipment Finance News search snippet also exists) | R2 |
| May 5, 2026 | CTO/CISO blog post with the freeway metaphor | https://www.torus.co/news/the-dispatch-security-isnt-a-feature-its-how-we-work | S |
| Jun 12, 2026 | ROWE comment letter (Section 5) | https://rowesternenergy.org/wp-content/uploads/2026/06/Consolidated-Spring-Workshop-Comments_06222026.pdf | S |
| Jul 2026 | GigaOne weekly production records; output up more than 76% in six months | https://www.torus.co/news/torus-gigaone-sets-production-records-six-months-after-coming-online | R |
| Aug-Oct 2026 | Data-center pages go 404; homepage drops AI and hyperscalers | Section 2.7 | S |
| Oct 8, 2026 | Fast Company 2026 Next Big Things in Tech, for managing fast-moving loads at the point of demand | https://www.torus.co/news/torus-named-to-2026-next-big-things-in-tech-award | R |
| n/a | PLMA recognition, named in a research summary with no source URL | UNVERIFIED | n/a |

**Zero Gravity Summit 2026.** The agenda puts the hackathon winner announcement on Day 2 at 9:05 AM, after a welcome from Rep. Maloy. We found no Torus speaker in the agenda text (https://zerogravitysummit.com/agenda, R).

---

## 7. What Torus does not advertise, and what Clearlane adds

"Not advertised" means we did not find it on any Torus page we read. It does not mean the product lacks it, so never say "Torus lacks".

**What Torus already publishes, which Clearlane does not replace:**
- Lasso's facility-load forecasting
- sub-250ms dispatch
- Spin and Pulse routing
- the event audit log
- forecast-based scheduling for co-ops
- fleet views for utility operators

| Not advertised | Nearest thing Torus publishes | What Clearlane adds | Where it shows |
|---|---|---|---|
| A timetable keyed to EDAM day-ahead prices at ELAP_PACE-APND | Lasso inputs named as load, weather, rate schedules and "grid signals" | Each station's hourly plan built from the day-ahead price posted about 9:16pm MT the night before | Beats 1-2 (traffic report, race) |
| An exportable hourly operating envelope with SCH | The ROWE letter asks for envelope standards and SCH | `clearlane.envelope/v1`: hourly reserve kW, maximum charge and discharge kW, SCH hours (our definition, labeled DERIVED) | Beat 5 |
| A published rule for sizing the reserve held for RMP calls | Spin and Pulse roles; Lasso routes each event | A reserve sized in kW and held in Spin, so Pulse keeps its schedule; a battery-only comparison shows the cost | Beat 3 (crash) |
| A Pulse cycle budget with a wear price | 7,500 cycles over 25 years; Spin spares Pulse | A wear price calibrated to about 300 cycles a year, with a meter on screen | Beats 2 and 4 |
| Carbon as a dispatch input | Sustainability appears only as a customer motive | Average-emissions CO2 per hour from EIA, with a caveat line | Race end cards |
| Measured, multi-month results for scheduling policies | Case studies with no sizes and mostly expected savings | A three-policy backtest from May 1 to Oct 27, 2026 on REAL prices | Beat 5 |
| Plain-language reasons for each hour | Dashboards for facility and utility users | Named lanes (clear, shoulder, jam), each with a one-line reason | Ribbon and plan |
| Scheduling of flexible compute | Data-center pages, now 404 | One SIMULATED card applying the same timetable to a flexible AI load: compute follows the sun in time, not in space | Beat 6 card |

How to position it: Clearlane is one more grid signal that Lasso could take through its API. It is not a Lasso replacement.

---

## 8. Guardrails for talking about Torus on stage

- **Stations.** Say "simulated Torus-style station". No Torus logos and no Torus branding. Clearlane is its own tool.
- **Facts.** Never invent a Torus fact. Each Torus number is TORUS_PUBLISHED, from one named page. Where Torus's pages disagree, pick one and name it: 359 vs more than 360 events; 99.9% vs 99.99% uptime; 540,000, 545,000 or 582,000 sq ft.
- **Absence.** Say "not advertised", never "Torus lacks" or "Torus is missing".
- **The baseline.** The fixed overnight schedule is the off-peak rule baseline, not Torus practice. Question 1 asks Torus what sets charging today.
- **Who gets the value.** Dollar figures are value to RMP's system at day-ahead prices, not Torus revenue. RMP's customers capture it today; Torus and hosts share in it only if a program credits scheduled dispatch.
- **MOU sizes.** 70 MW was the first MOU; 500 MW is a ceiling under the expanded MOU, not installed capacity.
- **Heatmap.** It states no time zone. Show both readings every time.
- **ROWE.** Say "Torus's June 2026 comments to ROWE, the Western resource adequacy program", not "Utah regulators". Torus asked for SCH to be defined transparently and did not propose a definition.
- **Data centers.** Make no claim about a current Torus data-center product. The pages have been down since August. Creekstone's "Torus Load Smoothing" is Creekstone's claim, on creekstone.energy.
- **Case studies.** Outcomes are mostly expected, with no sizes. Never use the placeholder Ash Grove or POWDR cards, and never attach the $25,000 figure to Waterford.
- **Names.** Say "PacifiCorp's Shawn Grant" without a title; sources give two different ones.
- **Networks.** Never imply Clearlane connects to a host's IT network. Torus says its stations sit on an isolated network with an electrical-only link to the facility.
- **Torus judge.** Nicole Witmyer is Torus's Strategic Events Leader, per the judges slide. Do not assume grid-engineering depth; lead with the picture.
- **CO2.** CO2 figures are average-emissions estimates, with the caveat on screen.
- **Copy.** No em dashes in any externally facing copy.

---

## 9. Questions for Torus

Craig sends these Tue Oct 27 at about 9:00am MT, via the mentor table or the event channel. They are in priority order, one sentence each.

1. In Lasso today, what sets a Wattsmart site's daily charging window: the host's rate schedule, an RMP signal, or both?
2. Were all 359 events in 2025 unplanned frequency calls, or does the count include scheduled peak or congestion dispatches?
3. What time zone is the 2025 VPP event heatmap on the Rocky Mountain Power case study in?
4. After a Wattsmart event, does Spin refill from Pulse or from the grid, and is that refill held under the host's demand limit?
5. Who sets each site's reserve kW: RMP through its battery management system, Lasso, or the enrollment contract?
6. Is event delivery, such as the 102% figure, measured against the station's scheduled output or against the site meter's baseline?
7. Do Wattsmart sites export to the grid during events, or is discharge limited to offsetting the host's own load?
8. Could Lasso accept an external day-ahead schedule or hourly operating envelope through its API?
9. Did the June ROWE comments have a Utah or Wyoming counterpart, and is System Critical Hours defined in any filing there yet?
10. May we quote published Spin and Pulse specs and the 2025 event data on stage, with attribution, beside "simulated Torus-style" stations?

---

## 10. Contradictions and gaps on Torus's own pages

| Item | What differs | Where |
|---|---|---|
| Factory size | 540,000 vs 545,000 vs 582,000 sq ft | Maloy news; Station body; Station FAQ |
| Uptime | 99% (Station meta), 99.9% (most pages), 99.99% (2025 wrap-up) | torus-nova; case study; wrap-up |
| 2025 events | 359 vs more than 360 | case study; wrap-up |
| Event timing | 2024: mostly late afternoon and evening (CEO); 2025 heatmap: every hour, with no time zone | Utility Dive; heatmap image |
| Trace image | A 0-400 kW axis against a 3,828 kW label | event trace image |
| Product names | Nova vs Station; "Nova Spin" in the Spin page meta | torus-nova; torus-flywheel |
| Template errors | Waterford page has a Schaeffer paragraph; the Schaeffer page names JD Machine; the SLVECC meta title reads JD Machine | case-study pages |
| Placeholder cards | fpo-case-study-3/4/5 on /case-studies | https://www.torus.co/case-studies |
| Shawn Grant's title | Customer Solutions Director (case study) vs Wattsmart Program Manager (Mar 2025 release) | case study; Mar 2025 release |
| Cicero report date | Listed 9.23.2026, dateline Sept 22, 2025 | Cicero post |
| Spin kWh per unit | Not published | n/a |
