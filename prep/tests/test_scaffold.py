"""Scaffold smoke tests: the research snapshot and the fixture bundle carry the pinned Oct 27 prices."""

import csv
import json
import pathlib
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[2]
SNAPSHOT = ROOT / "research" / "data" / "pace_snapshot_2026-10-27.csv"
FIXTURE = ROOT / "contracts" / "fixtures" / "bundle_2026-10-27.json"


class SnapshotTest(unittest.TestCase):
    def test_snapshot_has_24_hours_starting_0700z(self):
        with SNAPSHOT.open(newline="", encoding="utf-8") as f:
            rows = list(csv.DictReader(f))
        self.assertEqual(len(rows), 24)
        self.assertEqual(rows[0]["interval_start_utc"], "2026-10-27T07:00:00+00:00")
        self.assertEqual(float(rows[14]["da_lmp_elap_pace"]), 21.38)  # hour beginning 3pm MT
        self.assertEqual(float(rows[17]["da_lmp_elap_pace"]), 55.78)  # hour beginning 6pm MT


class FixtureTest(unittest.TestCase):
    def test_fixture_is_24_mountain_hours_with_the_pinned_prices(self):
        b = json.loads(FIXTURE.read_text(encoding="utf-8"))
        self.assertEqual(b["schema"], "clearlane.bundle/v1")
        self.assertEqual([h["hour_mt"] for h in b["hours"]], list(range(24)))
        self.assertEqual(b["hours"][0]["ts_utc"], "2026-10-27T06:00:00Z")
        self.assertEqual(b["hours"][15]["lmp_usd_mwh"], 21.38)
        self.assertEqual(b["hours"][18]["lmp_usd_mwh"], 55.78)
        self.assertTrue(all(h["solar_fcst_mw"] >= 0 for h in b["hours"]))
        self.assertTrue(all(len(p["lmp_usd_mwh"]) == 24 for p in b["peers"]))


if __name__ == "__main__":
    unittest.main()
