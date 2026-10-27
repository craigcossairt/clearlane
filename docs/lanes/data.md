# Data lane brief

Harness: **Codex desktop app**. Worktree: `C:\Users\Craig Cossairt\Code\clearlane-data`. Branch prefix: `data/`.
Tracking issue: **#2 "Lane: data status"**. Queue: `gh issue list --label lane:data --state open`.

Read `AGENTS.md` first. If this brief disagrees with `AGENTS.md` or `contracts/types.ts`, they win: follow them and say so on #2 so Integration fixes the brief.

All times are Mountain (MDT, UTC-6 until Sun Nov 1 2026).

| Train | When | What it means for you |
|---|---|---|
| 1 | Tue 1:45am | Contracts frozen. Only Integration changes `contracts/` after this, additively. |
| 2 | Tue 8:00am | CORE COMPLETE target: core issues 1-7 merged. |
| 3 | Tue 10:45am | Integration owes `contracts/flags.ts` and `contracts/envelope.v1.schema.json`. |
| 4 | Tue 2:00pm | Formal core checkpoint. CORE RED stops all stretch work. |
| 5 | Tue 5:30pm | Stretch-1 merged. |
| 6 | Tue 11:30pm | Feature freeze. Stretch-2 merged or cut. |
| 7, 8 | Wed 10:00am, noon | Fixes and copy only. |
| Freeze | Wed 2:00pm | Tag `v1-stage`. |

Tue about 9:16pm: Integration runs your refresh for the Oct 28 operating day. Hard stop 10:30pm; if prices are not posted by then, the stage stays on Oct 27, labeled. Craig is away Tue 11:00am-1:30pm and 6:00pm-11:00pm and asleep about 2am-7am; keep working your queue, Integration keeps merging.

---

## 1. Role and boundaries

You are the front of the pipeline: `prep/` (Python) writes `public/data/` (REAL), the engine reads it and writes `public/derived/` (DERIVED), and the app and pitch read those. Every stage number starts from a file you write, so your files must be exact, byte-reproducible and honestly labeled.

**You own, and may write:**

- `prep/**`: Python 3.13 standard-library fetchers, parsers, builders, tests and the oracle scripts.
- `public/data/**`: the committed REAL data files (bundles, history, Torus facts, stretch data files).
- `api/**`: the 2030.5-shaped export and the feed (stretch only).

**You also are:** the cross-family reviewer of every engine PR (Codex reviewing Claude). Comment only.

**You never:**

- Edit outside your paths: `contracts/`, `research/`, `docs/`, `tools/`, `.github/`, `engine/`, `app/`, `pitch/`, `science/`, or root files (`package.json`, `package-lock.json`, `tsconfig.json`, `vitest.config.ts`, `.gitignore`, `.gitattributes`). Need one changed: comment on the issue, or open a `lane:integration` issue (template in §8).
- Merge, approve, or push to `main`. Integration merges, data first in every train.
- Install a Python package or add an npm dependency. Standard library only: `urllib`, `zipfile`, `csv`, `json`, `xml.etree`, `statistics`, `random`, `hashlib`, `datetime`, `pathlib`, `subprocess`.
- Commit a raw download, `PACE.xlsx`, a copied third-party page, a key or a `.env`.
- Change a number to make a test pass. If your output disagrees with `docs/FACTS.md`, stop and report (§8).

**Lane done (AGENTS.md):** real bundles, May to Oct history and Torus facts committed and tested; the Tuesday-night refresh is one command.

**What consumers read from you:**

| File | Shape | Read by |
|---|---|---|
| `public/data/bundle_2026-10-27.json` | `Bundle` | engine pinned tests, app beats |
| `public/data/bundle_2026-10-28.json` | `Bundle` | written Tue night by `prep/refresh_tonight.py` (Integration runs it) |
| `public/data/hist_2026-05-01_2026-10-27.json` | `HistDay[]` | engine backtest, ui `any-day` |
| `public/data/hist_2026-05-01_2026-10-27.meta.json` | lane-defined sidecar (§6) | engine backtest window and missing days |
| `public/data/torus_published.json` | `TorusPublished` plus `sources` and `notes` | engine call sampler, ui `lineage`, pitch |
| `prep/data/eia_pace_hourly.csv` plus `.meta.json` | lane-defined (§6) | your builders, `response-tables` |
| `prep/reference/*.py` | oracle scripts | engine pinned tests |

---

## 2. Boot sequence

Run commands one per line (Windows PowerShell 5.1 has no `&&`).

```powershell
cd "C:\Users\Craig Cossairt\Code\clearlane-data"
git fetch origin
git switch --detach origin/main
git status --short --branch
python --version
node --version
gh auth status
Test-Path "..\clearlane-raw\eia\PACE.xlsx"
```

Expect: a clean tree; Python 3.13.x; Node 22.x; `gh` logged in as craigcossairt; `True` for the 75 MB EIA workbook (local only, never committed).

Read, in this order:

1. `AGENTS.md`
2. This file.
3. `contracts/types.ts`: `Provenance`, `SourceRef`, `Tagged`, `HourSignal`, `PeerNodeSeries`, `Bundle`, `HistDay`, `TorusPublished`, and `Envelope` (stretch).
4. `research/DATA-SOURCES.md`: every feed, limit and hour convention. §4 (worked example) and §5 (fetch plans) are the spec for your core.
5. `docs/FACTS.md`: the Time conventions block at the top, then the rows your files feed.
6. `research/TORUS.md`: the per-value URLs for `torus_published.json`.
7. `docs/STRETCH.md`: tiers, flags, your stretch rows (`rt-history`, `response-tables`, `export-2030-5`, `lasso-feed`, `territories`).
8. `docs/common-gotchas.md`.
9. `contracts/fixtures/bundle_2026-10-27.json` and `tools/make_fixture.py`: the fixture your real bundle replaces.
10. `research/analysis/scripts/snapshot.py` (OASIS parsing to generalize) and `research/analysis/demo-story/co2.py` (the xlsx streaming pattern).

Check network from this sandbox once:

```powershell
python -I -c "import urllib.request as u; print(u.urlopen('https://www.eia.gov/electricity/gridmonitor/', timeout=30).status)"
```

`200` means go. An error means the sandbox has no network: see §8 (Network) before starting any fetch issue.

Baseline and queue:

```powershell
npm run check:all
gh issue list --label lane:data --state open --json number,title,labels,milestone --limit 50
```

`npm run check:all` must be green on `origin/main` before you change anything (run `npm ci` first only if `node_modules` is missing). If it is red on `main`, that is not yours to fix: post it on #2 and on #1.

