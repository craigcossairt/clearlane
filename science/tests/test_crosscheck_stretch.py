"""Synthetic tests for science/crosscheck_stretch.py, each worked on paper."""

import contextlib
import datetime as dt
import io
import math
import pathlib
import tempfile
import unittest

from science import common, crosscheck_stretch as cs

LEDGER = common.ROOT / "public/derived/call_ledger.json"
EIA = common.ROOT / "prep/data/eia_pace_hourly.csv"


class PoissonTests(unittest.TestCase):
    def test_quantiles_of_mean_one(self):
        # P(0) = 0.3679, P(<=1) = 0.7358, P(<=2) = 0.9197, P(<=3) = 0.9810
        self.assertEqual(cs.poisson_quantile(1.0, 0.05), 0)
        self.assertEqual(cs.poisson_quantile(1.0, 0.5), 1)
        self.assertEqual(cs.poisson_quantile(1.0, 0.95), 3)

    def test_zero_mean_and_large_mean(self):
        self.assertEqual(cs.poisson_quantile(0.0, 0.95), 0)
        q = cs.poisson_quantile(900.0, 0.5)  # exp(-900) underflows; log space must not
        self.assertTrue(895 <= q <= 905)


class SameDayTests(unittest.TestCase):
    def test_same_day_probability(self):
        # two weekdays, 2 calls each, N = 4; each weekday has 2 window days
        # c = (2*1 + 2*1) / (4*3) / 2 = 1/6
        self.assertAlmostEqual(cs.same_day_prob([2, 2], [2, 2]), 1 / 6)

    def test_weekday_with_no_days_and_one_call_adds_nothing(self):
        self.assertAlmostEqual(cs.same_day_prob([1, 3], [0, 3]), (3 * 2) / (4 * 3) / 3)


class WindowTests(unittest.TestCase):
    def test_call_energy(self):
        # 250 kW for 330 s with a 19 s ramp: 250 x 320.5 / 3600
        self.assertAlmostEqual(cs.call_energy_kwh(250, 330, 19), 250 * 320.5 / 3600)

    def test_refill_at_full_power(self):
        host = [300.0] * 96
        w = cs.refill_window_s(0, 25.0, host, 800, 250, 0, 330)
        self.assertAlmostEqual(w, 330 + 25.0 / 250 * 3600)

    def test_refill_waits_for_room(self):
        # interval 0 has no room; from 900 s the room is 100 kW
        host = [800.0] + [700.0] * 95
        w = cs.refill_window_s(0, 10.0, host, 800, 250, 0, 330)
        self.assertAlmostEqual(w, 900 + 10.0 / 100 * 3600)

    def test_refill_cut_at_day_end(self):
        host = [800.0] * 96
        self.assertEqual(cs.refill_window_s(86000, 5.0, host, 800, 250, 0, 330), 86400 - 86000)

    def test_pulse_charge_takes_room(self):
        host = [300.0] * 96
        # room = 800 - 300 - 250 = 250, still full power
        self.assertAlmostEqual(cs.refill_window_s(0, 25.0, host, 800, 250, 250, 330), 330 + 360)
        host = [600.0] * 96  # room 800 - 600 - 250 < 0: never refills
        self.assertEqual(cs.refill_window_s(0, 25.0, host, 800, 250, 250, 330), 86400)

    def test_pair_probability_same_hour(self):
        # window 60.5 s from every start: inside when the minutes differ by 0 or 1
        win = [60.5] * 1440
        # minute pairs (a, b) in one hour with |a - b| <= 1: 60 + 2 x 59 = 178 of 3600
        self.assertAlmostEqual(cs.pair_inside_prob(5, 5, win), 178 / 3600)

    def test_pair_probability_adjacent_hours_uses_earlier_window(self):
        win = [0.0] * 1440
        win[5 * 60 + 59] = 61.0  # only a 5:59 start has a window reaching 6:00
        # hours 5 and 6: inside only for (5:59, 6:00) -> 1 of 3600
        self.assertAlmostEqual(cs.pair_inside_prob(5, 6, win), 1 / 3600)
        self.assertAlmostEqual(cs.pair_inside_prob(6, 5, win), 1 / 3600)

    def test_expected_overlaps(self):
        win = [60.5] * 1440
        by_hour = [0] * 24
        by_hour[5] = 2
        # one pair in hour 5, c = 1/2
        self.assertAlmostEqual(cs.expected_overlaps(by_hour, win, 0.5), 0.5 * 178 / 3600)

    def test_recount_consecutive_only(self):
        win = [600.0] * 1440
        starts = {"d1": [0, 300, 1200], "d2": [3600]}
        # d1: 300 is inside 0's window; 1200 - 300 = 900 is not; d2 has one call
        self.assertEqual(cs.recount_inside(starts, win), 1)


