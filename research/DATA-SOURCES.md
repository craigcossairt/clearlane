# Data sources: exact recipes

How to fetch, parse and join every dataset Clearlane uses for PACE (PacifiCorp East, Utah). Each recipe gives the endpoint, a full example query that was run, the parameters, the response format, the timestamp convention, the ids, the limits and errors we saw, the license, and a worked example against a file cached in `research/data/` or `research/analysis/`.

Curated 2026-10-26 (Mountain). Sources: `research/notes/data-option1.findings.md`, `research/notes/data-option2.findings.md`, the cached files themselves (headers and rows were re-read for this page), and the gridstatus source copy in `../clearlane-raw/misc/gridstatus/caiso.py` (not in git). UNVERIFIED marks anything not confirmed at the source or by a run.

No source below needs an API key. Do not add keys to git.

## Summary

| Source | What we take from it | Format | Time stamps | Cached example |
|---|---|---|---|---|
| CAISO OASIS `PRC_LMP` DAM | Day-ahead hourly price at PACE and peer nodes | zip of CSV | GMT start/end; Pacific operating day, hour ending | `research/data/caiso5/`, `research/analysis/option2/oct/` |
| CAISO OASIS `SLD_FCST` DAM | Day-ahead load forecast, area PACE | zip of CSV | same | `research/data/caiso3/` |
| CAISO OASIS GroupZip `EDAM_WND_SLR_FORECAST_GRP` | Day-ahead wind and solar forecast, PACE | zip of XML | GMT start/end | `research/data/caiso4/` |
| CAISO OASIS `PRC_INTVL_LMP` RTM | 5-minute real-time price (context only) | zip of CSV | GMT; Pacific day, hour ending, interval 1-12 | `research/data/caiso1/` |
| EIA-930 six-month CSV | Hourly demand, forecast, generation by fuel, interchange | CSV | UTC and BA-local, hour ending | `research/data/eia930/` (PACE rows only) |
| EIA 930-api JSON | Same series with about 1.4 h lag | JSON | UTC, hour ending | `research/data/eia930api/pace_d_df.json` |
| EIA `PACE.xlsx` | Hourly CO2 emissions and intensity | xlsx | Excel serials, hour ending | raw only: `../clearlane-raw/eia/PACE.xlsx` (75 MB, not in git) |

## 1. CAISO OASIS: rules for every query

