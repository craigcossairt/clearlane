# Judging brief

What the event slides say about the Torus bounty, the judges, the schedule and submission, and how Clearlane answers each criterion. Written Oct 26, 2026 (Mountain time).

**Scope.** Craig enters only the Torus bounty. The Nucleus x Startup State bounty is out of scope: no Nucleus slide in the deck and no double-entry talk.

**Sources.** The kickoff slide images `s1.png`, `s2.png`, `s3.png`, `s4.png` and `s6.png` in `../clearlane-raw/event/` are local only and not in git. Slide 5 (s5) is the Torus bounty slide. It has no local copy; the judge-review session (orchestrator-started) read it from the Google Slides kickoff deck on Oct 28 2026, about 4am MT (`tools/out/judge-review.md`, local scratch). The organizers' judging-groups PDF (received Oct 28, relayed by the orchestrator; local only, not in git) adds the judging rooms, times and submission method; rows from it cite "organizers' judging-groups PDF, Oct 28". Where the slides are silent, this file says **not stated**. Facts that come from somewhere other than a slide name their source.

---

## 1. The event

| Item | As shown | Slide |
|---|---|---|
| Name | Hard Tech Hackathon, part of Hard Tech Week (47G + Utah Tech Week) | s1 |
| Logos on the kickoff slide | Torus, Nucleus, Kickstart, The University of Utah | s1 |
| Host | Aernata | s1 |
| Venue | Aernata, 250 E 200 S, Ste 320, Salt Lake City | s6 |
| Guest speaker | Juan Lizarazo (in/juanlizarazo), talk titled "How I Won 3 Straight Hackathons" | s3 |

## 2. Schedule

| When | What | Slide |
|---|---|---|
| Mon Oct 26, 4-5 PM | Kickoff: get briefs, meet sponsors, start building | s6 |
| Mon-Wed | Build: three days to ship a solution | s6 |
| Wed Oct 28, 5-6 PM | Judging: teams present to sponsor judges | s6 |
| Thu Oct 29 | Winners announced on the main stage at the Zero Gravity Summit | s6 |
| Wed Oct 28, by 5:00 PM | Arrive at Aernata, 250 E 200 S, Suite 320, Salt Lake City | organizers' judging-groups PDF, Oct 28 |
| Wed Oct 28, 5:15 PM | Judging starts. Groups 4 to 6 judge Torus | organizers' judging-groups PDF, Oct 28 |
| Wed Oct 28, 5:20 PM | Craig presents in Group 4. Each team has a 5-minute slot; be at the room before the slot | organizers' judging-groups PDF, Oct 28 |
| Wed Oct 28, 6:15-6:45 PM | Finals: finalists from each group present to the full panel | organizers' judging-groups PDF, Oct 28 |
| Thu Oct 29, 9:00 AM | Winners announced on the main stage at Zero Gravity Summit. Finalists get a free ticket and should arrive by 8:30 AM | organizers' judging-groups PDF, Oct 28 |

