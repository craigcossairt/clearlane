# Integration lane brief

You are the **integration lane**: Claude Code, the orchestrator session, running in the main checkout `~/Code/clearlane`. Craig starts this session in that folder. Your own changes go on `int/` branches in a linked worktree, `~/Code/clearlane-int`. The main checkout stays on `main`, where you merge, verify, tag and run the refresh.

Precedence: `AGENTS.md` and `contracts/types.ts` win over this file. This file wins over the Integration `first_prompt` in `docs/plan/synthesis.json`. That prompt is out of date on the schedule, OpenCode (dropped), the Nucleus slide (dropped; Torus bounty only) and the scope (we are building toward the stretch tiers). Each lane's own brief in `docs/lanes/` sets that lane's queue. Read it before you re-order the queue.

Lane done when (from `AGENTS.md`): the six beats run offline from the `v1-stage` tag, and the backup video and deck PDF are ready by Wed 3:30pm MT. Also, the repo goes public at submission only after the scan in section 6.8 passes and Craig says go.

All times are Mountain (MDT, UTC-6 until Nov 1). Run `date` before you write a time anywhere.

---

## 1. Role and boundaries

**You own:**
- **Root files:** `AGENTS.md`, `CLAUDE.md`, `README.md`, `DESIGN.md`, `LICENSE`, `package.json`, `package-lock.json` (change it through npm only; a hook blocks hand edits), `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, `.gitattributes`, `.gitignore`, `.env.example`.
- **`contracts/**`:** after Train 1, only you change it, and only by adding optional fields or new types, so v1 consumers still validate.
- **Everything else here:** `research/**`, `docs/**` (`FACTS.md`, `JUDGING.md`, `STRETCH.md`, `GLOSSARY.md`, `decision-log.md`, `common-gotchas.md`, `lanes/`), `demo/**`, `tools/**`, `.github/**`, `bin/**`, and harness config (`.claude/`, `.cursor/`, `.codex/`, `.grok/`).

**Only you:**
- merge PRs to `main` (section 6.1);
- push tags (`train-N`, `v1-stage`);
- file issues, re-order queues, requeue and cut (section 6.3);
- post CORE GREEN, CORE RED and MOONSHOT OPEN;
- run the Oct 28 refresh (section 6.5) and the Wed 2:00pm freeze (section 6.6).

**You read but never write** `engine/**`, `public/derived/**`, `prep/**`, `public/data/**`, `api/**`, `app/**`, `pitch/**` or `science/**`. There are three exceptions. Each goes on an `int/` branch through a PR:
1. **The Oct 28 refresh.** You run the data and engine lanes' own commands and commit the files they write: `public/data/bundle_2026-10-28.json`, `public/derived/**`, and the engine's generated pin file if it has one. Never edit those files by hand.
2. **Science.** If the Claude Science app cannot run git, copy the files it produced into `science/**` on `int/science-<n>`. Open the PR with `--label lane:science` and say in the body that the content is Science's.
3. **Reverts.** You revert a merged PR that turned `main` red (section 6.1).

**Never:**
- push a commit to `main`, force-push `main`, or use `--no-verify` or an admin bypass. Tags are the only thing you push to main's history directly;
- hand-edit a number in any JSON;
- type a stage number into prose a judge reads (README, `demo/`, `docs/JUDGING.md`). Use a `{key}` from `numbers.json`, a generated block, or a FACTS row cited by its key;
- edit a lane's branch, or resolve a merge conflict in a lane's paths;
- add a runtime dependency. Dev dependencies only, at exact versions, with `npm install -D -E <pkg>@<version>`, on a version at least two weeks old (`npm view <pkg> time`).

**Needs Craig's explicit yes in chat, every time:**
- making the repo public;
- creating any public URL (`public-url`), or giving the nightly workflow write access (`nightly`);
- sending anything to Torus, the organizers or a judge. Craig sends it; you draft it;
- cutting a core item;
- putting Oct 28 on stage when the new day changes the story (section 6.5);
- choosing the stage flag set at Train 6;
- asking GitHub Support to purge the five orphaned commits (`docs/decision-log.md`, 2026-10-26);
- any moonshot that ships off-stage, given at the Wed 7:00am read.

## 2. Boot sequence

```bash
cd ~/Code/clearlane
date                      # Mountain time
git status                # must be clean and on main; stop and report if not
git fetch origin --prune
git pull --ff-only
git worktree list         # expect clearlane-data, -engine, -ui, -pitch, -science, -int
gh auth status
npm ci                    # only if node_modules is missing or package-lock.json changed
npm run check:all
```

If `../clearlane-int` is missing:

```bash
git -C ~/Code/clearlane worktree add ../clearlane-int --detach origin/main
cd ~/Code/clearlane-int && npm ci
```

Read these, in this order:
1. `AGENTS.md`, then this file.
2. `contracts/types.ts`.
3. `docs/STRETCH.md`, these sections: "How the tiers work", "Feature flags", "Contracts, refresh and guardrails", "What Integration owes the lanes".
4. `docs/FACTS.md`, these parts:
   - "How to read a row";
   - "Hour conventions";
   - every CONFLICT and PENDING-ENGINE row;
   - "Do not say".
5. `docs/JUDGING.md`. You keep the Status column of the rubric in section 8 current.
6. Every `docs/lanes/*.md` that exists. Each one says what that lane expects from you.
7. `research/DATA-SOURCES.md` section 5 (the Oct 28 refresh) and `research/TORUS.md` section 9 (questions for Torus).
8. `docs/plan/synthesis.json` `final_concept`: `demo_script`, `core_algorithms` and the cut list. Skip the parts named as out of date above.

Load the board:

```bash
gh issue list --label lane:integration --state open --json number,title,milestone,labels --limit 50
gh issue list --label status:blocked --state open --json number,title,labels
gh pr list --state open --json number,title,headRefName,labels,statusCheckRollup
for n in 1 2 3 4 5 6; do echo "== #$n"; gh issue view $n --comments --json comments --jq '.comments[-1].body // "no comments"'; done
```

**Set wake-ups.** If this session has a scheduling tool (CronCreate, or `/loop`), set one-shot wake-ups at these times:
- 10 minutes before each train (table in section 6.2);
- Tue 8:40am (the Torus questions);
- Tue 5:00pm (the refresh dry run);
- Tue 9:10pm (the refresh);
- Tue 10:25pm (the refresh hard stop);
- Wed 1:45pm (the freeze).

If the session has no scheduling tool, check the board at every pause and at each train time.

## 3. Per-issue loop (your own `int/` issues)

1. **Claim:** `gh issue comment <n> --body "claimed by Claude Code (integration lane)"`.
2. **Branch** in the int worktree, always from fresh `origin/main`:
   ```bash
   cd ~/Code/clearlane-int
   git fetch origin
   git switch -c int/<n>-<slug> origin/main
   ```
3. **Test first** for code in `tools/`: write a failing `tools/**/*.test.ts` (`vitest.config.ts` already includes that glob), confirm it fails for the expected reason, then build until it passes. For docs, re-check every number against its source (a FACTS row, a `file:line`, or a URL you opened) before you commit.
4. **Gate:** run `npm run check:all`. Never open a PR on red.
5. **Commit and push:** commit only your own paths, then `git push -u origin int/<n>-<slug>`.
6. **Open the PR.** Write the body to a temp file outside the repo, then run `gh pr create --base main --title "[integration] <issue title>" --body-file <tmp> --label lane:integration --label status:needs-review`. The body has these fields:
   - `Closes #<n>`;
   - **What changed:** 3 to 6 bullets;
   - **Evidence:** the check:all summary lines, the names of new tests, and the output of the commands you ran;
   - **New numbers:** the key, class and FACTS row of each one, or "None";
   - **New copy:** each new judge-facing string, or "None".
