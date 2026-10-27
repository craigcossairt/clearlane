"""Tests for science/common.py: time conversions, readers and writers."""
import datetime as dt
import json
import pathlib
import tempfile
import unittest

from science import common

UTC = dt.timezone.utc


class TimeTests(unittest.TestCase):
    def test_oasis_start_0600z_is_oct27_hb0(self):
        t = common.parse_oasis_time("2026-10-27T06:00:00-00:00")
        self.assertEqual(t, dt.datetime(2026, 10, 27, 6, tzinfo=UTC))
        self.assertEqual(common.mountain_hb(t), (dt.date(2026, 10, 27), 0))

    def test_oasis_0500z_is_previous_day_hb23(self):
        t = common.parse_oasis_time("2026-10-27T05:00:00-00:00")
        self.assertEqual(common.mountain_hb(t), (dt.date(2026, 10, 26), 23))

    def test_mst_after_nov_first_sunday(self):
        # Nov 2 2026 is after DST ends (Nov 1): MST, UTC-7.
        t = dt.datetime(2026, 11, 2, 7, tzinfo=UTC)
        self.assertEqual(common.mountain_hb(t), (dt.date(2026, 11, 2), 0))
        self.assertEqual(common.mountain_offset_hours(dt.datetime(2026, 10, 27, 6, tzinfo=UTC)), -6)

    def test_utc_start_of_mountain_hour(self):
        self.assertEqual(common.utc_start(dt.date(2026, 10, 27), 0),
                         dt.datetime(2026, 10, 27, 6, tzinfo=UTC))
        self.assertEqual(common.utc_start(dt.date(2026, 10, 27), 23),
                         dt.datetime(2026, 10, 28, 5, tzinfo=UTC))

    def test_eia_end_0700_is_start_0600(self):
        t = common.parse_eia_end("10/27/2026 7:00:00 AM")
        self.assertEqual(t, dt.datetime(2026, 10, 27, 7, tzinfo=UTC))
        self.assertEqual(common.eia_utc_start("10/27/2026 7:00:00 AM"),
                         dt.datetime(2026, 10, 27, 6, tzinfo=UTC))
        self.assertEqual(common.eia_utc_start("10/27/2026 12:00:00 AM"),
                         dt.datetime(2026, 10, 26, 23, tzinfo=UTC))


OASIS_HEADER = ("INTERVALSTARTTIME_GMT,INTERVALENDTIME_GMT,OPR_DT,OPR_HR,OPR_INTERVAL,NODE_ID_XML,"
                "NODE_ID,NODE,MARKET_RUN_ID,LMP_TYPE,XML_DATA_ITEM,PNODE_RESMRID,GRP_TYPE,POS,MW,GROUP\n")


def oasis_row(start, node, kind, mw, opr_dt="1999-01-01", opr_hr="7"):
    end = start  # end time is not read
    return (f"{start},{end},{opr_dt},{opr_hr},0,{node},{node},{node},DAM,{kind},X,{node},"
            f"ALL_APNODES,0,{mw},1\n")


class OasisReaderTests(unittest.TestCase):
    def test_filters_node_and_lmp_type_and_ignores_opr_fields(self):
        with tempfile.TemporaryDirectory() as d:
            p = pathlib.Path(d) / "a.csv"
            p.write_text(OASIS_HEADER
                         + oasis_row("2026-10-27T06:00:00-00:00", "ELAP_PACE-APND", "LMP", "30.21857")
                         + oasis_row("2026-10-27T06:00:00-00:00", "ELAP_PACE-APND", "MCC", "1.5")
                         + oasis_row("2026-10-27T06:00:00-00:00", "TH_SP15_GEN-APND", "LMP", "99")
                         + oasis_row("2026-10-27T07:00:00-00:00", "ELAP_PACE-APND", "LMP", "28.0"),
                         encoding="utf-8", newline="\n")
            got = common.read_oasis_lmp([p], "ELAP_PACE-APND")
        self.assertEqual(got, {dt.datetime(2026, 10, 27, 6, tzinfo=UTC): 30.21857,
                               dt.datetime(2026, 10, 27, 7, tzinfo=UTC): 28.0})

    def test_conflicting_duplicate_raises(self):
        with tempfile.TemporaryDirectory() as d:
            p = pathlib.Path(d) / "a.csv"
            p.write_text(OASIS_HEADER
                         + oasis_row("2026-10-27T06:00:00-00:00", "N", "LMP", "1")
                         + oasis_row("2026-10-27T06:00:00-00:00", "N", "LMP", "2"),
                         encoding="utf-8", newline="\n")
            with self.assertRaises(ValueError):
                common.read_oasis_lmp([p], "N")


