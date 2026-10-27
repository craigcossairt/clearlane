# Run of show

All times Mountain (MDT, UTC-6). Integration keeps this file current at every train.

## Timeline

| When                  | What                                                          |
| --------------------- | ------------------------------------------------------------- |
| Tue 1:45am            | Train 1, contracts frozen (ran late: tagged 8:50am)           |
| Tue 8:00am            | Train 2, core complete target (tagged 9:15am)                 |
| Tue 9:00am            | Craig sends the Torus and organizer questions (posted on #1)  |
| Tue 10:45am           | Train 3, stretch-1 under way; rehearsal 0                     |
| Tue 11:00am to 1:30pm | Craig away                                                    |
| Tue 2:00pm            | Train 4, core checkpoint                                      |
| Tue 5:00pm            | Oct 28 refresh dry run                                        |
| Tue 5:30pm            | Train 5, stretch-1 merged                                     |
| Tue 6:00pm to 11:00pm | Craig away; Integration runs the refresh                      |
| Tue about 9:16pm      | Oct 28 day-ahead prices available                             |
| Tue 10:30pm           | Refresh hard stop                                             |
| Tue 11:30pm           | Train 6, feature freeze; Craig picks the flag set; rehearsals |
| Wed 7:00am            | Fixes only; Craig's read                                      |
| Wed 10:00am           | Train 7                                                       |
| Wed noon              | Train 8, copy and polish                                      |
| Wed 2:00pm            | Code freeze, tag `v1-stage`                                   |
| Wed 3:30pm            | Backup video and deck PDF copied to laptop, USB stick and Mac |
| Wed by 5:00pm         | Craig submits                                                 |
| Wed 5:00pm to 6:00pm  | Judging                                                       |

## Beats on main

| Beat                 | Status | Note                        |
| -------------------- | ------ | --------------------------- |
| 1 Traffic report     | ok     | #155                        |
| 2 Race               | ok     | #168                        |
| 3 Crash              | ok     | #169; Mountain heatmap #173 |
| 4 Re-plan            | ok     | #170                        |
| 5 Envelope and proof | ok     | #171                        |
| 6 Scale and close    | ok     | #172                        |

## Train log

| Train | Tagged (MT) | Merged                                                                    | Gate                                                                     | Cuts |
| ----- | ----------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ---- |
| 1     | Tue 8:50am  | integration #119, #123                                                    | check:all green                                                          | none |
| 2     | Tue 9:15am  | data #114, #116, #121; engine #113; pitch #17, #15, #16; integration #126 | check:all green; offline-check and facts-check not built                 | none |
| 3     | Tue 11:55am | data #124; engine #118, #122, #143; integration #132, #147, #149          | check:all green                                                          | none |
| 4     | not tagged  | data #151; integration #166, #167; ui #155, #168 to #172                  | 4:08pm: check:all green; offline 6/6; facts-check 1 fail (fixed by #167) | none |

## Rehearsal log

| When (MT) | Length | Build | What broke | Fix |
| --------- | ------ | ----- | ---------- | --- |
|           |        |       |            |     |

## Oct 28 refresh list

The core list, verbatim from `docs/lanes/integration.md` section 6.5:

```bash
python -I prep/refresh_tonight.py --day 2026-10-28 --poll-until 22:00
npx tsx engine/cli/numbers.ts public/data/bundle_2026-10-28.json
npx tsx engine/cli/envelope.ts public/data/bundle_2026-10-28.json
npm run check:all
```

Then: every merged stretch CLI that writes a per-day file (none yet) and the checks in section 6.5 step 4. No engine re-pin is needed: the pins run on `contracts/fixtures`.

**Data step tonight.** `prep/refresh_tonight.py` (#44) is not on main. If #44 has not merged by 8:30pm, the data step is this command instead. It is already on main and proven in the dry run. Run it from the int worktree every 5 minutes from about 9:16pm, last try 10:00pm:

```bash
python -I prep/build_bundle.py --day 2026-10-28 --refetch --out ../clearlane-raw/refresh/bundle_2026-10-28.json
```

It validates the whole day before an atomic write, and any failure exits non-zero. Copy the file into `public/data/` only after an exit 0 with 24 hours. Then run the engine commands above.

**Must merge before 9:16pm** (found by the dry run; otherwise check:all goes red on any new day): engine `numbers.test.ts:436` reads the Oct 27 bundle by name (#3); ui `App.test.tsx:121` expects "Today" for an Oct 27 clock (#4).

**Dry run, Tue 5:10pm**, on `int/refresh-dry` (never pushed):

- Oct 27 rebuilt from the cache: byte-identical to the committed bundle.
- Forced OASIS failure (dead proxy): exit 1; `public/data` hashes unchanged.
- Synthetic Oct 28 (Oct 27 re-dated): both engine CLIs ran; facts-check PASS; build ok; offline-check PASS 6/6, 0 external requests; pitch resolver: 50 keys, none unresolved.
- check:all: the two day-coupled tests above failed, plus three 5 s timeouts in CLI-spawning tests that pass alone. The timeouts are fixed in `vitest.config.ts`.

## Stage flag set

Every flag off until Craig picks the set at Train 6.

## Pack list

- [ ] Demo laptop and charger
- [ ] Display adapter (the venue's display input is UNVERIFIED)
- [ ] Presenter remote, tested at rehearsal 0
- [ ] USB stick with the backup video and deck PDF
- [ ] The Mac with a `v1-stage` build
