# Decision log

Dates in Mountain time. One line per decision; reasoning as long as it needs.

- **2026-10-26** Build Clearlane: Option 1 (rush hour) as the spine, Option 2 only as the "in time, not in space" card. Torus bounty only, no second bounty. See docs/plan/synthesis.json.
- **2026-10-26** Start from a stripped Trellis subset: guard hooks and harness adapters only, no push gate, CI matrix, leases or brain.
- **2026-10-26** No research brain index. Curated markdown in research/ and docs/ is the shared memory; every harness reads it natively.
- **2026-10-26** OpenCode dropped. Five harnesses already exceed one person's review bandwidth; overflow work folds into the Integration and UI lanes.
- **2026-10-26** GitHub Issues are the task board; Integration is the only merger; trains are sync checkpoints, merges are continuous.
- **2026-10-26** Rewrote `main` before any lane branched to drop two verbatim Alibaba cluster-trace docs (license unchecked) from every commit, and force-pushed (Craig's go). The copies live in `../clearlane-raw/third-party-docs/`. GitHub still serves the five orphaned old commits by full SHA until it garbage-collects them; nothing links to them (their CI runs are deleted). Before the repo goes public, either ask GitHub Support to purge them or accept that risk: only someone who already has an old SHA can reach them.
