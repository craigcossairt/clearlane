"""Synthetic tests for science/chart_step_hours.py."""
import datetime as dt
import json
import unittest
import xml.etree.ElementTree as ET

from science import chart_step_hours as ch

NS = "{http://www.w3.org/2000/svg}"


def three_days(month):
    base = [10.0] * 24
    d1 = list(base); d1[17] = 25.0
    d2 = list(base); d2[18] = 30.0
    d3 = list(base); d3[18] = 15.0; d3[6] = 15.0  # tie: HB 6
    return {dt.date(2026, month, 1): d1, dt.date(2026, month, 2): d2, dt.date(2026, month, 3): d3}


META = {"oct_label": "x of y October days", "jul_label": "July: x of y", "inputs": [], "footer": ["f"]}


class ChartTests(unittest.TestCase):
    def setUp(self):
        self.data, self.svgs = ch.build(three_days(10), three_days(7), META)

    def test_counts_are_plotted_per_hour(self):
        oc = self.data["october"]["counts_by_hb"]
        self.assertEqual(len(oc), 24)
        self.assertEqual((oc[6], oc[17], oc[18], sum(oc)), (1, 1, 1, 3))
        self.assertEqual(self.data["october"]["hb17_or_18"], 2)
        self.assertEqual(self.data["july"]["hb13_to_20"], 2)
        self.assertEqual(self.data["october"]["median_step"], 15.0)

    def test_svgs_parse_and_text_floor(self):
        for theme in ("dark", "light"):
            root = ET.fromstring(self.svgs[theme])
            self.assertEqual(root.get("viewBox"), "0 0 1920 1080")
            texts = list(root.iter(NS + "text"))
            self.assertTrue(all(float(t.get("font-size")) >= 24 for t in texts))
            joined = " ".join(t.text or "" for t in texts)
            self.assertIn("hour beginning, Mountain time", joined)
            self.assertIn(META["oct_label"], joined)
            self.assertIn(META["jul_label"], joined)
            self.assertIsNotNone(root.find(".//" + NS + "pattern"))  # July is hatched

    def test_headline_labels_are_40px(self):
        root = ET.fromstring(self.svgs["dark"])
        for t in root.iter(NS + "text"):
            if t.text in (META["oct_label"], META["jul_label"]):
                self.assertGreaterEqual(float(t.get("font-size")), 40)

    def test_deterministic(self):
        d2, s2 = ch.build(three_days(10), three_days(7), META)
        self.assertEqual(s2, self.svgs)
        self.assertEqual(json.dumps(d2, sort_keys=True), json.dumps(self.data, sort_keys=True))


if __name__ == "__main__":
    unittest.main()
