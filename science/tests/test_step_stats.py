"""Synthetic tests for science/step_stats.py, each worked on paper."""

import contextlib
import datetime as dt
import io
import json
import pathlib
import tempfile
import unittest
from fractions import Fraction

from science import common, step_stats as ss

HIST = common.ROOT / "public/data/hist_2026-05-01_2026-10-27.json"


def flat_day(step_at, size=10.0):
    """24 prices at 20 with one rise of `size` at hour beginning step_at, falling back after it."""
    p = [20.0] * 24
    p[step_at] = 20.0 + size
    return p


class BinomialTests(unittest.TestCase):
    def test_hand_computed_tail(self):
        # n = 5, p = 1/3, k = 4: C(5,4) (1/3)^4 (2/3) + (1/3)^5 = 10/243 + 1/243 = 11/243
        self.assertEqual(ss.binom_upper_tail(5, 4, Fraction(1, 3)), Fraction(11, 243))

    def test_fair_coin(self):
        # n = 3, p = 1/2, k = 2: 3/8 + 1/8
        self.assertEqual(ss.binom_upper_tail(3, 2, Fraction(1, 2)), Fraction(1, 2))

    def test_all_hits_and_zero_hits(self):
        p0 = Fraction(2, 23)
        self.assertEqual(ss.binom_upper_tail(4, 4, p0), p0**4)
        self.assertEqual(ss.binom_upper_tail(4, 0, p0), 1)

    def test_binomial_record(self):
        hours = [17, 18, 18, 5]
        r = ss.binomial_test(hours, ss.TARGET)
        self.assertEqual((r["n"], r["k"]), (4, 3))
        self.assertEqual(r["p0"], "2/23")
        self.assertAlmostEqual(r["expected"], 8 / 23)
        self.assertAlmostEqual(r["p_value"], float(ss.binom_upper_tail(4, 3, Fraction(2, 23))))


class TvdTests(unittest.TestCase):
    def test_disjoint_is_one_identical_is_zero(self):
        self.assertEqual(ss.tvd([17, 17], [18, 18]), 1.0)
        self.assertEqual(ss.tvd([3, 17, 18], [17, 18, 3]), 0.0)

    def test_half_overlap(self):
        # f_a = {17: 1/2, 18: 1/2}, f_b = {17: 1}: 1/2 (|1/2 - 1| + 1/2) = 1/2
        self.assertEqual(ss.tvd([17, 18], [17, 17, 17]), 0.5)


class PermutationTests(unittest.TestCase):
    def test_identical_samples_give_p_one(self):
        a = [17, 18, 18, 5, 13]
        r = ss.permutation_test(a, list(a), b_perms=500, seed=1)
        self.assertEqual(r["observed"]["tvd"], 0.0)
        self.assertEqual(r["tvd"]["p_value"], 1.0)

    def test_disjoint_samples_give_small_p(self):
        r = ss.permutation_test([17] * 20, [5] * 20, b_perms=2000, seed=1)
        self.assertEqual(r["observed"]["tvd"], 1.0)
        self.assertLess(r["tvd"]["p_value"], 0.01)
        self.assertEqual(r["observed"]["share_17_18_diff"], 1.0)

    def test_same_seed_same_output(self):
        a, b = [17, 18, 18, 14, 19], [13, 14, 18, 19, 20, 6]
        r1 = ss.permutation_test(a, b, b_perms=300, seed=7)
        r2 = ss.permutation_test(a, b, b_perms=300, seed=7)
        self.assertEqual(json.dumps(r1, sort_keys=True), json.dumps(r2, sort_keys=True))
        self.assertEqual((r1["seed"], r1["b_perms"]), (7, 300))

    def test_add_one_estimate(self):
        r = ss.permutation_test([17] * 3, [17] * 3, b_perms=9, seed=3)
        self.assertEqual(r["tvd"]["n_ge"], 9)
        self.assertEqual(r["tvd"]["p_value"], 1.0)  # (1 + 9) / (1 + 9)


class DayTests(unittest.TestCase):
    def test_skips_short_and_absent_days(self):
        rows = [
            {"operating_day_mt": "2026-05-02", "lmp_usd_mwh": flat_day(17)},
            {"operating_day_mt": "2026-05-03", "lmp_usd_mwh": flat_day(18)[:23]},
        ]
        days, skipped = ss.days_from_rows(rows, dt.date(2026, 5, 1), dt.date(2026, 5, 3))
        self.assertEqual(list(days), [dt.date(2026, 5, 2)])
        self.assertEqual(skipped, [{"day": "2026-05-01", "prices": 0}, {"day": "2026-05-03", "prices": 23}])

    def test_step_hours_and_months(self):
        days = {
            dt.date(2026, 7, 1): flat_day(17, 5.0),
            dt.date(2026, 7, 2): flat_day(18, 7.0),
            dt.date(2026, 7, 3): flat_day(17, 9.0),
            dt.date(2026, 8, 1): flat_day(6, 1.0),
            dt.date(2026, 8, 2): flat_day(20, 3.0),
        }
        per_day = ss.per_day_steps(days)
        self.assertEqual(per_day["2026-07-02"], {"hb": 18, "step": 7.0})
        lines = ss.month_lines(per_day)
        self.assertEqual(
            lines["2026-07"],
            {
                "days": 3,
                "modal_hb": [17],
                "count_at_mode": 2,
                "median_step": 7.0,
                "first_day": "2026-07-01",
                "last_day": "2026-07-03",
            },
        )
        self.assertEqual(lines["2026-08"]["modal_hb"], [6, 20])  # a tie lists both
        self.assertEqual(lines["2026-08"]["median_step"], 2.0)


class FormatTests(unittest.TestCase):
    def test_p_value_format(self):
        self.assertEqual(ss._p(0.012776), "0.0128")
        self.assertEqual(ss._p(1 / 100001), "0.00001")
        self.assertEqual(ss._p(7.87e-23), "7.87e-23")

    def test_hour_labels(self):
        self.assertEqual([ss.hb_label(h) for h in (0, 12, 17, 23)], ["HB 12am", "HB 12pm", "HB 5pm", "HB 11pm"])


@unittest.skipUnless(HIST.exists(), "hist file not on this branch")
class RerunTests(unittest.TestCase):
    def test_same_seed_identical_bytes(self):
        with tempfile.TemporaryDirectory() as tmp:
            outs = []
            for i in range(2):
                out = pathlib.Path(tmp) / f"run{i}.json"
                with contextlib.redirect_stdout(io.StringIO()):
                    ss.main(["--perms", "200", "--out", str(out), "--no-md"])
                outs.append(out.read_bytes())
            self.assertEqual(outs[0], outs[1])


if __name__ == "__main__":
    unittest.main()
