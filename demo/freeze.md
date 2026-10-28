# Freeze day checklist (Wed Oct 28)

Everything #36 needs on Wednesday, in order, so the day is execution only. Times are Mountain. The procedure behind it is `docs/lanes/integration.md` section 6.6; the beats are in [`stage-script.md`](stage-script.md); the video is in [`backup-video.md`](backup-video.md).

**Stage mode: presenter.** The stage runs presenter mode from the URL `http://localhost:4173/?ff=presenter`. No flag default changes: every flag stays off in `contracts/flags.ts`, and the URL turns presenter mode on. The clicker drives it with Right or PageDown (Next) and Left or PageUp (Back); C, E and B are not used. `v1-stage-3` is the presenter stage build Craig serves on :4173, `v1-stage-2` is its fallback, and `v1-stage` (2:00pm) stays the six-beat fallback.

Two decisions must be made before 1:45pm, both Craig's:

- **Operating day:** Oct 27 (on main now) or Oct 28 (PR #189, held).
- **Flag set:** which flags in `contracts/flags.ts` go `default: true`, or none.

## 1:45pm, last merge

- [ ] No PR merges after this.
- [ ] Craig's flag set is on main as `default: true`, or every flag is still off.
- [ ] `public/derived/numbers.json` and the README numbers block show the chosen operating day: `node tools/readme-numbers.mjs --check` exits 0.

## 2:00pm, tag `v1-stage`

```bash
cd ~/Code/clearlane
git pull --ff-only && npm run check:all
node tools/offline-check.mjs && node tools/facts-check.mjs
npm run reproduce
git tag -a v1-stage -m "Stage build, operating day <day>, flags: <list or none>"
git push origin v1-stage
git ls-remote --tags origin v1-stage
```

- [ ] check:all green, offline check PASS, facts-check PASS, reproduce prints "REPRODUCED n/n stage numbers" (about 2 minutes).
- [ ] Tag pushed; write its SHA here: `________`

## 2:10pm, stage worktree from the tag

```bash
git -C ~/Code/clearlane worktree add ../clearlane-stage --detach v1-stage
cd ~/Code/clearlane-stage
git describe --tags && npm ci && npm run build && node tools/offline-check.mjs
netstat -ano | grep -E ":4173 .*LISTEN"   # must print nothing; else stop that PID: taskkill //PID <pid> //F
npx vite preview --port 4173 --strictPort
```

In a second terminal, with the preview running:

```bash
node app/scripts/projector-check.mjs http://localhost:4173
node app/scripts/projector-check.mjs http://localhost:4173 --presenter
node tools/offline-check.mjs --presenter
```

- [ ] No stray preview holds :4173. A `vite preview` left running from another worktree (for example `../clearlane-presenter`) makes `--strictPort` fail; stop it first.
- [ ] `git describe --tags` prints `v1-stage`.
- [ ] Offline check PASS (six beats and `--presenter`: 8 screens, 6 actions) and projector check PASS, default and `--presenter` (1920x1080 and 375px).
- [ ] Stop the preview when done.

## 2:20pm, airplane-mode run

On the demo machine (Craig picks it). If it is not this laptop, run the stage worktree step there first, with Wi-Fi on.

1. [ ] With Wi-Fi on: `npm ci` and `npm run build` in `../clearlane-stage`.
2. [ ] Turn Wi-Fi off. Check the tray icon shows no connection.
3. [ ] Confirm :4173 is free (the `netstat` line above prints nothing), then `npx vite preview --port 4173 --strictPort`, open `http://localhost:4173/?ff=presenter`, press F11.
4. [ ] Run the eight presenter screens with the clicker only (Right or PageDown), timed with a phone stopwatch. Target 2:45. Each screen action (the race replay, both calls, resume, the backtest, the fleet) is one Next press; Next on a screen with no action left moves to the next screen.
   - Then open `http://localhost:4173/` and run beats 1 to 6 from the keyboard per `stage-script.md`, still offline: this is the fallback.
5. [ ] Still offline: `node tools/offline-check.mjs` and `node tools/offline-check.mjs --presenter` PASS, and `npm run reproduce` prints REPRODUCED (this is the Wi-Fi-off proof for #32).
6. [ ] Press R. Turn Wi-Fi back on.
7. [ ] Log the time, length and anything that broke in the run-of-show rehearsal log, with build `v1-stage`.

If a beat fails: stop, note the beat and the `data-state` on screen, and post on #4. A fix after 2:00pm means a new tag (`v1-stage` is moved only with Craig's go).

## About 3:05pm to 3:20pm, tag `v1-stage-2` (presenter build, on Craig's go)

After the presenter PRs merge (about 3:05pm), on the new main in a fresh detached worktree:

```bash
git fetch origin && git worktree add ../clearlane-stage2 --detach origin/main
cd ../clearlane-stage2 && npm ci
npm run check:all
node tools/offline-check.mjs && node tools/offline-check.mjs --presenter && node tools/facts-check.mjs
npm run reproduce && node tools/readme-numbers.mjs --check
npx vite preview --port 4176 --strictPort   # any free port from 4176 up; :4173 is for the stage
node app/scripts/projector-check.mjs http://localhost:4176 && node app/scripts/projector-check.mjs http://localhost:4176 --presenter
git tag -a v1-stage-2 -m "Stage build, presenter mode by URL, operating day <day>, flags: none"
git push origin v1-stage-2
```

- [ ] Every check green. If one is red, do not tag: the stage runs `v1-stage` in the six-beat mode.
- [x] Tag pushed: `v1-stage-2` at `18faaba`.
- [ ] Rebuild the stage worktree from `v1-stage-2` (the 2:10pm steps with `v1-stage-2`), then repeat the 2:20pm airplane-mode run on it.

## About 3:40pm, tag `v1-stage-3` (presenter stage build, Craig's go)

Craig: "Yes, re-tag". After #285 (green "Clear" in the presenter title wordmark) merged, the orchestrator ran the `v1-stage-2` gate above on main in a fresh detached worktree and tagged `v1-stage-3` at `64e7079`. `v1-stage-2` stays the fallback. The presenter video is not re-recorded.

- [x] Stage worktree `../clearlane-stage3`, detached at `v1-stage-3` (64e7079), npm ci and build done. Serve it from that folder with `npx vite preview --port 4173 --strictPort`.

## 2:35pm, backup video

Record from the airplane-mode setup, Wi-Fi still off, per [`backup-video.md`](backup-video.md).

- [ ] Recorded, checked (length, size, last frame) and named `clearlane-backup.mp4` (six beats, from `v1-stage`).
- [ ] After `v1-stage-2`: a presenter take from that tag, named `clearlane-backup-presenter.mp4`.

## 3:00pm, deck PDF check

Craig builds the deck on his machine (`node pitch/build.mjs`, PDFs in `pitch/out/`, never committed). Then:

```bash
pdftotext -layout pitch/out/clearlane-deck.pdf - > "$TEMP/deck.txt"
grep -c "{[a-z0-9_]*}" "$TEMP/deck.txt"   # unresolved keys: must be 0
python -I -c "import sys; print(open(sys.argv[1], encoding='utf-8').read().count(chr(0x2014)))" "$TEMP/deck.txt"   # em dashes: must be 0
grep -ci "nucleus" "$TEMP/deck.txt"       # Nucleus slide: must be 0
grep -c "Oct <day>" "$TEMP/deck.txt"      # operating day: at least 1
```

- [ ] All four checks pass. Repeat for the one-pager PDFs.
- [ ] The operating day in the PDF matches the stage build.

## 3:30pm, copies in place

| File                                                     | Demo laptop desktop | USB stick | The Mac |
| -------------------------------------------------------- | ------------------- | --------- | ------- |
| `clearlane-backup.mp4`                                   | [ ]                 | [ ]       | [ ]     |
| `clearlane-deck.pdf`                                     | [ ]                 | [ ]       | [ ]     |
| `v1-stage` build (`npm run build` in a clone at the tag) | n/a                 | n/a       | [ ]     |

- [ ] Open each copy once to prove it plays or opens.
- [ ] Phone status to Craig: tag SHA, operating day, flags, and where the video and PDF are.

## 4:00pm to 5:00pm, submission and release

- [ ] Craig submits from `demo/submission.md` by 5:00pm.
- [ ] GitHub release on `v1-stage` with the deck and one-pager PDFs attached.
- [ ] Repo public only on Craig's go, after the #35 items are answered (findings on #1).

## Before the clock starts (about 4:50pm)

- [ ] No other `vite preview` running; :4173 belongs to the stage preview.
- [ ] Wi-Fi off, preview running from `../clearlane-stage3` (at `v1-stage-3`; fallback `v1-stage-2`), browser F11 on `http://localhost:4173/?ff=presenter`, screen 1: `data-mode="presenter"`, `data-screen="1"`.
- [ ] The six-beat fallback is one URL away: `http://localhost:4173/`.
- [ ] Backup video open in a second window, paused at 0:00.
- [ ] Presenter remote tested (see `keymap.md`), charger plugged in, display adapter connected.
