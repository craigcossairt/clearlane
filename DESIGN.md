# DESIGN.md: stage app

The app is shown on a projector at 1920x1080 to judges 3 to 6 meters away, and on a phone at 375px.
It uses the same visual language as the plan page (`docs/plan/plan-v1.html`). UI lane owns the code; this file owns the tokens.

## Tokens

| Token | Light | Dark | Meaning |
|---|---|---|---|
| `--bg` | `#f6f5f1` | `#111316` | page |
| `--ink` | `#1b1c1e` | `#ebeae6` | text |
| `--muted` | `#5a5d63` | `#a2a6ad` | secondary text, axes |
| `--accent` | `#1c5bb8` | `#7ea9ff` | the one primary action, focus ring |
| `--clear` / `--clear-soft` | `#1d8457` / `#e3f2ea` | `#3cbf84` / `#16291f` | clear lane: price at or below the day's low band |
| `--shoulder` / `--shoulder-soft` | `#b97d0c` / `#f6eedb` | `#e2a73c` / `#2b2414` | shoulder hours |
| `--jam` / `--jam-soft` | `#bf3a29` / `#f8e6e2` | `#ee6b58` / `#2e1a17` | jam: evening peak, System Critical Hours |
| `--solar` | `#d99a00` | `#f0c04c` | solar forecast overlay |

Dark is the stage default (projectors wash out light backgrounds). Light follows `prefers-color-scheme`.

## Rules

- Type: system UI stack for text, `ui-monospace` for numbers. No web fonts: the stage runs offline.
- On the projector, body text is at least 24px and every number a judge must read is at least 40px.
- Lane color is never the only signal. Every colored bar or band also carries a label or a pattern.
- Every number shows its provenance chip (REAL, DERIVED, SIMULATED, TORUS_PUBLISHED, ASSUMPTION, MEASURED).
- Empty, loading and failed look different from each other. No number renders as a confident zero.
- Motion under 400ms. Under `prefers-reduced-motion` the end state lands at once; nothing is hidden.
- A state change (Solve to Solving, a crash firing) never resizes its container.
- No em dashes in any copy a judge reads.
