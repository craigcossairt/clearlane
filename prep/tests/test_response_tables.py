"""Offline tests for the response tables (stretch `response-tables`)."""

import hashlib
import json
import pathlib
import random
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from unittest import mock

from prep import response_tables as rt

ROOT = pathlib.Path(__file__).resolve().parents[2]


def _row(utc, date, hour, demand, fcst, net_gen=8000.0, co2_t=5000.0, cons=1.4):
    return {
        "utc": utc,
        "date": date,
        "hour": hour,
        "demand": demand,
        "fcst": fcst,
        "net_gen": net_gen,
        "co2_t": co2_t,
        "co2_cons_lb_kwh": cons,
    }


class OlsTest(unittest.TestCase):
    def test_ols_recovers_an_exact_slope_and_intercept(self):
        rng = random.Random(1)
        xs = [rng.uniform(-500, 500) for _ in range(200)]
        ys = [0.6123456789 * x - 3.25 for x in xs]
        slope, intercept, r2 = rt.ols(xs, ys)
        self.assertAlmostEqual(slope, 0.6123456789, delta=1e-9)
        self.assertAlmostEqual(intercept, -3.25, delta=1e-9)
        self.assertAlmostEqual(r2, 1.0, delta=1e-9)

    def test_exact_line_gives_a_zero_width_bootstrap_interval(self):
        xs = list(range(-20, 21))
        ys = [-0.75 * x for x in xs]
        result = rt.fit(xs, ys, random.Random(rt.SEED), scale=1000, digits=1)
        self.assertEqual((result["slope"], result["lo"], result["hi"]), (-750.0, -750.0, -750.0))
        self.assertFalse(result["inconclusive"])

    def test_a_flat_relationship_is_flagged_inconclusive_not_dropped(self):
        rng = random.Random(7)
        xs = [rng.uniform(-1, 1) for _ in range(80)]
        ys = [rng.uniform(-1, 1) for _ in range(80)]
        result = rt.fit(xs, ys, random.Random(rt.SEED))
        self.assertTrue(result["inconclusive"])
        self.assertLessEqual(result["lo"], 0)
        self.assertGreaterEqual(result["hi"], 0)
        self.assertEqual(result["n"], 80)

    def test_fixed_seed_gives_identical_bootstrap(self):
        rng = random.Random(3)
        xs = [rng.uniform(0, 10) for _ in range(60)]
        ys = [2 * x + rng.gauss(0, 1) for x in xs]
        a = rt.bootstrap(xs, ys, random.Random(rt.SEED))
        b = rt.bootstrap(xs, ys, random.Random(rt.SEED))
        self.assertEqual(a, b)


class BadHourTest(unittest.TestCase):
    def test_each_rule_catches_its_case(self):
        self.assertEqual(rt.bad_reason(_row("", "", 0, None, 6000)), rt.BAD_RULES[0])
        self.assertEqual(rt.bad_reason(_row("", "", 0, 0, 6000)), rt.BAD_RULES[0])
        self.assertEqual(rt.bad_reason(_row("", "", 0, 5898, 0)), rt.BAD_RULES[1])
        self.assertEqual(rt.bad_reason(_row("", "", 0, 1137, 6048)), rt.BAD_RULES[2])
        self.assertIsNone(rt.bad_reason(_row("", "", 0, 6000, 6048)))
        self.assertIsNone(rt.bad_reason(_row("", "", 0, 3000, 6000)))
        self.assertIsNone(rt.bad_reason(_row("", "", 0, 9000, 6000)))
        self.assertEqual(rt.bad_reason(_row("", "", 0, 2999, 6000)), rt.BAD_RULES[2])
        self.assertEqual(rt.bad_reason(_row("", "", 0, 9001, 6000)), rt.BAD_RULES[2])

    def test_edam_is_requested_one_trading_day_per_call_across_the_window(self):
        days = rt._edam_days()
        self.assertEqual((days[0], days[-1], len(days)), ("2026-05-01", "2026-10-28", 181))

    def test_jan_8_2026_is_caught_in_the_real_extract(self):
        rows = rt.read_eia()
        jan8 = [r for r in rows if r["date"] == "2026-01-08" and rt.bad_reason(r)]
        self.assertTrue(any(r["demand"] == 1137 for r in jan8), [(r["hour"], r["demand"], r["fcst"]) for r in jan8])

    def test_mountain_hours_follow_the_clock_across_both_dst_changes(self):
        self.assertEqual(rt.mountain("2025-11-02T07:00:00Z").hour, 1)  # first 1am, MDT
        self.assertEqual(rt.mountain("2025-11-02T08:00:00Z").hour, 1)  # repeated 1am, MST
        self.assertEqual(rt.mountain("2025-11-03T06:00:00Z").strftime("%Y-%m-%d %H"), "2025-11-02 23")
        self.assertEqual(rt.mountain("2026-03-08T08:00:00Z").hour, 1)
        self.assertEqual(rt.mountain("2026-03-08T09:00:00Z").hour, 3)  # 2am never happens
        self.assertEqual(rt.mountain("2026-10-27T06:00:00Z").strftime("%Y-%m-%d %H"), "2026-10-27 00")
        self.assertEqual(max(r["hour"] for r in rt.read_eia()), 23)

    def test_a_planted_bad_hour_is_excluded_and_listed(self):
        rows = [_row(f"2026-05-01T{6 + h:02d}:00:00Z", "2026-05-01", h, 6000 + h, 6100) for h in range(24)]
        rows[13]["demand"] = 1137
        table = rt.forecast_residuals(rows)
        day = table["days"][0]["residual_mw"]
        self.assertIsNone(day[13])
        self.assertEqual(day[12], 6100 - 6012)
        self.assertEqual(
            [(b["hour_mt"], b["rule"], b["in_window"]) for b in table["bad_hours"]], [(13, rt.BAD_RULES[2], True)]
        )
        self.assertEqual(table["complete_days"], 0)


