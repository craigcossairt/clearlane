# Freeze day checklist (Wed Oct 28)

Everything #36 needs on Wednesday, in order, so the day is execution only. Times are Mountain. The procedure behind it is `docs/lanes/integration.md` section 6.6; the beats are in [`stage-script.md`](stage-script.md); the video is in [`backup-video.md`](backup-video.md).

Two decisions must be made before 1:45pm, both Craig's:

- **Operating day:** Oct 27 (on main now) or Oct 28 (PR #189, held).
- **Flag set:** which flags in `contracts/flags.ts` go `default: true`, or none.

## 1:45pm, last merge

- [ ] No PR merges after this.
- [ ] Craig's flag set is on main as `default: true`, or every flag is still off.
- [ ] `public/derived/numbers.json` and the README numbers block show the chosen operating day: `node tools/readme-numbers.mjs --check` exits 0.

## 2:00pm, tag `v1-stage`

```bash
cd "C:/Users/Craig Cossairt/Code/clearlane"
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
git -C "C:/Users/Craig Cossairt/Code/clearlane" worktree add ../clearlane-stage --detach v1-stage
cd "C:/Users/Craig Cossairt/Code/clearlane-stage"
git describe --tags && npm ci && npm run build && node tools/offline-check.mjs
npx vite preview --port 4173 --strictPort
```

In a second terminal, with the preview running:

```bash
node app/scripts/projector-check.mjs http://localhost:4173
```

- [ ] `git describe --tags` prints `v1-stage`.
- [ ] Offline check PASS and projector check PASS (1920x1080 and 375px).
- [ ] Stop the preview when done.

## 2:20pm, airplane-mode run

On the demo machine (Craig picks it). If it is not this laptop, run the stage worktree step there first, with Wi-Fi on.

1. [ ] With Wi-Fi on: `npm ci` and `npm run build` in `../clearlane-stage`.
2. [ ] Turn Wi-Fi off. Check the tray icon shows no connection.
3. [ ] `npx vite preview --port 4173 --strictPort`, open `http://localhost:4173/`, press F11.
4. [ ] Run beats 1 to 6 from the keyboard per `stage-script.md`, timed with a phone stopwatch. Target 2:45.
5. [ ] Still offline: `node tools/offline-check.mjs` PASS, and `npm run reproduce` prints REPRODUCED (this is the Wi-Fi-off proof for #32).
6. [ ] Press R. Turn Wi-Fi back on.
7. [ ] Log the time, length and anything that broke in the run-of-show rehearsal log, with build `v1-stage`.

If a beat fails: stop, note the beat and the `data-state` on screen, and post on #4. A fix after 2:00pm means a new tag (`v1-stage` is moved only with Craig's go).

## 2:35pm, backup video

Record from the airplane-mode setup, Wi-Fi still off, per [`backup-video.md`](backup-video.md).

- [ ] Recorded, checked (length, size, last frame) and named `clearlane-backup.mp4`.

## 3:00pm, deck PDF check

Craig builds the deck on his machine (`node pitch/build.mjs`, PDFs in `pitch/out/`, never committed). Then:

```bash
pdftotext -layout pitch/out/deck.pdf - > "$TEMP/deck.txt"
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
| `deck.pdf`                                               | [ ]                 | [ ]       | [ ]     |
| `v1-stage` build (`npm run build` in a clone at the tag) | n/a                 | n/a       | [ ]     |

- [ ] Open each copy once to prove it plays or opens.
- [ ] Phone status to Craig: tag SHA, operating day, flags, and where the video and PDF are.

## 4:00pm to 5:00pm, submission and release

- [ ] Craig submits from `demo/submission.md` by 5:00pm.
- [ ] GitHub release on `v1-stage` with the deck and one-pager PDFs attached.
- [ ] Repo public only on Craig's go, after the #35 items are answered (findings on #1).

## Before the clock starts (about 4:50pm)

- [ ] Wi-Fi off, preview running from `../clearlane-stage`, browser F11 on beat 1, `data-state="ready"`.
- [ ] Backup video open in a second window, paused at 0:00.
- [ ] Presenter remote tested (see `keymap.md`), charger plugged in, display adapter connected.
