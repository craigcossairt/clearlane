# Research reference oracles

These scripts are runnable copies of the research calculations. They read the committed research inputs and write only to stdout. The arithmetic is kept identical to the source scripts.

From the repository root:

```powershell
python -I prep/reference/fix.py research prep/reference/stage_numbers.py
python -I prep/reference/stage_numbers.py research
python -I prep/reference/habit.py research
python -I prep/reference/co2.py ..\clearlane-raw\eia\PACE.xlsx
```

Expected pinned lines:

- `fix.py`: `price-only (value $65.79/MW-day)`; `wear $10/MWh: gross $57.54/MW-day`; `July: wear-10 gross mean $48.52/MW-day`; `Oct: wear-10 gross mean $39.71/MW-day`.
- `stage_numbers.py`: `price-only plan value $65.79/MW-day`; `July 2026: 30 days; price-only 1MW/2MWh daily value mean $51.74`; `Oct 1-25 2026: 25 days; price-only 1MW/2MWh daily value mean $48.68`; `$2,551 at Oct 27 DA prices`.
- `habit.py`: `value $20.06/MW-day`; `timetable vs habit: value x2.91`; `70 MW: habit $1,405/day`; `500 MW: habit $10,032/day`.
- `co2.py`: `HE16   446  n=25`; `HE19   629  n=25`.

`co2.py` requires the local 75 MB workbook at `../clearlane-raw/eia/PACE.xlsx`; the workbook is never committed.
