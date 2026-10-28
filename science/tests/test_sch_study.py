"""Synthetic tests for science/sch_study.py, each worked on paper."""

import contextlib
import datetime as dt
import io
import pathlib
import tempfile
import unittest
import xml.etree.ElementTree as ET

from science import common, sch_study as sch

EIA = common.ROOT / "research/data/eia930/PACE_EIA930_BALANCE_2026_Jul_Dec.csv"
HIST = common.ROOT / "public/data/hist_2026-05-01_2026-10-27.json"


class RuleTests(unittest.TestCase):
    def test_top_k_ties_to_earlier_and_flags_boundary_tie(self):
        self.assertEqual(sch.top_k([1, 5, 5, 3], 1), ([1], True))
        self.assertEqual(sch.top_k([1, 5, 5, 3], 2), ([1, 2], False))
        self.assertEqual(sch.top_k([4, 3, 2, 1], 2), ([0, 1], False))

    def test_jam_hours_25_percent_of_range(self):
        # min 0, max 100, range 100: jam at or over 75
        self.assertEqual(sch.jam_hours([0.0, 100.0, 80.0, 75.0, 74.0]), [1, 2, 3])

    def test_ours_is_top4_net_load_plus_jam(self):
        net = [float(24 - h) for h in range(24)]  # hours 0..3 are the 4 highest
        p = [10.0] * 24
        p[20] = 50.0  # min 10, max 50: jam at or over 40
        r = sch.rule_ours(net, p)
        self.assertEqual(r["hours"], [0, 1, 2, 3, 20])
        self.assertEqual((r["top4"], r["jam"], r["tie"]), ([0, 1, 2, 3], [20], False))

    def test_top_price_and_threshold(self):
        p = [float(h % 7) for h in range(24)]  # 6 at h = 6, 13, 20
        self.assertEqual(sch.rule_top_price(p, 3)["hours"], [6, 13, 20])
        self.assertEqual(sch.rule_threshold([1.0, 5.0, 3.0, 5.0], 4.0)["hours"], [1, 3])


class NetLoadTests(unittest.TestCase):
    def test_eia_net_load_clamps_solar_not_wind(self):
        row = {sch.DEMAND: "100", sch.SOLAR: "-5", sch.WIND: "-2"}
        self.assertEqual(sch.eia_net_load(row), 102.0)  # 100 - max(0, -5) - (-2)
        row = {sch.DEMAND: "1,000", sch.SOLAR: "300", sch.WIND: "100"}
        self.assertEqual(sch.eia_net_load(row), 600.0)

    def test_blank_cell_gives_none(self):
        self.assertIsNone(sch.eia_net_load({sch.DEMAND: "100", sch.SOLAR: "", sch.WIND: "3"}))

    def test_eia_days_groups_hour_ending_and_skips_incomplete(self):
        # Mountain day Jul 2 2026 HB 0 starts 06:00Z, so its EIA end stamp is 07:00Z.
        rows = []
        for h in range(24):
            end = dt.datetime(2026, 7, 2, 7, tzinfo=dt.timezone.utc) + dt.timedelta(hours=h)
            rows.append({"utc_start": end - common.HOUR, sch.DEMAND: str(1000 + h), sch.SOLAR: "0", sch.WIND: "0"})
        rows.append(
            {
                "utc_start": dt.datetime(2026, 7, 3, 6, tzinfo=dt.timezone.utc),
                sch.DEMAND: "5",
                sch.SOLAR: "0",
                sch.WIND: "",
            }
        )
        days, incomplete = sch.eia_days(rows)
        self.assertEqual(list(days), [dt.date(2026, 7, 2)])
        self.assertEqual(days[dt.date(2026, 7, 2)][0], 1000.0)
        self.assertEqual(days[dt.date(2026, 7, 2)][23], 1023.0)
        self.assertEqual(incomplete, {dt.date(2026, 7, 3): 0})


class OverlapTests(unittest.TestCase):
    def test_reading_weights(self):
        counts = [0] * 24
        counts[0] = 3
        counts[18] = 1
        mt = sch.reading_weights(counts, "mountain")
        utc = sch.reading_weights(counts, "utc")
        self.assertEqual((mt[0], mt[18]), (0.75, 0.25))
        # UTC 00:00 is 18:00 MDT; UTC 18:00 is 12:00 MDT
        self.assertEqual((utc[18], utc[12], utc[0]), (0.75, 0.25, 0.0))

    def test_coverage_budget_lift(self):
        f = [0.0] * 24
        f[18] = 1.0
        w = [0.0] * 24
        w[18] = 1.0
        r = sch.overlap(f, w, 1.0)
        self.assertEqual((r["coverage"], r["budget"], r["lift"]), (1.0, 1 / 24, 24.0))
        flat = sch.overlap([0.25] * 24, [1 / 24] * 24, 6.0)
        self.assertAlmostEqual(flat["lift"], 1.0)  # random flags do no better than their budget

    def test_jaccard(self):
        d = "2026-07-01"
        self.assertAlmostEqual(sch.jaccard({(d, 1), (d, 2)}, {(d, 2), (d, 3)}), 1 / 3)
        self.assertEqual(sch.jaccard(set(), set()), 1.0)

    def test_shape(self):
        flags = {"a": [17, 18], "b": [18]}
        f = sch.shape(flags)
        self.assertEqual((f[17], f[18], f[0]), (0.5, 1.0, 0.0))


class ChartTests(unittest.TestCase):
    def test_chart_text_floor_and_labels(self):
        shapes = {k: [((h + i) % 24) / 24 for h in range(24)] for i, k in enumerate(sch.RULES)}
        means = {k: 6.0 for k in sch.RULES}
        calls = [9, 41, 5, 4, 1, 3, 4, 14, 23, 26, 25, 20, 15, 33, 19, 14, 14, 8, 6, 4, 5, 34, 24, 8]
        svg = sch.draw_chart("dark", shapes, means, calls, ["footer a", "footer b", "footer c"])
        root = ET.fromstring(svg)
        ns = "{http://www.w3.org/2000/svg}"
        texts = list(root.iter(ns + "text"))
        self.assertTrue(texts)
        self.assertTrue(all(float(t.get("font-size")) >= 24 for t in texts))
        body = " ".join(t.text or "" for t in texts)
        for k in sch.RULES:
            self.assertIn(sch.RULE_LABELS[k], body)
        self.assertEqual(root.get("viewBox"), "0 0 1920 1080")

    def test_label_spacing(self):
        ys = sch.spread_labels([500.0, 501.0, 502.0, 300.0], 34.0, 200.0, 560.0)
        s = sorted(ys)
        self.assertTrue(all(b - a >= 34.0 - 1e-9 for a, b in zip(s, s[1:])))
        self.assertEqual(ys[3], 300.0)


@unittest.skipUnless(EIA.exists() and HIST.exists(), "inputs not on this branch")
class RerunTests(unittest.TestCase):
    def test_same_inputs_identical_bytes(self):
        with tempfile.TemporaryDirectory() as tmp:
            outs = []
            for i in range(2):
                d = pathlib.Path(tmp) / f"run{i}"
                with contextlib.redirect_stdout(io.StringIO()):
                    sch.main(["--out-dir", str(d), "--no-md"])
                outs.append([(d / n).read_bytes() for n in ("sch_study.json", "sch_rules.svg", "sch_rules.json")])
            self.assertEqual(outs[0], outs[1])


if __name__ == "__main__":
    unittest.main()