class Co2Tests(unittest.TestCase):
    def test_ols(self):
        slope, icept, r2 = cs.ols([0.0, 1.0, 2.0], [1.0, 3.0, 5.0])
        self.assertAlmostEqual(slope, 2.0)
        self.assertAlmostEqual(icept, 1.0)
        self.assertAlmostEqual(r2, 1.0)

    def test_decile_bin_puts_cut_values_up(self):
        cuts = cs.decile_cuts([float(v) for v in range(11)])  # 0..10: cuts at 1..9
        self.assertEqual(cuts, [1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0, 9.0])
        self.assertEqual(cs.load_bin(0.5, cuts), 0)
        self.assertEqual(cs.load_bin(1.0, cuts), 1)
        self.assertEqual(cs.load_bin(10.0, cuts), 9)

    def test_load_binned_cell_weights(self):
        # cell pairs fall 3 in bin 0 and 1 in bin 2; bin slopes 100 and 300
        self.assertAlmostEqual(cs.weighted_cell([0, 0, 0, 2], {0: 100.0, 2: 300.0}), 150.0)

    def test_pairs_seasons_hours_and_skips(self):
        t0 = dt.datetime(2026, 1, 15, 7, tzinfo=dt.timezone.utc)  # 00:00 MST, Jan 15
        rows = []
        for k, (d, f, g, c) in enumerate([(100, 100, 120, 50), (110, 100, 130, 54), (120, 100, 0, 60)]):
            rows.append(
                {"utc": t0 + k * common.HOUR, "demand": d, "fcst": f, "net_gen": g, "co2_t": c, "co2_cons": 1.0}
            )
        rows.append(dict(rows[-1], utc=t0 + 5 * common.HOUR))  # gap: not consecutive
        pairs, skipped = cs.co2_pairs(rows)
        # pair 1 good on both bases; pair 2 fails generated (net gen 0); pair 3 not consecutive
        self.assertEqual(skipped, 2)
        self.assertEqual([(p[0], p[1]) for p in pairs["generated"]], [("DJF", 1)])
        g = pairs["generated"][0]
        self.assertEqual((g[2], g[3], g[4]), (130, 10, 4))
        cons = pairs["consumed"]
        self.assertEqual([(p[0], p[1]) for p in cons], [("DJF", 1), ("DJF", 2)])
        self.assertAlmostEqual(cons[0][4], (110 - 100) * 1000 / cs.LB_PER_T)

    def test_bad_hour_rules(self):
        self.assertTrue(cs.good_hour({"demand": 100, "fcst": 100}))
        self.assertFalse(cs.good_hour({"demand": 0, "fcst": 100}))
        self.assertFalse(cs.good_hour({"demand": 100, "fcst": None}))
        self.assertFalse(cs.good_hour({"demand": 151, "fcst": 100}))
        self.assertTrue(cs.good_hour({"demand": 150, "fcst": 100}))


class ScaleTests(unittest.TestCase):
    def test_leg_volumes(self):
        q = cs.leg_volumes([1, 2, 3, 4], [18, 19])
        self.assertAlmostEqual(q[1], -2 / math.sqrt(0.88) / 4)
        self.assertAlmostEqual(q[18], 2 * math.sqrt(0.88) / 2)
        self.assertEqual(q[0], 0.0)

    def test_reprice(self):
        q = [0.0] * 24
        q[1], q[18] = -1.0, 1.0
        p = [0.0] * 24
        p[1], p[18] = 10.0, 50.0
        s = [0.0] * 24
        s[1], s[18] = 0.1, 0.2
        # price taker: 50 - 10 = 40; at F = 10: (10 + 1) x -1 + (50 - 2) x 1 = 37
        self.assertAlmostEqual(cs.reprice_value(p, q, s, 0), 40.0)
        self.assertAlmostEqual(cs.reprice_value(p, q, s, 10), 37.0)


class SpreadTests(unittest.TestCase):
    def test_bands(self):
        spreads = {"a": 10.0, "b": 15.0, "c": 30.0, "d": 80.0}
        ties = {"a", "c"}
        out = cs.spread_bands(spreads, ties, [(0, 15), (15, 25), (25, 50), (50, None)])
        self.assertEqual([(b["days"], b["rule_ties_or_wins"]) for b in out], [(1, 1), (1, 0), (1, 1), (1, 0)])


class SummaryTests(unittest.TestCase):
    def test_stats(self):
        s = cs.stats([4.0, 1.0, 3.0, 2.0])
        self.assertAlmostEqual(s["p50"], 2.5)
        self.assertAlmostEqual(s["mean"], 2.5)
        self.assertAlmostEqual(s["p10"], 1.3)

    def test_close(self):
        self.assertTrue(cs.close(1.0, 1.0 + 1e-10, 1e-9))
        self.assertFalse(cs.close(1.0, 1.1, 1e-9))
        self.assertFalse(cs.close(None, 1.0, 1e-9))


@unittest.skipUnless(LEDGER.exists() and EIA.exists(), "inputs not on this branch")
class RerunTests(unittest.TestCase):
    def test_same_inputs_identical_bytes(self):
        with tempfile.TemporaryDirectory() as tmp:
            outs = []
            for i in range(2):
                p = pathlib.Path(tmp) / f"run{i}.json"
                with contextlib.redirect_stdout(io.StringIO()):
                    cs.main(["--out", str(p), "--no-md"])
                outs.append(p.read_bytes())
            self.assertEqual(outs[0], outs[1])


if __name__ == "__main__":
    unittest.main()
