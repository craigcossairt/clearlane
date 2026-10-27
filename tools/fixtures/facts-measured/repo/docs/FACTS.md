# Fixture fact ledger for the MEASURED rule

Columns: Key | Claim | Value | Class | Source | Re-derive | Lvl | Status.

## Facts

| Key | Claim | Value | Class | Source | Re-derive | Lvl | Status |
|---|---|---|---|---|---|---|---|
| solve_live | Class MEASURED, still marked pending. | ms | MEASURED | browser | live only | 1 | PENDING-ENGINE |
| keys_live | Class is not MEASURED here; pitch/keys.json says prov MEASURED. | ms | ASSUMPTION | browser | live only | 1 | PENDING-ENGINE |
| clash_live | Class MEASURED, but numbers.json also stores it. | ms | MEASURED | browser | live only | 1 | PENDING-ENGINE |
| engine_pending | Class DERIVED, engine has not produced it. | $/MW-day | DERIVED | engine | C1 | 1 | PENDING-ENGINE |
| engine_unchecked | Class DERIVED, carried from a note. | 7 | DERIVED | note | N | 1 | UNCHECKED |
| stored_ok | In numbers.json and a normal key. | $1.00 | DERIVED | src | C1 | 4 | VERIFIED |
