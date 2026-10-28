"""Offline tests for the real-time price history (stretch `rt-history`): DST days, missing intervals, 5-minute path."""

import csv
import io
import json
import pathlib
import tempfile
import unittest
import zipfile
from datetime import datetime, timedelta, timezone
from unittest import mock
from urllib.parse import parse_qs, urlparse

from prep import oasis, rt_history
from prep.rt_history import (
    build_days,
    chunks,
    day_intervals,
    day_start_utc,
    parse_intvl,
    parse_rtpd,
    to_15min,
)

ROOT = pathlib.Path(__file__).resolve().parents[2]
UTC = timezone.utc
EXTRACT = ROOT / "research" / "data" / "caiso1" / "20261025_20261025_PRC_INTVL_LMP_RTM_20261026_20_16_14_v1.csv"
HEADER = "INTERVALSTARTTIME_GMT,OPR_DT,OPR_HR,NODE,MARKET_RUN_ID,LMP_TYPE,{col}\n"


def _gmt(instant: datetime) -> str:
    return instant.strftime("%Y-%m-%dT%H:%M:%S-00:00")


def _zip(text: str) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as archive:
        archive.writestr("data.csv", text)
    return buf.getvalue()


def _price(instant: datetime) -> float:
    return round(10 + instant.hour + instant.minute / 100, 5)


def _body(start: datetime, end: datetime, minutes: int, col: str, skip=()) -> str:
    lines = [HEADER.format(col=col)]
    t = start
    while t < end:
        if _gmt(t) not in skip:
            for kind, value in (("LMP", _price(t)), ("MCC", -0.5)):
                lines.append(f"{_gmt(t)},{t:%Y-%m-%d},{t.hour + 1:02d},ELAP_PACE-APND,X,{kind},{value}\n")
        t += timedelta(minutes=minutes)
    return "".join(lines)


class FakeOasis:
    """RTPD answers in PRC, INTVL in MW; `fail_rtpd` makes every RTPD call return an OASIS error."""

    def __init__(self, fail_rtpd=False, skip=()):
        self.fail_rtpd, self.skip, self.urls = fail_rtpd, set(skip), []

    def __call__(self, url):
        self.urls.append(url)
        q = parse_qs(urlparse(url).query)
        start = datetime.strptime(q["startdatetime"][0], "%Y%m%dT%H:%M-0000").replace(tzinfo=UTC)
        end = datetime.strptime(q["enddatetime"][0], "%Y%m%dT%H:%M-0000").replace(tzinfo=UTC)
        if q["queryname"][0] == "PRC_RTPD_LMP":
            if self.fail_rtpd:
                return _zip_xml()
            return _zip(_body(start, end, 15, "PRC", self.skip))
        return _zip(_body(start, end, 5, "MW", self.skip))


def _zip_xml() -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as archive:
        archive.writestr("err.xml", "<m:ERR_CODE>1000</m:ERR_CODE><m:ERR_DESC>No data</m:ERR_DESC>")
    return buf.getvalue()


class FakeClock:
    def __init__(self):
        self.t = 0.0

    def monotonic(self):
        return self.t

    def sleep(self, seconds):
        self.t += seconds

    def now(self):
        return datetime(2026, 10, 28, 8, tzinfo=UTC) + timedelta(seconds=self.t)