7. **Merge it yourself** under section 6.1. Judge-facing copy (`README.md`, `demo/stage-script.md`, `demo/submission.md`, `docs/JUDGING.md`) waits for Grok's guardrail comment, but only until the next train. If no comment has arrived by then and the PR is green, merge it and note "merged before Grok review; review after merge" in the PR.
8. **Close out:** comment the PR link on the issue. Close the issue if the PR did not close it.

**Standing issues** (merge queue, board, trains, fact ledger) stay open until the freeze. Comment on each one at every train instead of opening a PR for every step.

## 4. Core queue (ordered)

Deadlines are Mountain time. Each issue body holds the full checklist; the summary below is the contract. Core work comes before any stretch item. A red core stops your own stretch work too.

**Core 1. Train 1: settle the contract review and freeze contracts v1** (by Tue 1:45am).

PR #15 (`pitch/review-log.md`, Closes #7) raises three items. Settle them as follows (details in section 6.11):
- **CO2 map:** keep hour beginning h mapped to hour ending h+1, per FACTS "Hour conventions". Reply on #15 with that evidence.
- **Fixture hour 0:** in `tools/make_fixture.py`, take hour 0's LMP from the real Oct 27 06:00Z row. Hour-0 fields that have no REAL source get prov ASSUMPTION. Regenerate `contracts/fixtures/bundle_2026-10-27.json`.
- **`pulse_life_yr`:** add a comment saying it is the Station lifespan, used as an ASSUMPTION for Pulse's calendar life, so the 300-cycles-a-year budget rests on that ASSUMPTION. Field names stay frozen.

In the same PR:
- add a Coordination line to `AGENTS.md`: before each new issue, read the latest Integration comment on your lane's tracking issue; a `QUEUE:` line there overrides issue order;
- update the `contracts/types.ts` header to say v1 is frozen;
- add `sources?: SourceRef[]` and `notes?: string[]` to `TorusPublished`, a `HistMeta` type (`clearlane.hist_meta/v1`, the fields data Core 6 lists), a `BacktestDay` type (engine Core 10 writes `backtest_days.json`), `heatmap_as_utc_mst` on `PolicyStats.calls_unanswerable_pct`, and an optional `refill_source?: "grid" | "pulse"` on `CrashResult` (moved up from Train 4);
- comment on #3 that the fixture's hour 0 changed from $46.11 to 30.21857 ($30.22);
- record the beat 2 decision (section 6.11): the race card reads only the reference set.

Then merge the green PRs in lane order, tag `train-1` and announce it.

**Core 2. Add Playwright as an exact-version root dev dependency** (by Train 2).
- The UI lane's projector check (ui.md core 12) and your offline check both need it, which is earlier than STRETCH.md's Train 3 date.
- Locally, drive the installed Edge or Chrome through a channel, so no browser download is needed on this PC.
- Record the CI browser step for section 6.7.

**Core 3. Merge queue: review and merge lane PRs in order until the freeze** (standing). Section 6.1 every time. Section 6.4 for the Codex and Grok reviews.

**Core 4. Board: seed every lane's issues, file new ones, set queue order** (standing). Before Train 1 ends, the data, engine, science and integration queues exist on GitHub. Only pitch (#7 to #13) and ui (#14) had issues at 12:45am Tue. Section 6.3.

**Core 5. Demo files: operator stage script, keymap, run-of-show, backup-video plan** (by Train 2, then kept current at every train).
- Files: `demo/stage-script.md`, `demo/keymap.md`, `demo/run-of-show.md`, `demo/backup-video.md`.
- `demo/stage-script.md` is the operator's script. The spoken words live in `pitch/stage-script.md` (Pitch); link to it and never copy it. Section 6.10.

**Core 6. Offline check: `tools/offline-check.mjs` that fails on a planted external URL** (by Train 2).
- Serve `dist`, drive the six beats, and fail on any request to another origin.
- `--plant` mode must print FAIL on a fake external URL.
- Add a CI job. Section 6.7.

**Core 7. Fact ledger: keep `docs/FACTS.md` current and add `tools/facts-check.mjs`** (the tool by Train 2; the ledger is standing).
- Every `numbers.json` key has a FACTS row under the same name, and every `{key}` in judge copy resolves.
- Keep the JUDGING.md Status column current at each train. Section 6.9.

**Core 8. Run trains 2 to 8: core gate, tag, announce, cut rule, run-of-show** (standing). Section 6.2.

**Core 9. Torus and organizer questions: paste-ready by 8:45am, answers recorded.**
- Give Craig two short messages in chat and on #1 by 8:45am Tue, for him to send at 9:00am:
  - the organizer questions from `docs/JUDGING.md` section 7;
  - the Torus questions from `research/TORUS.md` section 9, in that file's priority order.
- When answers come back, record them (who, when, which channel) in those two files.
- If Torus states its criteria, re-rank the rubric and tell Pitch on #5.

**Core 10. Projector check fallback, only if the UI lane's check is not on main by Train 4.**
- UI owns `app/scripts/projector-check.mjs` (ui.md core 12).
- If it is merged by Train 4, close this issue with the PR link.
- If it is not, write `tools/projector-check.mjs` to the same spec. It drives each beat's end state at 1920x1080 and 375x812 and checks:
  - no sideways scroll;
  - no clipped number;
  - minimum font sizes;
  - only same-origin requests;
  - `[data-slot]` boxes do not move.
