"""Real-time PACE prices from CAISO OASIS, 15-minute values per Mountain day (stretch `rt-history`).

PRC_RTPD_LMP (15-minute) is the primary source. A window that errors falls back to PRC_INTVL_LMP
(5-minute, RTM v1) one day at a time; a 15-minute value from that path is the mean of all three
5-minute intervals, and fewer than three means missing. Missing intervals are null and listed, never filled.

Usage:
    python -I prep/rt_history.py fetch [--log PATH]   # paced, cached, resumable
    python -I prep/rt_history.py build                # writes public/data/rt_<start>_<end>.json
    python -I prep/rt_history.py spotcheck            # 5-minute path vs research/data/caiso1, to the cent
"""

import argparse
import csv
import io
import json
import sys
import zipfile
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Callable

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from prep import oasis  # noqa: E402
from prep._paths import PUBLIC_DATA, RAW  # noqa: E402
from prep.jsonio import write_json  # noqa: E402

UTC = timezone.utc
NODE = "ELAP_PACE-APND"
SCHEMA = "clearlane.rt/v1"
STEP = timedelta(minutes=15)
CHUNK_DAYS = 30  # under the 31-day rule
RTPD_VERSIONS = (3, 1)
INTVL_VERSION = 1
RANGES = (
    ("2026-05-01", "2026-10-27", "summer"),
    ("2025-11-01", "2026-04-30", "winter"),
)
# US Mountain DST, written out (no zoneinfo): clocks change at 2am local on these dates.
# A Mountain day starts at local midnight, which is MDT (UTC-6) when start < day <= end, else MST (UTC-7).
DST = (
    (date(2025, 3, 9), date(2025, 11, 2)),
    (date(2026, 3, 8), date(2026, 11, 1)),
)
SPOTCHECK_CSV = ROOT / "research" / "data" / "caiso1" / "20261025_20261025_PRC_INTVL_LMP_RTM_20261026_20_16_14_v1.csv"
OASIS_LICENSE = (
    "CAISO Terms of Use (https://www.caiso.com/privacy-terms-of-use): limited license, credit California ISO"
)


def _day(value: str | date) -> date:
    return date.fromisoformat(value) if isinstance(value, str) else value


def mdt_at_midnight(day: str | date) -> bool:
    day = _day(day)
    for start, end in DST:
        if start < day <= end:
            return True
    if not DST[0][0] - timedelta(days=366) <= day <= DST[-1][1] + timedelta(days=1):
        raise ValueError(f"no DST rule written for {day}")
    return False


def day_start_utc(day: str | date) -> datetime:
    day = _day(day)
    offset = 6 if mdt_at_midnight(day) else 7
    return datetime(day.year, day.month, day.day, offset, tzinfo=UTC)


def day_intervals(day: str | date) -> list[str]:
    day = _day(day)
    start, end = day_start_utc(day), day_start_utc(day + timedelta(days=1))
    out = []
    while start < end:
        out.append(_z(start))
        start += STEP
    return out


def _z(instant: datetime) -> str:
    return instant.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")


def _stamp(value: str) -> str:
    return _z(datetime.fromisoformat(value.strip().replace("Z", "+00:00")))


def _days(first: str, last: str) -> list[date]:
    current, end, out = _day(first), _day(last), []
    while current <= end:
        out.append(current)
        current += timedelta(days=1)
    return out


def chunks(first: str, last: str, size: int = CHUNK_DAYS) -> list[tuple[date, date]]:
    """Inclusive Mountain-day chunks of at most `size` days."""
    days = _days(first, last)
    return [(days[i], days[min(i + size, len(days)) - 1]) for i in range(0, len(days), size)]


def _csv(raw: bytes) -> list[dict[str, str]]:
    with zipfile.ZipFile(io.BytesIO(raw)) as archive:
        names = [name for name in archive.namelist() if name.lower().endswith(".csv")]
        if not names:
            raise oasis.OasisError("no_csv", "OASIS zip contains no CSV member")
        text = archive.read(names[0]).decode("utf-8-sig")
    return list(csv.DictReader(io.StringIO(text, newline="")))


def _lmp_rows(rows: list[dict[str, str]]) -> dict[str, float]:
    out = {}
    for row in rows:
        if row.get("LMP_TYPE") != "LMP" or row.get("NODE") != NODE:
            continue
        value = row.get("PRC") or row.get("MW")
        out[_stamp(row["INTERVALSTARTTIME_GMT"])] = float(value)
    return out


