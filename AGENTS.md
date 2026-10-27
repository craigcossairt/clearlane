# AGENTS.md: Clearlane

Hackathon build for the Torus bounty (Energy x AI Infrastructure), Hard Tech Hackathon, Salt Lake City.
Code freeze Wed Oct 28 2026, 2pm MT; judging 5pm. Six agent harnesses work here at once. Stay in your lane.

## What it is

A day planner for Torus-style stations on Utah's grid. It reads the CAISO day-ahead price for PacifiCorp
East, fills Pulse (battery) in the midday clear lane, stays off the road in the 6pm jam, keeps Spin
(flywheel) ready for Rocky Mountain Power's calls, and exports an hourly operating envelope with System
Critical Hours. Data flows `prep/` (Python) -> `public/data/` (REAL) -> `engine/` (TypeScript) ->
`public/derived/` (DERIVED) -> `app/` (stage) and `pitch/`. Plan of record: `docs/plan/synthesis.json`.

## Start here

1. Your lane brief: `docs/lanes/<lane>.md`. It is self-contained.
2. `contracts/types.ts`: every shape that crosses a lane boundary. Only Integration changes it after Train 1.
3. `docs/FACTS.md`: every number we may say, with source and certainty. Never put a number on screen that is not there.
4. `research/README.md`: index of the research. Large and third-party files are in `../clearlane-raw/` (local only, never committed).
5. `docs/STRETCH.md`: stretch tiers, flags and deadlines. `docs/JUDGING.md`: what the judges score.

## Rules

- Work in your lane's worktree, on a branch `<prefix>/<issue#>-<slug>` cut from `origin/main`. One PR per issue, `Closes #<n>` in the body.
- Touch only the paths your lane owns. Need a change elsewhere? Comment on the issue or open one for the owning lane.
- Never merge and never push to `main`. Integration merges.
- Before every PR: `npm run check:all` (typecheck, vitest, build, prep unittest). CI runs the same.
- Test first. A number that reaches the stage is pinned by a test.
- No keys, `.env` or copied third-party pages in git. The repo goes public at submission.
- `DATA_MODE=snapshot` is the default; nothing on stage may need the network.
- Every on-screen number comes from `public/derived/numbers.json` or the engine, and carries its provenance:
  REAL, DERIVED, SIMULATED, TORUS_PUBLISHED, ASSUMPTION or MEASURED.
- Torus guardrails: "not advertised", never "Torus lacks"; stations are "simulated Torus-style", no Torus logos;
  the overnight schedule is our baseline, never Torus practice; value is to RMP's system, not Torus revenue.
- No em dashes in anything a judge reads (app copy, deck, README, one-pagers).
- Stretch work ships behind its feature flag. If a core beat is red at a train, stop stretch work and fix core.

## Lanes

| Lane | Harness | Worktree | Owns | Done when |
|---|---|---|---|---|
| Integration | Claude Code (main) | `clearlane` | root files, `contracts/`, `research/`, `docs/`, `demo/`, `tools/`, `.github/`, harness config | Six beats run offline from tag `v1-stage`; backup video and deck PDF ready by Wed 3:30pm |
| Engine | Claude Code | `../clearlane-engine` | `engine/`, `public/derived/` | Pinned Oct 27 numbers pass to the cent; backtest and `numbers.json` validate; solve times are measured |
| Data | Codex | `../clearlane-data` | `prep/`, `public/data/`, `api/` | Real bundles, May-Oct history and Torus facts committed and tested; Tue-night refresh is one command |
| UI | Cursor | `../clearlane-ui` | `app/` | Six beats run from the keyboard at 1920x1080 and 375px with provenance chips and no network |
| Pitch | Grok Build | `../clearlane-pitch` | `pitch/` | Deck, one-pagers, Q&A and stage script read every number as a key; every PR reviewed for guardrails |
| Science | Claude Science | `../clearlane-science` | `science/` | Three charts, a cited brief and an independent cross-check of the pinned numbers |

## Coordination

`tools/out/**` is gitignored scratch; any lane may write there.

Before each new issue, read the latest Integration comment on your lane's tracking issue. A `QUEUE:` line there overrides issue order.

GitHub Issues on `craigcossairt/clearlane` are the task board: labels `lane:*`, `tier:core|stretch-1|stretch-2|moonshot`,
`status:blocked`, `status:needs-review`; milestones are the trains. Your queue: `gh issue list --label lane:<lane> --state open`.
Comment "claimed by <harness>" when you start an issue and link the PR when you finish. Blocked: add `status:blocked`,
say what you need, take the next issue. At each train, post one status comment on your lane's tracking issue
("Lane: <lane> status", label `tracking`) and rebase on `origin/main`.