---

## 3. Per-issue loop

1. **Pick** the first open issue in the order of §4, then §5, whose same-lane dependencies are merged (`git log origin/main --oneline -- <path>` shows the file) and that has no `status:blocked` label. Skip blocked ones and take the next.
2. **Claim:** `gh issue comment <n> --body "claimed by codex"`.
3. **Branch:** `git fetch origin`, then `git switch -c data/<n>-<slug> origin/main` (slug: two to four lowercase words with hyphens, for example `data/21-oasis-client`).
4. **Test first.** Write the failing test in `prep/tests/test_<topic>.py`. Run it and watch it fail for the right reason:
   `python -I -m unittest discover -s prep/tests -t . -k <TestNameOrMethod>`
5. **Implement** until green. Then break the thing under test once on purpose (change a constant, drop a check), confirm the test you predicted fails, and revert. Record that in the PR.
6. **Gate:** `npm run check:all` green, and `git status --short` lists only paths you own.
7. **Commit and push:**
   ```powershell
   git add prep public/data api
   git commit -m "data: <what changed, plainly> (#<n>)"
   git push -u origin HEAD
   ```
   Never `git add -A`. Never stage a file under `..\clearlane-raw`.
8. **Open the PR.** Write the body to a file outside the worktree, then:
   ```powershell
   gh pr create --base main --title "[data] <issue title without the prefix>" --body-file "$env:TEMP\pr-<n>.md" --label lane:data --label status:needs-review
   ```
9. **Link:** `gh issue comment <n> --body "PR #<pr>: <one line>"`.
10. **Review loop.** Pitch (Grok Build) reviews every PR for overclaims, guardrails and em dashes; Integration may comment too. Fix on the same branch, push, and reply in the thread with what changed. You never merge.
11. **After merge:** `git fetch origin`, `git switch --detach origin/main`, back to step 1.

**At every train**, for each of your open branches:

```powershell
git switch <branch>
git fetch origin
git rebase origin/main
npm run check:all
git push --force-with-lease
```

Force-push only your own `data/*` branches.

**PR body template:**

```markdown
Closes #<n>

## What changed
- <file>: <what it does now>

## Evidence
<each command you ran and the last lines of its output; the number table the issue asks for>
Mutation check: <what you broke, which test failed, reverted>

## Provenance
- <file> <field>: REAL | DERIVED | TORUS_PUBLISHED | ASSUMPTION, from <source URL or repo path>

## Not done or UNVERIFIED
- <item>, or "Nothing"
```

---

## 4. Core queue

Due: merged by **Train 2 (Tue 8:00am)**; **Train 4 (Tue 2:00pm)** is the hard checkpoint. Work in this order. Items 1 and 2 are small and unblock other lanes, so they go first.

Module layout to aim for (create files as each issue needs them):

```text
prep/
  __init__.py          exists
  _paths.py            ROOT, RAW (env CLEARLANE_RAW, else ROOT.parent / "clearlane-raw"), PUBLIC_DATA
  jsonio.py            deterministic JSON writer (§6)
  mtday.py             Mountain-day and UTC mapping (explicit offsets, no zoneinfo)
  oasis.py             OASIS client, parsers, CLI
  eia.py               PACE.xlsx extract, CLI
  validate.py          shape validators for Bundle, HistDay[], TorusPublished (tests and refresh share them)
  build_torus.py       build_bundle.py   build_hist.py   refresh_tonight.py
  reference/           oracle copies of the research scripts
  data/                eia_pace_hourly.csv, eia_pace_hourly.meta.json
  tests/               test_*.py, fixtures/
```

### Core 1. Reference oracles

**Goal.** The engine pins its numbers against the research scripts. Put runnable copies in `prep/reference/` so anyone can reproduce the FACTS values with one command.

**Build.** Copy `research/analysis/demo-story/{fix.py, numbers.py, habit.py, co2.py}` to `prep/reference/{fix.py, stage_numbers.py, habit.py, co2.py}` with only these edits:

- `{R}/oasis/` becomes `{R}/data/oasis/` (the research tree moved; the scripts crash with "mean requires at least one data point" without this). Verified: with only this change, `fix.py` prints every C3 value below.
- `numbers.py` is renamed `stage_numbers.py`: a file named `numbers.py` shadows the standard `numbers` module that `statistics` imports whenever its folder is on `sys.path`.
- Every `open(...)` gains `encoding="utf-8"` (and `newline=""` for CSV).
- A header comment names the source path and says "oracle copy: do not change the arithmetic".
- `prep/reference/README.md`: the four commands and their expected key lines.

No arithmetic change of any kind. `numbers.py`'s own crash section has an index bug; use `fix.py` for call shares and do not fix it.

**Tests** (`prep/tests/test_reference.py`): run each script with `subprocess.run([sys.executable, "-I", ...], cwd=ROOT, capture_output=True, text=True, encoding="utf-8", check=True)` and assert these substrings (they are what the scripts print today):

- `python -I prep/reference/fix.py research prep/reference/stage_numbers.py`: `price-only (value $65.79/MW-day)`; `local 276/359=77%; UTC->MDT 186/359=52%; UTC->MST 156/359=43%`; `wear $10/MWh: gross $57.54/MW-day`; `local 142/359=40%; UTC->MDT 65/359=18%; UTC->MST 51/359=14%`; `gross $55.56/MW-day`; `July: wear-10 gross mean $48.52/MW-day`; `Oct: wear-10 gross mean $39.71/MW-day`.
- `python -I prep/reference/stage_numbers.py research`: `price-only plan value $65.79/MW-day`; `July 2026: 30 days; price-only 1MW/2MWh daily value mean $51.74`; `Oct 1-25 2026: 25 days; price-only 1MW/2MWh daily value mean $48.68`; `price-only value $4,605`; `price-only value $32,896`; `$2,551 at Oct 27 DA prices`.
- `python -I prep/reference/habit.py research`: regex `value \$\s*20\.06/MW-day`; `charge cost $39.53/MWh`; `timetable vs habit: value x2.91`; `70 MW: habit $1,405/day, -18.4 t CO2/day ; timetable $4,088/day, +18.9 t CO2/day`; `500 MW: habit $10,032/day, -131.2 t CO2/day ; timetable $29,203/day, +134.9 t CO2/day`.
- `co2.py` needs `..\clearlane-raw\eia\PACE.xlsx`, which CI does not have: `skipUnless` that file exists, with the skip reason naming the path. Assert `HE16   446  n=25` and `HE19   629  n=25`. CI still pins this profile through Core 4's extract test.

