"""Offline history shape checks independent of raw OASIS responses."""

import unittest
import csv
import json
import math
import pathlib
import tempfile

from prep import oasis
from prep.build_hist import WINDOWS, _call_url, _day_record, build

ROOT = pathlib.Path(__file__).resolve().parents[2]
HIST = ROOT / "public" / "data" / "hist_2026-05-01_2026-10-27.json"
META = ROOT / "public" / "data" / "hist_2026-05-01_2026-10-27.meta.json"


def _research_prices(path: pathlib.Path) -> dict[str, float]:
    """Published PACE LMP by UTC hour start. The extracts begin at 06:00Z, a Mountain midnight."""
    with path.open(newline="", encoding="utf-8") as stream:
        return {
            row["INTERVALSTARTTIME_GMT"].replace("-00:00", "Z"): float(row["MW"])
            for row in csv.DictReader(stream)
            if row["NODE"] == "ELAP_PACE-APND" and row["LMP_TYPE"] == "LMP"
        }


class HistoryBuildTest(unittest.TestCase):
    def test_research_price_extracts_cover_the_pinned_windows(self):
        july = _research_prices(
            ROOT
            / "research"
            / "data"
            / "oasis"
            / "dam_jul"
            / "20260630_20260730_PRC_LMP_DAM_20261026_20_19_29_v12.csv",
        )
        october = _research_prices(
            ROOT
            / "research"
            / "data"
            / "oasis"
            / "dam_oct"
            / "20260930_20261025_PRC_LMP_DAM_20261026_20_19_45_v12.csv",
        )
        # Jul 1-30 is 30 Mountain days and Oct 1-25 is 25, each with 24 priced hours.
        self.assertEqual(len(july), 30 * 24)
        self.assertEqual(len(october), 25 * 24)

    def test_incomplete_day_is_listed_and_never_filled(self):
        day = "2026-05-01"
        prices = {"2026-05-01T07:00:00Z": 42.125}
        co2 = {}
        record, missing, null_hours = _day_record(day, prices, co2)
        self.assertIsNone(record)
        self.assertEqual(missing["day"], day)
        self.assertEqual(missing["hours_present"], 1)
        self.assertIn("EDAM began", missing["reason"])
        self.assertEqual(null_hours, [])

    def test_complete_day_keeps_published_price_precision_and_null_co2(self):
        from prep import mtday

        day = "2026-05-02"
        starts = mtday.mountain_day_hours(day)
        prices = {ts.strftime("%Y-%m-%dT%H:%M:%SZ"): 42.12345 + i for i, ts in enumerate(starts)}
        record, missing, null_hours = _day_record(day, prices, {})
        self.assertIsNone(missing)
        self.assertEqual(record["lmp_usd_mwh"][0], 42.12345)
        self.assertEqual(record["co2_g_kwh"], [None] * 24)
        self.assertEqual(null_hours, list(range(24)))

    @unittest.skipUnless(HIST.is_file() and META.is_file(), "real history output awaits OASIS cache")
    def test_committed_history_shape_gaps_and_research_pins(self):
        days = json.loads(HIST.read_text(encoding="utf-8"))
        meta = json.loads(META.read_text(encoding="utf-8"))
        labels = [day["operating_day_mt"] for day in days]
        missing = [row["day"] for row in meta["missing_days"]]
        self.assertEqual(meta["schema"], "clearlane.hist_meta/v1")
        self.assertEqual(meta["days"], len(days))
        self.assertEqual(labels, sorted(labels))
        self.assertEqual(len(labels), len(set(labels)))
        self.assertEqual(missing, sorted(missing))
        self.assertEqual(len(labels) + len(missing), 180)
        self.assertIn("2026-05-01", missing)
        may1 = next(row for row in meta["missing_days"] if row["day"] == "2026-05-01")
        self.assertIn("EDAM began", may1["reason"])
        self.assertFalse(set(labels) & set(missing))
        for day in days:
            self.assertEqual(len(day["lmp_usd_mwh"]), 24)
            self.assertEqual(len(day["co2_g_kwh"]), 24)
            self.assertTrue(
                all(isinstance(value, (int, float)) and math.isfinite(value) for value in day["lmp_usd_mwh"])
            )
            self.assertTrue(all(value is None or value > 0 for value in day["co2_g_kwh"]))
        indexed = {day["operating_day_mt"]: day for day in days}
        pins = (
            (
                "2026-07-01",
                "2026-07-30",
                ROOT
                / "research"
                / "data"
                / "oasis"
                / "dam_jul"
                / "20260630_20260730_PRC_LMP_DAM_20261026_20_19_29_v12.csv",
            ),
            (
                "2026-10-01",
                "2026-10-25",
                ROOT
                / "research"
                / "data"
                / "oasis"
                / "dam_oct"
                / "20260930_20261025_PRC_LMP_DAM_20261026_20_19_45_v12.csv",
            ),
        )
        for first, last, source in pins:
            expected = _research_prices(source)
            compared = 0
            for day in days:
                if first <= day["operating_day_mt"] <= last:
                    from prep.mtday import mountain_day_hours

                    stamps = [
                        instant.strftime("%Y-%m-%dT%H:%M:%SZ")
                        for instant in mountain_day_hours(day["operating_day_mt"])
                    ]
                    self.assertEqual(day["lmp_usd_mwh"], [expected[stamp] for stamp in stamps])
                    compared += 24
            self.assertEqual(compared, len(expected))
        bundle_path = ROOT / "public" / "data" / "bundle_2026-10-27.json"
        if bundle_path.is_file():
            bundle = json.loads(bundle_path.read_text(encoding="utf-8"))
            history_day = indexed["2026-10-27"]
            self.assertEqual(
                [round(x, 2) for x in history_day["lmp_usd_mwh"][1:]], [x["lmp_usd_mwh"] for x in bundle["hours"][1:]]
            )

    @unittest.skipUnless(
        all(oasis._cache_path(_call_url(*window), "prc_lmp").is_file() for window in WINDOWS),
        "raw OASIS cache not present (CI has no clearlane-raw)",
    )
    def test_two_builds_are_byte_identical_and_match_committed_output(self):
        with tempfile.TemporaryDirectory() as first, tempfile.TemporaryDirectory() as second:
            out_a = pathlib.Path(first) / HIST.name
            out_b = pathlib.Path(second) / HIST.name
            build(out=out_a)
            build(out=out_b)
            self.assertEqual(out_a.read_bytes(), out_b.read_bytes())
            self.assertEqual(out_a.with_name(META.name).read_bytes(), out_b.with_name(META.name).read_bytes())
            if HIST.is_file() and META.is_file():
                self.assertEqual(out_a.read_bytes(), HIST.read_bytes())
                self.assertEqual(out_a.with_name(META.name).read_bytes(), META.read_bytes())


if __name__ == "__main__":
    unittest.main()
