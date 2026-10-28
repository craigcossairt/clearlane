"""Synthetic tests for science/backtest_intervals.py, each worked on paper."""

import contextlib
import io
import json
import pathlib
import random
import tempfile
import unittest

from science import common, backtest_intervals as bi

DAYS_FILE = common.ROOT / "public/derived/backtest_days.json"


def rows_for(values):
    """backtest_days rows from {policy: [values by day]} starting 2026-05-02."""
    import datetime as dt

    out = []
    n = len(next(iter(values.values())))
    for i in range(n):
        d = (dt.date(2026, 5, 2) + dt.timedelta(days=i)).isoformat()
        for pol, vs in values.items():
            out.append(
                {
                    "operating_day_mt": d,
                    "policy": pol,
                    "usd_per_mw_day": vs[i],
                    "beats_fixed_overnight": pol != "fixed_overnight" and vs[i] > values["fixed_overnight"][i],
                }
            )
    return out


class ResampleTests(unittest.TestCase):
    def test_moving_block_indexes(self):
        rng = random.Random(1)
        idx = bi.moving_block_indexes(20, 7, rng)
        self.assertEqual(len(idx), 20)
        # 3 blocks of 7 cut to 20: each block is a run of consecutive days with no wrap
        for b in range(3):
            run = idx[b * 7 : (b + 1) * 7]
            self.assertTrue(0 <= run[0] <= 13)
            self.assertEqual(run, list(range(run[0], run[0] + len(run))))

    def test_stationary_indexes_wrap_and_length(self):
        rng = random.Random(2)
        idx = bi.stationary_indexes(10, 7, rng)
        self.assertEqual(len(idx), 10)
        self.assertTrue(all(0 <= i < 10 for i in idx))

    def test_stationary_mean_block_near_seven(self):
        rng = random.Random(3)
        starts = 0
        total = 0
        for _ in range(400):
            idx = bi.stationary_indexes(179, 7, rng)
            total += len(idx)
            starts += 1 + sum(1 for a, b in zip(idx, idx[1:]) if b != (a + 1) % 179)
        self.assertAlmostEqual(total / starts, 7.0, delta=0.5)

    def test_iid_block_one(self):
        rng = random.Random(4)
        self.assertEqual(len(bi.moving_block_indexes(5, 1, rng)), 5)


class StatTests(unittest.TestCase):
    def test_share_beating_ties_do_not_beat(self):
        self.assertEqual(bi.share_beating([1.0, 2.0, 3.0, 4.0], [1.0, 1.0, 3.0, 5.0]), 25.0)

    def test_interval_percentile_linear(self):
        # 5th and 95th type-7 percentiles of 0..100 are 5 and 95
        self.assertEqual(bi.interval([float(x) for x in range(101)]), [5.0, 95.0])


class BootstrapTests(unittest.TestCase):
    def setUp(self):
        self.const = {"fixed_overnight": [10.0] * 30, "price_only": [40.0] * 30, "clearlane": [30.0] * 30}

    def test_constant_series_gives_zero_width(self):
        series = bi.series_from_rows(rows_for(self.const))
        for method in ("moving_block", "stationary", "iid"):
            r = bi.bootstrap(series, method, b=200, seed=5)
            for pol in bi.POLICIES:
                lo, hi = r["p50"][pol]
                self.assertEqual(lo, hi)
                self.assertEqual(lo, self.const[pol][0])
            self.assertEqual(r["days_beating_fixed_overnight_pct"]["clearlane"], [100.0, 100.0])
            self.assertEqual(r["days_beating_fixed_overnight_pct"]["fixed_overnight"], [0.0, 0.0])

    def test_same_seed_identical_output(self):
        rng = random.Random(9)
        vals = {p: [rng.uniform(-20, 120) for _ in range(40)] for p in bi.POLICIES}
        series = bi.series_from_rows(rows_for(vals))
        r1 = bi.bootstrap(series, "moving_block", b=300, seed=11)
        r2 = bi.bootstrap(series, "moving_block", b=300, seed=11)
        self.assertEqual(json.dumps(r1, sort_keys=True), json.dumps(r2, sort_keys=True))
        r3 = bi.bootstrap(series, "stationary", b=300, seed=11)
        r4 = bi.bootstrap(series, "stationary", b=300, seed=11)
        self.assertEqual(json.dumps(r3, sort_keys=True), json.dumps(r4, sort_keys=True))


class SeriesTests(unittest.TestCase):
    def test_gaps_and_missing_policy_are_listed(self):
        rows = rows_for(
            {"fixed_overnight": [1.0, 2.0, 3.0], "price_only": [4.0, 5.0, 6.0], "clearlane": [2.0, 2.0, 2.0]}
        )
        rows = [r for r in rows if not (r["operating_day_mt"] == "2026-05-03" and r["policy"] == "clearlane")]
        rows = [r for r in rows if r["operating_day_mt"] != "2026-05-04"] + rows_for(
            {"fixed_overnight": [1.0] * 4, "price_only": [1.0] * 4, "clearlane": [1.0] * 4}
        )[-3:]
        s = bi.series_from_rows(rows)
        self.assertEqual(s["incomplete_days"], ["2026-05-03"])
        self.assertEqual(s["gaps"], [["2026-05-02", "2026-05-05"]])
        self.assertEqual(s["days"], ["2026-05-02", "2026-05-05"])

    def test_flag_disagreements_counted(self):
        rows = rows_for({"fixed_overnight": [1.0, 2.0], "price_only": [1.0, 3.0], "clearlane": [0.0, 2.0]})
        rows[2]["beats_fixed_overnight"] = True  # clearlane day 1: 0 > 1 is false, the flag says true
        s = bi.series_from_rows(rows)
        self.assertEqual(s["flag_disagreements"], [{"day": "2026-05-02", "policy": "clearlane"}])


@unittest.skipUnless(DAYS_FILE.exists(), "backtest_days.json not on this branch")
class RerunTests(unittest.TestCase):
    def test_same_seed_identical_bytes(self):
        with tempfile.TemporaryDirectory() as tmp:
            outs = []
            for i in range(2):
                out = pathlib.Path(tmp) / f"run{i}.json"
                with contextlib.redirect_stdout(io.StringIO()):
                    bi.main(["--resamples", "100", "--out", str(out), "--no-md"])
                outs.append(out.read_bytes())
            self.assertEqual(outs[0], outs[1])


if __name__ == "__main__":
    unittest.main()
