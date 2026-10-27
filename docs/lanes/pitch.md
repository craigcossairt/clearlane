# Pitch lane brief

Precedence: `AGENTS.md` and `contracts/types.ts` win over this file. This file wins over the plan files in `docs/plan/`, which are superseded (see `docs/plan/README.md`): OpenCode is dropped, there is no Nucleus slide, and this is the Torus bounty only.

| | |
|---|---|
| Lane | Pitch |
| Harness | Grok Build |
| Worktree | `C:\Users\Craig Cossairt\Code\clearlane-pitch` (Git Bash: `/c/Users/Craig Cossairt/Code/clearlane-pitch`) |
| Branch prefix | `pitch/` for every new issue. The three open `grok/*` branches (PRs #15, #16, #17) keep their names. |
| Owns | `pitch/**` and nothing else |
| Done when | The deck, both one-pagers, the Q&A cards and the stage script read every number as a `{key}`; the deck and one-pager PDFs build offline; every PR on the repo has a pitch review for its head commit |
| Tracking issue | #5 "Lane: pitch status" |
| Written | Tue Oct 27 2026, about 12:45am MT, by Integration |

This brief is self-contained. If it disagrees with `docs/plan/synthesis.json`, this brief wins. If it disagrees with `docs/FACTS.md` about a number or a wording, FACTS.md wins.

---

## 1. Role and boundaries

You write what the judges read and hear, and you are the claim check on everything else.

**What you build** (all under `pitch/`):

- **The stage script.** Six beats in 2:45, spoken by Craig over the live app.
- **The deck.** Markdown source plus an offline 16:9 PDF. On stage: slide 1, then the live demo, then the close slide. The other slides are Q&A backups.
- **The host one-pager and the RMP one-pager.** Each is one US Letter page, as Markdown source plus a PDF.
- **The judge Q&A cards.**
- **The pitch checker.** `pitch/resolve.mjs` plus shared rules: it resolves `{key}`s and fails on hand-typed numbers, em dashes and guardrail phrases.
- **Research notes for the pitch:** the RMP tariff, System Critical Hours and the heatmap time zone.
- **The judge drill on Tuesday night.**
- **Two stretch-1 items:** `autovideo` and `leave-behind`.

**What you do outside `pitch/`:**

- **Review every PR in the repo,** from every lane, for guardrails, em dashes, hype words and claims that are not in `docs/FACTS.md`. Reviews are PR comments only: never approve, never request changes, never push to another lane's branch.
- **Open an issue for the owning lane** when you need something in its paths, such as a key in `numbers.json`, a `data-beat` attribute in the app, or a FACTS row.

**You are the second model family.** Claude wrote most of the research and `docs/FACTS.md`, so your review is the cross-family check on claims. The most useful thing you can find is a claim that does not hold. Report it with file:line and the evidence. Do not soften it.

**Never:**

- Merge a PR or push to `main`. Integration merges.
- Edit a file outside `pitch/`. That includes `package.json`, `.gitignore` at the root, `docs/`, `contracts/`, `app/` and `public/`.
- Type a result number into copy. Every result is a `{key}`. Section 6 lists the rule and its allowlist.
- Use a Torus logo, frame anything for the Nucleus x Startup State bounty, or state the Torus prize amount.
- Run `npm run format`. It rewrites the whole repo. If you want formatting, run `npx prettier --write pitch/`.
- Run `git add -A` or `git add .`. Stage `pitch/` paths by name.

**Craig decides these** (ask on #5, then carry on with other work):

- His answer to "will you keep building this?"
- Whether to print paper copies.
- The go for a public judge URL (the `public-url` item belongs to Integration).
- Whether to quote any Torus answer on stage.
- Voiceover for the backup video.

---

## 2. Boot sequence

Run this at the start of every session and after every compaction. Use Git Bash, not PowerShell or WSL.

```bash
cd "/c/Users/Craig Cossairt/Code/clearlane-pitch"
git fetch origin --prune
git status --short                       # must be empty before you switch branches
git branch --show-current
date '+%a %b %-d %-I:%M%p MT'            # the machine clock is Mountain time; stamp every comment with this
gh issue list --label lane:pitch --state open --json number,title,milestone,labels \
  --jq '.[] | "#\(.number) [\(.milestone.title // "none")] \(.title) \([.labels[].name]|join(","))"'
gh issue view 5 --comments | tail -60    # your last status, plus any CORE RED / CORE GREEN from Integration
gh pr list --state open --json number,title,headRefName,author \
  --jq '.[] | "#\(.number) \(.headRefName) \(.title)"'
```

If `git status --short` shows work, commit it on its own branch before you do anything else (section 3, step 6). Never stash and never discard drafts.

### Read before the first issue, in this order

1. `AGENTS.md`: lanes, rules, coordination.
2. `docs/FACTS.md`, the whole file. Read the "Hour conventions" and "Do not say" sections twice.
3. `research/TORUS.md`, sections 2, 3.4, 5, 7, 8 and 9.
4. `docs/JUDGING.md`: judges, what is not stated, and the working rubric (an ASSUMPTION).
5. `docs/STRETCH.md`: the tier rules, the flag kinds, and the two pitch rows (`autovideo`, `leave-behind`).
6. `docs/GLOSSARY.md`.
7. `contracts/types.ts`: `StageNumber`, `Envelope`, `PolicyStats`, `TorusPublished`.
8. `docs/plan/synthesis.json`: `final_concept.demo_script`, `pitch_outline` and `anticipated_judge_questions`. Parts of it are superseded:
   - The `grok/pitch` branch name, the old train times and any Nucleus framing.
   - Slide 9 (the Nucleus slide) is dropped.
   - Several numbers in the demo script are wrong. FACTS.md lists each correction.
9. `research/PRIOR-ART.md` sections 6 to 8, and `research/GRID.md` sections 7, 10 and 11, for Q&A depth.

**If a file is not on `origin/main` yet** (at 12:45am Tue, `docs/FACTS.md`, `docs/JUDGING.md`, `docs/STRETCH.md`, `docs/GLOSSARY.md`, this brief and several `research/*.md` were still uncommitted in the main checkout), read it from `../clearlane/` (read-only). Pass `--facts ../clearlane/docs/FACTS.md` to the checker until FACTS.md lands on `origin/main`. Say so in the PR body.

### Claim protocol

Before you start an issue, read its comments.

- **A "claimed by" comment from another session less than 4 hours old means the issue is taken.** Take the next one.
- **Otherwise, claim it.** Write the claim to a body file, because `gh ... --body "..."` lets the shell eat `$` amounts ("$13.27" became ".27" in issue #8):

```bash
B=$(mktemp)
printf 'claimed by Grok Build, %s\n' "$(date '+%a %b %-d %-I:%M%p MT')" > "$B"
gh issue comment <n> --body-file "$B"
```

**Every issue comment, PR body and review uses `--body-file`,** written with a quoted heredoc (`cat > "$B" <<'EOF'`). No exceptions.

---

## 3. Per-issue loop

1. **Claim** (section 2).
2. **Branch** from fresh `origin/main`:
   ```bash
   git fetch origin
   git switch -c pitch/<issue#>-<slug> origin/main
   ```
   - **Exception: stacking.** Until PR #17 merges, `pitch/resolve.mjs`, `pitch/keys.json` and the drafts exist only on `grok/9-deck`. An issue that edits them branches from `origin/grok/9-deck` instead. Write "Stacked on #17" at the top of the PR body, and rebase onto `origin/main` once #17 merges.
   - **Work on PRs #15, #16 and #17** goes on their existing branches: `git switch grok/pitch`, `git switch grok/8-tariff-research` or `git switch grok/9-deck`.
3. **Test first.**
   - Write the failing `node:test` case in `pitch/test/<area>.test.mjs` and run it, so you see it fail for the reason you expect.
   - For copy, the test is the checker plus the issue's own assertions, such as word budgets, page counts and required caveat lines.
   - Fixtures go in `pitch/test/fixtures/`.
4. **Write the change.** Every result is a `{key}`.
5. **Run the check.** Quote the tail of its output in the PR.
   ```bash
   npm run check:all && node --test "pitch/test/*.test.mjs" && node pitch/resolve.mjs
   ```
   - **After Engine lands `public/derived/numbers.json` on `main`,** add `--strict` to the resolver call.
   - **Once Integration adds `check:pitch` to `check:all`,** `npm run check:all` alone covers it.
   - **CI runs only `check:all` today,** so the pitch tests run only where you run them. Say in the PR that you ran them.
   - **Until `pitch/test/` exists** (before the checker issue lands), drop the `node --test` part.
6. **Commit** only your paths:
   ```bash
   git add pitch/<file> pitch/<file>
   git commit -m "<plain sentence: what changed and why>"
   ```
7. **Push:**
   ```bash
   git push -u origin pitch/<issue#>-<slug>
   ```
8. **Open the PR** with a body file:
   ```bash
   B=$(mktemp); cat > "$B" <<'EOF'
   Closes #<n>

   ## What changed
   <two to four plain sentences>

   ## Evidence
   <the check command and the tail of its output; PDF page counts; word counts>

   ## New numbers and their provenance
   <each new {key}: FACTS row, class, status, source "numbers" or "facts"; or "None">

   ## Guardrail self-check
   - [ ] No em or en dashes; American English; no hype words
   - [ ] No "Torus lacks/can't"; "not advertised" where it applies
   - [ ] Stations "simulated Torus-style"; no Torus logo
   - [ ] Overnight rule is our baseline, never Torus practice
   - [ ] Value "to RMP's system at day-ahead prices", not Torus revenue or host savings
   - [ ] CO2 "estimated, using average emissions"; PacifiCorp East (Utah, Wyoming, Idaho)
   - [ ] Heatmap shown under both readings; 500 MW is an MOU ceiling
   - [ ] No Nucleus framing; no prize amount; no quote of 15+ words; every quote has its URL

   ## Needs from other lanes
   <issue links, or "None">
   EOF
   gh pr create --base main --head pitch/<issue#>-<slug> --title "<plain sentence>" --body-file "$B"
   gh pr edit <pr#> --add-label status:needs-review
   ```
9. **Comment on the issue:** "PR #<pr> open: <one line>", using `--body-file`.
10. **Never merge.** Address review comments on the same branch. Each push re-runs CI.
11. **At every train** (section 9), rebase each open branch:
    ```bash
    git switch <branch> && git fetch origin && git rebase origin/main
    <run the check command>
    git push --force-with-lease
    ```
    - A conflict in `pitch/` is yours to fix.
    - A conflict anywhere else means your branch touched another lane's path. Drop that change.

---

## 4. Core queue, with acceptance criteria

Work top to bottom. Find the issue numbers with `gh issue list --label lane:pitch`. Seven issues already exist, and Integration retitles them to the titles below:

| Order | Old issue | New title |
|---|---|---|
| 1 | #7 | Close out the contract review |
| 2 | #8 | Tariff research |
| 6 | #9 | Deck |
| 9 | #10 | Reviews |
| 11 | #11 | Judge drill |
| S1 | #12 | autovideo |
| S2 | #13 | leave-behind |

Trains are Mountain time.

| # | Title | Train | Depends on |
|---|---|---|---|
| 1 | [pitch] Close out the contract review and withdraw the CO2 hour finding (PR #15) | Train 1, Tue 1:45am | none |
| 2 | [pitch] Correct and land the tariff, SCH and heatmap research (PR #16) | Train 2, Tue 8:00am | none |
| 3 | [pitch] Pitch checker: key resolver and guardrail lint with mutation-checked tests | Train 2 | PR #17 (stack on it) |
| 4 | [pitch] Key catalog mapped to FACTS rows, plus the numbers.json key request to Engine | Train 2 | 3 |
| 5 | [pitch] Stage script for the six beats at 2:45, every number a key | Train 3, Tue 10:45am | 3, 4 |
| 6 | [pitch] Deck source and offline 16:9 PDF, no Nucleus slide | Train 3 (source), Train 4 (PDF) | 3, 4 |
| 7 | [pitch] Host and RMP one-pagers, one US Letter page each | Train 4, Tue 2:00pm | 2, 3, 4, 6 (build script) |
| 8 | [pitch] Judge Q&A cards by judge, every answer keyed and cited | Train 4 | 3, 4 |
| 9 | [pitch] Guardrail and claim review of every PR at each train | every train to Freeze | 3 |
| 10 | [pitch] Oct 28 refresh pass: re-resolve and re-export all copy | Train 6, Tue 11:30pm | 5 to 8 |
| 11 | [pitch] Tuesday-night judge drill and rehearsal sheet | Train 6 | 5, 8 |
| 12 | [pitch] Submission write-up and README judge section (draft for Integration) | Train 8, Wed noon | 6, 8 |

**First, get PR #17 merge-ready.** It holds first drafts of the deck, both one-pagers, the Q&A, the stage script, `keys.json` and `resolve.mjs`, and CI is green. Change its body from "Closes #9" to "Refs" the deck, stage script, one-pager and Q&A issues, because each of those closes with its own PR. Then apply the draft fixes listed under items 5 to 8 that are cheap. Integration merges #17 at Train 2, then #15 and #16; branches stacked on #17 retarget to `origin/main` after that.

### 1. Close out the contract review (PR #15, branch `grok/pitch`)

Finding 1 in `pitch/review-log.md` is wrong, and the fix it asks for would break correct data.

- **Hour beginning h is clock hour h:00 to h+1:00, which is EIA hour ending h+1.** FACTS.md "Hour conventions" says the same: "Hour beginning h uses HE h+1."
- **So `CO2_HOUR_ENDING[h + 1]` in `tools/make_fixture.py:61` is correct.** Fixture hour 0 (midnight to 1am) = HE1 = 697, and hour 13 (1pm to 2pm) = HE14 = 450.
- **The proposed re-pin is wrong.** The CO2 values -0.395 and +0.130 t/MW-day would be the wrong numbers.

Acceptance:

- [ ] Finding 1 moves to a "Withdrawn" heading that names the error and gives the worked example above.
- [ ] Findings 2 and 3 stay, and so do notes 4 to 7:
  - 2: fixture hour 0 is borrowed from the next midnight but labeled REAL.
  - 3: `pulse_life_yr` names the Station lifespan.
- [ ] Note 8 says this brief now exists.
- [ ] The date line reads Tue Oct 27 (the file and the #5 status comment say Mon Oct 26 by mistake).
- [ ] A PR comment, posted with `--body-file`, tells Integration that finding 1 is withdrawn.
- [ ] Push before Train 1.

### 2. Correct and land the tariff research (PR #16, branch `grok/8-tariff-research`)

Integration cross-checked Schedules 6, 6A and 8 against the posted sheets on Oct 27 (Lvl 2). Every rate in `pitch/research-tariff.md` matches. Three corrections remain:

- [ ] **Schedule 8, time periods.**
  - Integration read Schedule 8's time-periods sheet (8.3) as Docket 24-035-04, effective Apr 25 2025, not 26-035-T08.
  - Re-open the Schedule 8 PDF and fix the docket line for that sheet if it holds. If you read it differently, say what you saw and where.
- [ ] **"Schedule 8's summer on-peak starts at 3pm, which includes the clear-lane hours the timetable charges in"** overstates it.
  - The Oct 27 timetable charges HB 1pm to 3pm (FACTS `midday_avg`), so the summer window overlaps only the 3pm hour.
  - Say that, and say the summer lanes are a different day's plan.
- [ ] **Fix the date stamps.** "Checked Mon Oct 26, about 12:30am" and "Downloaded Oct 26" should say Tue Oct 27 unless the download really was Monday.
- [ ] **Keep the host copy in kW,** with no host dollar figure. `rmp_ci_tariff` in FACTS.md stays UNCHECKED until Integration upgrades it, so no tariff dollar value goes in judge-facing copy.
- [ ] **Keep both SCH quotes under 15 words,** each with the ROWE URL.
- [ ] **The heatmap section still says "not verified, show both readings."**
- [ ] **Post a short summary comment on #8** (`--body-file`, so the `$` signs survive). The earlier comment lost them.

### 3. Pitch checker (`pitch/resolve.mjs`, `pitch/lib/rules.mjs`, `pitch/test/`)

One rule module shared by the copy resolver and the PR scanner (item 9). Exit codes:

- 0: clean
- 1: findings
- 2: could not run (missing `keys.json`, unreadable FACTS.md, bad JSON)

Never let exit 2 read as clean.

Acceptance:

- [ ] **Inputs.** Every `pitch/**/*.md` and `pitch/**/*.html`. It skips:
  - `pitch/research-*.md` and `pitch/review-log.md`. These are working notes that cite rates with their sources, not stage copy.
  - `pitch/test/fixtures/**`.
- [ ] **Unknown key.** A `{key}` missing from `pitch/keys.json` fails.
- [ ] **Source "numbers."** A key with `source: "numbers"` reads `display` from `public/derived/numbers.json`.
  - With `--strict`, a key missing from that file fails.
  - Without it, the placeholder display is allowed, and the run says how many keys are unresolved.
- [ ] **Source "facts."** A key with `source: "facts"` names a FACTS row in `fact`.
  - The row must be VERIFIED, or CONFLICT with the display text taken from its "Say" wording.
  - Its `display` must appear verbatim in that row's Claim or Value cell, or in the matching "Say instead" cell of "Do not say".
  - UNCHECKED and PENDING-ENGINE rows fail.
- [ ] **One source per key.** A key that is in `numbers.json` and also marked `source: "facts"` fails.
- [ ] **MEASURED keys** (`solve_ms`, `replan_ms`) never resolve from a file. They render as `[read from screen]`.
- [ ] **`{operating_day}`** resolves to the shared `as_of_mt` of the numbers the copy uses, and fails if those keys disagree.
- [ ] **Hand-typed results fail:**
  - `$` amounts
  - percentages
  - a number followed by MW, kW, kWh, MWh, g/kWh, t, ms, s, min, C or x
  - bare numbers of three or more digits
- [ ] **The allowlist is a list of regexes, each with a one-line reason in the code:**
  - years 2020 to 2030
  - dates (Oct 27, May 1)
  - clock times (6pm, 9:16pm, 1:45am)
  - beat timings (0:25)
  - Schedule 6, 6A and 8
  - IEEE 2030.5
  - `clearlane.envelope/v1`
  - URLs
  - docket numbers
  - slide headings (`## 4.`)
  - 1920x1080
  - Option 1 and Option 2
  - Train numbers
- [ ] **Em dash (U+2014) and en dash (U+2013) fail.**
- [ ] **Banned phrases fail** (case-insensitive). The list is in section 7.
- [ ] **Hype words fail.** The list is in section 7.
- [ ] **Each finding prints `file:line: rule: text`.**
- [ ] **`--render <dir>`** writes resolved copies for the PDF build.
- [ ] **`--facts <path>`** overrides the FACTS.md location.
- [ ] **Tests** in `pitch/test/rules.test.mjs`: one failing and one passing fixture per rule, plus "the current pitch copy exits 0".
- [ ] **Mutation check.**
  1. Before you run it, write down which test each mutation should fail.
  2. Break each rule in turn (comment out the rule, or widen its allowlist).
  3. Confirm exactly that test fails, then restore the rule.
  4. Put the ledger (rule, mutation, predicted failures, observed failures) in the PR body.

Verify:

```bash
node --test "pitch/test/*.test.mjs"
node pitch/resolve.mjs
echo "exit $?"
```

### 4. Key catalog and the Engine key request (`pitch/keys.json`)

FACTS.md says a key the engine writes keeps its FACTS name in `numbers.json`. The PR #17 catalog invented other names, which `numbers.json` will never contain. Examples:

- `events_2025` for `rmp_events_2025`
- `mou_mw` for `mou_70mw`
- `mou_ceiling_mw` for `torus_500mw`
- `station_life_yr` for `torus_lifespan_yr`
- `fossil_priciest_pct` for one half of `fossil_priciest_oct`

Acceptance:

- [ ] **Every catalog entry** has these fields:
  - `fact`: the FACTS row
  - `source`: `"numbers"` or `"facts"`
  - `unit`
  - `prov`: the FACTS class
  - `display`: for a "facts" key, the exact wording; for a "numbers" key, a placeholder
  - `note`: when the wording differs from the raw value, for example "show 3,655"
- [ ] **Single-value rows use the FACTS key name.**
- [ ] **Multi-value rows use split keys named `<fact>_<part>`,** listed in the Engine request below. These rows include:
  - `fossil_priciest_oct`
  - `time_vs_space_oct`
  - `oct_step_hour_days`
  - `calls_unanswerable_price_only`
  - `mou_share_of_peak`
  - `calls_answered_pct` under each heatmap reading
- [ ] **CONFLICT rows** use the say-instead value as their own key:
  - `fixed_rule_charge_usd_mwh` ($39.53, from `overnight_avg`)
  - `timetable_charge_usd_mwh` ($21.55, from `midday_avg`)
  - `calls_missed_range_pct` ("43% to 77%")
  - `crash_call_minutes` ("about five and a half minutes")
  - `pulse_share_per_call` ("about 5%")
  - `net_load_climb_mw` ("3,655" or "about 3,650")
- [ ] **`overnight_avg` and `midday_avg` stay only as window averages,** labeled "1am to 6am average" and "9am to 5pm average". Never as what a schedule paid.
- [ ] **`keys.test.mjs`** checks four things:
  - every `fact` exists in FACTS.md
  - no row is UNCHECKED or PENDING-ENGINE unless `source` is "numbers"
  - MEASURED keys are flagged
  - no two entries share a display without saying why
- [ ] **Open one issue for Engine** (labels `lane:engine` and `tier:core`): "[engine] numbers.json keys the pitch reads". It lists every `source: "numbers"` key with its FACTS row and unit. It also asks for:
  - the split keys
  - `peak_hour_mt` and `trough_hour_mt`
  - both heatmap readings as separate keys, plus the shift in hours (6 for MDT, 7 for MST)
  - the TORUS_PUBLISHED values the app shows
- [ ] **Link that issue from the PR.**

### 5. Stage script (`pitch/stage-script.md`)

Six beats in 2:45. Craig speaks and the app shows. Timings come from the plan:

| Beat | Time | What happens |
|---|---|---|
| 1, traffic report | 0:00 to 0:25 | |
| 2, the race | 0:25 to 0:55 | Space |
| 3, the crash | 0:55 to 1:40 | C |
| 4, re-plan | 1:40 to 2:00 | |
| 5, envelope and proof | 2:00 to 2:25 | E |
| 6, scale and close | 2:25 to 2:45 | |

Speech budget: 2.5 words a second (150 a minute, an ASSUMPTION until Craig times a read). Count each `{key}` as 3 words.

| Beat | Seconds | Max words |
|---|---|---|
| 1 | 25 | 62 |
| 2 | 30 | 75 |
| 3 | 45 | 112 |
| 4 | 20 | 50 |
| 5 | 25 | 62 |
| 6 | 20 | 50 |
| Total | 165 | 400 |

The plan's own script ran 406 words, with beat 1 at 74 and beat 6 at 56, so cut there first.

Acceptance:

- [ ] **`script.test.mjs`** checks four things:
  - six beat headings in order, with these timings
  - the per-beat and total word budgets
  - MEASURED keys stay `[read from screen]`
  - the required lines below are present
- [ ] **Required lines:**
  - "simulated Torus-style" in beat 2
  - "value to RMP's system at day-ahead prices" in beat 2
  - "estimated, using average emissions" wherever CO2 is said
  - a crash call of "about five and a half minutes"
  - our trace is simulated and the event card is Torus's 2025 report, said apart
  - the SCH rule is "our proposal"
  - both heatmap readings on the backtest card
  - "an MOU for up to" 500 MW, "not installed capacity", and "the fleet is assumed not to move prices" in beat 6
- [ ] **The day is "the day on screen,"** not "today". If the Oct 28 refresh misses, the stage shows Oct 27 on Wednesday.
- [ ] **The overnight rule is "a battery on a fixed off-peak rule. That rule is ours, not Torus practice."** Its charge price is `{fixed_rule_charge_usd_mwh}`. Clearlane's is `{timetable_charge_usd_mwh}`. Never pair `{overnight_avg}` or `{midday_avg}` with a schedule.
- [ ] **Beat 5 says "we found no Utah or Wyoming docket that defines it,"** not "no Utah docket has". PR #16 searched; it did not prove a negative.
- [ ] **Close:** "Fill up when the road is clear, keep Spin ready for the crash." The ask is a day-ahead envelope into Lasso at a few Wattsmart sites this winter. Torus's interest in that is an ASSUMPTION, so it is said as an ask, never as an agreement.
- [ ] **Option 2 is one line** in beat 6 or on the close slide: compute follows the sun in time, not in space (`time_vs_space_oct` split keys; say "about 40 percent").
- [ ] **A "Craig's cues" column** says which key to press and what the screen shows at each line.

### 6. Deck and offline PDF (`pitch/deck.md`, `pitch/build.mjs`, `pitch/.gitignore`)

Slides follow `pitch_outline` in synthesis minus slide 9 (Nucleus). Headroom (`headroom_05_mw`, VERIFIED) is Q&A only. SB 132 is out until its FACTS row (`sb132_contract`) is checked.

Acceptance:

- [ ] **Slides:** title (slide 1), the live demo, and the close (last). Everything between is a Q&A backup, and slide 1's notes say so. Every slide footer shows `{operating_day}` and the provenance class of each number on it.
- [ ] **The heatmap is our own redraw** from `public/data/torus_published.json` under both readings, labeled "Torus 2025 event data, time zone not stated". Never Torus's image.
- [ ] **The Spin and Pulse line on slide 4,** "Spin absorbs spikes so Pulse can discharge steadily", has no FACTS row. Cut it, or ask Integration for a row with its URL (TORUS.md section 2.3).
- [ ] **`pitch/build.mjs` renders and checks offline:**
  1. It runs `resolve.mjs --render pitch/out/src`.
  2. It turns the Markdown subset into self-contained HTML in `pitch/out/`: headings, paragraphs, lists, tables, bold, code spans and links. It uses system fonts and no external `src` or `href` for assets.
  3. It prints each page with Edge headless.
  4. It checks page counts: the deck has one page per `## N.` slide, and each one-pager has 1.
- [ ] **No npm dependency.** `package.json` belongs to Integration.
- [ ] **The Edge command,** proven on this PC on Oct 27 (Lvl 4: two pages at 960 x 540 pt, which is 13.333 x 7.5 in):
  ```bash
  "/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" --headless=new --disable-gpu --no-first-run \
    --user-data-dir="<abs temp dir>" --no-pdf-header-footer --print-to-pdf="<abs path>.pdf" "file:///<abs path>.html"
  ```
  - Without `--user-data-dir` it wrote no PDF while the desktop Edge was open.
  - Use `@page { size: 13.333in 7.5in; margin: 0 }` for the deck and `size: Letter` for the one-pagers.
  - Read the Edge path from env `MSEDGE`, falling back to the path above.
  - The demo laptop's Edge path is UNVERIFIED.
  - If Edge fails, the fallback is Ctrl+P from the HTML.
- [ ] **`pitch/.gitignore` holds `out/`.** Final PDFs are never committed (the 500 KB rule). Integration attaches them as GitHub release assets on the submission tag; git keeps the source and a link.
- [ ] **`deck.test.mjs`:**
  - no "Nucleus" or "Startup State"
  - slide count matches the outline minus slide 9
  - no external asset URLs in the built HTML
  - page counts. When Edge is missing, it reports SKIP, never PASS.

Verify:

```bash
node pitch/build.mjs && ls -la pitch/out/*.pdf
```

### 7. One-pagers (`pitch/one-pager-host.md`, `pitch/one-pager-rmp.md`)

Acceptance:

- [ ] **The host page has no `$` at all after resolution.**
  - The host value is "the meter does not set a new 15-minute peak," in kW.
  - Schedule 6, 6A and 8 facts appear as cited context only: the 15-minute interval and the on-peak windows, with the sheet URLs from PR #16, never a bill saving.
- [ ] **The RMP page frames every dollar** as "value to RMP's system at day-ahead prices, not Torus revenue, not a host bill cut." It shows the envelope fields from `contracts/types.ts` (`EnvelopeHour`) in plain words, and marks SCH "our proposal".
- [ ] **Both pages** say "simulated Torus-style" and carry the operating day. Each prints to exactly 1 Letter page (`build.mjs` checks it).
- [ ] **`onepager.test.mjs`** checks two things:
  - no `$` in the resolved host page
  - the framing line is present on the RMP page

### 8. Judge Q&A cards (`pitch/qa.md`)

Acceptance:

- [ ] **Cards are grouped by judge voice.** Each card carries the judge's name and affiliation as `docs/JUDGING.md` lists them:
  - Ryan Byrd (former CTO): depth and correctness
  - Angela Smith (COO, Nucleus Fund): path to reality. Never Nucleus bounty framing.
  - Nicole Witmyer (Torus): fit with Torus and Lasso
  - Scott Holley (Lassonde Center): Utah impact and students
  - Tanner Potter (Kickstart): market and ask
- [ ] **Cover all 16 `anticipated_judge_questions`** from synthesis, with the FACTS corrections applied, plus at least 6 new ones. Include:
  - "Isn't this just arbitrage?"
  - "What happens if a second call comes during refill?" (`second_call_shortfall_kw`)
  - "Why trust the heatmap?" Answer with both readings and the 43% to 77% range.
  - "Is this Torus revenue?"
  - "How do you know Lasso doesn't do this?" Answer "not advertised", citing TORUS.md section 7.
  - "What did Torus tell you?" Only what Craig cleared.
- [ ] **Each answer is at most 2 sentences,** with every number a `{key}` and a source line (a FACTS row, or a URL with a quote under 15 words).
- [ ] **`qa.test.mjs`** checks four things:
  - every card has a judge tag from the five names
  - the answer is 2 sentences or fewer
  - there is at least one key or source line
  - no card mentions the prize amount
- [ ] **A "Torus answers" section** stays empty until Craig posts Torus's replies to the 10 questions in TORUS.md section 9 (he sends them about 9:00am Tue). Fold the replies in within 30 minutes of seeing them, and quote them only if Craig says so.

### 9. Guardrail and claim review of every PR at each train

Standing work at every train through Freeze, including every stretch PR.

Acceptance:

- [ ] **`pitch/review/scan.mjs <diff file>`** applies `pitch/lib/rules.mjs` to the added lines of a diff and prints `file:line: rule: text`.
  - **Rules per path:**
    - Judge-facing paths get every rule: `app/src/**` text, `README.md`, the `display` fields in `public/derived/numbers.json`, `science/**/*.md`, `demo/**`, `pitch/**`.
    - `docs/FACTS.md` and `docs/lanes/**` get the em dash rule only, because they quote banned phrases on purpose.
  - **A `$` or `%` literal in `app/src` text is a "check" finding:** is it read from `numbers.json`?
- [ ] **Review routine for each open PR:**
  ```bash
  gh pr diff <n> > "$(mktemp)"
  node pitch/review/scan.mjs <file>
  ```
  Then read the diff yourself for claims: any number or factual sentence not in FACTS.md is a finding, even when the scanner is clean.
- [ ] **Post one comment per head commit with `--body-file`.** The first line is the marker `pitch-review: <sha7> CLEAN` or `pitch-review: <sha7> FINDINGS <n>`. Each finding gives file:line, the rule, and a "Say instead". Check for an existing marker on the same sha before you post.
- [ ] **Comments only.** No approve, no request-changes, no pushes.
- [ ] **Priority:** PRs that touch `app/`, `README.md`, the `numbers.json` display strings, `science/`, `demo/` or `docs/FACTS.md` first, then the rest.
- [ ] **The status comment on #5 at each train** lists every PR reviewed and its marker.

### 10. Oct 28 refresh pass

When the Oct 28 bundle lands, the date on screen changes. Integration's hard stop for that bundle is 10:30pm. Prices were available by 9:16pm the night before for Oct 27, so expect them around then.

Acceptance:

- [ ] **Within 30 minutes of Engine's regenerated `numbers.json` merging:**
  1. Rebase.
  2. Run `node pitch/resolve.mjs --strict`.
  3. Re-run `node pitch/build.mjs`.
  4. Read the diff of every resolved file.
- [ ] **Re-read every sentence that depends on the day.** Lane hours, the peak hour and the "5pm or 6pm" line may no longer fit the new day. Rewrite those sentences, not the numbers.
- [ ] **If the refresh misses the hard stop,** the copy stays on Oct 27, and every page and the script say "Oct 27" through `{operating_day}`.
- [ ] **Post the outcome on #5:** "refreshed to Oct 28" or "staying on Oct 27", with the resolver output.

### 11. Tuesday-night judge drill (`pitch/drill.md`)

Craig is away 6:00pm to 11:00pm and rehearses live from about 11:30pm to 1:30am.

Acceptance:

- [ ] **By 11:00pm:**
  - a written grade of the stage script and the Q&A cards, played as each of the five judges
  - the weakest 5 answers rewritten
  - every claim in them re-checked against FACTS.md
- [ ] **`pitch/drill.md`, the rehearsal sheet:**
  - 20 questions ordered by judge, each with its 2-sentence answer and the trap word to avoid ("revenue", "lacks", "six-minute", "record peak", "Utah regulators")
  - a stopwatch table per beat for Craig to fill in
- [ ] **After rehearsal,** fold in the beat times Craig posts. Cut words in any beat that ran over.

### 12. Submission write-up and README judge section (draft)

Submission method and format are not stated (`docs/JUDGING.md` section 6), so this is a draft for Integration, which owns `README.md` and submits.

Acceptance:

- [ ] **`pitch/submission.md`:**
  - a 150-word summary
  - how to run the six beats offline from tag `v1-stage`
  - the "What's real" table (REAL, DERIVED, SIMULATED, TORUS_PUBLISHED, ASSUMPTION, MEASURED)
  - a one-paragraph method note (one founder, six agent lanes, every task on GitHub Issues)
  - links to the deck PDF
- [ ] **`pitch/readme-judges.md`:** the README section text for Integration to paste.
- [ ] **Timing:** both drafts above are delivered at Train 7 as input. Integration alone writes `README.md` and the final submission text at Train 8.
- [ ] **Final PDFs** `clearlane-deck.pdf`, `one-pager-host.pdf` and `one-pager-rmp.pdf`, re-exported after the last copy fix, in `pitch/out/` (not committed). Integration attaches them as release assets on the submission tag and needs them by Wed 3:30pm.
- [ ] **Checker clean in `--strict` mode.**

---

## 5. Stretch queue

Start stretch only when both hold:

- Your core issues are merged.
- Integration has posted **CORE GREEN** on #5.

**CORE RED** on #5 stops stretch commits at once. Open stretch PRs stay open, and you switch to core fixes or reviews. Pitch capacity is 2 stretch-1, 0 stretch-2 and 0 moonshot. When your queue is empty, review PRs and support rehearsal. Never take work in another lane's paths.

Both pitch items are `off_*` switches: nothing in the six beats imports them, so they need no `contracts/flags.ts` entry. Hard deadline: **Train 5, Tue 5:30pm**, merged. Re-run both after the Oct 28 refresh.

### S1. `autovideo` (stretch-1, flag `off_record_video`, about 1 hour)

Issue: "[pitch] autovideo: scripted backup video of the six beats with captions" (was #12).

**Done when** (from `docs/STRETCH.md`):

- One command builds the stage app and drives the six beats at 1920x1080 on the script timings with Playwright.
- It writes a video 2:40 to 2:50 long, plus a WebVTT caption file whose lines come from the stage script with every `{key}` resolved from `numbers.json`. An unresolved key fails the run.
- Every frame shows the operating day.
- After the Oct 28 regeneration, a re-run finishes in under 10 minutes.
- Output goes to the gitignored `pitch/out/video/`. Craig copies it to the laptop and a USB stick by Wed 3:30pm.
- A manual screen capture stays the fallback.

Plan:

- **Run order:** `pitch/video/record.mjs` runs `npm run build`, then `npx vite preview --port 4173 --strictPort` with `DATA_MODE=snapshot`, then drives the beats with keyboard presses.
- **Browser.** Playwright launches with `channel: "msedge"`, so no browser download is needed.
- **Duration check:** ffmpeg converts the WebM to MP4, and `ffprobe -v error -show_entries format=duration -of csv=p=0 <file>` checks the length.
- **Needs from Integration:** Playwright as a dev dependency.
- **Needs from UI:** a `data-beat` attribute that names the current beat, and a stable selector for the operating-day label. Open an issue for each.
- **Unverified:** ffmpeg is on this PC, but its presence on the demo laptop is UNVERIFIED, and so is Playwright video quality on Windows. Narration needs Craig's voice or a live voiceover.

### S2. `leave-behind` (stretch-1, flag `off_leave_behind`, about 1.5 hours)

Issue: "[pitch] leave-behind: judge page, envelope packet and sample envelope" (was #13).

**Done when** (from `docs/STRETCH.md`):

- **`pitch/leave-behind.html`** prints to one US Letter page with:
  - the ribbon
  - the race result
  - the crash summary
  - an envelope excerpt
  - the what-is-real table
  - the questions we asked Torus
  - a QR code to the judge URL
- **`pitch/envelope-packet.md`** is two pages, with its PDF at Train 8. It:
  - defines every `clearlane.envelope/v1` field in one line with its unit
  - marks the SCH rule "our proposal"
  - says "a working example, not a filing"
  - quotes the ROWE asks under 15 words each, with the URL https://rowesternenergy.org/wp-content/uploads/2026/06/Consolidated-Spring-Workshop-Comments_06222026.pdf
  - adds the SCH evidence table if `sch-rule-study` merged, and the 2030.5 mapping appendix if `export-2030-5` merged
- **`pitch/torus-kit/`** holds a sample envelope copied from `public/derived` and one paragraph on how Lasso could take it as one more grid signal, not a Lasso replacement.
- **The checker** resolves every `{key}` and fails on an unknown key or a hand-typed number. The em dash and banned-word check passes.
- **Both PDFs** regenerate after the Oct 28 numbers land.

Plan:

- **QR code:** include it only if Integration's `public-url` item merged with Craig's go and a QR encoder dev dependency exists. Otherwise leave the QR and the URL off entirely.
- **Torus questions:** list only the ones Craig confirms he sent.
- **No implied endorsement.** Never imply Torus endorsed the kit, or that we have a regulatory role.
- **Printing** is Craig's call.

---

## 6. Domain notes

### The story

- **The bounty.** Torus's bounty has two options. Option 1, "rush hour for electrons", is our spine. Option 2, "compute follows the sun", is one closing card. The bounty wording is paraphrased in `docs/JUDGING.md` and is UNVERIFIED, so never quote it as Torus's text.
- **The insight:** in Utah the off-peak habit runs backwards. On PacifiCorp East the cheapest and cleanest hours are midday, and the jam is at 6pm.
- **Clearlane's answer:**
  - It fills Pulse in the midday clear lane.
  - It stays off the road in the evening jam.
  - It keeps Spin ready for Rocky Mountain Power's calls.
  - It exports an hourly operating envelope with System Critical Hours.

### Numbers that bite

Each row is a CONFLICT or a "Do not say" entry in FACTS.md.

| Do not say | Say | FACTS row |
|---|---|---|
| The off-peak rule charges at $38.71 | $39.53 (the rule charges HB 1am to 4am) | `overnight_avg` |
| Clearlane charges at $22.83 | $21.55 (the timetable charges HB 1pm to 3pm) | `midday_avg` |
| A six-minute call | A call of about five and a half minutes | `crash_call_minutes` |
| A call uses 4.6% of a Pulse | About 5% of a Pulse | `pulse_share_per_call` |
| Price-only misses 14% to 77% of calls | 43% to 77%, depending on how the hours are read | `calls_missed_range_pct` |
| 27 of 30 July days | 28 of 30 | `jul_step_hour_spread` |
| Net load climbs 3,654.5 MW | 3,655 MW, or about 3,650 | `net_load_climb_mw` |
| More than 360 events | 359, the case-study figure | `rmp_events_2025` |
| Pulse has a 25-year life | Station lifespan 25 years | `torus_lifespan_yr` |
| Torus asked Utah regulators | Torus's June 2026 comments to ROWE | `rowe_audience` |
| Prices post at 9:16pm | Available by 9:16pm the night before | `oct27_prices_available_mt` |
| Utah's grid (for CO2 or fuel mix) | PacifiCorp East (Utah, Wyoming, Idaho) | Do not say |
| Record peak (10,173 MW) | Highest hour in 16 months of EIA data | `pace_peak_16mo_mw` |
| Most calls come in the evening | Show the heatmap under both readings | `rmp_event_timing_2024` |
| Any annualized value | Daily values, and the backtest P10 to P90 once it exists | Do not say |
| 500 MW installed, or linking it to the 500 MW seasonal headroom | An MOU for up to 500 MW | `torus_500mw`, `headroom_seasonal_05_mw` |
| Torus's uptime as a single settled figure | 99.9% from the wrap-up summary, with the row's CONFLICT note in mind | `torus_uptime_2025` |
| Any factory size | Leave it out | `torus_facility_sqft` |

The 18 PENDING-ENGINE keys (backtest, crash, envelope and timing) have no value until Engine writes them. Never type one.

### Hours and time zones

- **MT is MDT (UTC-6) until Nov 1 2026.** The whole backtest window is UTC-6.
- **"HB 6pm"** means 6:00 to 7:00pm MT.
- **EIA files are hour ending,** so hour beginning h uses HE h+1.
- **The research snapshot** is CAISO's Oct 27 trade day, which starts at 07:00Z. A Mountain day starts at 06:00Z, so fixture hour 0 is borrowed from the next midnight. Never quote an hour 0 price from the fixture.
- **Torus's 2025 heatmap** labels 12am to 11pm and states no time zone. Every result built on it is shown twice: read as Mountain, and read as UTC. Name the shift: 6 hours under MDT, 7 under MST.

### Torus

- **Published specs.** Everything Torus publishes is class TORUS_PUBLISHED and has a FACTS row: Spin, Pulse, the Station, Lasso, the RMP case study, the 70 MW MOU, the 500 MW MOU ceiling, ramp 19 s against a 30 s target, and 102% delivered.
- **What is not advertised.** `research/TORUS.md` section 7 lists what Torus does not advertise. Use "not advertised", never "lacks".
- **Lasso's published inputs** are load, weather, grid signals and rate schedules. The overnight rule is our comparison baseline, not what Lasso does.
- **ROWE.** In its June 2026 comments to ROWE, Torus asks for dispatchability standards that recognize scheduled and utility-directed operating envelopes (TORUS.md section 5, with the URL). It says it does not advocate a specific SCH definition. Our SCH rule is "our proposal".
- **Pages offline.** Torus's data-center pages are offline as of Oct 26 2026. The reason is unknown, so never guess at it.
- **The freeway comparison.** The Torus CTO's freeway comparison (`cto_freeway`, 8 words, with its URL in FACTS) matches our traffic picture. Quote it only with the URL.

### Judges and rules

- **The panel.**
  - Five judges. Nicole Witmyer is the only Torus person shown.
  - Which judges score the Torus bounty is not stated.
  - Torus's criteria are not stated. The rubric in `docs/JUDGING.md` section 8 is our ASSUMPTION, and "clarity of insight" as a criterion is UNVERIFIED.
- **Not stated:** pitch length (we rehearse 2:45), submission method and the submission deadline.
- **Our own plan:** code freeze Wed 2:00pm, tag `v1-stage`, submission by 5:00pm, judging 5:00 to 6:00pm.
- **Prize amount.** It is UNVERIFIED. Never state it.

### Value and CO2

- **Every dollar** is value to RMP's system at PACE day-ahead prices, for a reference station of 1 MW / 2 MWh with RTE 0.88 (an ASSUMPTION). Never Torus revenue, host savings or a bill cut.
- **CO2** is an estimate using EIA average emissions on an October profile. Never marginal, and never measured.

### Craig's day

All times are MT.

| Time | What |
|---|---|
| Tue 9:00am | Craig sends the Torus questions |
| Tue 11:00am to 1:30pm | Away |
| Tue 6:00pm to 11:00pm | Away |
| About 11:30pm | Rehearsal starts |
| About 2:00am to 7:00am | Asleep |

- **While Craig is away,** keep working the queue. Integration merges from his phone.
- **Questions for Craig** go on #5 in one grouped comment. Never wait on an answer when other work is open.

---

## 7. Guardrails

The checker enforces the phrase lists. You still read for meaning, because a reworded overclaim gets past any list.

**Torus:**

- Say "not advertised", never "Torus lacks", "Torus can't", "Torus cannot", "Lasso doesn't" or "Lasso does not".
- Stations are "simulated Torus-style". No Torus logos, no Torus images, no real units.
- The overnight schedule is our baseline ("a battery on a fixed off-peak rule"), never Torus or Lasso practice.
- Value is "value to RMP's system at day-ahead prices". "Torus revenue" appears only in the negative ("not Torus revenue").
- CO2 is "estimated, using average emissions", with that caveat in view wherever the number is.
- Show both heatmap readings (MT and UTC) every time.
- 500 MW is "an MOU for up to 500 MW", never installed capacity, and never tied to the 500 MW headroom figure.
- Never invent a Torus fact. A Torus claim needs a FACTS row, or a URL you opened plus a quote under 15 words.

**Scope:** no Nucleus or Startup State framing, slide or double-entry talk. No prize amount.

**Banned phrases** (the checker list, case-insensitive):

- `Torus lacks`, `Torus can't`, `Torus cannot`, `Lasso doesn't`, `Lasso does not`
- `Torus revenue`, unless it appears as "not Torus revenue"
- `Utah regulators`
- `six-minute call`, `6-minute call`
- `500 MW installed`
- `Nucleus x`, `Nucleus bounty`, `Nucleus slide`, `Startup State`. "Nucleus Fund" stays allowed, as Angela Smith's affiliation on the Q&A cards. The deck test bans "Nucleus" outright, because the deck names no judges.
- `record peak`
- `14% to 77%`
- `Pulse has a 25-year`
- `27 of 30`
- `prices post at`
- `most calls in the evening`

**Style for anything a judge reads:**

- No em dashes or en dashes.
- American English.
- Plain words and short sentences.
- No hype words: `comprehensive`, `robust`, `seamless`, `leverage`, `cutting-edge`, `game-changer`.

**Certainty:**

- **Never invent a number, quote, URL or fact.** If it is not in the repo research, `../clearlane-raw`, or a source you opened this session, write "UNVERIFIED" next to it.
- **Mark the certainty of every claim in a PR or review:**
  - Lvl 2: read in the named source
  - Lvl 3: math walked by hand
  - Lvl 4: printed by a command you ran
- **A claim short of that is reported as unproven.**

**Public repo:**

- The repo goes public at submission.
- No secrets, keys or `.env` files.
- No copies of third-party pages and no Torus images. PACE.xlsx and page snapshots stay in `../clearlane-raw`.
- Quotes under 15 words, each with its URL.

**Git:**

- Branch `pitch/<issue#>-<slug>` from `origin/main`. One PR per issue, with `Closes #<n>`.
- Stage paths by name.
- Use `--force-with-lease`, never `--force`, and only on your own branches.
- Never merge. Never push to `main`.

---

## 8. When blocked

Blocked means you need something from another lane, from Integration or from Craig, and you cannot honestly finish without it.

1. Add the label: `gh issue edit <n> --add-label status:blocked`.
2. Comment on the issue with `--body-file`. Say what you need, from which lane, and the smallest thing that unblocks you, for example "Engine writes `fixed_rule_charge_usd_mwh` to numbers.json". Link the request issue you opened in that lane.
3. Take the next issue in your queue. Do not wait, and do not work around the block by typing a number or editing another lane's path.
4. When the block clears, remove the label (`gh issue edit <n> --remove-label status:blocked`) and resume.

**A stretch item waiting for CORE GREEN is gated, not blocked.** Take `status:blocked` off #12 and #13 unless something other than the gate holds them.

**Copy that needs a PENDING-ENGINE key is not blocked.** Write it with the `{key}`, run the checker in draft mode, and open the PR. `--strict` catches it if the key never lands.

---

## 9. Status reporting

**At every train,** post one status comment on #5 (`--body-file`), dated with `date '+%a %b %-d %-I:%M%p MT'`.

| Train | When (MT) | What the pitch lane does by then |
|---|---|---|
| Train 1 | Tue 1:45am | PR #15 fixed (item 1) |
| Train 2 | Tue 8:00am | PR #16 fixed; PR #17 merge-ready; checker and catalog PRs open; Engine key request filed |
| Train 3 | Tue 10:45am | Stage script and deck source PRs open; Torus answers folded in if Craig posted them |
| Train 4 | Tue 2:00pm, core checkpoint | Deck PDF, one-pagers and Q&A PRs open; reviews current |
| Train 5 | Tue 5:30pm | Stretch-1 merged or reported missed |
| Train 6 | Tue 11:30pm, feature freeze | Oct 28 refresh pass done or "staying on Oct 27"; drill grade posted by 11:00pm |
| Train 7 | Wed 10:00am | Fixes only; reviews current |
| Train 8 | Wed noon | Submission draft and release PDFs PR open |
| Freeze | Wed 2:00pm | Tag `v1-stage`; final review markers on everything merged |

**Template:**

```text
Lane: pitch status, Train <n>, <date output>

Merged since last train: <#s, or none>
Open PRs: <#n title (CI state, pitch-review marker)>
In flight: <issue and what is left>
Blocked: <issue, what is needed, from whom; or none>
Reviews this train: <#n CLEAN | #n FINDINGS k>
Next: <the next one or two issues>
Needs from Craig: <one grouped list, or Nothing>
```

**When the queue empties,** post the same template with "Queue empty". Then review open PRs in priority order (item 9), and support rehearsal by tightening the Q&A, timing beats and re-checking claims.
