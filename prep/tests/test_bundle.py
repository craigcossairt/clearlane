"""Offline contract checks for the Oct 27 real bundle builder."""

import json
import pathlib
import unittest
import csv
import math

from prep.build_bundle import _round2, _co2_profile
from prep.validate import validate_all
from prep.mtday import local_mt

ROOT = pathlib.Path(__file__).resolve().parents[2]
BUNDLE = ROOT / "public" / "data" / "bundle_2026-10-27.json"


class BundleBuildTest(unittest.TestCase):
    def test_rounding_is_to_cents(self):
        self.assertEqual(_round2(30.21857), 30.22)
        self.assertEqual(_round2(-0.714), -0.71)

    def test_co2_profile_uses_same_utc_hour_and_integer_rounding(self):
        rows = [
            {"utc_start": "2026-10-01T06:00:00Z", "local_date": "2026-10-01", "co2_gen_lb_kwh": "1.0"},
            {"utc_start": "2026-10-02T06:00:00Z", "local_date": "2026-10-02", "co2_gen_lb_kwh": "1.2"},
            {"utc_start": "2026-09-01T06:00:00Z", "local_date": "2026-09-01", "co2_gen_lb_kwh": "5.0"},
        ]
        self.assertEqual(_co2_profile(rows, "2026-10-03T06:00:00Z", "2026-10-01", "2026-10-02"), (499, 2))

    def test_generic_validator_scans_every_committed_bundle(self):
        paths = validate_all(ROOT / "public" / "data")
        for path in paths:
            with self.subTest(path=path.name):
                json.loads(path.read_text(encoding="utf-8"))

    @unittest.skipUnless(BUNDLE.is_file(), "real bundle awaits OASIS cache")
    def test_committed_bundle_pins_hours_and_provenance(self):
        bundle = json.loads(BUNDLE.read_text(encoding="utf-8"))
        with (ROOT / "research" / "data" / "pace_snapshot_2026-10-27.csv").open(newline="", encoding="utf-8") as stream:
            snapshot = list(csv.DictReader(stream))
        self.assertEqual(bundle["schema"], "clearlane.bundle/v1")
        self.assertEqual(bundle["operating_day_mt"], "2026-10-27")
        self.assertEqual(len(bundle["hours"]), 24)
        hour0 = bundle["hours"][0]
        self.assertEqual((hour0["lmp_usd_mwh"], hour0["mcc_usd_mwh"]), (30.22, -0.71))
        self.assertTrue(any("2026-10-26" in note for note in bundle["notes"]))
        peer_fields = ("da_lmp_elap_pacw", "da_lmp_elap_pge", "da_lmp_th_sp15_gen")
        for hour, expected in zip(bundle["hours"][1:], snapshot[:23], strict=True):
            for field, key in (
                ("lmp_usd_mwh", "da_lmp_elap_pace"),
                ("mcc_usd_mwh", "da_congestion_pace"),
                ("load_fcst_mw", "da_load_fcst_pace_mw"),
                ("solar_fcst_mw", "edam_solar_fcst_pace_mw"),
                ("wind_fcst_mw", "edam_wind_fcst_pace_mw"),
            ):
                self.assertEqual(hour[field], round(float(expected[key]), 2))
            for peer, key in zip(bundle["peers"], peer_fields, strict=True):
                self.assertEqual(peer["lmp_usd_mwh"][hour["hour_mt"]], round(float(expected[key]), 2))
        for hour in bundle["hours"]:
            self.assertEqual(len(hour["prov"]), 5)
            self.assertEqual(hour["co2_kind"] == "eia_observed_avg", hour["prov"]["co2"] == "REAL")
            self.assertEqual(
                hour["net_load_mw"], round(hour["load_fcst_mw"] - hour["solar_fcst_mw"] - hour["wind_fcst_mw"], 2)
            )
            self.assertEqual(hour["local_mt"], local_mt(hour["ts_utc"]))
            for value in hour.values():
                if isinstance(value, (int, float)):
                    self.assertTrue(math.isfinite(value))
            self.assertNotIn("—", json.dumps(hour, ensure_ascii=False))


if __name__ == "__main__":
    unittest.main()
