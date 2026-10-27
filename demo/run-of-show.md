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

| Beat                 | Status  | Note                         |
| -------------------- | ------- | ---------------------------- |
| 1 Traffic report     | missing | stage app is UI PR #18, held |
| 2 Race               | missing |                              |
| 3 Crash              | missing |                              |
| 4 Re-plan            | missing |                              |
| 5 Envelope and proof | missing |                              |
| 6 Scale and close    | missing |                              |

## Train log

| Train | Tagged (MT) | Merged                                                                    | Gate                                                     | Cuts |
| ----- | ----------- | ------------------------------------------------------------------------- | -------------------------------------------------------- | ---- |
| 1     | Tue 8:50am  | integration #119, #123                                                    | check:all green                                          | none |
| 2     | Tue 9:15am  | data #114, #116, #121; engine #113; pitch #17, #15, #16; integration #126 | check:all green; offline-check and facts-check not built | none |

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

Then: every merged stretch CLI that writes a per-day file (none yet), the engine re-pin command (asked for on #3, due by Train 5), and the checks in section 6.5 step 4. Final by Train 5.

## Stage flag set

Every flag off until Craig picks the set at Train 6.

## Pack list

- [ ] Demo laptop and charger
- [ ] Display adapter (the venue's display input is UNVERIFIED)
- [ ] Presenter remote, tested at rehearsal 0
- [ ] USB stick with the backup video and deck PDF
- [ ] The Mac with a `v1-stage` build
