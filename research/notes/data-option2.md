

######## data-option2
## SUMMARY
Option 2 can be built entirely from free data. All of it can be pulled in a few hours, and most of it was tested live tonight. The best minimal stack:
(1) EIA-930 six-month bulk CSVs. No key needed. They give hourly generation by fuel and a demand forecast for each balancing authority (PACE is PacifiCorp East, which covers Utah). Data ran to about 21 hours before the test. Multiply the mix by IPCC lifecycle factors to get carbon intensity per region.
(2) Open-Meteo forecast. No key needed. It gives hourly solar radiation (GHI/GTI/DNI) up to 16 days ahead; 72 hours for Salt Lake City were tested.
(3) Alibaba PAI GPU 2020 trace. The task table is 34 MB. It gives real job arrival, end time and GPU request, so it can drive the "flexible AI job" stream.
(4) NLR "Generative AI Workload Power Profiles". About 1 GB, with real GPU job power sampled at 5-10 Hz. This is the Torus hook: once compute has moved to a clean site, its 0.2-3 Hz power swings still have to be absorbed, and that is what a flywheel does.

Microsoft, OpenAI and NVIDIA published research on AI training power swings in 2025. It finds swings of tens to hundreds of MW. NVIDIA's GB300 adds capacitor storage, but only 65 J per GPU. NERC documents a 1,500 MW data center load loss and a 1 Hz oscillation event. Together these give a strong, sourced story for a combined "where and when to run" plus "smooth the swings" demo that covers both options.

Things to avoid:
- NREL is now NLR. developer.nrel.gov no longer resolves; use developer.nlr.gov.
- NASA POWER solar data lags about 3 months, so use it for history only.
- Electricity Maps' API is paid after a 14-day trial.
- WattTime gives full data only for CAISO_NORTH without a subscription.
- Google Borg is BigQuery-only and 2.4 TiB.
- MIT Supercloud is about 2 TB under CC BY-NC-ND.

Label every chart REAL, DERIVED or SIMULATED.