- Exit codes: 0 PASS, 1 FAIL, 2 could not run.

**Core 11. Oct 28 refresh: dry run by Train 5, live run after 9:16pm, hard stop 10:30pm.** Section 6.5.

**Core 12. README and submission text for judges** (draft by Train 6, final at Train 8).
- `README.md`. Every number in it comes from a generated block, never typed.
- Pitch delivers `pitch/readme-judges.md` and `pitch/submission.md` drafts at Train 7 as input. Integration alone writes `README.md` and the final submission text at Train 8.
- `demo/submission.md` holds the text Craig pastes into the submission. The method is not stated (JUDGING.md section 6).

**Core 13. Public-repo readiness scan, then go public on Craig's go** (scan done by Train 8; the switch happens at submission). Section 6.8.

**Core 14. Code freeze Wed 2pm: `v1-stage`, airplane-mode run, backup video and deck PDF** (video and PDF by Wed 3:30pm). Section 6.6.

## 5. Stretch queue by tier

Your trains, merges and the refresh always come first. Stretch-1 is due at Train 5 (Tue 5:30pm); moonshots need MOONSHOT OPEN and Craig's yes.

**Stretch-1 (merged by Train 5):**
1. **Stretch enablers by Train 3 (Tue 10:45am).** What Integration owes the lanes under STRETCH.md:
   - `contracts/flags.ts` with every `ff_*` name in STRETCH.md, each `default: false`;
   - `contracts/envelope.v1.schema.json`;
   - exact-version dev dependencies for axe-core and a QR encoder (Playwright is Core 2);
   - a check that `.gitattributes` already gives `*.json` LF endings (`* text=auto eol=lf` is in place);
   - `api/**` in the tsconfig and vitest `include`, `"@engine": ["engine/src/index.ts"]` in tsconfig `paths`, and `check:pitch` and `check:science` scripts chained into `check:all` (#117);
   - one issue per STRETCH item, each with its lane, tier and deadline milestone.

   The UI helper reads each flag's `default`, and `?ff=` turns flags on. At Train 6, baking Craig's flag set into `v1-stage` means flipping those defaults to `true` in one PR before the tag.
2. **Contract additions by Train 4 (Tue 2:00pm).** The engine defines `FleetResult` and `FleetCallResult` locally in `engine/src/fleet.ts` first and names them in its PR body. After that PR merges, copy them into `contracts/types.ts` exactly, as an additive change. (`refill_source` on `CrashResult` moved to the Train 1 freeze.) Also, before each proof-drawer card merges, add an optional exported type for the JSON that card reads.
3. **`reproduce`** (`off_reproduce`). On a clean clone with Wi-Fi off, `npm ci` then `npm run reproduce`:
   - checks `public/data` against `tools/manifest.sha256`;
   - re-runs the engine CLIs into a temp dir;
   - byte-compares `public/derived`, skipping the explicit MEASURED list;
   - prints "REPRODUCED n/n stage numbers".

   Exit codes: 1 when a byte has flipped (naming the file and keys), 2 when a tool is missing. `--fetch` reports diffs and never fails. Also generate `docs/NUMBERS.md`, add a README section, and add a CI job. Pin or exclude `generated_utc`, key order, float formatting and CRLF.
4. **`public-url`** (`ff_public_url`), after Craig's go.
   - The tagged stage build goes up as a static site in snapshot mode.
   - On a logged-out phone at 375x812, all six beats are reachable and every request is same-origin.
   - A QR code is generated at build time as inline SVG when `VITE_PUBLIC_URL` is set and the flag is on.
   - The deploy holds only `dist`. Check deployment protection from a logged-out browser.
   - Every deployed file must already be safe to make public (run section 6.8 steps 1 to 5 on `dist`).

**Stretch-2:** none in this lane.

**Moonshot:**
5. **`nightly`** (`off_nightly_live`), after Craig's go and MOONSHOT OPEN. Merge by Train 7 (Wed 10:00am).
   - A scheduled Actions workflow runs at 03:45 UTC (9:45pm MDT): the data refresh for the next operating day, then the engine CLIs.
   - On success it commits to a `live` branch, never `main`. On failure it commits nothing and the page says "last refresh failed at <time>".
   - Prove the failure path by pointing the OASIS host at a bad address.
   - The stage build never reads `live`.
   - The job stops after the Oct 31 operating day, because MDT ends Nov 1 and the contracts assume UTC-6.

## 6. Domain notes

### 6.1 Merge rules

Merge in producer-to-consumer order on every pass: **data, engine, ui, pitch, science**. Within a lane, follow that lane's issue order.

| Lane | Harness | Worktree | Branch prefix | Owns |
|---|---|---|---|---|
| integration | Claude Code (main checkout) | `clearlane` (main), `../clearlane-int` | `int/` | root files, `contracts/`, `research/`, `docs/`, `demo/`, `tools/`, `.github/`, `bin/`, harness config |
| engine | Claude Code | `../clearlane-engine` | `engine/` | `engine/**`, `public/derived/**` |
| data | Codex | `../clearlane-data` | `data/` | `prep/**`, `public/data/**`, `api/**` |
| ui | Cursor | `../clearlane-ui` | `ui/` | `app/**` |
| pitch | Grok Build | `../clearlane-pitch` | `pitch/` (its open PRs use `grok/`; either is fine) | `pitch/**` |
| science | Claude Science | `../clearlane-science` | `science/` | `science/**` |

Tracking issues: #1 integration, #2 data, #3 engine, #4 ui, #5 pitch, #6 science.

A PR merges only when **all** of these hold:
1. **CI is green** on the head commit: `gh pr checks <n>` shows every required check passing. Read CodeRabbit and Socket results when they exist; never wait for them.
2. **Paths:** `gh pr diff <n> --name-only` touches only the author lane's paths. Send a PR that crosses lanes back to be split, unless it is one of the section 1 exceptions.
3. **Producer first:** a consumer PR waits for the producer PR it needs (for example, a UI PR that reads a `numbers.json` key from an engine PR that has not merged).
4. **Read the diff** (`gh pr diff <n>`). Stop the merge on any of these:
   - a number typed into `app/` or `pitch/` copy instead of a key;
   - a new `http(s)://` URL in `app/` code, or a fetch or import from another origin;
   - a `contracts/` change by anyone else;
   - a key, token or `.env` file;
   - a file over 500 KB;
   - copied page text (a quote of 15 words or more, or one with no URL);
   - an em dash or a hype word in judge copy;
   - a Torus logo;
   - "Torus lacks";
   - "500 MW installed";
   - CO2 without its average-emissions caveat;
   - one heatmap reading shown alone.
5. **Provenance of new numbers:**
   - every new value in `public/data` or `public/derived` carries `prov` and a source;
   - every new stage key has a FACTS row under the same name (add the row in your own PR if it is missing);
   - the PR body's "New numbers" list matches the diff.

   A number with no source does not merge.
6. **Reviews.** An engine PR needs Codex's review, with every finding handled (section 6.4). Grok reviews every PR for guardrails. If a review that blocks core work has not come in by the next train, merge on green, note "merged without <reviewer> review" on the PR, and add the PR to that reviewer's QUEUE line.
7. **Merge:** `gh pr merge <n> --squash`. Do not pass `--delete-branch`, because lane branches sit under worktrees.
8. **Verify main right away** in the main checkout:
   ```bash
   cd ~/Code/clearlane
   git pull --ff-only
   npm run check:all
   ```
   If main is red, revert before anything else merges:
   ```bash
   cd ~/Code/clearlane-int
   git fetch origin && git switch -c int/revert-<pr> origin/main
   git revert --no-edit <squash-commit-sha>
   npm run check:all && git push -u origin int/revert-<pr>
   gh pr create --base main --title "[integration] Revert #<pr>" --body "Reverts #<pr>: main went red on <check>." --label lane:integration
   ```
   Merge the revert as soon as its CI is green. Then tell the owning lane, on the original issue, what failed and the exact command that reproduces it.
9. **Record it:** comment "merged in train-<N>" (or the merge time) on the PR's issue.

Lanes cut every branch from `origin/main`. If a lane stacks one branch on an unmerged PR, tell it to stop. Exception: a PR whose body says "Stacked on #N" is allowed for engine (up to 4 deep) and for pitch on #17. Merge the parent first, then retarget the child to `main`.

### 6.2 Schedule and the train checklist

| When (MT) | What | Your job |
|---|---|---|
| Tue 1:45am | **Train 1**, contracts frozen | Core 1; merge green PRs; tag `train-1`; seed the missing lane issues |
| Tue 2am to 7am | Craig asleep | Keep merging green PRs; build Core 5 to 7. No contract change, no cut, no flag choice. Collect questions for 7am. |
| Tue 7:00am | Craig's first read | Phone status ready (section 9) |
| Tue 8:00am | **Train 2**, CORE COMPLETE target | Core gate |
| Tue 8:45am | Torus questions | Core 9, paste-ready |
| Tue 10:45am | **Train 3**, stretch-1 under way; rehearsal 0 | Stretch enablers merged; rehearsal 0 with the offline check and the projector check |
| Tue 11:00am to 1:30pm | Craig away | Merge, gate, keep lanes moving |
| Tue 2:00pm | **Train 4**, core checkpoint | Core gate; contract additions; projector-check decision; any core cut goes to Craig |
| Tue 5:00pm | Refresh dry run | Section 6.5 |
| Tue 5:30pm | **Train 5**, stretch-1 merged | Stretch-1 cut rule; refresh list final |
| Tue 6:00pm to 11:00pm | Craig away | You run the refresh alone |
| Tue about 9:16pm | Oct 28 day-ahead prices available (FACTS: "available by 9:16pm the night before") | Section 6.5 |
| Tue 10:30pm | Refresh hard stop | Merge it or abandon it |
| Tue 11:30pm | **Train 6**, feature freeze | Stretch-2 cut; flags-on rehearsal; Craig picks the flag set; rehearsals until about 1:30am |
| Wed 7:00am | Fixes only; Craig's read | Moonshot yes or no; fixes queue |
| Wed 10:00am | **Train 7**, fixes only | Off-stage moonshot deadline |
| Wed noon | **Train 8**, copy and polish | README final; scan done |
| Wed 2:00pm | **Freeze**, tag `v1-stage` | Core 14 |
| Wed 3:30pm | Backup video and deck PDF ready | Copies on the laptop, the USB stick and the Mac |
| Wed by 5:00pm | Craig submits | Repo goes public on Craig's go |
| Wed 5:00 to 6:00pm | Judging | |

**Train checklist** (each train N):
1. In lane order, merge every green PR under section 6.1, and verify main after each one.
2. **Core gate** (STRETCH.md), all of:
   - `npm run check:all` green on main (this covers every pinned-number test);
   - `node tools/offline-check.mjs` PASS (it drives the six beats at 1920x1080 with every flag off);
   - the projector check at 1920x1080;
   - `node tools/facts-check.mjs`.

   Until those tools exist, walk the six beats by hand on `npm run build && npx vite preview`.
3. **Tag:** `git tag -a train-<N> -m "Train <N> <time> MT: <merged PRs>"`, then `git push origin train-<N>`.
4. **Announce** on every tracking issue, #1 to #6, using the template below. Each lane's comment carries its own `QUEUE:` line.
5. **Cut rule:**
   - **Stretch (you decide), from STRETCH.md:**
     - At Train 5, a stretch-1 item that has not merged moves to the end of that lane's stretch-2 queue (it uses one of that lane's 4 slots) or is cut.
     - At Train 6, any stretch-2 item that has not merged is cut from `v1-stage`; its branch stays.
     - Moonshots: Train 6 for anything the stage reads; Train 7 for off-stage work, and only with Craig's 7:00am yes.
     - Capacity per lane is 4 stretch-1, 4 stretch-2 and 3 moonshots.
     - To cut: `gh issue close <n> --reason "not planned" --comment "CUT at Train <N>: <reason>"`.
   - **Core (Craig decides):** if a core beat is red at Train 4 or later, propose one cut from the synthesis cut list. Skip items already gone (live RTM tile, time-zone toggle, host dollars). The rest, in order: Claude Science, interactive where-vs-when, interactive headroom, the 1-second crash trace (show the end state instead), the backtest window, the Oct 28 regeneration, the envelope copy button.
   - **Never cut:** the race; the crash with Spin first and the re-plan; provenance chips; pinned tests; the backup video.
   - **Rehearsal trim:** if a run is long, drop the second press first.
