"""Synthetic tests for science/chart_backtest.py (issue #106)."""
import json
import pathlib
import subprocess
import sys
import tempfile
import unittest
import xml.etree.ElementTree as ET

from science import chart_backtest as cb
from science import common

NS = "{http://www.w3.org/2000/svg}"
REAL = common.ROOT / "public" / "derived" / "backtest.json"


def pctl(p10, p50, p90, mean):
    return {"p10": p10, "p50": p50, "p90": p90, "mean": mean}


def policy(name, usd):
    return {"policy": name, "usd_per_mw_day": usd, "co2_t_per_mw_day": pctl(0, 0, 0, 0),
            "pulse_cycles_per_yr": 0, "host_ceiling_breaches": 0,
            "calls_unanswerable_pct": {"heatmap_as_mt": 0, "heatmap_as_utc": 0, "heatmap_as_utc_mst": 0},
            "days_beating_fixed_overnight_pct": 0}


def synthetic():
    return {
        "schema": "clearlane.backtest/v1",
        "window": {"start_mt": "2026-05-01", "end_mt": "2026-05-10", "days": 9,
                   "missing_days": ["2026-05-01"]},
        "wear_usd_mwh": 1.0, "seed": 1,
        "policies": [
            policy("clearlane", pctl(5.0, 30.126, 90.0, 35.5)),
            policy("fixed_overnight", pctl(-10.0, 4.5, 40.0, 9.25)),
            policy("price_only", pctl(10.0, 33.0, 100.0, 40.0)),
        ],
    }


INPUT = {"path": "public/derived/backtest.json", "sha256": "0" * 64}


def texts(svg):
    root = ET.fromstring(svg)
    return root, [t for t in root.iter(NS + "text")]


class BuildTests(unittest.TestCase):
    def setUp(self):
        self.data, self.svgs = cb.build(synthetic(), INPUT)

    def test_rows_are_in_policy_order_with_values_from_the_file(self):
        rows = self.data["policies"]
        self.assertEqual([r["policy"] for r in rows], ["fixed_overnight", "price_only", "clearlane"])
        self.assertEqual(rows[2]["usd_per_mw_day"], pctl(5.0, 30.126, 90.0, 35.5))
        self.assertEqual(self.data["window"]["missing_days"], ["2026-05-01"])
        self.assertEqual(self.data["input"], INPUT)
        self.assertEqual(self.data["unit"], "$/MW-day")

    def test_svgs_parse_floor_and_frame(self):
        for theme in ("dark", "light"):
            root, ts = texts(self.svgs[theme])
            self.assertEqual(root.get("viewBox"), "0 0 1920 1080")
            self.assertIsNotNone(root.find(NS + "title"))
            self.assertIsNotNone(root.find(NS + "desc"))
            self.assertTrue(all(float(t.get("font-size")) >= 24 for t in ts))
            self.assertNotIn("—", self.svgs[theme])
            self.assertNotIn("–", self.svgs[theme])

    def test_policy_names_caption_window_and_footer_in_text(self):
        _, ts = texts(self.svgs["light"])
        joined = " | ".join(t.text or "" for t in ts)
        for name in ("fixed_overnight", "price_only", "clearlane"):
            self.assertIn(name, joined)
        self.assertIn("Value to RMP's system at day-ahead prices.", joined)
        self.assertIn("The fixed overnight rule is our comparison rule, not Torus practice.", joined)
        self.assertIn("May 1 to May 10 2026", joined)
        self.assertIn("9 days", joined)
        self.assertIn("missing: 2026-05-01", joined)
        self.assertIn("public/derived/backtest.json", joined)
        self.assertIn("DERIVED", joined)
        self.assertIn("science/chart_backtest.py", joined)

    def test_p50_values_printed_at_40px(self):
        _, ts = texts(self.svgs["dark"])
        by_text = {t.text: float(t.get("font-size")) for t in ts}
        for label in ("P50 $4.50", "P50 $33.00", "P50 $30.13"):
            self.assertIn(label, by_text)
            self.assertGreaterEqual(by_text[label], 40)

    def test_bar_tick_and_dot_land_on_the_values(self):
        x = cb.x_scale(self.data)
        root, _ = texts(self.svgs["light"])
        bars = [r for r in root.iter(NS + "rect") if r.get("data-role") == "p10-p90"]
        self.assertEqual(len(bars), 3)
        b = bars[2]  # clearlane, third row
        self.assertAlmostEqual(float(b.get("x")), x(5.0), places=1)
        self.assertAlmostEqual(float(b.get("x")) + float(b.get("width")), x(90.0), places=1)
        ticks = [ln for ln in root.iter(NS + "line") if ln.get("data-role") == "p50"]
        self.assertAlmostEqual(float(ticks[0].get("x1")), x(4.5), places=1)
        dots = [c for c in root.iter(NS + "circle") if c.get("data-role") == "mean"]
        self.assertAlmostEqual(float(dots[1].get("cx")), x(40.0), places=1)

    def test_domain_covers_every_value_and_zero(self):
        lo, hi = self.data["axis"]["min"], self.data["axis"]["max"]
        self.assertLessEqual(lo, -10.0)
        self.assertGreaterEqual(hi, 100.0)
        self.assertLessEqual(lo, 0)

    def test_deterministic(self):
        d2, s2 = cb.build(synthetic(), INPUT)
        self.assertEqual(s2, self.svgs)
        self.assertEqual(json.dumps(d2, sort_keys=True), json.dumps(self.data, sort_keys=True))


class ValidationTests(unittest.TestCase):
    def test_wrong_schema_is_refused(self):
        bad = synthetic()
        bad["schema"] = "clearlane.backtest/v0"
        with self.assertRaises(ValueError):
            cb.build(bad, INPUT)

    def test_missing_policy_is_refused(self):
        bad = synthetic()
        bad["policies"] = bad["policies"][:2]
        with self.assertRaises(ValueError):
            cb.build(bad, INPUT)

    def test_unordered_percentiles_are_refused(self):
        bad = synthetic()
        bad["policies"][0]["usd_per_mw_day"] = pctl(50.0, 30.0, 90.0, 35.0)
        with self.assertRaises(ValueError):
            cb.build(bad, INPUT)

    def test_absent_input_exits_nonzero_with_message(self):
        with tempfile.TemporaryDirectory() as d:
            missing = pathlib.Path(d) / "backtest.json"
            r = subprocess.run([sys.executable, "-I", str(common.ROOT / "science" / "chart_backtest.py"),
                                "--input", str(missing), "--out", str(pathlib.Path(d) / "out")],
                               capture_output=True, text=True)
        self.assertNotEqual(r.returncode, 0)
        self.assertIn("backtest.json not found", r.stderr)


@unittest.skipUnless(REAL.exists(), "public/derived/backtest.json not on this checkout")
class RealDataTests(unittest.TestCase):
    def test_committed_chart_json_matches_the_real_input(self):
        committed = common.ROOT / "science" / "charts" / "backtest_spread.json"
        self.assertTrue(committed.exists())
        data = json.loads(committed.read_text(encoding="utf-8"))
        self.assertEqual(data["input"]["sha256"], common.sha256(REAL))
        real = json.loads(REAL.read_text(encoding="utf-8"))
        want = {p["policy"]: p["usd_per_mw_day"] for p in real["policies"]}
        got = {p["policy"]: p["usd_per_mw_day"] for p in data["policies"]}
        self.assertEqual(got, want)
        self.assertEqual(data["window"], real["window"])


if __name__ == "__main__":
    unittest.main()
