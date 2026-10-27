# Fixture fact ledger

Columns: Key | Claim | Value | Class | Source | Re-derive | Lvl | Status.

## Commands

| ID | Command | Notes |
|---|---|---|
| C1 | `python -I habit.py` | not a key row |

## Facts

| Key | Claim | Value | Class | Source | Re-derive | Lvl | Status |
|---|---|---|---|---|---|---|---|
| alpha_verified | Matches numbers.json. | $1.00 | DERIVED | src | C1 | 4 | VERIFIED |
| beta_verified | Disagrees with numbers.json. | $2.00 | DERIVED | src | C1 | 4 | VERIFIED. Checked by verifier (Oct 27) |
| gamma_pending | Engine has now produced it. | $/MW-day | DERIVED | engine | C1 | 1 | PENDING-ENGINE |
| delta_pending | Engine has not produced it. | $/MW-day | DERIVED | engine | C1 | 1 | PENDING-ENGINE |
| eps_conflict | Two sources disagree. Say "about five and a half minutes" or "under six". Then more text. | 5.6 min | TORUS_PUBLISHED | src | C1 | 2 | CONFLICT. Checked by verifier (Oct 27) |
| iota_conflict | Two sources disagree with no wording here. | 3 | REAL | src | C1 | 2 | CONFLICT |
| zeta_unchecked | Carried from a note. | 7 | REAL | note | N | 1 | UNCHECKED |
| verified_only | Verified but not built by the engine. | 9 | REAL | src | C1 | 2 | VERIFIED |

## Do not say

| Do not say | Why | Say instead |
|---|---|---|
| "Three of them" | Wrong count (iota_conflict). | "three, per the case study". |

## Verifier report

| Key | Was | Now | Why |
|---|---|---|---|
| alpha_verified | UNCHECKED | VERIFIED | four cells, not a fact row |
