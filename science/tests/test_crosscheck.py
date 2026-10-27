"""Synthetic tests for science/crosscheck.py, each worked on paper."""
import datetime as dt
import math
import unittest

from science import common, crosscheck as xc

UTC = dt.timezone.utc


class RaceTests(unittest.TestCase):
    def test_two_hour_race_rte_064(self):
        # sqrt(0.64) = 0.8: sells 2 x 0.8 = 1.6 MWh, buys 2 / 0.8 = 2.5 MWh.
        p = [0.0] * 24
        p[1] = 10.0   # charge HB 1am
        p[18] = 50.0  # discharge HB 6pm
        self.assertAlmostEqual(xc.race_value(p, [1], [18], rte=0.64), 1.6 * 50 - 2.5 * 10)  # 55

    def test_rte_one_is_plain_spread_times_two(self):
        p = [float(h) for h in range(24)]
        # mean(1,2) = 1.5, mean(18,19) = 18.5: 2 x 17 = 34
        self.assertAlmostEqual(xc.race_value(p, [1, 2], [18, 19], rte=1.0), 34.0)

    def test_default_rte_088(self):
        p = [0.0] * 24
        p[18] = 1.0
        self.assertAlmostEqual(xc.race_value(p, [1], [18]), 2 * math.sqrt(0.88))


class StepTests(unittest.TestCase):
    def test_step_hour_tie_goes_to_earliest(self):
        p = [10.0] * 24
        p[5] = 20.0   # step +10 at h=5, then -10 at h=6
        p[17] = 20.0  # step +10 at h=17 (tie)
        self.assertEqual(xc.step_hour(p), (5, 10.0))

    def test_no_cross_midnight_step(self):
        p = [100.0] + [1.0] * 22 + [2.0]  # h=0 is high; only h=1..23 count
        self.assertEqual(xc.step_hour(p), (23, 1.0))

    def test_three_day_summary(self):
        base = [10.0] * 24
        d1 = list(base); d1[17] = 25.0           # HB 17, step 15
        d2 = list(base); d2[18] = 30.0           # HB 18, step 20
        d3 = list(base); d3[18] = 15.0; d3[6] = 15.0  # tie 5 and 5: HB 6
        days = {dt.date(2026, 10, 1): d1, dt.date(2026, 10, 2): d2, dt.date(2026, 10, 3): d3}
        s = xc.step_summary(days)
        self.assertEqual(s["n_days"], 3)
        self.assertEqual(s["by_hour"], {"6": 1, "17": 1, "18": 1})
        self.assertEqual(s["median_step"], 15.0)
        self.assertEqual(xc.count_in(s, range(17, 19)), 2)


class DecileTests(unittest.TestCase):
    def test_twenty_hours_in_ten_bins(self):
        t0 = dt.datetime(2026, 10, 1, 6, tzinfo=UTC)
        hours = []
        for i in range(20):
            # LMP i (ascending); share 0.5 except the two dearest at 1.0 and two cheapest at 0.0
            share = 0.0 if i < 2 else (1.0 if i >= 18 else 0.5)
            hours.append((t0 + dt.timedelta(hours=i), float(i), share))
        bins = xc.deciles(hours)
        self.assertEqual(len(bins), 10)
        self.assertEqual(bins[0], {"decile": 1, "n": 2, "mean_lmp": 0.5, "mean_share_pct": 0.0})
        self.assertEqual(bins[9], {"decile": 10, "n": 2, "mean_lmp": 18.5, "mean_share_pct": 100.0})

    def test_ties_broken_by_time(self):
        t0 = dt.datetime(2026, 10, 1, 6, tzinfo=UTC)
        hours = [(t0 + dt.timedelta(hours=i), 5.0, float(i % 2)) for i in range(10)]
        bins = xc.deciles(hours)
        self.assertEqual([b["mean_share_pct"] for b in bins], [0.0, 100.0] * 5)

    def test_fossil_share_clamps_negatives(self):
        row = {c: "" for c in xc.FUEL_COLUMNS.values()}
        row[xc.FUEL_COLUMNS["coal"]] = "60"
        row[xc.FUEL_COLUMNS["gas"]] = "20"
        row[xc.FUEL_COLUMNS["solar"]] = "-5"
        row[xc.FUEL_COLUMNS["wind"]] = "20"
        self.assertAlmostEqual(xc.fossil_share(row), 0.8)


class NetLoadAndLaneTests(unittest.TestCase):
    def test_net_load_clamps_solar_only(self):
        self.assertEqual(xc.net_load(5000.0, -3.0, -10.0), 5010.0)
        self.assertEqual(xc.net_load(5000.0, 1200.0, 300.0), 3500.0)

    def test_lanes(self):
        p = [40.0] * 24
        p[15] = 20.0
        p[18] = 60.0
        lanes = xc.lanes(p)
        self.assertEqual(lanes["min"], 20.0)
        self.assertEqual(lanes["range"], 40.0)
        self.assertEqual(lanes["clear_max"], 30.0)
        self.assertEqual(lanes["jam_min"], 50.0)


class EntryTests(unittest.TestCase):
    def test_second_path_never_changes_status(self):
        e = xc.entry("k", "u", 1.0, 2.0, "t", False, "m", [], {"source": "s", "value": 1.0, "passes_tolerance": True})
        self.assertEqual(e["status"], "mismatch")
        self.assertEqual(e["second_path"]["value"], 1.0)

    def test_none_science_is_pending(self):
        self.assertEqual(xc.entry("k", "u", 1.0, None, "t", True, "m", [])["status"], "pending")


class StatusTests(unittest.TestCase):
    def test_rounds_equal(self):
        self.assertTrue(xc.rounds_equal(20.06474, 20.0647, 4))
        self.assertFalse(xc.rounds_equal(20.0648, 20.0647, 4))
        self.assertTrue(xc.rounds_equal(1404.52, 1404.5, 1))


if __name__ == "__main__":
    unittest.main()