## IMPLICATIONS
- Option 2 is fully feasible on free data in 44 hours. The no-key core is EIA-930 bulk CSV (where is clean, by hour, for each balancing authority) plus Open-Meteo (when the sun will be up, 72 h ahead). Neither needs an account, and both were tested tonight.
- Best overlap with Torus: frame the build as 'Compute follows the sun, and Torus keeps it from rocking the grid'. Layer 1 (hours): a router that moves deferrable AI jobs across regions and times and shows carbon saved. Layer 2 (seconds): once the jobs land in Utah (PACE, Rocky Mountain Power territory), replay real 10 Hz GPU power traces scaled to cluster size, then simulate a flywheel absorbing the 0.2-3 Hz swings and holding the grid draw flat to a ramp-rate limit. This uses both bounty options and ties directly to Torus Spin and its PacifiCorp relationship.
- Best job trace for the flexible-AI simulation: the Alibaba PAI 2020 task table (34 MB; real arrivals, durations and GPU requests; direct download). Use Alibaba GPU v2026 (HP vs LP priority, training vs offline_inference) only to calibrate what share of work is deferrable, and say so. Use the Azure LLM 2023 CSVs (1 MB) as the latency-bound inference baseline that cannot move.
- Best power-swing source: the NLR GenAI power profiles (5/10 Hz, about 1 GB, public). Its 5 Hz Nyquist limit covers the 0.2-3 Hz band the Microsoft/OpenAI/NVIDIA paper flags. Avoid the Sci Data 50 Hz set for anything you republish, because CC BY-NC-ND forbids derivatives.
- Skip Google Borg/PowerData (BigQuery and a GCP project needed), MIT Supercloud (2 TB, NC-ND), Electricity Maps (paid) and WattTime beyond the free index. They add setup time without improving the demo.
- Use developer.nlr.gov, not developer.nrel.gov, in any NREL/NLR code; agents trained on older docs will produce the dead host. PVWatts DEMO_KEY is enough for one hourly on-site solar profile per site, but cache the result because the limit is about 10-30 calls per hour.
- NASA POWER solar lags about 3 months, so use it only for historical or typical-day context. Open-Meteo is the live forecast source.
- A strong pitch number: NVIDIA's on-rack storage is 65 J/GPU, only about 1.8 kWh even for 100k GPUs. That covers sub-second spikes only. The seconds-to-minutes band between capacitors and batteries is Torus's lane.
- Suggested honest labeling: put a provenance badge on every chart. REAL: EIA-930 pulled <timestamp>, Open-Meteo forecast issued <timestamp>. DERIVED: carbon intensity = EIA fuel mix x IPCC AR5 lifecycle medians. SIMULATED: job stream resampled from Alibaba PAI 2020, deferrable share assumed, flywheel model with illustrative parameters that are not Torus specs. Add a 'What's real' table to the README and the final slide.
## RISKS
- Price data is not covered here. EIA-930 has no prices, so 'cheapest' needs CAISO OASIS or ERCOT LMPs (not tested by me) or a clearly labeled simulated price.
- Torus Spin is quoted at a 25,000-cycle life. At 0.2-3 Hz, AI training produces about 17,000-260,000 oscillations per day. If those counted as full cycles the life would be used up within about a day, so the sim must use depth-weighted equivalent cycles (rainflow counting), and the team should ask Torus how micro-cycles are rated. Raising this unprepared in front of judges could backfire.
- Alibaba OSS downloads come from Beijing/Hangzhou buckets and may be slow from Utah. The 34-60 MB v2020 tables are fine; the 1.19 GB v2026 summary may take a long time. Alibaba's licensing is unclear (no LICENSE file), so cite the trace program and the papers.
- The Open-Meteo free tier is non-commercial only. That is fine for a hackathon, but any Torus productization needs a paid plan.
- EIA-930 data runs about 21 h behind, has placeholder future rows with blanks, and small negative solar values at night. The dashboard should show 'latest available hour' rather than claim 'live', and must clip the negatives.
- Carbon intensity from the generation mix ignores imports and exports between regions (WattTime MOER accounts for them). Say this on the slide.
- The parallel-search and Firecrawl free tiers hit their rate limits mid-research, so a few claims rest on WebSearch summaries and are marked unverified.
## OPEN QUESTIONS
- Does Torus rate Spin cycle life by full equivalent cycles or by count of micro-cycles? This decides whether a flywheel suits the 0.2-3 Hz AI training ripple, and is worth asking the Torus judge or the Torus engineers before the pitch.
- Does PacifiCorp / Rocky Mountain Power publish a ramp-rate or oscillation spec for large loads that the demo could use as the 'utility limit' line?
- What sampling rate, columns and file layout does the NLR GenAI power-profile zip use for multi-node training runs? I did not download the 1 GB zip.
- What file sizes do the Azure LLM 2024 one-week CSVs have? Not checked.
- Can EIA-930 be replaced by a no-lag source for PACE (for example PacifiCorp OASIS)? Not researched.
- What are the IPCC AR5 factors exactly, from the primary source (AR5 WGIII Annex III Table A.III.2)? I only verified them through a secondary table.
## ENDPOINTS
* NASA POWER Hourly API | auth: none | tested: true | HTTP 200, 48 hourly values per parameter for SLC; Oct 1 2025 midday GHI about 730 W/m2. Fill value -999 for unavailable recent solar hours. | limits: No documented hard rate limit found; responses slow down as more parameters or hours are requested. | coverage: Global point data from 2001 to near-real-time. Max 15 parameters per request; LST or UTC. Observed: solar irradiance ends 2026-07-31 (about 3-month lag), T2M through 2026-10-22 (about 4-day lag).
   req: https://power.larc.nasa.gov/api/temporal/hourly/point?parameters=ALLSKY_SFC_SW_DWN,CLRSKY_SFC_SW_DWN,T2M&community=RE&longitude=-111.891&latitude=40.761&start=20251001&end=20251002&format=JSON&time-standard=LST
