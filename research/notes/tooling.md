

######## tooling
## SUMMARY
Claude Science is real and Craig can use it. Anthropic launched it on June 30, 2026 as a beta desktop research workbench. It writes and runs Python, R and shell code in a sandbox with persistent kernels, and it has connectors, a literature-review skill and a background reviewer that flags numbers it cannot trace. Results are saved as versioned artifacts with a provenance record. It is included in Team plans but off by default: an Owner or Primary Owner has to turn it on in Organization settings > Claude Science. The current docs list Windows 11 x64 support. It is not a coding harness for a repo, so for this hackathon it fits only a side lane: checking the forecast or scheduler against historical public data, and producing traceable charts and a cited literature brief for the pitch.

For the build, all five harnesses now support isolated parallel work and read AGENTS.md:
- **Claude Code:** worktrees, subagents, dynamic workflows (16 concurrent agents by default) and cloud sessions on Team. Agent teams are experimental and do not isolate teammates in worktrees.
- **Cursor 3:** Agents Window, worktrees, /best-of-n, cloud VMs (Premium+ or Teams plan), plus Design Mode and a browser for UI work.
- **Codex:** managed worktrees, cloud best-of-N (1-4 attempts) and non-interactive review.
- **Grok Build:** subagents in worktrees and workflows of 128 agents (up to 1,024).
- **OpenCode:** any model, with built-in worktree tools since Oct 12.

Vals Terminal-Bench 4.0 puts Claude Opus 5.5 first; mirrored leaderboards put Grok 4.7 well below.