class DayBoundaryTest(unittest.TestCase):
    def test_fall_back_day_has_100_intervals_and_neighbors_96(self):
        self.assertEqual(day_start_utc("2025-11-01"), datetime(2025, 11, 1, 6, tzinfo=UTC))
        self.assertEqual(day_start_utc("2025-11-02"), datetime(2025, 11, 2, 6, tzinfo=UTC))
        self.assertEqual(day_start_utc("2025-11-03"), datetime(2025, 11, 3, 7, tzinfo=UTC))
        self.assertEqual([len(day_intervals(d)) for d in ("2025-11-01", "2025-11-02", "2025-11-03")], [96, 100, 96])
        self.assertEqual(day_intervals("2025-11-02")[-1], "2025-11-03T06:45:00Z")
        self.assertEqual(day_intervals("2025-11-03")[0], "2025-11-03T07:00:00Z")

    def test_spring_forward_day_has_92_intervals_and_neighbors_96(self):
        self.assertEqual(day_start_utc("2026-03-08"), datetime(2026, 3, 8, 7, tzinfo=UTC))
        self.assertEqual(day_start_utc("2026-03-09"), datetime(2026, 3, 9, 6, tzinfo=UTC))
        self.assertEqual([len(day_intervals(d)) for d in ("2026-03-07", "2026-03-08", "2026-03-09")], [96, 92, 96])
        self.assertEqual(day_intervals("2026-03-08")[-1], "2026-03-09T05:45:00Z")
        self.assertEqual(day_intervals("2026-03-09")[0], "2026-03-09T06:00:00Z")

    def test_summer_days_start_at_06z(self):
        self.assertEqual(day_intervals("2026-10-27")[0], "2026-10-27T06:00:00Z")
        self.assertEqual(day_intervals("2026-05-01")[-1], "2026-05-02T05:45:00Z")

    def test_consecutive_days_tile_utc_with_no_gap_or_overlap_across_both_ranges(self):
        for first, last, _ in rt_history.RANGES:
            days, _ = build_days(first, last, {})
            stamps = [s for d in days for s in d["ts_utc"]]
            self.assertEqual(len(stamps), len(set(stamps)))
            for a, b in zip(stamps, stamps[1:]):
                gap = datetime.fromisoformat(b[:-1]) - datetime.fromisoformat(a[:-1])
                self.assertEqual(gap, timedelta(minutes=15), (a, b))

    def test_chunks_stay_under_31_days_and_cover_the_range(self):
        for first, last, _ in rt_history.RANGES:
            parts = chunks(first, last)
            self.assertEqual(parts[0][0].isoformat(), first)
            self.assertEqual(parts[-1][1].isoformat(), last)
            for lo, hi in parts:
                self.assertLess((hi - lo).days + 1, 31)
            for (_, hi), (lo, _) in zip(parts, parts[1:]):
                self.assertEqual((lo - hi).days, 1)


class ParseTest(unittest.TestCase):
    def test_rtpd_keeps_lmp_rows_from_the_prc_column(self):
        start = datetime(2026, 10, 25, 6, tzinfo=UTC)
        got = parse_rtpd(_zip(_body(start, start + timedelta(hours=1), 15, "PRC")))
        self.assertEqual(
            list(got), ["2026-10-25T06:00:00Z", "2026-10-25T06:15:00Z", "2026-10-25T06:30:00Z", "2026-10-25T06:45:00Z"]
        )
        self.assertEqual(got["2026-10-25T06:15:00Z"], 16.15)

    def test_five_minute_path_matches_the_caiso1_extract_to_the_cent(self):
        with EXTRACT.open(newline="", encoding="utf-8") as stream:
            rows = list(csv.DictReader(stream))
        published = {
            r["INTERVALSTARTTIME_GMT"].replace("-00:00", "Z"): float(r["MW"]) for r in rows if r["LMP_TYPE"] == "LMP"
        }
        got = parse_intvl(rows)
        self.assertEqual(len(got), 24)
        self.assertEqual(min(got), "2026-10-25T07:00:00Z")
        self.assertEqual(max(got), "2026-10-25T08:55:00Z")
        for stamp, value in published.items():
            self.assertEqual(round(got[stamp], 2), round(value, 2), stamp)
        fifteen = to_15min(got)
        self.assertEqual(len(fifteen), 8)
        first = [published[f"2026-10-25T07:{m:02d}:00Z"] for m in (0, 5, 10)]
        self.assertAlmostEqual(fifteen["2026-10-25T07:00:00Z"], sum(first) / 3, places=6)

    def test_a_15_minute_value_needs_all_three_5_minute_intervals(self):
        five = {
            "2026-10-25T07:00:00Z": 1.0,
            "2026-10-25T07:05:00Z": 2.0,
            "2026-10-25T07:10:00Z": 3.0,
            "2026-10-25T07:15:00Z": 4.0,
            "2026-10-25T07:20:00Z": 5.0,
        }
        self.assertEqual(to_15min(five), {"2026-10-25T07:00:00Z": 2.0})


class BuildTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        patcher = mock.patch.object(rt_history, "RAW", pathlib.Path(self.temp.name) / "raw")
        patcher.start()
        self.addCleanup(patcher.stop)
        self.addCleanup(self.temp.cleanup)
        self.logs = []

    def _fetch(self, transport, first, last):
        fetcher = rt_history.Fetcher(transport, FakeClock(), log=self.logs.append)
        return fetcher, fetcher.prices(first, last)

    def test_missing_intervals_are_null_and_listed_never_filled(self):
        hole = "2025-11-02T08:30:00Z"
        fetcher, prices = self._fetch(FakeOasis(skip={hole.replace("Z", "-00:00")}), "2025-11-01", "2025-11-03")
        doc = rt_history.document("2025-11-01", "2025-11-03", "winter", prices, fetcher)
        self.assertEqual(doc["missing"], [hole])
        day = doc["days"][1]
        self.assertEqual(len(day["ts_utc"]), 100)
        self.assertIsNone(day["lmp_usd_mwh"][day["ts_utc"].index(hole)])
        self.assertEqual(sum(v is None for d in doc["days"] for v in d["lmp_usd_mwh"]), 1)
        self.assertEqual(doc["label"], "RT proxy")
        self.assertTrue(any("RT proxy" in note for note in doc["notes"]))
        json.dumps(doc, allow_nan=False)

    def test_rtpd_error_falls_back_to_five_minute_means_day_by_day(self):
        transport = FakeOasis(fail_rtpd=True)
        fetcher, prices = self._fetch(transport, "2026-10-26", "2026-10-27")
        self.assertEqual(fetcher.fallback_days, ["2026-10-26", "2026-10-27"])
        self.assertEqual(len(prices), 192)
        t = datetime(2026, 10, 27, 6, tzinfo=UTC)
        expected = sum(_price(t + timedelta(minutes=m)) for m in (0, 5, 10)) / 3
        self.assertAlmostEqual(prices["2026-10-27T06:00:00Z"], expected, places=6)
        queries = [parse_qs(urlparse(u).query)["queryname"][0] for u in transport.urls]
        self.assertEqual(queries.count("PRC_RTPD_LMP"), 2)  # v3, then v1
        self.assertEqual(queries.count("PRC_INTVL_LMP"), 2)  # one call per day

    def test_calls_are_paced_and_a_rerun_reads_the_cache(self):
        clock = FakeClock()
        transport = FakeOasis()
        rt_history.Fetcher(transport, clock, log=self.logs.append).prices("2026-05-01", "2026-06-29")
        self.assertEqual(len(transport.urls), 2)
        self.assertGreaterEqual(clock.t, oasis.MIN_CALL_GAP_S)
        rt_history.Fetcher(transport, clock, log=self.logs.append).prices("2026-05-01", "2026-06-29")
        self.assertEqual(len(transport.urls), 2)

    def test_fetched_prices_outside_the_window_are_dropped(self):
        _, prices = self._fetch(FakeOasis(), "2026-10-27", "2026-10-27")
        self.assertEqual(min(prices), "2026-10-27T06:00:00Z")
        self.assertEqual(max(prices), "2026-10-28T05:45:00Z")
        self.assertEqual(len(prices), 96)


class CommittedFilesTest(unittest.TestCase):
    def test_committed_rt_files_have_the_expected_days_and_honest_nulls(self):
        for first, last, season in rt_history.RANGES:
            path = ROOT / "public" / "data" / f"rt_{first}_{last}.json"
            if not path.is_file():
                self.skipTest(f"{path.name} not built")
            doc = json.loads(path.read_text(encoding="utf-8"))
            self.assertEqual(doc["schema"], "clearlane.rt/v1")
            self.assertEqual(doc["interval_min"], 15)
            self.assertEqual(doc["days"][0]["operating_day_mt"], first)
            self.assertEqual(doc["days"][-1]["operating_day_mt"], last)
            nulls = [s for d in doc["days"] for s, v in zip(d["ts_utc"], d["lmp_usd_mwh"]) if v is None]
            self.assertEqual(nulls, doc["missing"])
            for day in doc["days"]:
                self.assertEqual(day["ts_utc"], day_intervals(day["operating_day_mt"]))
            self.assertEqual(doc["label"], "RT proxy" if season == "winter" else "RT")


if __name__ == "__main__":
    unittest.main()
