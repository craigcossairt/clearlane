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
| Wed 2:00pm            | Code freeze, tag `v1-stage` (six-beat fallback)               |
| Wed 2:45pm            | Presenter PRs #270 and #271 due                               |
| Wed about 3:05pm      | Presenter PRs merged; freeze gate on the new main             |
| Wed about 3:20pm      | Tag `v1-stage-2` (presenter build) on Craig's go              |
| Wed about 3:40pm      | Tag `v1-stage-3`, the stage build; `v1-stage-2` is fallback   |
| Wed about 4:00pm      | Tag `v1-stage-4`, the stage build; `v1-stage-3` is fallback   |
| Wed 3:30pm            | Backup video and deck PDF copied to laptop, USB stick and Mac |
| Wed by 5:00pm         | Craig submits                                                 |
| Wed about 4:30pm      | Craig leaves for Aernata, 250 E 200 S, Suite 320              |
| Wed by 5:00pm         | At Aernata                                                    |
| Wed 5:15pm            | Judging starts; groups 4 to 6 judge Torus                     |
| Wed 5:20pm            | Craig presents, Group 4, 5-minute slot (setup included)       |
| Wed 6:15pm to 6:45pm  | Finals, if picked: present to the full panel                  |
| Thu 8:30am            | Finalists arrive at Zero Gravity Summit                       |
| Thu 9:00am            | Winners announced, Zero Gravity Summit main stage             |

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

| Train | Tagged (MT) | Merged                                                                      | Gate                                                                                              | Cuts                                                  |
| ----- | ----------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| 1     | Tue 8:50am  | integration #119, #123                                                      | check:all green                                                                                   | none                                                  |
| 2     | Tue 9:15am  | data #114, #116, #121; engine #113; pitch #17, #15, #16; integration #126   | check:all green; offline-check and facts-check not built                                          | none                                                  |
| 3     | Tue 11:55am | data #124; engine #118, #122, #143; integration #132, #147, #149            | check:all green                                                                                   | none                                                  |
| 4     | not tagged  | data #151; integration #166, #167; ui #155, #168 to #172                    | 4:08pm: check:all green; offline 6/6; facts-check 1 fail (fixed by #167)                          | none                                                  |
| 5     | Tue 5:44pm  | data #176; engine #181; ui #180; pitch #130; science #174; integration #177 | check:all green; offline 6/6; facts-check PASS; projector by hand ok (small text: #190)           | stretch-1 cut: #29, #48, #64 to #67, #86 to #89, #110 |
| 6     | Tue 11:27pm | on d52ac32: #213, #214, #209, #210, #195, #204                              | gate green; all flags off                                                                         | none                                                  |
| 7     | Wed 9:58am  | on 3c3bc00: integration #267 (docs)                                         | check:all green; offline 6/6; facts PASS; reproduce 110/110; projector default and presenter PASS | none                                                  |
| 8     | Wed 11:40am | on 3c3bc00: none                                                            | Train 7 counts; offline 6/6 and facts PASS rerun                                                  | none                                                  |

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

**Live run, Tue 5:50pm.** The Oct 28 prices were posted by 5:11pm, well before 9:16pm. `prep/refresh_tonight.py` (#176) exited 0 with 24 hours. Both engine CLIs ran, facts-check PASS, offline-check 6/6, pitch resolver 0 unresolved. Result: PR #189, **held for Craig's 11pm pick** because the race falls from 2.9x to 1.0x (story table in the PR). Its check:all waits on one more day-coupled test, `app/src/beats/Race.test.tsx:21` (asked on #4, due 10:00pm).

Day-coupled tests found by the dry run and fixed before the live run: engine #181, ui #180.

**Dry run, Tue 5:10pm**, on `int/refresh-dry` (never pushed):

- Oct 27 rebuilt from the cache: byte-identical to the committed bundle.
- Forced OASIS failure (dead proxy): exit 1; `public/data` hashes unchanged.
- Synthetic Oct 28 (Oct 27 re-dated): both engine CLIs ran; facts-check PASS; build ok; offline-check PASS 6/6, 0 external requests; pitch resolver: 50 keys, none unresolved.
- check:all: the two day-coupled tests above failed, plus three 5 s timeouts in CLI-spawning tests that pass alone. The timeouts are fixed in `vitest.config.ts`.

## Stage flag set

Every flag off in `contracts/flags.ts`. The stage opens presenter mode from the URL, `http://localhost:4173/?ff=presenter`, so no flag default changes. The six-beat stage at `http://localhost:4173/` is the fallback.

## Stage cues, presenter mode

The clicker only: Right or PageDown is Next, Left or PageUp is Back. C, E and B are not used.

| Screen     | Next presses on it | What they do                             |
| ---------- | ------------------ | ---------------------------------------- |
| 1 Title    | 1                  | to Traffic                               |
| 2 Traffic  | 1                  | to Race                                  |
| 3 Race     | 2                  | replay; then to Call                     |
| 4 Call     | 3                  | first call; second call; then to Re-plan |
| 5 Re-plan  | 2                  | resume; then to Envelope                 |
| 6 Envelope | 2                  | backtest; then to Scale                  |
| 7 Scale    | 2                  | fleet to the maximum; then to Close      |
| 8 Close    | 0                  | last screen                              |

A Next press while the race replay is running jumps it to its end; one more press leaves the screen. Check this table against the screens after #270 and #271 merge.

## Pack list

- [ ] Demo laptop and charger
- [ ] Display adapter (the venue's display input is UNVERIFIED)
- [ ] Presenter remote, tested at rehearsal 0
- [ ] Before any stage preview: stop stray `vite preview` processes and confirm :4173 is free (`demo/freeze.md`, 2:10pm)
- [ ] USB stick with the backup video and deck PDF
- [ ] The Mac with a `v1-stage` build
- [ ] At the room before 5:20pm: laptop on the presenter title screen (`http://localhost:4173/?ff=presenter`, F11), display cable plugged in. Setup comes out of the 5-minute slot.