- **Base URLs.** `https://oasis.caiso.com/oasisapi/SingleZip?...` for single reports, `https://oasis.caiso.com/oasisapi/GroupZip?...` for report groups.
- **Datetime format.** `startdatetime=YYYYMMDDTHH:MM-0000` and `enddatetime=...`, in GMT. The window is start-inclusive and end-exclusive on interval start (seen in every cached file).
- **`resultformat=6`** returns CSV inside a zip. **`resultformat=5`** returns XML inside a zip (the only format we used for GroupZip).
- **Window cap: 31 days.** A 40-day query returned error **1004**, "Data can be requested for period of 31 days only" (`research/data/caiso6/20260415_20260525_PRC_LMP_DAM_20261026_20_26_51.xml`). A 30-day window worked (`research/data/oasis/dam_jul/`). Exactly 31 days was not tested; use 30-day windows. The OASIS FAQ says per-report limits run from 1 day to 31 days (https://www.caiso.com/documents/oasis-frequently-asked-questions.pdf).
- **Errors come back as a zip holding an XML file**, even when CSV was asked for. Detect them before parsing: the zip member name ends in `.xml` when you asked for CSV, or the body contains `<m:ERR_CODE>`. gridstatus treats an `.xml.zip` Content-Disposition, or `.xml` anywhere in the body, as "no data" (`../clearlane-raw/misc/gridstatus/caiso.py` lines 391-399). The only code we saw was 1004.
- **Spacing.** Keep at least 5 s between calls. OASIS can return **HTTP 429** beyond about 1 request per 5 s; CAISO does not publish this figure, and it comes from gridstatus comments and its retry loop (sleep 5 s, multiplied by the retry count each time; caiso.py lines 372-389 and 1420-1422). Our rule: wait at least 5 s between calls and back off 30 s on a 429 (`docs/plan/synthesis.json`, data_plan). No 429 was seen in our runs.
- **No CORS.** Responses carry no `Access-Control-Allow-Origin` header, so fetch server-side or in a prep script, never from the browser.
- **Retention.** 39 months online (OASIS FAQ above). Older bulk history sits at https://oasis-bulk.caiso.com and needs an AWS account. Not needed: EDAM history only starts May 1 2026.
- **File names.** `<startOPRDT>_<endOPRDT>_<QUERY>_<MKT>_<YYYYMMDD_HH_MM_SS>_v<version>.csv`. The stamp is the creation time in **Pacific** time. Example: `20261027_20261028_PRC_LMP_DAM_20261026_20_16_40_v12.csv` was made 8:16:40pm PDT Oct 26 = 03:16Z Oct 27. The error file's XML header says 03:26:51Z and its name says 20_26_51, which confirms the Pacific reading.
- **Rows are unsorted.** Sort on `INTERVALSTARTTIME_GMT`.
- **The value column is named `MW` in every report, including price reports**, where it holds $/MWh.
- **Times.** `INTERVALSTARTTIME_GMT` and `INTERVALENDTIME_GMT` look like `2026-10-27T07:00:00-00:00`. `OPR_DT` is the **Pacific** operating date. `OPR_HR` is the Pacific **hour ending**, 1-24. The CAISO day starts at 07:00Z while PDT lasts (08:00Z after Nov 1 2026).
- **License.** CAISO's Terms of Use (https://www.caiso.com/privacy-terms-of-use) bar copying, republishing or redistributing site material except as authorized, ask for credit to the California ISO, and grant API users a limited license that CAISO can revoke and that forbids adverse or excessive use. The exact permitted-use clause was cut off in what we read (UNVERIFIED). The developer site https://developer.caiso.com holds the interface specification and an acceptable use policy that we did not read (UNVERIFIED). **Committing raw OASIS extracts to the public repo is Craig's call**; the safer default is to commit the fetch script plus derived numbers and keep raw extracts in `../clearlane-raw`. Credit line: "Price and forecast data: California ISO OASIS."

### 1a. PRC_LMP, day-ahead (DAM), version 12

Day-ahead hourly price at a node, split into components.

- **Example (run 2026-10-26):**
  `https://oasis.caiso.com/oasisapi/SingleZip?queryname=PRC_LMP&market_run_id=DAM&version=12&node=ELAP_PACE-APND&startdatetime=20261027T07:00-0000&enddatetime=20261028T07:00-0000&resultformat=6`
- **Several nodes in one call:** comma-separate them, `node=ELAP_PACE-APND,ELAP_PACW-APND,ELAP_PGE-APND,TH_SP15_GEN-APND` (this produced `research/data/caiso5/`).
- **Node ids.** `ELAP_PACE-APND` (PacifiCorp East, Utah). Peers: `ELAP_PACW-APND` (PacifiCorp West), `ELAP_PGE-APND` (Portland General Electric, an EDAM member since Oct 1 2026), `TH_SP15_GEN-APND` (Southern California trading hub).
- **Columns:** `INTERVALSTARTTIME_GMT, INTERVALENDTIME_GMT, OPR_DT, OPR_HR, OPR_INTERVAL, NODE_ID_XML, NODE_ID, NODE, MARKET_RUN_ID, LMP_TYPE, XML_DATA_ITEM, PNODE_RESMRID, GRP_TYPE, POS, MW, GROUP`.
- **Components** (`LMP_TYPE` / `XML_DATA_ITEM`): `LMP`/`LMP_PRC` total price; `MCE`/`LMP_ENE_PRC` energy; `MCC`/`LMP_CONG_PRC` congestion; `MCL`/`LMP_LOSS_PRC` losses; `MGHG`/`LMP_GHG_PRC` greenhouse gas. PACE's GHG component was 0 in every cached hour. One node for one day = 5 x 24 = 120 rows.
- **Format quirks.** `OPR_HR` is not zero-padded in DAM (`1`..`24`). `OPR_INTERVAL` is 0.
- **Availability.** Prices for operating day Oct 27 were already published when we fetched at 03:16Z Oct 27 (9:16pm MDT Oct 26). That is an upper bound; the real publish time is UNVERIFIED. Plan for the next day's prices by about 9pm MT the evening before. EDAM data for PACE starts with operating day 2026-05-01: a query from Apr 25 returned nothing earlier (`research/data/caiso7/`).
- **Worked example.** In `research/data/caiso5/20261027_20261028_PRC_LMP_DAM_20261026_20_23_37_v12.csv`, the row
  `2026-10-28T00:00:00-00:00,2026-10-28T01:00:00-00:00,2026-10-27,18,0,ELAP_PACE-APND,...,LMP,LMP_PRC,...,55.78409,1`
  is OPR_DT Oct 27, OPR_HR 18 (5-6pm PDT), which is **6-7pm MDT Oct 27**: $55.78/MWh, the evening step in `research/GRID.md` §2.
- **History we hold:** Jul 1-30 MT (`research/data/oasis/dam_jul/`, PACE), Oct 1-25 MT (`research/data/oasis/dam_oct/`, PACE), Oct 1-27 MT with PACW, PGE and SP15 (`research/analysis/option2/oct/`), Jul 1-30 with PACW and SP15 (`research/analysis/option2/jul/`), May 1-23 (`research/data/caiso7/`, PACE), Jul 20 (`research/data/oasis/dam_0720/`).

### 1b. SLD_FCST, day-ahead (DAM), version 1

Day-ahead load forecast for every EDAM and WEIM area. No node parameter.

- **Example (run 2026-10-26):**
  `https://oasis.caiso.com/oasisapi/SingleZip?queryname=SLD_FCST&market_run_id=DAM&version=1&startdatetime=20261027T07:00-0000&enddatetime=20261028T07:00-0000&resultformat=6`
- **Columns:** `INTERVALSTARTTIME_GMT, INTERVALENDTIME_GMT, LOAD_TYPE, OPR_DT, OPR_HR, OPR_INTERVAL, MARKET_RUN_ID, TAC_AREA_NAME, LABEL, XML_DATA_ITEM, POS, MW, EXECUTION_TYPE, GROUP`.
- **Filter** `TAC_AREA_NAME == "PACE"`. One day returns 864 rows: 36 areas x 24 hours, all `LOAD_TYPE` 1, `LABEL` "Demand Forecast Day Ahead", `XML_DATA_ITEM` `SYS_FCST_DA_MW`, `EXECUTION_TYPE` DAM.
- **Area names to watch:** `PGE` vs `PGE-TAC`. We read `PGE` as Portland General and `PGE-TAC` as PG&E's CAISO transmission access charge area. This is inferred from the naming and not confirmed (UNVERIFIED). Other CAISO areas end in `-TAC` too (`CA ISO-TAC`, `SCE-TAC`, `SDGE-TAC`, `VEA-TAC`, `MWD-TAC`).
- **Worked example.** `research/data/caiso3/20261027_20261028_SLD_FCST_DAM_20261026_20_17_09_v1.csv`, row start `2026-10-28T00:00:00-00:00`, `TAC_AREA_NAME` PACE, OPR_HR 18: **5,937 MW** for 6-7pm MDT Oct 27.
- Windows longer than one day were not tested (UNVERIFIED). Neither was a Mountain-day window starting at 06:00Z; fetch whole operating days and slice.

### 1c. EDAM_WND_SLR_FORECAST_GRP (GroupZip), version 1

Day-ahead wind and solar forecast for the EDAM areas.

- **Example (run 2026-10-26):**
  `https://oasis.caiso.com/oasisapi/GroupZip?resultformat=5&version=1&groupid=EDAM_WND_SLR_FORECAST_GRP&startdatetime=20261027T07:00-0000&enddatetime=20261028T07:00-0000`
- **Format.** Zip of one XML file in namespace `http://www.caiso.com/soa/EDAMWindAndSolarForecast_v1.xsd`. `MessageHeader/TimeDate` is the publish stamp (2026-10-26T16:10:09Z, which is 10:10am MDT the day before). `REPORT_HEADER` says `TZ` GMT, `MKT_TYPE` DAM, `UOM` MW. Each `REPORT_DATA` element has `INTERVAL_START_GMT`, `INTERVAL_END_GMT`, `BAA_GRP_ID`, `SOLAR`, `WIND`.
- **Areas** (`BAA_GRP_ID`): CISO, PACE, PACW, PGE. One day = 96 elements. No negative solar values seen.
- **Spacing.** gridstatus sleeps 5 s before each GroupZip call and fetches one day per call (caiso.py lines 1410-1422). Longer windows were not tested (UNVERIFIED). A "still processing, retry later" response is reported for GroupZip elsewhere but not confirmed at the source (UNVERIFIED).
- **Cached file name** follows a different pattern: `research/data/caiso4/20261027_20261027_EDAM_WND_SLR_FORECAST_GRP_N_v1.xml`.
- **Worked example.** The element with `INTERVAL_START_GMT` 2026-10-27T23:00:00-00:00 and `BAA_GRP_ID` PACE has `SOLAR` 986.99 and `WIND` 1915.68: the forecast for 5-6pm MDT Oct 27.

### 1d. PRC_INTVL_LMP, real-time (RTM), version 1

Five-minute real-time price. Context only; the product reads the day-ahead price.

- **Example (run 2026-10-26):**
  `https://oasis.caiso.com/oasisapi/SingleZip?queryname=PRC_INTVL_LMP&market_run_id=RTM&version=1&node=ELAP_PACE-APND&startdatetime=20261025T07:00-0000&enddatetime=20261025T09:00-0000&resultformat=6`
- **Version.** `version=1` worked for us. The OASIS FAQ examples use `version=2` (not tested). With `node=ALL` the FAQ says one hour per call.
- **Columns** differ in order from DAM: `INTERVALSTARTTIME_GMT, INTERVALENDTIME_GMT, OPR_DT, OPR_HR, NODE_ID_XML, NODE_ID, NODE, MARKET_RUN_ID, LMP_TYPE, XML_DATA_ITEM, PNODE_RESMRID, GRP_TYPE, POS, MW, OPR_INTERVAL, GROUP`.
- **Format quirks.** `OPR_HR` is zero-padded (`01`). `OPR_INTERVAL` runs 1-12. The cached two hours hold 96 rows: 24 intervals x 4 components (LMP, MCC, MCE, MCL).
- **Worked example.** `research/data/caiso1/20261025_20261025_PRC_INTVL_LMP_RTM_20261026_20_16_14_v1.csv`, first row: 07:00-07:05Z Oct 25, OPR_DT 2026-10-25, OPR_HR 01, interval 1, MCC 0.

## 2. EIA-930 (U.S. Energy Information Administration)

**License for all EIA data:** public domain. EIA asks for an acknowledgment such as "Source: U.S. Energy Information Administration (Oct 26 2026)." Source: https://www.eia.gov/about/copyrights_reuse.php

**Respondent ids:** `PACE` (PacifiCorp East). Others we use: `PACW`, `PGE`, `CISO`. Each BA reports local times in its own zone: Mountain for PACE, Pacific for CISO.

### 2a. Six-month balance CSVs

- **Example (run 2026-10-26):**
  `https://www.eia.gov/electricity/gridmonitor/sixMonthFiles/EIA930_BALANCE_2026_Jul_Dec.csv`
  Also `EIA930_BALANCE_2025_Jul_Dec.csv` and `EIA930_BALANCE_2026_Jan_Jun.csv`.
- **Size and lag.** The 2026 Jul-Dec file was 30.8 MB, all areas, last modified 2026-10-26 14:44 GMT. PACE demand ran through 10/26 06:00 UTC (about a 1-day lag); the PACE forecast ran through 10/27 06:00 UTC. Full files live in `../clearlane-raw/eia/` (48, 47 and 31 MB, 60 areas). The repo copies in `research/data/eia930/` hold **PACE rows only**: 4,417, 4,343 and 2,832 rows.
- **Columns.** 65 columns. The ones we use: `Balancing Authority`, `Data Date`, `Hour Number`, `Local Time at End of Hour`, `UTC Time at End of Hour`, `Demand Forecast (MW)`, `Demand (MW)`, `Net Generation (MW)`, `Total Interchange (MW)`, `Net Generation (MW) from Coal`, `... from Natural Gas`, `... from Hydropower Excluding Pumped Storage`, `... from Solar without Integrated Battery Storage`, `... from Solar with Integrated Battery Storage`, `... from Wind without Integrated Battery Storage`, `... from Wind with Integrated Battery Storage`, `... from Battery Storage`. Imputed and Adjusted variants follow. The last column is the region (`NW` for PACE).
- **Parsing.** Times look like `07/20/2026 11:00:00 PM` (`%m/%d/%Y %I:%M:%S %p`). No thousands commas in the PACE copies, but strip commas anyway. Empty cells mean missing. Night solar can be slightly negative (down to -3 MW).
- **Timestamps.** Both time columns are **hour ending**. Join on `UTC Time at End of Hour` minus 1 hour, which gives the UTC interval start. `Data Date` plus `Hour Number` is the BA-local day and hour ending.
- **DST.** The fall-back day has 25 hours with a repeated local 1:00 AM. Verified: on 11/02/2025, Hour Number 1 is local 1:00 AM at 07:00Z and Hour Number 2 is local 1:00 AM at 08:00Z. The spring-forward day has 23 hours.
- **Known bad hour.** Jan 8 2026, 1-2am MST: demand 1,137 MW against a 6,048 MW forecast. Drop or impute it (`research/analysis/depth/headroom_output.txt` cleans 1 bad hour).
- **Worked example.** `research/data/eia930/PACE_EIA930_BALANCE_2026_Jul_Dec.csv`, row `PACE,07/20/2026,17,07/20/2026 5:00:00 PM,07/20/2026 11:00:00 PM,10006,10173,...`: Hour Number 17, ending 5pm MDT, UTC end 23:00Z, so UTC start 22:00Z = **4-5pm MDT**: demand 10,173 MW, forecast 10,006 MW.

### 2b. 930-api JSON (undocumented, no key)

The JSON feed behind EIA's grid monitor. Fresher than the CSV; undocumented, so it could change without notice.

- **Example (run 2026-10-27 03:26Z, the evening of Oct 26 MT):**
  `https://www.eia.gov/electricity/930-api/region_data/series_data?type[0]=D&type[1]=DF&type[2]=NG&type[3]=TI&respondent[0]=PACE&start=10252026%2000:00:00&end=10282026%2000:00:00&frequency=hourly&timezone=Mountain&limit=10000&offset=0`
- **Parameters.** `type[n]`: D demand, DF day-ahead demand forecast, NG net generation, TI total interchange. `respondent[n]`: BA id. `start` and `end`: `MMDDYYYY HH24:MI:SS` with the space URL-encoded as `%20` (the response's own field list parses them with `to_timestamp(<<value>>, 'MMDDYYYY HH24:MI:SS')`). `frequency=hourly`, `limit`, `offset`.
- **Response.** A one-element list whose object has `data`, `query`, `recordCount` and `totalCount`. Each `data` entry is one series with `RESPONDENT_ID`, `RESPONDENT_NAME`, `TYPE_ID`, `TYPE_NAME`, `TIME_ZONE`, `FREQUENCY`, `DISPLAY_ORDER` and `VALUES` = {`DATES`, `DATA`, `DATA_REPORTED`, `DATA_IMPUTED`}. DATES look like `10/25/2026 00:00:00`.
- **Timestamps.** `TIME_ZONE` came back `"UTC"` although `timezone=Mountain` was sent. **DATES are UTC hour ending.** Checked against the six-month CSV: 31 demand and 55 forecast overlaps, 0 mismatches. The first DATE equaled the `start` value, so treat `start`/`end` as UTC too (inferred, UNVERIFIED at source).
- **Lag.** At 03:26Z, demand ran through 02:00Z (about 1.4 h lag), forecast through 10/27 06:00Z, NG and TI through 10/26 05:00Z.
- **CORS.** Sends `Access-Control-Allow-Origin: *`, so a browser page could call it. Still fetch it in prep and cache the result for the demo.
- **Worked example.** `research/data/eia930api/pace_d_df.json`: `recordCount` 166 = D 51 + DF 55 + NG 30 + TI 30 values. First demand value: `10/25/2026 00:00:00` (UTC end), 5,745 MW, which covers 5-6pm MDT Oct 24.

### 2c. PACE.xlsx: hourly CO2

The per-area workbook is the only free hourly CO2 series we found for PACE.

- **Example (run 2026-10-26):** `https://www.eia.gov/electricity/gridmonitor/knownissues/xls/PACE.xlsx`
- **Size.** 75.3 MB, 2015-07-01 onward. **Keep it out of git** (`../clearlane-raw/eia/PACE.xlsx`). Prep must parse it to a small CSV.
- **Sheets.** Published Hourly Data (sheet1), Published Daily Data, BA Full Names, Hourly Charts, Daily Charts, Known Data Issues, Notes, Imbalance Thresholds, Range Thresholds.
- **Hourly columns we use:** `UTC time`, `Local date`, `Hour`, `Local time`, `Time zone`, `CO2 Factor: COL`, `CO2 Factor: NG`, `CO2 Factor: OIL`, `CO2 Emissions Generated`, `CO2 Emissions Intensity for Generated Electricity`, `CO2 Emissions Intensity for Consumed Electricity`, plus `Demand`, `Net generation` and fuel columns.
- **Units.** CO2 emissions in metric tons; intensity in **lb/kWh**. g/kWh = lb/kWh x 453.592. Check: Oct 25, hour ending 4pm MT, 3,429.44 t x 2,204.62 / 6,809 MWh = 1.1104 lb/kWh, matching the reported value (`research/analysis/scripts/pace_co2_units.py`).
- **Timestamps.** Dates are Excel serial numbers (day 0 = 1899-12-30). `Hour` is the local (Mountain) hour ending 1-24, and `UTC time` is the hour-ending instant. First row: `Local date` 42186 (2015-07-01), `Hour` 1, `UTC time` 42186.2917 (07:00Z), `Local time` 01:00, `Time zone` Mountain. UTC start = `UTC time` minus 1 hour.
- **Lag.** Yesterday's CO2 appears about 4pm ET. The consumed-basis intensity lags more; it was still blank for Oct 25 on Oct 26.
- **Parsing.** Stream it with `zipfile` plus `xml.etree.ElementTree.iterparse`: read `xl/sharedStrings.xml`, then `xl/worksheets/sheet1.xml`, clearing each row. Stdlib only; about 15 s on this PC. See `research/analysis/demo-story/co2.py`.
- **Worked example.** `python -I research/analysis/demo-story/co2.py ../clearlane-raw/eia/PACE.xlsx` prints the Oct 1-25 2026 mean by hour ending: HE16 (3-4pm) 446 g/kWh, HE19 (6-7pm) 629 g/kWh. The same values are hard-coded in `research/analysis/demo-story/habit.py`.

### 2d. EIA API v2 (backup only, needs a key)

- `https://api.eia.gov/v2/electricity/rto/region-data/data/?api_key=<KEY>&frequency=hourly&data[0]=value&facets[respondent][]=PACE&facets[type][]=D&start=2026-10-20T00&length=5000`. Routes also include `fuel-type-data` (facet `fueltype`) and `interchange-data`.
- Without a key: `API_KEY_MISSING`. JSON caps at 5,000 rows per request. EIA asks callers to stay under about 9,000 requests an hour with bursts under 5 a second. The key is free by email. Not tested with a key. Whether v2 serves the CO2 series was not checked.
- The full bulk file `https://www.eia.gov/opendata/bulk/EBA.zip` is 699 MB and needs no key. Too big for this build.

## 3. Ruled out

| Source | Why not | Evidence |
|---|---|---|
| **Electricity Maps** | Lists zone `US-NW-PACE` without a key but refuses data ("Invalid auth-token"). The API is paid (about EUR 6,000 a year per signal, UNVERIFIED) with a 14-day trial. The free personal tier is reported as one zone, 24 hours of history, no forecast and non-commercial use (UNVERIFIED: official pages returned 403/404). | `https://api.electricitymaps.com/v3/zones`, `https://api.electricitymaps.com/v3/carbon-intensity/latest?zone=US-NW-PACE`, `research/notes/data-option1.findings.md`, `research/notes/data-option2.findings.md` |
| **WattTime** | API v3 needs an account token. Historical, forecast and map data are for subscribers. The full marginal (MOER) signal is free only for `CAISO_NORTH`; elsewhere only a 0-100 signal index is free. So there is no free marginal CO2 for PACE. | https://docs.watttime.org/ |
| **Open-Meteo** | The free API is non-commercial only (under 10,000 calls a day), licensed CC BY 4.0 with attribution. Salt Lake City irradiance is a poor proxy for PACE utility solar: at 15:00Z Oct 27 it gave 80 W/m2 while EDAM forecast 1,943 MW. It labels radiation by the end of the hour, so the `slc_*` columns in `research/data/pace_snapshot_2026-10-27.csv` sit one hour early. **Use the EDAM solar forecast instead. Drop the `slc_*` columns or attribute them.** | https://open-meteo.com/en/terms, `research/notes/data-option1.findings.md` |
| **NREL (now NLR)** | NREL was renamed the National Laboratory of the Rockies on Dec 1 2025. `developer.nrel.gov` was retired May 29 2026 and failed DNS here; APIs now live at `developer.nlr.gov`. PVWatts DEMO_KEY worked, but docs say 30 calls an hour and 50 a day while the response header said `X-Ratelimit-Limit: 10`. A typical-year solar model is not needed when EDAM publishes a day-ahead solar forecast. | https://developer.nlr.gov/docs/nlr-domain-transition, `research/notes/data-option2.findings.md` |
| NASA POWER | Works with no key, but solar data lags about 3 months (recent hours return the fill value -999). History only, and not at plant locations. | `research/notes/data-option2.md` |
| gridstatus library | Works without a key for CAISO, but pulls about 54 MB of dependencies (pandas, numpy and more). Our prep is stdlib only. We copy its rules, not its code. | https://pypi.org/pypi/gridstatus/json |
| gridstatus.io hosted API | Needs an account key (500,000 rows a month free). Adds nothing EIA and OASIS lack for PACE. | https://raw.githubusercontent.com/gridstatus/gridstatusio/main/README.md |
| ERCOT public API | Needs a subscription key and an hourly ID token. Not Utah. | `research/notes/data-option1.findings.md` |

## 4. Joining Mountain days

**Rule 1: join on the UTC interval start, never on local labels.** Convert every source to a UTC hour start first.

**Rule 2: a Mountain day and a CAISO operating day are offset by one hour.**

- While MDT lasts (through Oct 31 2026), a **Mountain day D is the 24 hours starting at D 06:00Z**.
- The **CAISO operating day D starts at D 07:00Z** (midnight Pacific).
- So Mountain hour beginning m on day D is CAISO `OPR_DT` D, `OPR_HR` m, for m = 1..23. **Mountain hour 0 is CAISO `OPR_DT` D-1, `OPR_HR` 24.** A Mountain day always needs the last hour of the previous CAISO operating day.
- After DST ends on Nov 1 2026, the Mountain day starts at 07:00Z and the CAISO day at 08:00Z. The same one-hour offset and the same rule hold.

**Per-source conversion to UTC start:**

| Source | Field | To UTC start |
|---|---|---|
| OASIS CSV | `INTERVALSTARTTIME_GMT` | use as is |
| OASIS EDAM XML | `INTERVAL_START_GMT` | use as is |
| EIA six-month CSV | `UTC Time at End of Hour` | minus 1 hour |
| EIA 930-api | `VALUES.DATES` | minus 1 hour |
| PACE.xlsx | `UTC time` (Excel serial) | minus 1 hour |
| `pace_snapshot_2026-10-27.csv` | `interval_start_utc` | use as is (`local_mt` is start minus 6 h, MDT only) |

**Worked example: Oct 27 2026, Mountain time.**

- 6-7pm MDT Oct 27 = UTC start 2026-10-28T00:00Z = OPR_DT 2026-10-27, OPR_HR 18. Price $55.78 (`research/data/caiso5/`), load forecast 5,937 MW (`research/data/caiso3/`).
- Midnight-1am MDT Oct 27 = UTC start 2026-10-27T06:00Z = **OPR_DT 2026-10-26, OPR_HR 24**. Price $30.22857, found in `research/analysis/option2/oct/20260930_20261028_PRC_LMP_DAM_20261026_20_37_47_v12.csv`. It is **not** in `research/data/caiso2/` or `caiso5/`, which hold only operating day Oct 27. The load and wind forecasts for this hour need the SLD_FCST and EDAM queries for operating day Oct 26 (`startdatetime=20261026T07:00-0000&enddatetime=20261027T07:00-0000`), which are not cached.
- `research/data/pace_snapshot_2026-10-27.csv` covers UTC 07:00Z Oct 27 to 07:00Z Oct 28: 1am Oct 27 to 1am Oct 28 Mountain. Its last row (`local_mt` 10-28 00:00, $46.11) belongs to the Mountain day Oct 28. `research/analysis/demo-story/habit.py` maps that row to hour 0; its chosen hours (1-5am, 1-4pm, 6-8pm) do not use hour 0, so its results stand, but a Mountain-day chart built that way shows the wrong midnight price.
- For prices, one OASIS PRC_LMP call can return a Mountain day directly: `startdatetime=20261027T06:00-0000&enddatetime=20261028T06:00-0000`. This works because `research/data/oasis/dam_oct/` was fetched with 06:00Z bounds and its first row is OPR_DT 09-30 HE24. For SLD_FCST and GroupZip, 06:00Z bounds were not tested; fetch both operating days and slice.

**Other traps:**

- EIA local columns are each BA's own zone. Do not compare PACE local hours with CISO local hours.
- EIA fall-back days repeat a local hour; UTC is unique. The CAISO 25-hour operating day (Nov 1 2026) labeling was not checked (UNVERIFIED) and falls after judging.
- OASIS DAM `OPR_HR` is `1`..`24`; RTM is `01`..`24` with `OPR_INTERVAL` 1-12. Parse as integers.

## 5. Fetch plans

**History, May 1 to Oct 27 2026 (Mountain), PRC_LMP DAM.** EDAM begins with operating day May 1, so the Mountain day May 1 has 23 priced hours (its hour 0 is operating day Apr 30, before EDAM) and May 2 is the first full Mountain day. Use 30-day windows with 06:00Z bounds, at least 5 s apart, 30 s backoff on 429. Six calls cover it:

1. `20260501T06:00-0000` to `20260531T06:00-0000`
2. `20260531T06:00-0000` to `20260630T06:00-0000`
3. `20260630T06:00-0000` to `20260730T06:00-0000`
4. `20260730T06:00-0000` to `20260829T06:00-0000`
5. `20260829T06:00-0000` to `20260928T06:00-0000`
6. `20260928T06:00-0000` to `20261028T06:00-0000`

Each with `queryname=PRC_LMP&market_run_id=DAM&version=12&node=ELAP_PACE-APND&resultformat=6` (add peer nodes comma-separated if needed). Check each response for an XML error before parsing. The Oct 1-27 slice already exists in `research/analysis/option2/oct/` and can be used to test the parser.

**EIA history.** The three six-month CSVs cover Jul 2025 to Oct 25 2026 for PACE. The repo copies are PACE only, so any multi-area work (PACW, PGE, CISO) needs the full files from `../clearlane-raw/eia/` or a fresh download.

**Oct 28 refresh (demo day).** The Mountain day Oct 28 is UTC 2026-10-28T06:00Z to 2026-10-29T06:00Z.

1. PRC_LMP DAM, `startdatetime=20261028T06:00-0000&enddatetime=20261029T06:00-0000`. Its hour 0 (OPR_DT Oct 27, HE24) is already public; the rest appears once operating day Oct 28 publishes (expected by about 9pm MT Oct 27, from the one observation above).
2. SLD_FCST DAM for operating days Oct 27 and Oct 28 (`20261027T07:00-0000` to `20261028T07:00-0000`, then `20261028T07:00-0000` to `20261029T07:00-0000`), filter PACE, slice to the Mountain day.
3. EDAM GroupZip for the same two operating days, one call each, filter PACE.
4. EIA 930-api for the latest demand and forecast, and PACE.xlsx for the trailing 30-day CO2 mean by hour.
5. Wait 5 s or more between every OASIS call. Keep each raw response in `../clearlane-raw` and write only the merged, attributed CSV into the repo.

## 6. Gaps in the cached data

- `research/data/pace_snapshot_2026-10-27.csv` is a CAISO operating day, not a Mountain day (see §4). Mountain hour 0 needs OPR_DT Oct 26 HE24 for price (cached in `research/analysis/option2/oct/`), load and wind (not cached).
- No PACE CO2 extract exists in git. The hourly means in `research/analysis/demo-story/habit.py` came from `co2.py` run on the raw workbook. Prep must parse `PACE.xlsx` into a small CSV.
- `research/data/eia930/` holds PACE rows only. `research/analysis/option2/edam_where_vs_when.py` (PACW, PGE, CISO) and `research/analysis/depth/headroom.py` and `extras.py` point at full-file paths that are not in the repo.
- `research/analysis/depth/headroom.py` uses numpy. A stdlib port is needed if prep must stay stdlib only.
- The snapshot's `slc_*` Open-Meteo columns are off by one hour and carry a CC BY 4.0 attribution duty.
- History before Oct 1 for PACW, PGE and SP15 exists only for July. May, June, August and September need the fetch plan above.
