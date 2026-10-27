"""Shared helpers for the science lane: time, readers, hashes and writers.

Stdlib only. Every science script is run as ``python -I science/<script>.py``. ``-I`` drops the
script's own folder from sys.path, so each script starts with:

    import pathlib, sys
    ROOT = pathlib.Path(__file__).resolve().parents[1]; sys.path.insert(0, str(ROOT))
    from science import common

Time conventions (docs/lanes/science.md 6.1):
- Mountain day D runs D 06:00Z to D+1 06:00Z under MDT (UTC-6); hour beginning h starts at
  D (06+h):00Z. US rules: MDT from the second Sunday of March 02:00 local to the first Sunday of
  November 02:00 local, MST (UTC-7) otherwise.
- OASIS time comes from INTERVALSTARTTIME_GMT, never OPR_DT or OPR_HR.
- EIA-930 is hour ENDING: UTC start = "UTC Time at End of Hour" minus 1 hour.
"""
import csv
import datetime as dt
import hashlib
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[1]
RAW = ROOT.parent / "clearlane-raw"
UTC = dt.timezone.utc
HOUR = dt.timedelta(hours=1)

RESULTS_START = "<!-- results:start -->"
RESULTS_END = "<!-- results:end -->"


# ---------------------------------------------------------------- time

def _nth_sunday(year, month, n):
    d = dt.date(year, month, 1)
    d += dt.timedelta(days=(6 - d.weekday()) % 7)
    return d + dt.timedelta(weeks=n - 1)


def mountain_offset_hours(t):
    """UTC offset in hours (-6 MDT or -7 MST) for an aware UTC datetime t."""
    t = t.astimezone(UTC)
    y = t.year
    start = dt.datetime.combine(_nth_sunday(y, 3, 2), dt.time(9), UTC)   # 02:00 MST = 09:00Z
    end = dt.datetime.combine(_nth_sunday(y, 11, 1), dt.time(8), UTC)    # 02:00 MDT = 08:00Z
    return -6 if start <= t < end else -7


def mountain_hb(t):
    """(Mountain local date, hour beginning 0..23) for an aware UTC datetime t."""
    t = t.astimezone(UTC)
    local = (t + dt.timedelta(hours=mountain_offset_hours(t))).replace(tzinfo=None)
    return local.date(), local.hour


def utc_start(day, hb):
    """UTC start of hour beginning hb on Mountain day `day` (valid away from DST changes)."""
    guess = dt.datetime.combine(day, dt.time(0), UTC) + dt.timedelta(hours=hb + 6)
    off = mountain_offset_hours(guess)
    return dt.datetime.combine(day, dt.time(0), UTC) + dt.timedelta(hours=hb - off)


def parse_oasis_time(s):
    """Parse an OASIS GMT stamp such as 2026-10-27T06:00:00-00:00 to an aware UTC datetime."""
    s = s.strip()
    if s.endswith("-00:00"):
        s = s[:-6] + "+00:00"
    return dt.datetime.fromisoformat(s).astimezone(UTC)


def parse_eia_end(s):
    """Parse EIA-930 'UTC Time at End of Hour' (%m/%d/%Y %I:%M:%S %p) to aware UTC."""
    return dt.datetime.strptime(s.strip(), "%m/%d/%Y %I:%M:%S %p").replace(tzinfo=UTC)


def eia_utc_start(s):
    """UTC start of the EIA-930 hour whose end stamp is s."""
    return parse_eia_end(s) - HOUR


# ---------------------------------------------------------------- readers

def num(s):
    """Parse a CSV cell to float; blank or missing gives None; thousands commas are dropped."""
    if s is None:
        return None
    s = str(s).strip().replace(",", "")
    return float(s) if s else None


def read_oasis_lmp(paths, node, lmp_type="LMP"):
    """{utc_start: price} for one node from OASIS PRC_LMP CSVs.

    Keeps rows with NODE_ID == node and LMP_TYPE == lmp_type, value column MW, time from
    INTERVALSTARTTIME_GMT. An hour seen twice with different values raises ValueError.
    """
    out = {}
    for path in sorted(pathlib.Path(p) for p in paths):
        with open(path, encoding="utf-8", newline="") as f:
            for row in csv.DictReader(f):
                if row["NODE_ID"] != node or row["LMP_TYPE"] != lmp_type:
                    continue
                t = parse_oasis_time(row["INTERVALSTARTTIME_GMT"])
                v = float(row["MW"])
                if t in out and out[t] != v:
                    raise ValueError(f"{node} {t.isoformat()}: {out[t]} vs {v} in {rel(path)}")
                out[t] = v
    return out


def group_mountain_days(series):
    """Group {utc_start: value} into Mountain days.

    Returns (days, skipped): days is {date: [24 values in hour-beginning order]} in date order;
    skipped is [(date, hours_present)] for days without exactly 24 distinct hours. Never fills.
    """
    by_day = {}
    for t, v in series.items():
        d, h = mountain_hb(t)
        by_day.setdefault(d, {})[h] = v
    days, skipped = {}, []
    for d in sorted(by_day):
        hours = by_day[d]
        if len(hours) == 24 and set(hours) == set(range(24)):
            days[d] = [hours[h] for h in range(24)]
        else:
            skipped.append((d, len(hours)))
    return days, skipped


def read_eia930(path):
    """Rows of an EIA-930 balance CSV as dicts, each with an added 'utc_start' key."""
    with open(path, encoding="utf-8-sig", newline="") as f:
        rows = list(csv.DictReader(f))
    for r in rows:
        r["utc_start"] = eia_utc_start(r["UTC Time at End of Hour"])
    return rows


# ---------------------------------------------------------------- files

def rel(path):
    """Path relative to ROOT in POSIX form; ../clearlane-raw paths keep the ../ prefix."""
    p = pathlib.Path(path).resolve()
    try:
        return p.relative_to(ROOT).as_posix()
    except ValueError:
        return "../" + p.relative_to(ROOT.parent).as_posix()


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def input_record(paths):
    """[{path, sha256}] sorted by path, for an output's `inputs` field."""
    return [{"path": rel(p), "sha256": sha256(p)} for p in sorted(paths, key=lambda p: rel(p))]


def write_text(path, text):
    pathlib.Path(path).parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        f.write(text)


def write_json(path, obj):
    """Sorted keys, indent 2, LF line ends, final newline, UTF-8."""
    write_text(path, json.dumps(obj, sort_keys=True, indent=2, ensure_ascii=False) + "\n")


def write_results(md_path, body):
    """Replace only the text between the results markers in md_path."""
    with open(md_path, encoding="utf-8", newline="") as f:
        text = f.read()
    a = text.find(RESULTS_START)
    b = text.find(RESULTS_END)
    if a < 0 or b < 0 or b < a:
        raise ValueError(f"{rel(md_path)}: results markers missing or out of order")
    head = text[: a + len(RESULTS_START)]
    write_text(md_path, head + "\n" + body.strip("\n") + "\n" + text[b:])