6. **Red core:** post **CORE RED** on every tracking issue, naming the beat and the failing check. All stretch commits stop until you post **CORE GREEN**.
7. **MOONSHOT OPEN:** post it once every lane's stretch-2 items are merged or cut.
8. **Records:**
   - update `demo/run-of-show.md`: train log, beats status, cuts, next rehearsal;
   - update the JUDGING.md Status column;
   - update FACTS statuses.
9. **Phone status** to Craig (section 9).

Announcement template:

```
TRAIN <N> (<time> MT), tag train-<N>: CORE GREEN
Merged: data #a; engine #b; ui #c; pitch #d; science none
Main: check:all green; offline-check PASS; facts-check PASS (2 WARN)
Beats on main: 1 ok, 2 ok, 3 stub, 4 missing, 5 ok, 6 ok
Cut or requeued: <item> (<reason>), or none
QUEUE: #x, #y, #z
Next: Train <N+1> at <time>. Rebase your open PRs on origin/main now.
```

### 6.3 Board: seeding, new issues, re-ordering

- **Seeding.** The lane issues come from each lane brief's queue, written to `tools/issues.json` as `[{lane, title, tier, order, body, depends_on_titles?, milestone?}]`.
  - Run `node tools/seed-github.mjs --dry-run`, read the output, then run it without the flag. The seeder is idempotent: it skips any title that already exists.
  - It defaults milestones by tier (core to Train 2, stretch-1 to Train 5, stretch-2 and moonshot to Train 6). Set `milestone` for any issue due at another train.