**Verify.** `python -I -m unittest discover -s prep/tests -t . -k test_reference`; in the PR, show that changing `ETA` in a scratch copy makes the fix.py case fail.

**Depends on:** nothing.

### Core 2. Torus published facts file

**Goal.** `public/data/torus_published.json`: every Torus number the build may use, each tagged `TORUS_PUBLISHED` with its own source URL, so the lineage panel can show where it came from.

**Build.** `prep/build_torus.py` holds the values as constants (never scraped), each with its source from `research/TORUS.md`, and writes the file with the §6 writer.

| Key | Value | Source (from `research/TORUS.md`) |
|---|---|---|
| `events_2025_total` | 359 | https://www.torus.co/case-studies/case-studies-rocky-mountain-power |
| `events_2025_by_hour` | [9,41,5,4,1,3,4,14,23,26,25,20,15,33,19,14,14,8,6,4,5,34,24,8] (index 0 = 12am) | https://www.datocms-assets.com/93357/1778881001-vpp-events-rmp.jpg |
| `events_2025_by_weekday` | [50,57,43,57,53,45,54] (Mon to Sun) | same image |
| `ramp_s`, `ramp_target_s` | 19, 30 | https://www.datocms-assets.com/93357/1778882593-unplanned-ffr-rmp-1.jpg |
| `delivered_pct`, `delivered_band_pct` | 102, [90, 100] | same event image |
| `spin_c_rate`, `spin_cycle_life`, `spin_discharge_recharge_min` | 10, 25000, 12 | https://www.torus.co/torus-flywheel |
| `pulse_c_rate`, `pulse_cycle_life` | 0.5, 7500 | https://www.torus.co/torus-nova-pulse |
| `pulse_life_yr` | 25 | https://www.torus.co/torus-nova (this is the **Station** lifespan) |
| `mou_mw` | 70 | https://www.businesswire.com/news/home/20250127668054/en/Rocky-Mountain-Power-and-Torus-Announce-Strategic-Partnership |
| `mou_ceiling_mw` | 500 | https://www.torus.co/news/torus-raises-200-million-from-magnetar-deployment-of-modular-power-plants |

Shape: each key is `{ "value": ..., "prov": "TORUS_PUBLISHED", "source_id": "<id>" }`. Add top-level `"sources": SourceRef[]` (one per distinct URL; `license`: "Torus public web page, facts only, no text copied"; `retrieved_utc`: `"2026-10-26"`, the date `research/TORUS.md` says it was checked, because no time of day was recorded) and `"notes": string[]` containing, in plain words:

- The heatmap states no time zone; always show it read as Mountain time and as UTC.
- 359 is the RMP case study count; Torus's 2025 wrap-up says "more than 360". We use 359.
- `pulse_life_yr` is the Torus Station lifespan of 25 years, not a Pulse-specific rating.
- 500 MW is the ceiling of the expanded MOU, not installed capacity.

**Tests** (`test_torus.py`): all 15 keys present; every `prov` is `TORUS_PUBLISHED`; every `source_id` resolves to a `sources` entry with an `https://` URL; by-hour has 24 entries summing to 359; by-weekday has 7 summing to 359; total equals both sums; values equal the table above; two builds give identical bytes; no em dash (U+2014) anywhere in the file.

**Verify.** `python -I prep/build_torus.py`, then `python -I -m unittest discover -s prep/tests -t . -k test_torus`.