* NLR (ex-NREL) PVWatts v8 | auth: api_key: DEMO_KEY to explore, or a free signup key. The old developer.nrel.gov host is dead. | tested: true | HTTP 200, v8.5.0, no errors; 1 MW array gives 1,522,857 kWh/yr, capacity factor 17.38%, 8760 hourly AC values. | limits: Docs: DEMO_KEY 30/hour and 50/day per IP; own key 1,000/hour. Observed header X-Ratelimit-Limit: 10. | coverage: Hourly 8760 TMY PV output for any site in NSRDB coverage (SLC used NSRDB PSM V3 GOES tmy-2020)
   req: https://developer.nlr.gov/api/pvwatts/v8.json?api_key=DEMO_KEY&lat=40.761&lon=-111.891&system_capacity=1000&azimuth=180&tilt=30&array_type=1&module_type=0&losses=14&timeframe=hourly
* NLR NSRDB data download | auth: free api_key + email | tested: false | Not tested (needs a real key and email). | limits: 2,000 requests/day, 1 per 2 s, 20 concurrent; single-site CSV 10,000/day at 1/s | coverage: Satellite-derived solar irradiance (PSM v3/v4), Americas and more, many years
   req: https://developer.nlr.gov/api/nsrdb/v2/solar/... (needs api_key + email); bulk on AWS Open Data
* Open-Meteo Forecast API (solar radiation) | auth: none (non-commercial) | tested: true | HTTP 200, 72 hours (2026-10-26..28); midday GHI 535-569 W/m2 and GTI 807-848 W/m2 at SLC. | limits: Under 10,000 calls/day, 5,000/hour, 600/min, 300k/month; non-commercial only; CC BY 4.0 attribution | coverage: Global, hourly, up to 16-day forecast. A separate satellite radiation API and historical archive also exist.
   req: https://api.open-meteo.com/v1/forecast?latitude=40.761&longitude=-111.891&hourly=shortwave_radiation,direct_normal_irradiance,diffuse_radiation,global_tilted_irradiance,temperature_2m,cloud_cover,wind_speed_100m&tilt=30&azimuth=0&forecast_days=3&timezone=America%2FDenver
* EIA-930 Hourly Electric Grid Monitor bulk CSV | auth: none | tested: true | HTTP 200, 30.8 MB; PACE data through 2026-10-26 06:00 UTC; illustrative intensity PACE 470-750, CISO 67-322, ERCO 161-333, BPAT 68-83 g/kWh. | limits: About 30-48 MB per six-month file; no rate limit observed | coverage: All US balancing authorities, hourly demand, demand forecast, interchange and net generation by fuel. About 21 h lag at test time.
   req: https://www.eia.gov/electricity/gridmonitor/sixMonthFiles/EIA930_BALANCE_2026_Jul_Dec.csv
* EIA API v2 | auth: free registered api_key | tested: true | Without a key: HTTP 403 API_KEY_MISSING. | limits: Not checked | coverage: Same EIA-930 data, queryable
   req: https://api.eia.gov/v2/electricity/rto/fuel-type-data/data/?frequency=hourly&data[0]=value&facets[respondent][]=PACE&api_key=<free key>
* Alibaba cluster-trace-gpu-v2020 (PAI) | auth: none | tested: true | HEAD pai_job_table.tar.gz: HTTP 200, 62,065,432 bytes. | limits: task 34 MB, job 60 MB, instance 663 MB, sensor 388 MB compressed; no LICENSE file in repo | coverage: 6,500+ GPUs, about 1,800 machines, Jul-Aug 2020; job/task submit/start/end times, plan_gpu, gpu_type
   req: https://aliopentrace.oss-cn-beijing.aliyuncs.com/v2020GPUTraces/pai_task_table.tar.gz
* Alibaba cluster-trace-gpu-v2026 (ASI) | auth: none | tested: true | HEAD: HTTP 200, 1,188,295,031 bytes. | limits: summary 1.19 GB; pod_hourly 351.8 GB (impractical) | coverage: Six months, up to 155,410 GPUs; priority_class HP/LP, job_type training/online/offline inference, duration_hours, gpu_request
   req: https://tre-clusterdata.oss-cn-hangzhou.aliyuncs.com/cluster-trace-gpu-v2026/data/asi_opensource_job_execution_summary.zip