class GroupingTests(unittest.TestCase):
    def test_full_day_kept_and_short_day_skipped_and_listed(self):
        series = {}
        for h in range(24):
            series[common.utc_start(dt.date(2026, 10, 27), h)] = float(h)
        for h in range(1, 24):  # 23 hours, like May 1
            series[common.utc_start(dt.date(2026, 10, 26), h)] = 1.0
        days, skipped = common.group_mountain_days(series)
        self.assertEqual(list(days), [dt.date(2026, 10, 27)])
        self.assertEqual(days[dt.date(2026, 10, 27)], [float(h) for h in range(24)])
        self.assertEqual(skipped, [(dt.date(2026, 10, 26), 23)])


class EiaReaderTests(unittest.TestCase):
    def test_reads_rows_with_utc_start_and_numbers(self):
        with tempfile.TemporaryDirectory() as d:
            p = pathlib.Path(d) / "e.csv"
            p.write_text('"Balancing Authority","UTC Time at End of Hour","Demand (MW) (Adjusted)","X"\n'
                         '"PACE","10/27/2026 7:00:00 AM","7,023",""\n', encoding="utf-8", newline="\n")
            rows = common.read_eia930(p)
        self.assertEqual(rows[0]["utc_start"], dt.datetime(2026, 10, 27, 6, tzinfo=UTC))
        self.assertEqual(common.num(rows[0]["Demand (MW) (Adjusted)"]), 7023.0)
        self.assertIsNone(common.num(rows[0]["X"]))


class WriterTests(unittest.TestCase):
    def test_json_sorted_indent2_lf_final_newline(self):
        with tempfile.TemporaryDirectory() as d:
            p = pathlib.Path(d) / "o.json"
            common.write_json(p, {"b": 1, "a": [1, 2]})
            raw = p.read_bytes()
        self.assertEqual(raw, b'{\n  "a": [\n    1,\n    2\n  ],\n  "b": 1\n}\n')

    def test_sha256(self):
        with tempfile.TemporaryDirectory() as d:
            p = pathlib.Path(d) / "x"
            p.write_bytes(b"abc")
            self.assertEqual(common.sha256(p),
                             "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad")

    def test_marker_writer_replaces_only_between_markers(self):
        with tempfile.TemporaryDirectory() as d:
            p = pathlib.Path(d) / "r.md"
            p.write_text("# T\n\nkeep\n<!-- results:start -->\nold\n<!-- results:end -->\ntail\n",
                         encoding="utf-8", newline="\n")
            common.write_results(p, "new table")
            self.assertEqual(p.read_text(encoding="utf-8"),
                             "# T\n\nkeep\n<!-- results:start -->\nnew table\n<!-- results:end -->\ntail\n")

    def test_marker_writer_raises_without_markers(self):
        with tempfile.TemporaryDirectory() as d:
            p = pathlib.Path(d) / "r.md"
            p.write_text("no markers\n", encoding="utf-8")
            with self.assertRaises(ValueError):
                common.write_results(p, "x")

    def test_relpath_is_posix_and_relative_to_root(self):
        self.assertEqual(common.rel(common.ROOT / "science" / "common.py"), "science/common.py")


if __name__ == "__main__":
    unittest.main()