- **Time zone.** Not stated on the slides. The venue is in Salt Lake City, so read every time as Mountain.
- **Announcement time.** 9:00 AM Thu Oct 29 (organizers' judging-groups PDF, Oct 28). The Zero Gravity agenda had said 9:05 AM (https://zerogravitysummit.com/agenda, from research/notes/torus-intel.findings.md); the PDF is newer.
- **Code freeze and submission.** Not stated on the slides. The plan of record sets code freeze at Wed 2:00pm, the tag `v1-stage`, and submission by 5:00pm. Those are Craig's own deadlines, not published rules.
- **Pitch length.** A 5-minute slot per team (organizers' judging-groups PDF, Oct 28). Setup comes out of the slot, so the laptop is on the presenter title screen with the cable in before it starts. The plan rehearses a 2:45 demo.

## 3. The Torus bounty

| Item | What we have | Basis |
|---|---|---|
| Title | ENERGY x AI INFRASTRUCTURE | s5 |
| Prize | $5K | s5; FACTS `torus_bounty_amount` stays UNCHECKED until Craig confirms, so do not state it yet |
| Option 1, "Rush hour for electrons" | Paraphrase of s5: build software that knows when the grid is jammed and stays out of traffic. Its examples: a navigation app for electricity, a traffic report for tomorrow's grid, and agents that schedule around clean power. Its question: how would you manage the grid's congestion? Suggested data: EIA, CAISO, ERCOT, Open-Meteo and Electricity Maps. | s5 |
| Option 2, "Compute follows the sun" | Paraphrase of s5: decide where and when compute runs. Its examples: a carbon-saving job router, bidding agents and a live map. | s5 |
| Rules | Free and open-source data only. Simulated data is fine if it is labeled. | s5 |
| Stance | Torus does not expect teams to be grid experts; it cares more about engineering skill and creativity. | s5 (paraphrase) |
| What winning looks like | Judged on creativity, clarity of insight and execution. No weights are given. The judging slide adds that each sponsor sets its own definition of winning. | s5, s6 |

How Clearlane covers both options: Option 1 is the spine, and Option 2 enters as one closing card. In Utah, compute should follow the sun in time, not in space.

## 4. Judges

As shown on the "Meet the judges" slide (s2):

| # | Name | Affiliation as shown | Handle as shown |
|---|---|---|---|
| 01 | Ryan Byrd | Former CTO of Entrata, Aptive, and Pattern | in/ryanbyrd |
| 02 | Angela Smith | COO of Nucleus Fund | in/angelasmith116 |
| 03 | The Torus judge | Strategic Events Leader of Torus | not listed here |
| 04 | Scott Holley | Executive Director, Lassonde Center at the U of U | none shown |
| 05 | Tanner Potter | Partner at Kickstart | none shown |

- **Who scores Torus.** s2 does not say which bounty each judge scores (not stated). The Nucleus slide (s4) lists its own panel: Angela Smith, Tyler Jennings, Cam Dionne and Dylan Doty. The Torus judge is the only Torus person shown.
- **Our read of the panel (ASSUMPTION).** It mixes an engineering leader, investors and a university center lead, and only one judge is from Torus. The story has to land without grid expertise, and the engineering has to hold up under a former CTO's questions.

## 5. Judging criteria

- **Torus bounty: creativity, clarity of insight and execution** (s5). No weights are given. s6 says each sponsor defines winning.
- **The only weights on any slide** belong to the Nucleus x Startup State bounty (s4), which we are not entering. They are recorded here only so nobody mistakes them for Torus's: progress beyond concept 30%, path to reality 25%, hard tech depth 20%, Utah impact 15%, team and pitch 10%. Do not put them in the deck.

## 6. Submission, repos and templates

| Question | Answer | Basis |
|---|---|---|
| Submission method, format or link | Upload the presentation to the submission Google Drive folder. Share the slides and the technical build in any format; if the build is on GitHub, link it in the slides. | organizers' judging-groups PDF, Oct 28 |
| Submission deadline | Not stated; Craig's plan uses Wed 5:00pm | no slide |
| Deck, video or demo requirements | Slides plus the technical build, format of the team's choice | organizers' judging-groups PDF, Oct 28 |
| Repo must be public or open source | Not stated. The plan keeps the repo private until submission and keeps it ready to go public at any time (no secrets, no copied pages). | no slide |
| Starting from a template | Not stated on the slides. Craig reports that the guest speaker shared a template with the audience and that starting from our own template is fine. | Craig, Oct 26 |
| Ownership of what we build | Not stated for the Torus bounty. The Nucleus slide says teams keep full ownership, but that slide covers only its own bounty. | s4 |
| Data rules (open data, labeling simulated data) | The research notes refer to a free and open-data rule and to labeling simulated data per the hackathon rules. No slide in hand shows either (UNVERIFIED). Clearlane follows both anyway. | research/notes/torus-intel.md, utah-grid.md |

## 7. To confirm Tuesday morning

Ask the organizers, or the Torus judge for the Torus items:
1. What criteria, and what weights, will Torus use to pick the winner?
2. Where, in what format and by what time do we submit?
3. How long is each presentation, and do we use our own laptop?
4. Must the repo be public at submission?
5. Which judges score the Torus bounty?
6. Can we get the Torus bounty text in writing, so we can quote the two options exactly?

**Answers.** Question 1 is answered by s5: creativity, clarity of insight and execution, with no weights. s5 also gives the two options, so question 6 is answered in part; section 3 keeps them as paraphrases. No answer to questions 2 to 5 is recorded in the repo or on #1, so the section 6 rows stand as "Not stated". Record any answer here with who, when and channel, and update section 6.

The product questions for Torus are in research/TORUS.md, Section 9. Torus answered four of them (questions 2, 3, 8 and 10) by message to Craig Cossairt on Oct 27 2026; the answers are recorded there.

---

## 8. Working rubric and the Clearlane evidence for each item

Torus's stated criteria (s5) are creativity, clarity of insight and execution, with no weights. The rows marked "stated, s5" map them to Clearlane evidence. The other rows are our ASSUMPTION of what else counts, built from the bounty options, s6 and the panel on s2.

"Planned" means the evidence is in the plan of record (docs/plan/synthesis.json) but not yet in the repo. Integration updates the Status column at each train.

| Working criterion | Why we think it counts | Clearlane evidence | Where it lives | Status |
|---|---|---|---|---|
| Answers Option 1 | It is the bounty's first option | Beat 1, the traffic report. On Oct 27, PACE day-ahead prices bottom at $21.38 (hour beginning 3pm MT) and peak at $55.78 (hour beginning 6pm). In October the day's largest upward step landed at 5pm or 6pm on 24 of 27 days. | research/data/pace_snapshot_2026-10-27.csv (REAL); research/analysis/option2/step_hours_output.txt (DERIVED) | Data exists; the app is planned |
| Answers Option 2 | It is the bounty's second option | The closing card: compute follows the sun in time, not in space. In October, moving a 4-hour evening block in time saved 41%, against 8% for moving it across EDAM PacifiCorp and PGE nodes. Any AI campus shown is SIMULATED. | research/analysis/option2/where_vs_when_output.txt (DERIVED) | Data exists; the card is planned |
| Creativity (stated, s5) | A named Torus criterion | The reframe: in Utah the overnight off-peak habit runs backwards, so the station fills in the midday clear lane and stays off the road in the 6pm jam. The judge picks the moment of the crash. The hourly operating envelope is a new signal a grid operator could take. Compute follows the sun in time, not in space. | demo/stage-script.md; contracts/ (`clearlane.envelope/v1`) | In the app |
| Clarity of insight (stated, s5) | A named Torus criterion | One finding: in Utah the off-peak rule runs backwards. A midday timetable is worth $58.41 per MW-day against $20.06 for a fixed overnight schedule (1 MW / 2 MWh, RTE 0.88 ASSUMPTION). That is $4,088 against $1,405 a day at 70 MW, as value to RMP's system at day-ahead prices, not Torus revenue. | research/analysis/demo-story/habit.py (rerun Oct 26 with `python -I research/analysis/demo-story/habit.py research`; output matches) | DERIVED from REAL prices; checked |
| Fit with Torus's hardware and data | Torus sponsors and sets the bar (s6) | Spin holds the RMP reserve (10C, so 0.1 kWh per enrolled kW, DERIVED) and Pulse keeps its schedule (0.5C, 7,500 cycles). The call sampler uses Torus's own 2025 heatmap, read as Mountain time as Torus confirmed (`heatmap_readings` in docs/FACTS.md). The event card shows Torus's 19 s ramp against a 30 s target and 102% delivered. | research/TORUS.md Sections 2-3 (TORUS_PUBLISHED); engine/ | Planned |
| Fit with how Torus sells to utilities | Torus's June 2026 ROWE comments ask for operating envelopes and SCH; Lasso has an API | An hourly operating envelope export (`clearlane.envelope/v1`) with SCH, reserve kW and charge and discharge limits. It is pitched as one more grid signal Lasso could take, not a Lasso replacement. | contracts/; research/TORUS.md Sections 5 and 7 | Planned |
| Execution (stated, s5): a working product, not slides | A named Torus criterion; s6 asks teams to ship in three days | Six live beats in the browser from a frozen snapshot (`DATA_MODE=snapshot`, no network on stage). The judge presses the crash at a moment they pick. Re-plan time is MEASURED live. | app/, engine/, demo/ | Planned |
| Technical depth and correctness | A former CTO is on the panel (s2) | An exact 15-minute DP; a three-policy backtest over every day from May 1 to Oct 27, 2026 on REAL prices; pinned tests that regenerate every on-stage number; `npm run check:all` in CI on every PR | engine/, public/derived/, .github/ | Planned |
| Honesty about data | A mixed panel, plus our own rules | A provenance chip on every number (REAL, DERIVED, SIMULATED, TORUS_PUBLISHED, ASSUMPTION, MEASURED). A "What's real" table. The heatmap in Mountain time, as Torus confirmed. A caveat that CO2 is average emissions. Stations labeled "simulated Torus-style". | public/derived/numbers.json; README.md; docs/plan/synthesis.json (real_vs_simulated_table) | Planned |
| A path to real use | Investors on the panel; Torus's ROWE ask | The ask: feed Lasso a day-ahead envelope at a few Wattsmart sites this winter. Scale runs from today's 70 MW MOU to the 500 MW ceiling, with the caveat that the fleet is assumed not to move prices. | pitch/ | Planned (Torus's interest is an ASSUMPTION) |
| A pitch that lands for non-grid judges | Only one judge is from Torus | The traffic-report picture, which matches the Torus CTO's freeway comparison; a 2:45 demo; rehearsals Tue night | pitch/, demo/ | Planned |
| Team and method (not stated as a Torus criterion) | Judges may ask how one person built it | A solo founder running six agent lanes, each in its own worktree, with every task and PR on public GitHub Issues | .github/, docs/lanes/ | Planned |