* Alibaba cluster-trace-gpu-v2023 | auth: none | tested: true | HTTP 206 range GET returned header and rows. | limits: About 575 KB per CSV | coverage: 8,152 GPU tasks, 1,523 nodes; GPU milli-requests, QoS, creation/deletion times
   req: https://raw.githubusercontent.com/alibaba/clusterdata/master/cluster-trace-gpu-v2023/csv/openb_pod_list_default.csv
* Azure LLM Inference Trace 2023 | auth: none | tested: true | HTTP 200/206, rows from 2023-11-16 18:17 seen. | limits: 320 KB + 719 KB; CC-BY-4.0 | coverage: Per-request TIMESTAMP, ContextTokens, GeneratedTokens for code and conversation services, Nov 2023
   req: https://raw.githubusercontent.com/Azure/AzurePublicDataset/master/data/AzureLLMInferenceTrace_code.csv
* Azure LLM Inference Trace 2024 (1 week) | auth: none | tested: false | Link read from the dataset doc; not downloaded. | limits: CC-BY-4.0; size not checked | coverage: May 10-19 2024 sample, same schema
   req: https://github.com/Azure/AzurePublicDataset/releases/download/dataset-llm-2024/AzureLLMInferenceTrace_code_1week.csv
* Azure Functions Trace 2019 | auth: none | tested: true | HEAD: HTTP 200, 142,968,140 bytes. | limits: 143 MB; CC-BY | coverage: Two weeks of function invocation counts and durations, 2019
   req: https://github.com/Azure/AzurePublicDataset/releases/download/dataset-functions-2019/azurefunctions_dataset2019_azurefunctions-dataset2019.tar.xz
* Microsoft Philly traces | auth: none | tested: false | README read; data not downloaded. | limits: 0.98 GB compressed / 6.6 GB; CC-BY-4.0 | coverage: 117,325 DNN training jobs, Aug-Dec 2017; submit and attempt start/end times, GPU lists
   req: https://github.com/msr-fiddle/philly-traces
* Google ClusterData2019 + PowerData2019 | auth: Google Cloud project / BigQuery account | tested: false | Not tested (needs a GCP account). | limits: 2.4 TiB compressed; BigQuery-only; CC-BY | coverage: 8 Borg cells, May 2019 (5-min CPU histograms, tiers incl. best-effort batch) plus 57 PDU power domains
   req: BigQuery: google.com:google-cluster-data.clusterdata_2019_* and powerdata_2019.cell*_pdu*
* MIT Supercloud Dataset | auth: none (AWS Open Data); v2 will require a data use agreement | tested: false | Not tested (size). | limits: About 2 TB; CC BY-NC-ND 4.0 | coverage: Slurm logs plus CPU/GPU time series (V100, 100 ms nvidia-smi per secondary source), including power draw
   req: s3://mit-supercloud-dataset/datacenter-challenge/202201/
* NLR GenAI Workload Power Profiles | auth: none | tested: true | HEAD: 302 redirect to a public presigned S3 URL (download not started). | limits: 1,021 MB zip; NLR data catalog license | coverage: 5/10 Hz power traces of training and inference (LLM, image) on the Kestrel HPC, plus modeled whole-facility profiles
   req: https://data.nlr.gov/system/files/312/1775845072-dataset.zip
* Sci Data 2026 high-res AI training power dataset | auth: none | tested: false | Article read; files not downloaded. | limits: CC BY-NC-ND 4.0 | coverage: 32 H100/B200 8-GPU node sessions plus 40 RTX 3060 sessions, up to 50 Hz
   req: https://doi.org/10.6084/m9.figshare.31654879
* WattTime API v3 | auth: free account login, then token | tested: false | Not tested (needs an account). | limits: Subscriber-only for other regions' historical/forecast data | coverage: Free: 0-100 MOER index in all regions; full historical and forecast MOER only CAISO_NORTH without subscription; 5-min, 72 h forecast
   req: https://api.watttime.org/v3/signal-index?region=CAISO_NORTH&signal_type=co2_moer (Bearer token)
* Electricity Maps | auth: token; 14-day free trial | tested: false | Pricing page text read via curl; API not tested. | limits: Paid (about EUR 6,000/yr per signal); Data Portal free historical CSVs reportedly under ODbL | coverage: Global zones, real-time and forecast carbon intensity
   req: https://api.electricitymap.org/v3/ (token)