def parse_rtpd(raw: bytes) -> dict[str, float]:
    """PRC_RTPD_LMP: 15-minute LMP by UTC interval start (value column PRC)."""
    return _lmp_rows(_csv(raw))


def parse_intvl(raw_or_rows: bytes | list[dict[str, str]]) -> dict[str, float]:
    """PRC_INTVL_LMP RTM: 5-minute LMP by UTC interval start (value column MW)."""
    rows = _csv(raw_or_rows) if isinstance(raw_or_rows, bytes) else raw_or_rows
    return _lmp_rows(rows)


def to_15min(five: dict[str, float]) -> dict[str, float]:
    """Mean of the three 5-minute values in each 15-minute interval; fewer than three is left out."""
    groups: dict[str, list[float]] = {}
    for stamp, value in five.items():
        instant = datetime.fromisoformat(stamp.replace("Z", "+00:00"))
        start = instant - timedelta(minutes=instant.minute % 15, seconds=instant.second)
        groups.setdefault(_z(start), []).append(value)
    return {stamp: round(sum(v) / 3, 6) for stamp, v in sorted(groups.items()) if len(v) == 3}


def _url(query: str, start: datetime, end: datetime, version: int, base: str | None) -> str:
    params = {"market_run_id": "RTPD" if query == "PRC_RTPD_LMP" else "RTM", "version": version, "node": NODE}
    if base:
        params["base"] = base
    return oasis.build_url(query, start, end, **params)


def _cache(url: str, query: str) -> Path:
    q = oasis.urllib.parse.parse_qs(oasis.urllib.parse.urlparse(url).query)
    start = q["startdatetime"][0].replace(":", "")
    end = q["enddatetime"][0].replace(":", "")
    return RAW / "rt" / query.lower() / f"{start}_{end}_v{q['version'][0]}.zip"


class Fetcher:
    """Paced, cached fetch of one inclusive Mountain-day range. A killed run resumes from the cache."""

    def __init__(self, transport=None, clock=None, base: str | None = None, log: Callable[[str], None] = print):
        self.transport, self.clock, self.base, self.log = transport, clock, base, log
        self.sources: list[dict] = []
        self.fallback_days: list[str] = []

    def _get(self, query: str, start: datetime, end: datetime, version: int) -> bytes:
        url = _url(query, start, end, version, self.base)
        path = _cache(url, query)
        hit = path.is_file()
        raw = oasis.fetch(url, path, transport=self.transport, clock=self.clock)
        meta = path.with_suffix(path.suffix + ".meta.json")
        retrieved = json.loads(meta.read_text(encoding="utf-8"))["retrieved_utc"] if meta.is_file() else None
        self.sources.append({"url": url, "license": OASIS_LICENSE, "retrieved_utc": retrieved})
        self.log(f"{'cache' if hit else 'fetched'} {query} v{version} {_z(start)} to {_z(end)}")
        return raw

    def _rtpd(self, start: datetime, end: datetime) -> dict[str, float]:
        last = None
        for version in RTPD_VERSIONS:
            try:
                return parse_rtpd(self._get("PRC_RTPD_LMP", start, end, version))
            except oasis.OasisError as error:
                last = error
                self.log(f"PRC_RTPD_LMP v{version} failed {_z(start)}: {error}")
        raise last  # type: ignore[misc]

    def _intvl_day(self, day: date) -> dict[str, float]:
        start, end = day_start_utc(day), day_start_utc(day + timedelta(days=1))
        try:
            return to_15min(parse_intvl(self._get("PRC_INTVL_LMP", start, end, INTVL_VERSION)))
        except oasis.OasisError as error:
            self.log(f"PRC_INTVL_LMP failed {day}: {error}; the day stays missing")
            return {}

    def prices(self, first: str, last: str) -> dict[str, float]:
        out: dict[str, float] = {}
        for lo, hi in chunks(first, last):
            start, end = day_start_utc(lo), day_start_utc(hi + timedelta(days=1))
            try:
                got = self._rtpd(start, end)
            except oasis.OasisError:
                got = {}
                for day in _days(lo.isoformat(), hi.isoformat()):
                    self.fallback_days.append(day.isoformat())
                    got.update(self._intvl_day(day))
            out.update({k: v for k, v in got.items() if start <= datetime.fromisoformat(k[:-1] + "+00:00") < end})
        return out


