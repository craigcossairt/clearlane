# Submission text

Plain text for Craig to use in the event's submission. The method (organizers' judging-groups PDF, Oct 28; `docs/JUDGING.md` section 6): upload the presentation to the submission Google Drive folder, share the slides and the technical build, and link the GitHub repo in the slides.
Craig submits it. Re-check after the Oct 28 pick and at Train 8. No numbers are typed here; the README's numbers block
is generated from `numbers.json`.

## Title

Clearlane

## One-line summary

A day planner that times simulated Torus-style battery and flywheel stations to Utah's grid: charge in the midday clear
lane, stay off the road in the evening jam, and keep the flywheel ready for Rocky Mountain Power's calls.

## Short description

Clearlane reads the CAISO day-ahead price for PacifiCorp East and plans a station's whole day ahead. The battery
charges at midday, when solar makes power cheap, and holds its energy for the evening jam. The flywheel stays ready to
answer Rocky Mountain Power's demand response calls, so the battery can keep its evening block.
When a call lands, Clearlane re-plans the rest of the day from the actual state of charge.

Each day ends in an hourly operating envelope that marks System Critical Hours, a format Clearlane proposes for a
utility and a station operator to share. A backtest from May 1 to Oct 27 compares Clearlane with a fixed off-peak rule
on real prices.

Prices and forecasts are real public data (CAISO OASIS, EIA). The stations and calls are simulated, and every number on
screen carries its class: REAL, DERIVED, SIMULATED, TORUS_PUBLISHED, ASSUMPTION or MEASURED. Dollar values are value to
RMP's system at day-ahead prices. The demo runs offline.

## Bounty

Torus (Energy x AI Infrastructure) only.

## Team

Craig Cossairt, solo, working with six AI agent lanes.

## Repo

https://github.com/craigcossairt/clearlane

The repo goes public only on Craig's go (#35). The link must be in the slides, so check it opens signed out before uploading.

## Files

- Deck: `clearlane-deck.pdf`
- One-pagers: `one-pager-host.pdf`, `one-pager-rmp.pdf`
- Slides: `clearlane-slides.pdf`, one page per presenter screen at its end state, 1920x1080, from `v1-stage-2` (`node tools/slides-pdf.mjs`)
- Backup video: `clearlane-backup-presenter.mp4` from `v1-stage-2`; six-beat fallback `clearlane-backup.mp4` from `v1-stage`

## Drive folder upload

- [ ] `clearlane-slides.pdf` and `clearlane-deck.pdf`
- [ ] The backup video
- [ ] The repo link above, also in the slides
