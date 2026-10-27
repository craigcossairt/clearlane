# Common gotchas

Symptom, root cause, fix. Append when a bug costs more than ten minutes.

- **Bare `bash` in a hook runs WSL, not Git Bash.** Paths and HOME are wrong and hooks silently misfire. The Cursor and Grok hook files call `C:/Program Files/Git/bin/bash.exe` by full path; keep it that way.
- **Hour conventions differ by source.** The Oct 27 research snapshot (`research/data/pace_snapshot_2026-10-27.csv`) is hour BEGINNING Mountain time; EIA hourly CO2 is hour ENDING; CAISO's operating day starts 07:00Z, so hour 0 of a Mountain day (06:00Z) comes from the previous CAISO day.
- **`python` vs `python -I`.** Run every prep script with `-I` so a stray file in the working directory cannot shadow a standard-library module.
- **Python reads files as cp1252 on Windows.** Always pass `encoding="utf-8"` to `open()`, `Path.open()` and `read_text()`. CI runs on Linux (UTF-8), so a missing encoding passes in CI and breaks on the demo PC.
- **Python writes CRLF on Windows.** `Path.write_text()` and `open(..., "w")` turn each newline into CRLF. Pass `newline="\n"` for any file the repo commits (JSON in `public/`, fixtures).
- **TypeScript 7 drops `baseUrl`.** Path aliases in `tsconfig.json` are written relative (`"./contracts/*"`); adding `baseUrl` back fails the typecheck.