- **New issue:** write the body (context, acceptance checklist, files, verify commands, dependencies) to a temp file, then run `gh issue create --title "[<lane>] <title>" --label lane:<lane> --label tier:<tier> --milestone "<milestone title>" --body-file <tmp>`. Milestone titles start "Train N: ..." and "Freeze: Wed 2:00pm MT, tag v1-stage"; list them with `gh api repos/{owner}/{repo}/milestones --jq '.[].title'`.
- **Re-order:** post `QUEUE: #a, #b, #c` on the lane's tracking issue. Core 1 adds the AGENTS.md line that makes this override issue order.
- **Move a deadline:** `gh issue edit <n> --milestone "<title>"`, and say why in a comment.
- **Another lane's issue:** never close it silently. The only closes are cuts under the cut rule, or duplicates, with a comment naming the issue kept.

### 6.4 Reviews: Codex on engine PRs, Grok on every PR

- **Codex** (the data lane) reviews each engine PR. Handle each finding:
  1. Open the cited line before deciding anything.
  2. If the finding is real, the PR stays unmerged and the engine lane fixes it on the same branch.
  3. If it is a false positive, reply with `file:line` evidence.
  4. If it is real but outside the PR's scope, file an engine issue and merge.

  Record the result on the PR, for example: "Findings: 1 fixed in <sha>; 2 false positive (<evidence>); 3 deferred to #m."