class TableTest(unittest.TestCase):
    def test_marginal_co2_recovers_a_planted_factor_per_bin(self):
        rows = []
        net, co2 = 8000.0, 5000.0
        rng = random.Random(5)
        t0 = datetime(2026, 7, 1, 6, tzinfo=timezone.utc)  # Mountain midnight, MDT
        for i in range(24 * 30):
            day, hour = divmod(i, 24)
            step = rng.uniform(-300, 300)
            net += step
            co2 += 0.45 * step  # 0.45 t/MWh = 450 g/kWh
            utc = (t0 + timedelta(hours=i)).strftime("%Y-%m-%dT%H:%M:%SZ")
            rows.append(_row(utc, f"2026-07-{1 + day:02d}", hour, 6000.0, 6000.0, net, co2))
        table = rt.marginal_co2(rows, random.Random(rt.SEED))
        generated = [b for b in table["bins"] if b["basis"] == "generated"]
        self.assertEqual(len(generated), 24)
        for b in generated:
            self.assertEqual((b["season"], b["slope"], b["lo"], b["hi"]), ("JJA", 450.0, 450.0, 450.0))

    def test_price_response_bins_by_mountain_hour(self):
        prices, net = {}, {}
        for d in range(20):
            for h in range(24):
                stamp = (
                    f"2026-06-{1 + d:02d}T{(h + 6) % 24:02d}:00:00Z"
                    if h < 18
                    else f"2026-06-{2 + d:02d}T{(h + 6) % 24:02d}:00:00Z"
                )
                load = 5000 + 37 * d + h
                net[stamp] = load
                prices[stamp] = 0.02 * load + h
        table = rt.price_response(prices, net, random.Random(rt.SEED), "test")
        self.assertEqual([b["hour_mt"] for b in table["bins"]], list(range(24)))
        for b in table["bins"]:
            self.assertAlmostEqual(b["slope"], 0.02, places=9)
            self.assertEqual(b["n"], 20)
            self.assertEqual(b["slope_usd_mwh_per_100mw"], 2.0)


class BuildTest(unittest.TestCase):
    def test_build_is_byte_identical_and_labeled(self):
        with tempfile.TemporaryDirectory() as tmp:
            a, b = pathlib.Path(tmp) / "a.json", pathlib.Path(tmp) / "b.json"
            with mock.patch.object(rt, "RESAMPLES", 50):
                rt.build(a, offline_net_load=True)
                rt.build(b, offline_net_load=True)
            self.assertEqual(hashlib.sha256(a.read_bytes()).hexdigest(), hashlib.sha256(b.read_bytes()).hexdigest())
            doc = json.loads(a.read_text(encoding="utf-8"))
        self.assertEqual(doc["prov"], "DERIVED")
        for name, table in doc["tables"].items():
            self.assertEqual(table["prov"], "DERIVED", name)
            self.assertTrue(table["sources"], name)
            self.assertTrue(table["caveats"], name)
        self.assertEqual(len(doc["tables"]["price_response"]["bins"]), 24)
        self.assertIn("EIA-930", doc["tables"]["price_response"]["net_load_basis"])

    def test_committed_file_has_every_bin_and_honest_flags(self):
        path = ROOT / "public" / "data" / "response_tables.json"
        if not path.is_file():
            self.skipTest("response_tables.json not built")
        doc = json.loads(path.read_text(encoding="utf-8"))
        bins = doc["tables"]["marginal_co2"]["bins"]
        self.assertEqual(len(bins), 2 * 4 * 24)
        for b in bins + doc["tables"]["price_response"]["bins"]:
            if b["slope"] is not None:
                self.assertEqual(b["inconclusive"], b["lo"] <= 0 <= b["hi"], b)
        days = doc["tables"]["forecast_residuals"]["days"]
        self.assertEqual(days[0]["local_date"], "2026-05-01")
        self.assertTrue(all(len(d["residual_mw"]) == 24 for d in days))
        # Science #112: a second estimator disagrees, so the table must say a single hour is not precise.
        self.assertEqual(doc["tables"]["marginal_co2"]["caveats"], rt.CAVEATS["marginal_co2"])
        self.assertTrue(any("depend on the estimator" in c for c in rt.CAVEATS["marginal_co2"]))


if __name__ == "__main__":
    unittest.main()