def build_days(first: str, last: str, prices: dict[str, float]) -> tuple[list[dict], list[str]]:
    days, missing = [], []
    for day in _days(first, last):
        stamps = day_intervals(day)
        values = [prices.get(stamp) for stamp in stamps]
        missing.extend(stamp for stamp, value in zip(stamps, values) if value is None)
        days.append({"operating_day_mt": day.isoformat(), "ts_utc": stamps, "lmp_usd_mwh": values})
    return days, missing


def document(first: str, last: str, season: str, prices: dict[str, float], fetcher: Fetcher) -> dict:
    days, missing = build_days(first, last, prices)
    notes = [
        "Real-time PACE prices from California ISO OASIS PRC_RTPD_LMP (15-minute market), node ELAP_PACE-APND.",
        "Mountain days run local midnight to local midnight and are keyed by UTC interval start: 96 intervals, "
        "100 on Nov 2 2025 and 92 on Mar 8 2026.",
        "Missing intervals are null and listed in `missing`, never filled.",
    ]
    if fetcher.fallback_days:
        notes.append(
            "These days came from PRC_INTVL_LMP (5-minute, RTM): each 15-minute value is the mean of all three "
            "5-minute intervals, and fewer than three is missing: " + ", ".join(fetcher.fallback_days)
        )
    if season == "winter":
        notes.append(
            "RT proxy: EDAM's day-ahead market did not exist before May 1 2026, so these winter "
            "real-time prices have no day-ahead counterpart."
        )
    return {
        "schema": SCHEMA,
        "prov": "REAL",
        "node": NODE,
        "interval_min": 15,
        "window": {"start_mt": first, "end_mt": last},
        "label": "RT proxy" if season == "winter" else "RT",
        "days": days,
        "missing": missing,
        "sources": fetcher.sources,
        "notes": notes,
    }


def run(command: str, transport=None, clock=None, base=None, out_dir: Path | None = None, log=print) -> list[Path]:
    written = []
    for first, last, season in RANGES:
        fetcher = Fetcher(transport, clock, base, log)
        prices = fetcher.prices(first, last)
        if command == "fetch":
            log(f"{season}: {len(prices)} intervals cached for {first} to {last}")
            continue
        doc = document(first, last, season, prices, fetcher)
        path = (out_dir or PUBLIC_DATA) / f"rt_{first}_{last}.json"
        write_json(path, doc)
        log(f"wrote {path}: {len(doc['days'])} days, {len(doc['missing'])} missing intervals")
        written.append(path)
    return written


def spotcheck(transport=None, clock=None, base=None, log=print) -> bool:
    """Fetch the 5-minute path for the caiso1 extract's window and compare to the cent."""
    with SPOTCHECK_CSV.open(newline="", encoding="utf-8") as stream:
        expected = parse_intvl(list(csv.DictReader(stream)))
    start = datetime.fromisoformat(min(expected)[:-1] + "+00:00")
    end = datetime.fromisoformat(max(expected)[:-1] + "+00:00") + timedelta(minutes=5)
    got = parse_intvl(Fetcher(transport, clock, base, log)._get("PRC_INTVL_LMP", start, end, INTVL_VERSION))
    bad = [k for k in expected if k not in got or round(got[k], 2) != round(expected[k], 2)]
    log(f"spotcheck {len(expected)} intervals, {len(bad)} differ by a cent or more" + (f": {bad}" if bad else ""))
    return not bad


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("command", choices=("fetch", "build", "spotcheck"))
    parser.add_argument("--log", type=Path, help="also append progress lines to this file")
    parser.add_argument("--oasis-base", help="override the OASIS endpoint (testing)")
    args = parser.parse_args()

    def log(line: str) -> None:
        stamp = datetime.now(UTC).strftime("%H:%M:%SZ")
        print(f"{stamp} {line}", flush=True)
        if args.log:
            args.log.parent.mkdir(parents=True, exist_ok=True)
            with args.log.open("a", encoding="utf-8") as stream:
                stream.write(f"{stamp} {line}\n")

    if args.command == "spotcheck":
        return 0 if spotcheck(base=args.oasis_base, log=log) else 1
    run(args.command, base=args.oasis_base, log=log)
    return 0


if __name__ == "__main__":
    sys.exit(main())
