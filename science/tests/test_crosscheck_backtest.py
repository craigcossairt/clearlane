"""Synthetic tests for the #107 backtest and history checks in science/crosscheck.py."""
import datetime as dt
import math
import unittest

from science import crosscheck as xc

TEN = [1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0, 9.0, 10.0]


class PercentileTests(unittest.TestCase):
    def test_linear_type7_on_ten_values(self):
        got = [xc.pctl_linear(TEN, q) for q in (0.1, 0.5, 0.9)]
        for g, w in zip(got, [1.9, 5.5, 9.1]):
            self.assertAlmostEqual(g, w, places=12)

    def test_nearest_rank_on_ten_values(self):
        self.assertEqual([xc.pctl_nearest(TEN, q) for q in (0.1, 0.5, 0.9)], [1.0, 5.0, 9.0])

    def test_order_does_not_matter(self):
        self.assertEqual(xc.pctl_linear(list(reversed(TEN)), 0.5), 5.5)

    def test_summary_has_both_methods_and_mean(self):
        s = xc.summarize(TEN)
        self.assertAlmostEqual(s["linear"]["p50"], 5.5)
        self.assertEqual(s["nearest_rank"]["p90"], 9.0)
        self.assertAlmostEqual(s["mean"], 5.5)
        self.assertEqual(s["n"], 10)


class DominanceTests(unittest.TestCase):
    def stats(self, clearlane, price_only):
        return {"clearlane": dict(zip(("p10", "p50", "p90"), clearlane)),
                "price_only": dict(zip(("p10", "p50", "p90"), price_only))}

    def test_clean_order_passes(self):
        self.assertEqual(xc.dominance_violations(self.stats((1, 5, 9), (2, 5, 10))), [])

    def test_planted_violation_is_flagged(self):
        v = xc.dominance_violations(self.stats((1, 6, 9), (2, 5, 10)))
        self.assertEqual(v, ["p50: clearlane 6 > price_only 5"])


class FixedOvernightTests(unittest.TestCase):
    def test_rule_is_the_reference_race(self):
        p = [0.0] * 24
        for h in (1, 2, 3, 4):
            p[h] = 20.0
        p[18] = p[19] = 60.0
        leg = math.sqrt(0.88)
        self.assertAlmostEqual(xc.fixed_overnight_day(p), 2 * leg * 60 - 2 / leg * 20, places=12)

    def test_other_hours_do_not_count(self):
        p = [5.0] * 24
        q = list(p)
        q[0], q[12], q[23] = 900.0, -900.0, 900.0
        self.assertEqual(xc.fixed_overnight_day(p), xc.fixed_overnight_day(q))


class WindowTests(unittest.TestCase):
    def test_missing_days_are_those_without_24_prices(self):
        raw = {dt.date(2026, 5, 1): 23, dt.date(2026, 5, 2): 24, dt.date(2026, 5, 3): 24}
        hist_days = ["2026-05-02", "2026-05-03"]
        w = xc.window_check(hist_days, raw, dt.date(2026, 5, 1), dt.date(2026, 5, 3))
        self.assertEqual(w["days"], 2)
        self.assertEqual(w["missing_days"], ["2026-05-01"])
        self.assertEqual(w["raw_hours_on_missing"], {"2026-05-01": 23})

    def test_a_day_absent_everywhere_is_missing(self):
        w = xc.window_check(["2026-05-02"], {dt.date(2026, 5, 2): 24}, dt.date(2026, 5, 1),
                            dt.date(2026, 5, 2))
        self.assertEqual(w["missing_days"], ["2026-05-01"])
        self.assertEqual(w["raw_hours_on_missing"], {"2026-05-01": 0})


class HistVsRawTests(unittest.TestCase):
    def test_exact_match_and_a_planted_miss(self):
        day = dt.date(2026, 7, 1)
        raw = {day: [float(h) for h in range(24)]}
        hist = {day.isoformat(): [float(h) for h in range(24)]}
        r = xc.compare_hist_raw(hist, raw, day, day)
        self.assertEqual((r["hours"], r["max_abs_diff"], r["days_absent"]), (24, 0.0, []))
        hist[day.isoformat()][5] += 0.00002
        r = xc.compare_hist_raw(hist, raw, day, day)
        self.assertAlmostEqual(r["max_abs_diff"], 0.00002, places=9)
        self.assertEqual(r["worst"], {"day": "2026-07-01", "hb": 5})

    def test_day_absent_from_hist_is_listed(self):
        day = dt.date(2026, 7, 1)
        r = xc.compare_hist_raw({}, {day: [0.0] * 24}, day, day)
        self.assertEqual(r["days_absent"], ["2026-07-01"])
        self.assertEqual(r["hours"], 0)


class BeatingTests(unittest.TestCase):
    def test_strict_greater_than_ties_do_not_beat(self):
        fixed = {"a": 1.0, "b": 2.0, "c": 3.0, "d": 4.0}
        clear = {"a": 2.0, "b": 2.0, "c": 2.0, "d": 5.0}
        self.assertAlmostEqual(xc.share_beating(clear, fixed), 50.0)


class CycleTests(unittest.TestCase):
    def test_cycles_per_year_is_the_daily_mean_times_365(self):
        self.assertAlmostEqual(xc.cycles_per_year([1.0, 1.0, 1.0]), 365.0)
        self.assertAlmostEqual(xc.cycles_per_year([0.5, 1.5]), 365.0)
        self.assertAlmostEqual(xc.cycles_per_year([0.0, 1.0, 2.0, 1.0]), 365.0)

    def test_fixed_overnight_is_one_cycle_a_day_on_stored_energy(self):
        # the pre-#213 grid-side count would give sqrt(0.88) = 0.938 here
        self.assertAlmostEqual(xc.fixed_overnight_cycles(500.0, 0.88), 1.0, places=12)
        self.assertAlmostEqual(xc.cycles_per_year([xc.fixed_overnight_cycles(500.0, 0.88)] * 179), 365.0, places=9)

    def test_current_facts_pins(self):
        self.assertEqual((xc.FACTS_CLEARLANE_P10, xc.FACTS_CLEARLANE_P50, xc.FACTS_CLEARLANE_P90), (1.28, 38.69, 116.00))
        self.assertEqual(xc.FACTS_SHARE_BEATING_PCT, 91)
        self.assertEqual((xc.FACTS_CYCLES_FIXED, xc.FACTS_CYCLES_PRICE_ONLY), (365, 625))


if __name__ == "__main__":
    unittest.main()