Recommended pattern: contract first, then fan out. In the first 3 hours one integrator commits the types and schemas, fixtures labeled as simulated, a stub API, a demo script and fast green checks. Then work splits into lanes by directory (data adapters, engine, UI, pitch). Each lane belongs to one human running 2-3 agents in separate worktrees. Integration happens about every 4 hours, merging producers before consumers, with an end-to-end demo check after each merge. Code freezes around Wed 2pm. Use Trellis, slimmed down. Its adapters for four harnesses, worktree protocol and push gate fit this setup, but its AGENTS.md is 31,892 bytes, so trim it to stay under Codex's 32 KiB cap.
## IMPLICATIONS
- Claude Science: Craig (if he is the Team Owner) turns it on and gives it to ONE side lane with a 30-minute setup timebox. Its deliverables are a backtest of the forecast or scheduler on historical public data, 2-3 provenance-traced charts for the deck, and a cited literature brief on flywheel frequency response and data-center flexibility. Keep it off the critical path, and drop it if setup stalls. It draws on the same Team usage as Claude Code.
- Harness roles:
- Claude Code (Opus 5.5) is the orchestrator and integrator and owns the engine lane (congestion score, forecast, scheduling or dispatch optimizer), plus final review.
- Cursor owns the UI and demo lane (Design Mode, browser checks, /best-of-n for 2-3 dashboard variants).
- Codex owns the data adapters and tests: one adapter per source, `codex cloud exec --attempts 2-4` overnight, and `codex review` as the cross-family reviewer on Claude-written engine PRs.
- Grok Build reviews and researches: a workflow PR review before each integration merge and /deep-research for pitch facts. Keep it off the critical path.
- OpenCode is overflow only, for when a vendor's rate limit hits.
- Hour 0-3 (Mon night), one integrator commits a contract before anyone fans out:
- shared types and JSON schemas for the core objects (e.g. GridSignal {region, ts, price, carbon_intensity, load, congestion_score, source, simulated}, Job or Asset, Recommendation or DispatchPlan);
- fixture files labeled simulated;
- a stub API that returns the fixtures;
- a written 3-minute demo script;
- GREEN_COMMANDS limited to fast typecheck plus unit tests (under about 60 seconds).
Every lane branches from that commit.
- Use mock data first. The UI and engine build against fixtures from hour 3, and a DATA_MODE=fixture|cached|live switch moves to real data. Capture a cached snapshot of real data Tuesday night, and make that cached mode the default for judging, so a failed live API cannot sink the demo.
- Lanes by directory, each with a single owner:
- contracts/: integrator only;
- data/: one file per source;
- engine/: forecast and optimizer;
- app/: the UI;
- pitch/ and demo/.
Each human runs at most 2-3 agents at once, each in its own worktree and branch named lane/harness/task. Review capacity, not agent count, is the limit.
- Merge-conflict rules:
- contract changes come only from the integrator, as a separate PR merged first and announced with the exact diff (vague heads-up warnings were shown not to help);
- dependency and lockfile changes go only through the integrator;
- no shared registry or 'god' files: one file per feature, auto-discovered;
- small PRs, and agents never push to another agent's branch.
- Integration trains run about every 4 hours (e.g. Tue 9am, 1pm, 5pm, 9pm; Wed 9am, noon). Each merges in producer-to-consumer order (contracts, data, engine, UI), then runs the end-to-end demo script against fixtures, so main is always demoable. Code freezes Wed ~2pm with bug fixes only after that, a backup demo video is recorded by ~3:30pm, and the team rehearses before the 5pm judging.
- Use Trellis, slimmed down:
- keep AGENTS.md (trimmed to the hackathon's own facts, contracts, lane map and commands), the CLAUDE.md import, the Claude/Cursor/Grok/Codex adapters, worktree.md and the pre-push gate;
- delete brain/, daily-brief, launch-check and the other skills that do not apply;
- keep combined AGENTS.md under 32 KiB for Codex, and fix the Git Bash path on Windows;
- branch-claim leases are optional: worth keeping if several agent sessions share one git identity on one machine, skippable if the lane/harness/task naming rule is enforced.
- Do not build the plan on Claude Code agent teams (experimental, no worktree isolation, resume issues). Use plain worktree sessions or agent view, plus dynamic workflows only for fan-out research or review.
- Spread parallel load across vendors so no single plan's limits throttle the critical path, since agent teams and workflows multiply token use.
## RISKS
- Claude Science is in beta, its Windows support is newer than launch, setup needs about 5 GB and several minutes, and only an Owner or Primary Owner can enable it. Its usage competes with Claude Code on the same Team plan.
- Cloud agents (Cursor, Codex, Claude Code cloud) need the repo on GitHub and an environment set up. Cursor cloud needs a Premium+ or Teams plan. First-time setup on hackathon night can eat hours.
- Running more agents than the humans can review moves the bottleneck to integration. Semantic conflicts can merge cleanly and still break behavior, so every integration merge needs an end-to-end check.
- Codex silently cuts off project instructions past 32 KiB, and Trellis's AGENTS.md is already at 31,892 bytes.
- On Windows, hook configs that call a bare `bash` can resolve to WSL and fail in confusing ways. OpenCode has no Trellis hook adapter, so only the git pre-push gate guards it.
- The benchmark numbers come partly from third-party mirrors (benchlm). The official tbench.ai board did not render for me, and the harness-to-task fits are my judgment, not measurements.
- The arXiv coordination result is a preprint with hand-built scenarios and small samples. It supports the principle but does not give a precise effect size.
- Live public data APIs can fail or rate-limit during judging, so the demo needs a cached-data fallback.
## OPEN QUESTIONS
- Is Craig an Owner or Primary Owner of the Claude Team org? Only that role can turn on Claude Science.
- Which Cursor plan does the team have (cloud agents need Premium+ or Teams), which SuperGrok or X tier for Grok Build, and which ChatGPT plan for Codex cloud?
- How many humans are on the team, which OS does each use, and which harness does each prefer?
- Do the hackathon rules require a public or open-source repo, and is starting from a template (Trellis) allowed? Cloud agents need the repo on GitHub.
- Stack choice (TypeScript/Next vs Python) decides the contract format and the GREEN_COMMANDS.
- What does Torus define as winning? Sponsors set their own criteria, and that should shape which lane gets the most effort.