- **Grok** (Pitch) reviews every PR for guardrails, and reviews merged main at each train (#10). Handle its findings the same way. On judge-facing copy, treat a guardrail finding as real unless FACTS says otherwise, and fix it before the next train.
- **Neither reviewer's claim is taken on trust or dismissed unread.** One example is open at handoff: PR #15's CO2 item (section 6.11).
- **CodeRabbit:** clear findings that exist; never wait for it.

### 6.5 The Oct 28 refresh

**What it does.**
- It builds the Mountain operating day Oct 28: 2026-10-28T06:00Z to 2026-10-29T06:00Z.
- Hour 0 comes from CAISO's Oct 27 trade day, which is already published.
- Per `research/DATA-SOURCES.md` section 5, it fetches:
  - PRC_LMP DAM for 20261028T06:00 to 20261029T06:00;
  - SLD_FCST and the EDAM wind and solar forecasts for CAISO operating days Oct 27 and Oct 28;
  - CO2 from the committed EIA extract (no 930-api or `PACE.xlsx` fetch at night).
- OASIS calls stay at least 5 s apart, and raw responses go to `../clearlane-raw`. The data lane's script handles all of this; you run it.

**Refresh list** (final by Train 5), kept in `demo/run-of-show.md` under "Refresh list". The core list:

```bash
python -I prep/refresh_tonight.py --day 2026-10-28 --poll-until 22:00
npx tsx engine/cli/numbers.ts public/data/bundle_2026-10-28.json
npx tsx engine/cli/envelope.ts public/data/bundle_2026-10-28.json
npm run check:all
```
This is the one refresh command list. It is copied verbatim in `docs/lanes/data.md` Core 7, `docs/lanes/engine.md` section 6.9 and `docs/lanes/integration.md` section 6.5; change all three together. CO2 comes from the committed extract; nothing fetches EIA at night.

Then, outside the verbatim block: every merged stretch CLI that writes a per-day file; the engine lane's re-pin command (ask for it on #3 by Train 5; if none exists, the engine session re-pins in its own PR before 10:30pm); and the checks in step 4 of the run below. The backtest does not rerun: its window ends Oct 27.

**Dry run, Tue 5:00pm.** Run the whole list on Oct 27 on a throwaway `int/refresh-dry` branch, and never merge it. It proves two things: every command runs, and the data script exits non-zero and changes nothing when OASIS fails (use the failure switch the data brief names).

**Live run:**
1. **9:10pm:** main is green. Run `git -C ~/Code/clearlane-int switch -c int/oct28-refresh origin/main`.
2. **From about 9:16pm:** run the data command in the int worktree. `--poll-until 22:00` retries every 5 minutes and gives up at 10:00pm on its own.
3. Run the engine CLIs and the re-pin, in list order.
4. Run the checks:
   - `npm run check:all`;
   - `node tools/facts-check.mjs`;
   - `npm run build && node tools/offline-check.mjs`;
   - the six beats at `?day=2026-10-28` in `npx vite preview`;
   - Pitch's resolver (`node pitch/resolve.mjs`, flags per the pitch brief), which must leave no deck key unresolved.
5. **Story check.** Post a table on #1 comparing Oct 27 and Oct 28:
   - the cheapest and priciest hours and their prices;
   - peak over trough;
   - the clear, shoulder and jam hours;
   - both policies' $/MW-day;
   - whether Clearlane beats the off-peak rule;
   - the SCH hours.

   If Clearlane does not beat the off-peak rule, there is no evening jam, or the peak leaves the evening, **do not merge**. Leave the stage on Oct 27 and ask Craig when he is back at 11:00pm: "Oct 28: <one line>. Keep the stage on Oct 27? yes/no".
6. **FACTS:** add an "Oct 28 stage values" section with each key and its `display`, taken from `numbers.json`. Keep the Oct 27 rows as they are.
7. **PR and merge by 10:30pm.** CI must be green. If CI is still running at 10:20pm and local check:all is green, merge, note that in the PR, and watch CI; revert if it goes red.
8. **If the run fails or hits the hard stop:** nothing partial merges, because a mixed day is never allowed. The stage stays on Oct 27 and the header reads Cached (ui.md 6.2). Note it on #1 and in the run-of-show.
9. **After the merge:** tell Pitch on #5 to regenerate the deck numbers and re-record the backup video (`autovideo`, if merged).

**Changing the stage day.** The stage day is whichever bundle `numbers.json` was generated from (ui.md 6.2); there is no separate flag. To go back: `npx tsx engine/cli/numbers.ts public/data/bundle_2026-10-27.json`, through a PR.

### 6.6 Freeze and submission day (Wed)

- **7:00am:** Craig's read; fixes only from here. Train 7 at 10:00am; Train 8 at noon (copy and polish; README final; scan done).
- **1:45pm:** the last merge. Craig's Train 6 flag set must already be on main as `default: true` in `contracts/flags.ts`.
- **2:00pm, tag the stage build:**
  ```bash
  cd ~/Code/clearlane
  git pull --ff-only && npm run check:all
  git tag -a v1-stage -m "Stage build, operating day <day>, flags: <list or none>"
  git push origin v1-stage
  git worktree add ../clearlane-stage --detach v1-stage
  cd ../clearlane-stage && npm ci && npm run build && node tools/offline-check.mjs
  ```
  Then run the projector check at 1920x1080 against this build.
- **Airplane-mode run** on the demo machine (which machine is Craig's call):
  1. With Wi-Fi on, run `npm ci` and `npm run build`.
  2. Turn Wi-Fi off. Run `npx vite preview` and open the URL it prints (Vite's default is `http://localhost:4173/`).
  3. Run all six beats from the keyboard, timed to 2:45 per `demo/stage-script.md`.
  4. Run `node tools/offline-check.mjs` again, still offline.
  5. Turn Wi-Fi back on. Log the time and the result in the run-of-show.
- **Backup video** per `demo/backup-video.md`. Then copy the video and the deck PDF to the laptop, a USB stick and the Mac by 3:30pm.
- **Deck PDF:** Pitch exports it. You check that:
  - every `{key}` is resolved;
  - the operating day matches the stage;
  - there is no em dash;
  - there is no Nucleus slide.
- **Release assets:** attach the deck and one-pager PDFs (from `pitch/out/`, never committed) to a GitHub release on the submission tag.
- **Submission:** Craig submits by 5:00pm, from `demo/submission.md`. Make the repo public per section 6.8, and only on his go.

### 6.7 Offline check (`tools/offline-check.mjs`)

Usage: `node tools/offline-check.mjs [--dist dist] [--browser msedge|chrome|chromium] [--plant]`.

1. **Static scan.** Scan `dist/**/*.{html,js,css}` for URLs that the browser would load: `src=`, `href=`, `url(`, `@import`, `import(`, `fetch(`, `new URL(`, `XMLHttpRequest`, `sendBeacon`, `EventSource(`, `WebSocket(`.
   - Other absolute URLs inside the bundle are listed as INFO, not failures. These include data `source` strings bundled from JSON, SVG namespace URIs, and React's error-decoder link.
   - Each allowed pattern carries a one-line reason in the code.
2. **Serve.** Serve `dist` with a small built-in `node:http` static server on 127.0.0.1 and a free port. This adds no dependency.
3. **Browse and record.** Launch the browser with Playwright through the installed Edge or Chrome channel, and block service workers. Record every request. Abort and record:
   - any request whose origin differs from the server's;
   - any WebSocket;
   - any `/api/` request in snapshot mode.
4. **Drive the six beats** with the UI's hooks (ui.md 6.10):
   - open `/?beat=<1..6>&step=end&motion=off`;
   - wait for `body[data-state]` to leave `loading`;
   - press the beat's keys: Space; C, then C again; E; B; + and End; Right for the re-plan step; then R once at the very end to reset. `docs/lanes/ui.md` section 6.8 is the one source for keys; copy from it when it changes.

   A `failed` state counts as a failure.
5. **Output.** Print one line per violation, then either `PASS offline-check: 0 external requests, <n> same-origin, 6/6 beats` or `FAIL offline-check: <k> violations`.

**`--plant` self-test.**
- Copy `dist` to a temp dir.
- Insert `<img src="https://planted.offline-check.invalid/x.png">` into `index.html`.
- Add an init script that calls `fetch("https://planted.offline-check.invalid/p")`. The `.invalid` domain never resolves (RFC 2606).
- The run must print FAIL lines naming both planted URLs, then `SELF-TEST OK`, and exit 0. If either URL goes uncaught, print `SELF-TEST BROKEN` and exit 1.

**Exit codes.** 0 PASS; 1 FAIL; 2 could not run (no `dist`, no browser, or the server failed). Exit 2 prints `COULD NOT RUN: <reason>`. Never fold it into PASS or FAIL.

**Tests.** Keep the URL classifier and the origin check in `tools/lib/`, and test them in `tools/offline-check.test.ts`. A `.ts` test that imports `.mjs` needs a `.d.mts` file beside it, or `tsc` fails; keep `npm run typecheck` green.

**CI.** Add an `offline` job to `.github/workflows/ci.yml` after `check`:
1. `npm ci`;
2. `npm run build`;
3. install a browser. `npx playwright install --with-deps chromium` is the known route for the `playwright` package; it is UNVERIFIED for `playwright-core`;
4. run the check with `--browser chromium`;
5. run `--plant` and require `SELF-TEST OK`.

### 6.8 Public-repo scan (Core 13)

Run the scan by Train 8, and again right before the switch:

```bash
cd ~/Code/clearlane
# 1. secrets in any commit, and secret-like files
git log --all -p | grep -nE "(api[_-]?key|secret|token|passw|BEGIN [A-Z ]*PRIVATE KEY|ghp_[A-Za-z0-9]{30,}|github_pat_|sk-[A-Za-z0-9]{20,}|xai-[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16})" | head -100
git ls-files | grep -iE "(^|/)\.env|\.pem$|\.key$|secret"
# 2. blobs over 500 KB anywhere in history
git rev-list --objects --all | git cat-file --batch-check='%(objecttype) %(objectname) %(objectsize) %(rest)' | awk '$1=="blob" && $3>500000'
# 3. raw-folder files that reached git (an exact blob match)
find ../clearlane-raw -type f | while read -r f; do h=$(git hash-object "$f"); git cat-file -e "$h" 2>/dev/null && echo "IN GIT: $f"; done
# 4. tool banners and long quotes
grep -rniE "markdown content:|url source:|firecrawl|jina" research docs pitch | head -50
grep -rnE "\"[^\"]{90,}\"" research docs pitch | head -50
# 5. binaries and third-party files
git ls-files | grep -iE "\.(xlsx|pdf|png|jpe?g|zip|mp4)$"
```

Steps 6 to 8 are manual checks:
6. **Attribution:** the README's "Data sources and licenses" names CAISO OASIS and EIA, cites each Torus page by URL, and attributes Open-Meteo (CC BY 4.0) for the `slc_*` columns in `research/data/pace_snapshot_2026-10-27.csv`, or those columns are dropped (`research/DATA-SOURCES.md`).
7. **Orphaned commits:** ask Craig "Ask GitHub Support to purge the five orphaned commits? yes/no" and record the answer in `docs/decision-log.md`.
8. **License:** `LICENSE` exists and `package.json` says MIT.

Every hit from steps 1 to 5 gets one of three outcomes: removed in a PR; written off on #1 with a reason; or, for something in history, raised with Craig, because history rewrites are his call.

**The switch, on Craig's go only:**

```bash
gh repo edit craigcossairt/clearlane --visibility public --accept-visibility-change-consequences
curl -s -o /dev/null -w "%{http_code}\n" https://github.com/craigcossairt/clearlane   # expect 200 when logged out
```

Afterwards, check GitHub's secret-scanning alerts for the repo, and post the result on #1.

### 6.9 Fact ledger and numbers (Core 7)

- **Flow:** the engine CLIs write `public/derived/numbers.json`. FACTS registers every key under the same name. UI renders keys with `<Num k>`, and Pitch resolves `{key}`.
- **`tools/facts-check.mjs`** runs these checks:
  1. every `numbers.json` key has a FACTS row (FAIL if not);
  2. every `{key}` in `pitch/**/*.md`, `demo/**/*.md` and `README.md`, and every key in `app/src/stageKeys.ts`, resolves in `numbers.json` or in a VERIFIED FACTS row, or is a MEASURED key (`prov: "MEASURED"` in `pitch/keys.json`, or Class MEASURED on its FACTS row), which is live-only and needs no value (FAIL if none of these holds);
  3. a VERIFIED row whose value disagrees with `numbers.json` `display` (WARN, listing both);
  4. a PENDING-ENGINE row whose key now exists (WARN: update its status);
  5. a CONFLICT key used in judge copy (WARN, quoting the row's "say instead" wording);
  6. a MEASURED key that `numbers.json` also holds (FAIL: MEASURED is live-only, the same rule `pitch/resolve.mjs` applies).

  Exit codes: 0 PASS, 1 FAIL, 2 could not run. Test it with a vitest on a small fixture.
- **Upkeep:**
  - Each merge that adds or changes a stage key updates FACTS in the same train.
  - When the engine produces a PENDING-ENGINE key, fill in its value, set Lvl 4 with the command, and update the status.
  - Never raise a level beyond what you ran.
- **PR #16 tariff findings** come from Pitch (P.S.C.U. No. 52, Docket 26-035-T08, effective Aug 10 2026, per the PR):
  - Schedule 6: $14.49 summer and $12.82 winter per kW;
  - Schedule 8: $16.84 and $14.90;
  - Schedule 6A: no power charge, on-peak 6 to 10pm weekdays.

  They go into the `rmp_ci_tariff` row only after you open the tariff sheet yourself. Host results stay in kW on stage either way; changing that is Craig's call.
- **CONFLICT wording to enforce everywhere:**
  - say $39.53 and $21.55, never $38.71 or $22.83 as charge prices;
  - render `net_load_climb_mw` from its `display` ("3,655");
  - "a call of about five and a half minutes";
  - "Torus's June 2026 comments to ROWE";
  - "43% to 77%, depending on how the hours are read";
  - "359 events in 2025";
  - "available by 9:16pm the night before";
  - "Station lifespan 25 years";
  - "an MOU for up to 500 MW".

### 6.10 Demo files (Core 5)

- **`demo/stage-script.md`** is the operator's script. For each of the six beats it gives:
  - the time window (0:00-0:25, 0:25-0:55, 0:55-1:40, 1:40-2:00, 2:00-2:25, 2:25-2:45);
  - the keys to press;
  - the expected `data-beat` and `data-state`;
  - the `{key}`s on screen;
  - the one thing the judge must see;
  - the recovery if the beat fails: press R, or jump with the beat number, or cut to the backup video at that beat's timestamp.

  It links `pitch/stage-script.md` for the spoken lines and never copies them.
- **`demo/keymap.md`** mirrors `app/src/keymap.ts`. UI owns the keys (ui.md 6.8); re-sync this file at every train.
  - T is reserved for the projector theme (stretch). The old time-zone toggle, the Q cards and the L live tile are dropped.
  - What a presenter remote sends is UNVERIFIED. Test the remote at rehearsal 0.
- **`demo/run-of-show.md`** holds:
  - the timeline from section 6.2;
  - the rehearsal log (time, length, what broke);
  - the train log;
  - the refresh list;
  - the stage flag set;
  - the pack list (laptop, charger, display adapter, USB stick with the video and PDF, the Mac with a `v1-stage` build). The venue's display input is UNVERIFIED.
- **`demo/backup-video.md`** holds:
  - the spec: 1920x1080, 2:40 to 2:50, with the operating day on every frame;
  - the tool: Pitch's `autovideo` (`off_record_video`) if it merges. Otherwise a manual capture of the browser window (Xbox Game Bar, Win+Alt+R, tested at rehearsal 0);
  - when: a draft after the Train 6 rehearsal, the final after `v1-stage`;
  - where the copies go, and the checklist.

### 6.11 Open items at handoff (Tue 12:45am)

- **Open PRs:**
  - #15 (`grok/pitch`, the contract review, Closes #7);
  - #16 (`grok/8-tariff-research`, Closes #8);
  - #17 (`grok/9-deck`, the deck, one-pagers and Q&A).

  - #18 (`ui/14-six-beats`, the stage app). Before it merges: `app/src/qa/cards.json` moves to pitch; `app/src/stub/published.ts` becomes a fetch of `public/data/torus_published.json` behind the stub flag; the math in `app/src/stub/reference.ts` goes in favor of `numbers.json`; the Spin source URL is corrected to the torus-flywheel page in FACTS.

  The pitch PRs touch only `pitch/`. Order: #17 merges at Train 2, then #15 and #16; pitch's stacked branches retarget after that.
- **#15 item 1, the CO2 map, is a likely false positive.** FACTS "Hour conventions" says EIA's `PACE.xlsx` is hour ending, local time, so hour beginning h uses HE h+1. The fixture and `habit.py` do exactly that. Keep the map, and keep the pinned values -0.2625 and +0.270 t per MW-day.
- **#15 item 2, fixture hour 0.** It holds Oct 28 00:00 values ($46.11 at 2026-10-28T06:00Z) labeled REAL. The real Oct 27 hour-0 LMP is in `research/analysis/option2/oct/20260930_20261028_PRC_LMP_DAM_20261026_20_37_47_v12.csv`: interval start 2026-10-27T06:00Z, OPR_DT 2026-10-26, HE 24, LMP 30.21857. Both prices lie between the day's min ($21.38) and max ($55.78) and fall in the shoulder lane, so the lane thresholds do not move. The engine's DP value on the fixture can move, so tell the engine lane on #3.
- **#15 item 3, `pulse_life_yr`.** It is the Station lifespan, so mark the 300-cycles-a-year budget as resting on an ASSUMPTION, by comment.
- **Beat 2 charge prices.** The keys are pitch's names, `fixed_rule_charge_usd_mwh` ($39.53) and `timetable_charge_usd_mwh` ($21.55). Engine Core 12 writes them; FACTS has their rows.
- **Race card value.**
  - FACTS has `clearlane_usd_mw_day` (the reference, $58.41) and `clearlane_dp_usd_mw_day` (the engine DP, PENDING-ENGINE).
  - UI core 5 asserts that the live plan's value equals its key, and the deck's stage script reads `{clearlane_usd_mw_day}`.
  - Decided at Train 1 (#19, cross-check item 7): beat 2 reads only the reference set (`fixed_usd_mw_day`, `clearlane_usd_mw_day`, `race_ratio`, `fixed_70`, `clearlane_70`) and plays the reference timetable. `clearlane_dp_usd_mw_day` moves to the backtest or crash beat with its own label.
- **Key clash:** settled in ui.md 6.8.
- **Playwright:** moved to Core 2.

### 6.12 Working while Craig is away

- Craig is away Tue 11:00am to 1:30pm and 6:00pm to 11:00pm, and asleep about 2am to 7am both nights.
- **While he is out:** keep merging green PRs, run the trains on the clock, and run the refresh.
- **The scheduled contract work still lands on time:** the Train 1 freeze, the Train 3 flags and schema, and the Train 4 additions.
- **Never while he is out:** an unscheduled contract change, a core cut, a flag choice, going public or deploying.
- **Questions:** keep them in one "For Craig" list on #1, one yes/no per line, and lead the 7:00am, 1:30pm and 11:00pm status with them.
- **Push notifications:** if the session has a push-notification tool, use it only for CORE RED and for a yes/no that blocks a deadline.

## 7. Guardrails

- **Torus:**
  - stations are "simulated Torus-style", with no Torus logos or branding;
  - say "not advertised", never "Torus lacks";
  - the fixed overnight schedule is our off-peak baseline, never Torus practice;
  - value is "to RMP's system at day-ahead prices", never Torus revenue or host savings;
  - 500 MW is an MOU ceiling, not installed capacity;
  - never invent a Torus fact.
- **Data honesty:**
  - CO2 numbers are average-emissions estimates and always carry the caveat;
  - the 2025 heatmap states no time zone, so always show both readings (Mountain and UTC);
  - every number carries its provenance class;
  - missing, unknown and failed look different from each other;
  - anything not confirmed is marked UNVERIFIED.
- **Copy (README, demo/, submission, anything a judge reads):**
  - no em dashes;
  - American English and plain words;
  - none of: comprehensive, robust, seamless, leverage, cutting-edge, game-changer.
- **Public repo:**
  - no keys in git;
  - no copied page text (quotes under 15 words, with a URL);
  - third-party page snapshots, `PACE.xlsx`, the event slides and other large files live only in `../clearlane-raw`, which never enters git.
- **Offline:** `DATA_MODE=snapshot` is the default, and the stage needs no network.
- **Python:** run it as `python -I <script> <args>`, open files with `encoding="utf-8"`, and write with `newline="\n"`.
- **Shell:** in hooks, use the full Git Bash path, never bare `bash`, which runs WSL (`docs/common-gotchas.md`).
- **Core never depends on stretch.**

## 8. When blocked

1. Run `gh issue edit <n> --add-label status:blocked`, then `gh issue comment <n> --body "Blocked: need <exact thing> from <lane or Craig>; see #<issue>"`. Open the owner's issue first if none exists.
2. Take the next unblocked issue, or the next merge.
3. **A lane goes quiet.** If a lane has posted nothing for a full train while it has core work open, post on its tracking issue and requeue its core work by QUEUE line. Tell Craig the session may need a restart. You cannot restart another harness.
4. **CI or GitHub is down.** Keep local `npm run check:all` as the gate. Merge nothing until checks run again. Exception: the 10:20pm refresh rule in section 6.5.
5. **Craig is unreachable on a yes/no.** The safe default holds until he answers: no public URL, no going public, the stage stays on Oct 27, every flag stays off, and no core cut.

## 9. Status reporting

- **Every train:** post the announcement (section 6.2) on #1 to #6, then your own lane status on #1:
  ```
  Train <N> (<time> MT), integration
  - Merged: #a, #b
  - In flight: #c (PR #d, check green|red)
  - Blocked: #e (needs <what> from <whom>)
  - Next: #f, #g
  - Gate: check:all green|red; offline-check PASS|FAIL|not built; facts-check PASS|FAIL
  ```
- **Phone status** goes to Craig in this chat and at the top of that #1 comment. Five short lines at most:
  ```
  T4 2:00p CORE GREEN, tag train-4
  Merged 7 (data 2, eng 3, ui 2). Open 5. Blocked 1: ui#33 needs eng#29
  Beats: 1 ok 2 ok 3 ok 4 ok 5 stub 6 ok
  Q: cut the second press? yes/no
  Next: refresh dry run 5:00p
  ```
  Also send one at 7:00am, at 1:30pm and at 11:00pm (Craig's returns), even when no train falls then.
- **Queue empty:** say so on #1, then review other lanes' PRs and support rehearsals.