**Depends on:** nothing. Integration must add optional `sources?` and `notes?` to `TorusPublished` (see notes on #2).

### Core 3. OASIS client, parsers and Mountain-day mapping

**Goal.** One tested module that fetches CAISO OASIS with no key under the published limits, caches every raw response in `..\clearlane-raw`, and parses the three day-ahead reports into rows keyed by UTC interval start.

**Build** `prep/oasis.py` and `prep/mtday.py`:

- `build_url(query, start, end, **params)` for SingleZip and GroupZip. Times as `YYYYMMDDTHH:MM-0000` (GMT). Start inclusive, end exclusive.
- `fetch(url, cache_path, transport=None, clock=None)`: at least 5 s between calls (injectable clock and sleep), HTTP 429 means sleep 30 s and retry, at most 3 retries, then raise. Detect error responses before parsing (zip member ends `.xml` when CSV was asked, or the body contains `<m:ERR_CODE>`) and raise `OasisError(code, message)`. Save the raw zip to `RAW/oasis/<query>/<start>_<end>[_<nodes>].zip` plus `.meta.json` (`url`, `retrieved_utc`, `sha256`, `bytes`). A cache hit makes no network call unless `--refetch`.
- Parsers: `parse_prc_lmp` (PRC_LMP DAM v12: keep `LMP` and `MCC` rows; the value column is `MW`), `parse_sld_fcst` (SLD_FCST DAM v1, filter `TAC_AREA_NAME == "PACE"`), `parse_edam_wind_solar` (GroupZip EDAM_WND_SLR_FORECAST_GRP v1, XML namespace `http://www.caiso.com/soa/EDAMWindAndSolarForecast_v1.xsd`, `REPORT_DATA` fields `INTERVAL_START_GMT`, `BAA_GRP_ID`, `SOLAR`, `WIND`; filter PACE; clamp negative solar to 0 and count clamps). Normalize timestamps to `YYYY-MM-DDTHH:MM:SSZ`; rows come back unsorted, so sort on UTC start. Parse `OPR_HR` as an integer (DAM is not zero-padded, RTM is).
- `mtday.py`: `mountain_day_hours(day)` gives the 24 UTC starts from `day` 06:00Z; `local_mt(ts)` gives `2026-10-27T00:00-06:00`; `caiso_operating_days(day)` gives `(day-1, day)`. Fixed UTC-6 with a guard that raises for dates outside May 1 to Oct 31 2026. Do not use `zoneinfo`: this PC's Python has no tz database (`ZoneInfoNotFoundError` for `America/Denver`).
- CLI: `python -I prep/oasis.py fetch prc_lmp --start 2026-10-27T06:00Z --end 2026-10-28T06:00Z --nodes ELAP_PACE-APND` prints row counts and the cache path.

**Fixtures.** `prep/tests/fixtures/oasis/`: a few rows trimmed from the research extracts already in git (`research/data/caiso2`, `caiso3`, `caiso4`, and the 1004 error XML in `caiso6`). Tests zip them in memory.

**Tests** (`test_oasis.py`, no network): each parser on its fixture; sorting; timestamp normalization; padded and unpadded `OPR_HR`; the error zip raises `OasisError` with code 1004; a fake clock records at least 5 s between calls; 429 then success sleeps 30 s; three 429s raise; a cache hit calls no transport; Mountain hour 0 of day D maps to CAISO OPR_DT D-1, OPR_HR 24.

**Verify.** `python -I -m unittest discover -s prep/tests -t . -k test_oasis`, then one live smoke call with the CLI above (cached afterward).

**Depends on:** nothing. Network needed only for the smoke call.

### Core 4. Hourly CO2 extract from EIA PACE.xlsx

**Goal.** A small committed CSV of PACE hourly CO2 and demand, so builders and CI never need the 75 MB workbook.

**Build** `prep/eia.py`:

- Stream-parse `..\clearlane-raw\eia\PACE.xlsx` with `zipfile` and `xml.etree.ElementTree.iterparse` (`xl/sharedStrings.xml`, then `xl/worksheets/sheet1.xml`, columns by header name, `el.clear()` per row). Copy the pattern in `research/analysis/demo-story/co2.py`. About 15 s.
- Sheet 1 headers include `UTC time`, `Local date`, `Hour` (local hour ending 1-24), `Demand forecast`, `Demand`, `Net generation`, `CO2 Emissions Generated` (metric tonnes), `CO2 Emissions Intensity for Generated Electricity` and `... for Consumed Electricity` (lb/kWh). Dates are Excel serials from 1899-12-30; `UTC time` carries a fraction (46321.25 is 06:00). UTC interval start = `UTC time` minus 1 hour.
- Write `prep/data/eia_pace_hourly.csv` from 2025-07-01 onward with columns `utc_start, local_date, hour_ending, demand_mw, demand_fcst_mw, net_gen_mw, co2_t, co2_gen_lb_kwh, co2_cons_lb_kwh`, values exactly as in the workbook (no rounding), blank cells left blank (never 0).
- `prep/data/eia_pace_hourly.meta.json`: source URL `https://www.eia.gov/electricity/gridmonitor/knownissues/xls/PACE.xlsx`, license "public domain (US government); credit the U.S. Energy Information Administration", `sha256` of the workbook, its file time labeled as such, first and last `utc_start`, row count, and the last hour with CO2.
- CLI: `python -I prep/eia.py --extract` reads the local workbook; adding `--fetch` downloads a fresh one to `RAW/eia/PACE_<yyyymmddThhmmZ>.xlsx` first, then extracts from it.

As of the research copy, the workbook runs 2015-07-01 to 2026-10-26 and its last CO2 hour is local Oct 25 HE24.

**Tests** (`test_eia.py`): a tiny synthetic xlsx built in the test with `zipfile` (shared strings, three rows, one blank CO2 cell) parses to the expected rows with the blank kept as missing and the serial date converted; and, on the committed extract, the Oct 1-25 2026 mean of `co2_gen_lb_kwh * 453.592` by `hour_ending`, formatted with `:.0f`, equals the C4 profile exactly: {1:697, 2:697, 3:695, 4:694, 5:698, 6:704, 7:709, 8:698, 9:623, 10:534, 11:485, 12:461, 13:455, 14:450, 15:443, 16:446, 17:464, 18:531, 19:629, 20:673, 21:676, 22:682, 23:684, 24:693}.

**Verify.** `python -I prep/eia.py --extract`, then `python -I -m unittest discover -s prep/tests -t . -k test_eia`. Check the CSV is under about 1.5 MB.

**Depends on:** nothing (reads the local raw workbook).

### Core 5. Real Oct 27 bundle

**Goal.** `public/data/bundle_2026-10-27.json`: the real Mountain day Oct 27 (24 hours from 2026-10-27T06:00Z), replacing the fixture.

**Build** `prep/build_bundle.py --day 2026-10-27 [--refetch] [--co2-window-days 30 | --co2-window 2026-10-01:2026-10-25] [--out PATH]`:

- PRC_LMP DAM, one call with 06:00Z bounds and nodes `ELAP_PACE-APND,ELAP_PACW-APND,ELAP_PGE-APND,TH_SP15_GEN-APND`.
- SLD_FCST DAM and the EDAM GroupZip, one call per CAISO operating day for D-1 and D (07:00Z bounds), then slice to the Mountain day. 06:00Z bounds are untested for these two.
- **Hour 0** is CAISO OPR_DT Oct 26, HE24: LMP 30.21857 (rounds to 30.22), MCC -0.71, from `research/analysis/option2/oct/20260930_20261028_PRC_LMP_DAM_20261026_20_37_47_v12.csv`. Its load and wind are not cached anywhere, so this issue needs the operating-day Oct 26 SLD_FCST and EDAM calls. Say in `notes` that hour 0 comes from the previous CAISO operating day.
- Rounding: `lmp`, `mcc`, `load`, `solar`, `wind` to 2 decimals (the snapshot convention, so "to the cent" matches); `net_load_mw = round(load - solar - wind, 2)` from the rounded parts, prov DERIVED; peers rounded to 2 decimals.
- CO2 per hour: an observed EIA hour gives `co2_kind: "eia_observed_avg"`, prov REAL. Otherwise `eia_profile_avg_30d`, prov DERIVED: the mean over the trailing 30 observed Mountain days before D at the same UTC hour, `co2_gen_lb_kwh * 453.592`, rounded to an integer like the fixture. For Oct 27 that window is Sep 26 to Oct 25 (the extract has no later CO2). The `--co2-window` override reproduces the fixture's Oct 1-25 profile if Integration chooses it. Record the window and n in `notes`.
- `sources`: one `SourceRef` per call with the exact https URL called, `retrieved_utc` from the cache meta, and license "CAISO Terms of Use (https://www.caiso.com/privacy-terms-of-use): limited license, credit California ISO" for OASIS and the EIA line for CO2. `notes` includes "Price and forecast data: California ISO OASIS."
- `data_mode: "snapshot"`; `fetched_utc` = the latest `retrieved_utc` among the inputs, so a rebuild from cache is byte-identical.

**Tests** (`test_bundle.py`, reads the committed file):

- [ ] schema, node, `operating_day_mt`, 24 hours; `ts_utc` = D 06:00Z + i hours; `hour_mt == i`; `local_mt` format.
- [ ] Hours 1..23 equal `research/data/pace_snapshot_2026-10-27.csv` rows 0..22 at 2 decimals for lmp, mcc, load, solar and wind, and the three peer columns.
- [ ] Hour 0: lmp 30.22, mcc -0.71, and a note naming the previous operating day.
- [ ] Solar never below 0; `net_load_mw` identity holds; every hour has all five prov fields; `co2_kind` agrees with prov.
- [ ] Source ids unique and https; no NaN or null in required fields; no em dash in any string.
- [ ] A generic test validates every `public/data/bundle_*.json` with `prep/validate.py` (the Oct 28 bundle is checked the same way).

**Evidence for the PR:** the 24-row table, and a per-hour diff against the fixture (hour 0 moves from 46.11, which is Oct 28's midnight, to 30.22; CO2 moves if the window differs).

**Verify.** `python -I prep/build_bundle.py --day 2026-10-27`; a second run with `--out "$env:TEMP\b.json"` and a byte comparison (`python -I -c "import filecmp,sys; print(filecmp.cmp(sys.argv[1], sys.argv[2], shallow=False))" public\data\bundle_2026-10-27.json "$env:TEMP\b.json"` prints `True`); `npm run check:all`.

**Depends on:** Core 3, Core 4.

### Core 6. May 1 to Oct 27 history

**Goal.** `public/data/hist_2026-05-01_2026-10-27.json` (`HistDay[]`) for the backtest and the any-day picker, plus a sidecar listing what is missing and why.

**Build** `prep/build_hist.py`:

- Six PRC_LMP DAM calls with 06:00Z bounds, at least 5 s apart (DATA-SOURCES §5): 20260501-20260531, 20260531-20260630, 20260630-20260730, 20260730-20260829, 20260829-20260928, 20260928-20261028, each `T06:00-0000`. Request all four nodes in each call so `territories` later needs no fetch.
- One `HistDay` per complete Mountain day, in date order. Prices **as published**, no rounding (the research backtest reads raw `MW`, and the C2/C3 means only reproduce that way). CO2 from the extract, `co2_gen_lb_kwh * 453.592` rounded to 0.1, `null` where EIA has no value.
- A day with fewer than 24 priced hours is left out and listed, never filled. May 1 has 23 priced hours (its hour 0 is operating day Apr 30, before EDAM began).
- Sidecar `hist_2026-05-01_2026-10-27.meta.json`: `schema: "clearlane.hist_meta/v1"`, window, `days`, `missing_days: [{day, hours_present, reason}]`, `co2_null_hours` per day where any, `sources`, `fetched_utc`, `notes`.
- CLI: `python -I prep/build_hist.py` builds from the cache, fetching any window it lacks; `--fetch-only` fills the cache and writes nothing (so another checkout with network can run the fetch for you).

**Tests** (`test_hist.py`):

- [ ] Every day has 24 finite prices and 24 CO2 entries (number above 0 or null); days strictly increasing.
- [ ] Days plus missing days = 180 (May 1 to Oct 27); May 1 is listed missing with its reason; no day appears in both.
- [ ] Jul 1-30 prices equal `research/data/oasis/dam_jul/` exactly and Oct 1-25 equal `research/data/oasis/dam_oct/` exactly (this pins the C2/C3 inputs). If CAISO revised a price, the test fails: report it, do not adjust.
- [ ] Oct 27 hours 1..23 equal the bundle's prices at 2 decimals.
- [ ] Two builds from cache give identical bytes.

**Verify.** `python -I prep/build_hist.py`, `python -I -m unittest discover -s prep/tests -t . -k test_hist`, `npm run check:all`. Paste the missing-day list in the PR.

**Depends on:** Core 3, Core 4.

### Core 7. One-command Oct 28 refresh

**Goal.** Integration runs one command at about 9:16pm Tue to build `public/data/bundle_2026-10-28.json`. On any failure it exits non-zero and changes nothing.

**Build** `prep/refresh_tonight.py --day 2026-10-28 [--dry-run] [--poll-until 22:30] [--oasis-base URL]`:

- Fresh fetches (no cache reuse) into `RAW/refresh/<day>-<utcstamp>/`: PRC_LMP for the Mountain day (06:00Z bounds, four nodes), SLD_FCST and EDAM for operating days D-1 and D. CO2 uses the committed extract (no 75 MB download at night).
- Build into a temp file, validate with `prep/validate.py` plus "24 priced hours, no null", then `os.replace` into `public/data/`. `--dry-run` does everything except the replace and prints `DRY RUN: would write <path>`.
- Exit codes: **0** written (or dry run green); **1** data not ready or invalid, nothing changed; **2** could not run (bad arguments, raw folder not writable, Python error). Never exit 0 on a partial day.
- `--poll-until 22:30` retries the price fetch every 300 s until that Mountain time, then exits 1 with "Oct 28 prices not posted by 22:30; stay on Oct 27".
- After writing: run `python -I -m unittest discover -s prep/tests -t .`, then print a per-hour table of Oct 28 against Oct 27 (price, net load, CO2), daily min, max and mean, and the next commands for Integration (`git add public/data/bundle_2026-10-28.json`, then the engine CLIs). It never commits.

**Tests** (`test_refresh.py`, fake transport): success writes via temp then replace; dry run writes nothing; an OASIS error, a 23-hour day, and a validation failure each exit 1 and leave every file under `public/data` byte-identical (hash before and after); removing the validation call makes the planted-bad-bundle case fail (mutation check in the PR).

**Verify.**

```powershell
python -I prep/refresh_tonight.py --day 2026-10-27 --dry-run
python -I prep/refresh_tonight.py --day 2026-10-28 --dry-run --oasis-base https://oasis.invalid
git status --porcelain public/data
```

The first exits 0, the second exits 1, the third prints nothing.

**Depends on:** Core 5.

### Core 8. Cross-family review of engine PRs (standing)

**Goal.** A second model family reads every engine PR before it merges, looking for bugs and contract mismatches.

**How.**

- At every train and whenever an engine PR opens or gets new commits: `gh pr list --label lane:engine --state open`.
- Read `gh pr diff <n>` against `contracts/types.ts` and your data files. Use the Codex app's review on the diff as well (a `codex review` CLI command may exist in your build; UNVERIFIED).
- To run it, use a throwaway detached worktree: `git worktree add --detach ..\clearlane-review <head sha>`, run `npm run check:all` there, then `git worktree remove ..\clearlane-review`. Never check engine branches out in your own worktree.
- Look for: field names, units and hour indexing that differ from the contract or the data (hour 0, Mountain vs UTC, hour beginning vs ending); numbers that do not trace to `public/data`, `docs/FACTS.md` or the engine; missing provenance; non-determinism (unseeded random, `Date.now()` in output); tests that cannot fail; Torus guardrail breaks in strings.
- Post: `gh pr review <n> --comment --body-file "$env:TEMP\review-<n>.md"`. First line: `cross-review: reviewed <head sha> by codex (data lane)`. Then one line per finding: `BLOCKING|NIT <path>:<line> <what is wrong> <why> <suggested fix>`, or "No findings". Never approve or request changes.
- At each train, comment on this issue with the PRs and head SHAs you reviewed.

**Depends on:** nothing. Runs through every tier until freeze.

---

## 5. Stretch queue

Start rules (`docs/STRETCH.md`):

- **Stretch-1** starts when your core issues are merged and Integration has posted **CORE GREEN**. Exception: the unattended `rt-history` fetch may start once your core PRs are open and green. Deadline **Train 5, Tue 5:30pm**.
- **Stretch-2** starts when your stretch-1 items are merged or cut. Deadline **Train 6, Tue 11:30pm**.
- **Moonshot:** none in this lane. After stretch-2, review other lanes' PRs, regenerate your stretch files after the Oct 28 refresh, and support rehearsal. Never take work in another lane's paths.
- **CORE RED** posted on #2 means stop stretch commits at once and take core fixes until **CORE GREEN**.

Every stretch PR carries: its flag in the title and body; flag-off evidence (the diff touches no core data file, meaning `bundle_*`, `hist_2026-05-01_2026-10-27*`, `torus_published.json` or `prep/data/eia_pace_hourly.*`, and `npm run check:all` is green, which runs the engine pins and the six-beat tests); a prov on every new number; and Grok's review for overclaims, guardrails and em dashes.

| Order | Tier | Item | Flag | Hours (ceiling) |
|---|---|---|---|---|
| 9 | stretch-1 | `rt-history` | `off_rt_history` | 1.5 |
| 10 | stretch-1 | `response-tables` | `off_response_tables` | 2 |
| 11 | stretch-1 | `export-2030-5` | `ff_export_2030_5` | 1.5 |
| 12 | stretch-2 | `lasso-feed` | `off_lasso_feed` | 1.5 |
| 13 | stretch-2 | `territories` | `ff_territories` | 1.5 |

`off_*` means nothing in the six beats imports the file. `ff_*` stage flags are registered by Integration in `contracts/flags.ts` (owed by Train 3), default off; the app reads them, not you.

### 9. rt-history (stretch-1, `off_rt_history`)

- `prep/rt_history.py` fetches OASIS real-time prices for ELAP_PACE-APND for May 1 to Oct 27 2026 and Nov 1 2025 to Apr 30 2026: PRC_RTPD_LMP (15-minute) first, PRC_INTVL_LMP (5-minute, `market_run_id=RTM`, `version=1`) as fallback. Query names, versions and window caps for interval data are UNVERIFIED: try one day first, and drop to one-day calls if a longer window errors. Pace every call (5 s, 30 s on 429, 3 retries); cache each window so a killed run resumes.
- Start the fetch first and let it run in its own terminal while you work on `response-tables`: `python -I prep/rt_history.py fetch --log ..\clearlane-raw\rt\fetch.log`.
- Output `public/data/rt_2026-05-01_2026-10-27.json` and `public/data/rt_2025-11-01_2026-04-30.json`: `schema: "clearlane.rt/v1"`, node, `interval_min: 15`, `days: [{operating_day_mt, ts_utc[], lmp_usd_mwh[]}]` with `null` for a missing interval, `missing: [...]`, sources, notes. A 15-minute value from the 5-minute path is the mean of all three intervals; fewer than three means missing.
- DST: Mountain days are 96 intervals, except **Nov 2 2025 (100)** and **Mar 8 2026 (92)**; keying by UTC start means no hour repeats or vanishes. Implement offsets explicitly (no `zoneinfo`).
- Winter values are labeled "RT proxy": EDAM's day-ahead market did not exist then.
- Tests: a fixture checks the day boundary on both sides of each DST change; missing intervals are listed and null, never filled; the 5-minute path matches `research/data/caiso1/20261025_20261025_PRC_INTVL_LMP_RTM_20261026_20_16_14_v1.csv` (Oct 25, 07:00Z-08:55Z, 24 intervals, LMP rows) to the cent.
- Commit only 15-minute or hourly aggregates; raw 5-minute files stay in `..\clearlane-raw\rt\`.

### 10. response-tables (stretch-1, `off_response_tables`)

`prep/response_tables.py` (stdlib, `python -I`) writes `public/data/response_tables.json` with three tables, every table carrying source URLs, prov DERIVED and a plain caveat:

- **(a) Marginal CO2** per hour of day x season: OLS slope of the hourly change in `co2_t` on the hourly change in `net_gen_mw`, times 1,000 for g/kWh (1 t/MWh = 1,000 g/kWh). Consumed-basis variant on the change in `demand_mw`, with consumed tonnes = `co2_cons_lb_kwh * demand_mw * 1000 / 2204.62262`. Each bin has n, R2 and a seeded 90% bootstrap interval (seed 20261027, 1,000 resamples, 5th and 95th percentiles; state both choices as ASSUMPTION). A bin whose interval spans zero is flagged `inconclusive`, never dropped. Seasons are meteorological (DJF, MAM, JJA, SON; ASSUMPTION). Data: the extract from 2025-07-01.
- **(b) Forecast residuals:** whole-day vectors of PACE demand forecast minus demand, May to Oct 2026, from `research/data/eia930/PACE_EIA930_BALANCE_2026_*.csv` (in the repo; they end about Oct 25) or the extract. Bad hours are excluded and listed with the rule that caught them. Starting rule (ASSUMPTION, state it in the file): demand missing or at most 0, or demand outside 0.5x to 1.5x the forecast. It must catch Jan 8 2026 (1,137 MW against a 6,048 MW forecast).
- **(c) Price response:** slope of DA LMP on net load per Mountain hour of day (24 bins), with interval and R2. Net load as in the bundle (SLD_FCST load minus EDAM solar and wind), fetched May to Oct under the fetch rules and cached. If that fetch is not done in time, use EIA-930 demand minus EIA solar and wind generation and say so in the table.
- Tests: OLS recovers exact slopes on synthetic data to 1e-9; a fixed seed gives byte-identical output; a planted bad hour is excluded and listed.
- Caveats to carry: EIA's hourly CO2 is fuel-type generation times EIA factors, so the slope measures fuel-mix response, not plant heat rates; PACE exports most hours and midday curtailment is invisible in net generation. Method after Siler-Evans, Azevedo and Morgan 2012 (citation UNVERIFIED, not opened).

### 11. export-2030-5 (stretch-1, `ff_export_2030_5`)

- `api/export2030_5.ts` converts an `Envelope` into DERControlList-shaped XML and JSON: one DERControl per hour, `interval.start` = Unix seconds of `ts_utc`, `interval.duration` = 3600, power limits from `max_discharge_kw` and `max_charge_kw`, System Critical Hours carrying a plain-words description.
- Vitest (`api/test/export2030_5.test.ts`): 24 controls; starts strictly increasing by 3600; every limit in its allowed range; parsing the output back reproduces the envelope kW within 1 kW (`// @vitest-environment jsdom` gives `DOMParser`; jsdom is already a dev dependency).
- Build against a hand-written SIMULATED envelope fixture under `api/test/fixtures/` that validates against `contracts/envelope.v1.schema.json`; switch to the engine's `public/derived/envelope_<day>.json` once it exists.
- `api/docs/2030.5-mapping.md` marks every field VERIFIED (with the URL of the page you opened) or UNVERIFIED, after you open the SunSpec CSIP Implementation Guide. Field names so far come from search excerpts only (opModMaxLimW, opModFixedW, DefaultDERControl, potentiallySuperseded); opModExpLimW, opModImpLimW, sign conventions, the watts multiplier and the 2030.5 revision RMP uses are UNVERIFIED. If the guide cannot be opened, every field stays UNVERIFIED.
- Every place it shows, the label reads "2030.5-shaped, not certified".
- Blocked until Integration widens `vitest.config.ts` and `tsconfig.json` to include `api/**` and lands `contracts/envelope.v1.schema.json`. Ask on day one of stretch (§8 template).

### 12. lasso-feed (stretch-2, `off_lasso_feed`)

- `api/openapi.yaml` (OpenAPI 3.1) documents GET `/v1/signal/{day}` (24 rows: lane, system_critical, lmp, net_load, co2, each with prov), `/v1/envelope/{day}`, `/v1/fleet/{day}` and `/v1/envelope/{day}/2030.5`.
- `api/feed.ts` exports a pure handler that serves them from the committed `public/data` and `public/derived` files, with no network and no key. A missing source file returns 404 with a reason (for example, no fleet file until the engine's `fleet-rollup` merges).
- The same responses are written as static examples in `api/examples/`. They regenerate after the Tue-night refresh: give Integration the command.
- Vitest contract test loads one example per route and checks the schema id, `generated_utc`, `data_mode` and a prov on every value; a planted missing prov fails it.
- Lasso's API is not public, so this is a proposed shape, never an integration. Never say Torus or Lasso agreed to consume it. No hosted deploy.
- Same-lane dependency: `export-2030-5`. Cross-lane: the engine's envelope file and `fleet-rollup`.

### 13. territories (stretch-2, `ff_territories`)

- From the history fetch cache (Core 6 already pulled all four nodes), build `public/data/hist_pacw_2026-05-01_2026-10-27.json` and `public/data/hist_pge_2026-10-01_2026-10-27.json` in the HistDay schema, plus a meta sidecar each. PGE joined EDAM Oct 1 (`research/notes/utah-grid.findings.md`), so its window is 27 days, and the files say so.
- Price only: `co2_g_kwh` is all null with a note "price only; CO2 for PACW and PGE is out of scope".
- Unittest: 24 hours per day, missing days listed, and the builder fails on any filled or duplicated value (planted case).
- The engine backtest CLI should run unchanged with a node argument and write `backtest_<node>.json`. If it lacks the argument, open a one-line `lane:engine` issue; do not edit `engine/`.
- Wattsmart is an RMP program, so on other nodes the envelope is a format proposal only.

---

## 6. Domain notes

**Running Python.** Always `python -I <script> <args>`. Under `-I`, `python -I -m prep.x` fails with `No module named 'prep'`, and a script cannot import its siblings. Every CLI script starts with:

```python
import sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
from prep import oasis  # noqa: E402
```

Tests import `from prep import ...` and work because `unittest discover -t .` puts the repo root on the path. Always pass `encoding="utf-8"`; write files with `newline="\n"`. CI is Ubuntu, Node 22, Python 3.13: mind case-sensitive paths and forward slashes.

**Deterministic files** (the `reproduce` stretch checks SHA-256 of every `public/data` file):

```python
text = json.dumps(obj, indent=2, ensure_ascii=False, allow_nan=False) + "\n"
tmp = path.with_suffix(path.suffix + ".tmp")
with open(tmp, "w", encoding="utf-8", newline="\n") as f:
    f.write(text)
os.replace(tmp, path)
```

Timestamps as `YYYY-MM-DDTHH:MM:SSZ`. `fetched_utc` and `retrieved_utc` come from the raw cache meta, never from the current clock, so a rebuild from cache is byte-identical. Seed every random draw.

**Raw folder.** `C:\Users\Craig Cossairt\Code\clearlane-raw` (resolved as `<repo>\..\clearlane-raw`; override with `CLEARLANE_RAW`). It already holds `eia\PACE.xlsx` and the full EIA-930 six-month CSVs. Write OASIS responses under `oasis\`, refresh runs under `refresh\`, RT under `rt\`. Never write raw files inside the worktree.

**OASIS rules** (`research/DATA-SOURCES.md` §1):

- Base `https://oasis.caiso.com/oasisapi/SingleZip?` or `GroupZip?`. `resultformat=6` is zipped CSV, `5` zipped XML.
- Window cap: a 40-day query returned error 1004; 30 days works; exactly 31 is untested. Use 30.
- Errors come back as a zip holding XML even when you asked for CSV.
- At least 5 s between calls; 30 s backoff on 429; 3 retries. No CORS, so the browser can never call OASIS.
- `OPR_DT` is the Pacific operating date; `OPR_HR` is Pacific hour ending. Join on UTC interval start, never on `OPR_HR`.
- File-name stamps are Pacific time.

**Mountain day.** Day D = the 24 hours from D 06:00Z (MDT, through Oct 31 2026). Mountain hour beginning m = 1..23 is CAISO OPR_DT D, OPR_HR m. **Mountain hour 0 is OPR_DT D-1, OPR_HR 24.** EDAM began with operating day May 1, so May 1 has 23 priced hours and May 2 is the first full day.

**The Oct 27 snapshot is not a Mountain day.** `research/data/pace_snapshot_2026-10-27.csv` runs 07:00Z Oct 27 to 06:00Z Oct 28 (1am Oct 27 to midnight Oct 28, Mountain). Its last row (46.10654, rounds to 46.11) is Oct 28's hour 0, which the fixture borrowed. Your bundle matches the snapshot in hours 1..23 only. Expect the engine's Oct 27 numbers to move when your real bundle lands: the research DP gives $65.79/MW-day on the snapshot window and $73.80 on the real Mountain day. That is for Integration and the engine to re-pin; it is not a data bug, and you never adjust a price to hide it.

**DATA-SOURCES §4 typo.** It gives hour 0 as $30.22857; the cited file holds 30.21857 (LMP, ELAP_PACE-APND, OPR_DT 2026-10-26, OPR_HR 24). Use the file.

**EIA.**

- PACE.xlsx is hour ending, local prevailing time; join through UTC start (`UTC time` minus 1 hour), which handles DST.
- g/kWh = lb/kWh x 453.592.
- CO2 lags about a day (the research copy ends at local Oct 25 HE24), so both bundles will use the profile for every hour.
- EIA-930 six-month CSVs: `https://www.eia.gov/electricity/gridmonitor/sixMonthFiles/EIA930_BALANCE_2026_Jul_Dec.csv` (also `2026_Jan_Jun`, `2025_Jul_Dec`). Hour ending, `UTC Time at End of Hour` in `%m/%d/%Y %I:%M:%S %p`. The repo copies under `research/data/eia930/` are PACE rows only.
- 930-api dates are UTC hour ending even when `timezone=Mountain` is sent.
- Known bad hour: Jan 8 2026, demand 1,137 MW against a 6,048 MW forecast.

**Precision.** Bundle prices and forecasts: 2 decimals (the snapshot convention). History: as published. CO2: integer in the bundle (like the fixture), 0.1 in history. Say which in each file's `notes`.

**Provenance.** OASIS prices and forecasts: REAL. Net load, CO2 profile, every table: DERIVED. EIA observed CO2: REAL. Torus values: TORUS_PUBLISHED. Choices we made (bad-hour rule, seasons, bootstrap size): ASSUMPTION, written into the file.

**Sanity values for Oct 27** (hour beginning, Mountain): hour 0 $30.22; 1am $44.17; 3pm $21.38 (the day's cheapest); 6pm $55.78; 7pm load forecast 6,024 MW (the day's peak); minimum daytime net load 341 MW at 11am.

**Licenses and credit.** CAISO's Terms of Use limit redistribution and ask for credit; every file built from OASIS carries "Price and forecast data: California ISO OASIS." Whether CAISO-derived JSON may sit in a public repo is Craig's call (raw OASIS extracts already sit in `research/data/`). EIA data is public domain; credit the U.S. Energy Information Administration.

---

## 7. Guardrails

- **Never invent or fill a number.** Missing is listed and null, never zero, never interpolated. A fact you cannot trace to the repo research, `..\clearlane-raw`, or a page you actually opened gets `UNVERIFIED` next to it.
- **Never invent a Torus fact.** Only the values in Core 2, each from its named page.
- Say "not advertised", never "Torus lacks".
- Stations are "simulated Torus-style", with no Torus logos.
- The fixed overnight schedule is our off-peak baseline, never Torus practice.
- Value is "to RMP's system at day-ahead prices", never Torus revenue.
- CO2 is an average-emissions estimate and says so, unless a table says marginal and shows its interval.
- The 2025 heatmap states no time zone: every file and string that uses it keeps both readings, Mountain and UTC.
- 500 MW is the MOU ceiling, never installed capacity.
- No keys, `.env` or credentials in git. OASIS and EIA need none.
- No copied page text. Quotes under 15 words, with the URL.
- PACE.xlsx, raw downloads and third-party pages live only in `..\clearlane-raw`.
- No em dashes in any string a judge may read (every `notes` entry, every caveat, OpenAPI descriptions). American English, plain words.
- Labels that must appear wherever the item shows: "2030.5-shaped, not certified"; "RT proxy" for pre-EDAM winter prices; "proposed shape" for the feed.

---

## 8. When blocked

1. Add the label and say what you need, from whom:
   `gh issue edit <n> --add-label status:blocked`
   `gh issue comment <n> --body "Blocked: <what>. Need: <thing> from <lane or Craig>. Taking #<next> meanwhile."`
2. Take the next unblocked issue in queue order.
3. Name it in your next status comment on #2.

**Network or sandbox.** If OASIS, EIA or GitHub calls fail with a connection error, or the sandbox refuses writes to `..\clearlane-raw`: build everything that needs no network (oracles, Torus file, parsers and tests on fixtures, the CO2 extract from the local workbook), push it, and ask Integration on #1 either to enable network and that write path for the Codex session or to run your fetch command (for example `python -I prep/build_hist.py --fetch-only`). Your fetch commands must work from any checkout, because the cache is shared. Never write raw files inside the worktree as a workaround.

**OASIS down or throttling.** Back off as the rules say. Three failed retries means stop and report, never a tighter loop. For the Oct 28 refresh, exit 1 and let the stage stay on Oct 27.

**A number disagrees with `docs/FACTS.md` or a pinned test.** Stop. Do not change the number, the test or the arithmetic. Post the command, the expected value, the value you got and the file it came from on the issue and on #1, and take the next issue.

**Need a change outside your paths** (contract field, config include, flag, `.gitignore`). Open an issue:
`gh issue create --label lane:integration --title "Data needs: <thing>" --body "<what, why, which data issue it blocks, smallest change that works>"`

**A same-lane dependency is unmerged.** Take the next item. Do not stack branches unless Integration asks.

**CORE RED on #2.** Stop stretch commits immediately. Take core fix issues (yours, or tests and reviews for the owning lane) until CORE GREEN.

---

## 9. Status reporting

At every train (Tue 1:45am, 8:00am, 10:45am, 2:00pm, 5:30pm, 11:30pm; Wed 10:00am, noon), post one comment on **#2**:

```powershell
gh issue comment 2 --body-file "$env:TEMP\data-status.md"
```

```markdown
Train <n> status (data)
- Merged: #<issue> <title> (PR #<pr>)
- In flight: #<issue> PR #<pr>, <state>
- Blocked: #<issue>, needs <thing> from <whom>, or "Nothing"
- Next: #<issue>
- Data facts that changed: <for example "bundle hour 0 now $30.22, was $46.11 in the fixture">, or "None"
- Cross-review: PRs #.. reviewed at <sha>; BLOCKING findings open: <list or none>
- Missing days and UNVERIFIED items introduced this train: <list or none>
```

Also post on #2, outside the train rhythm:

- When the real Oct 27 bundle and the history merge: the hour 0 values, the CO2 window used, and the full missing-day list.
- After Integration's Oct 28 refresh: the operating day written, `fetched_utc`, and your stretch files that need regenerating (`lasso-feed` examples, anything per-day).
- Any time you stop on §8.
