"""Offline history shape checks independent of raw OASIS responses."""

import unittest
import csv
import json
import pathlib

from prep.build_hist import _day_record

ROOT = pathlib.Path(__file__).resolve().parents[2]
HIST = ROOT / "public" / "data" / "hist_2026-05-01_2026-10-27.json"
META = ROOT / "public" / "data" / "hist_2026-05-01_2026-10-27.meta.json"


def _research_prices(path: pathlib.Path, start: str, end: str) -> dict[str, float]:
    with path.open(newline="", encoding="utf-8") as stream:
        return {
            row["INTERVALSTARTTIME_GMT"].replace("-00:00", "Z"): float(row["MW"])
            for row in csv.DictReader(stream)
            if row["NODE"] == "ELAP_PACE-APND"
            and row["LMP_TYPE"] == "LMP"
            and start <= row["INTERVALSTARTTIME_GMT"][:10] <= end
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
            "2026-07-01",
            "2026-07-30",
        )
        october = _research_prices(
            ROOT
            / "research"
            / "data"
            / "oasis"
            / "dam_oct"
            / "20260930_20261025_PRC_LMP_DAM_20261026_20_19_45_v12.csv",
            "2026-10-01",
            "2026-10-25",
        )
        self.assertEqual(len(july), 714)
        self.assertEqual(sum(1 for stamp in july if stamp.startswith("2026-07-01")), 18)
        self.assertEqual(len(october), 594)
        self.assertEqual(sum(1 for stamp in october if stamp.startswith("2026-10-01")), 18)

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
        self.assertEqual(labels, sorted(labels))
        self.assertEqual(len(labels) + len(missing), 180)
        self.assertIn("2026-05-01", missing)
        may1 = next(row for row in meta["missing_days"] if row["day"] == "2026-05-01")
        self.assertIn("EDAM began", may1["reason"])
        self.assertFalse(set(labels) & set(missing))
        for day in days:
            self.assertEqual(len(day["lmp_usd_mwh"]), 24)
            self.assertEqual(len(day["co2_g_kwh"]), 24)
            self.assertTrue(all(isinstance(value, (int, float)) for value in day["lmp_usd_mwh"]))
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
            expected = _research_prices(source, first, last)
            for day in days:
                if first <= day["operating_day_mt"] <= last:
                    if day["operating_day_mt"] in ("2026-07-01", "2026-10-01"):
                        # The committed research extracts each have only 18 hours on the first pinned day.
                        continue
                    from prep.mtday import mountain_day_hours

                    stamps = [
                        instant.strftime("%Y-%m-%dT%H:%M:%SZ")
                        for instant in mountain_day_hours(day["operating_day_mt"])
                    ]
                    self.assertEqual(day["lmp_usd_mwh"], [expected[stamp] for stamp in stamps])
        bundle_path = ROOT / "public" / "data" / "bundle_2026-10-27.json"
        if bundle_path.is_file():
            bundle = json.loads(bundle_path.read_text(encoding="utf-8"))
            history_day = indexed["2026-10-27"]
            self.assertEqual(
                [round(x, 2) for x in history_day["lmp_usd_mwh"][1:]], [x["lmp_usd_mwh"] for x in bundle["hours"][1:]]
            )


if __name__ == "__main__":
    unittest.main()
