"""Pinned checks for the source-attributed Torus facts bundle."""

import json
import pathlib
import subprocess
import sys
import tempfile
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[2]
BUILDER = ROOT / "prep" / "build_torus.py"

EXPECTED = {
    "events_2025_total": 359,
    "events_2025_by_hour": [9, 41, 5, 4, 1, 3, 4, 14, 23, 26, 25, 20, 15, 33, 19, 14, 14, 8, 6, 4, 5, 34, 24, 8],
    "events_2025_by_weekday": [50, 57, 43, 57, 53, 45, 54],
    "ramp_s": 19,
    "ramp_target_s": 30,
    "delivered_pct": 102,
    "delivered_band_pct": [90, 100],
    "spin_c_rate": 10,
    "spin_cycle_life": 25000,
    "spin_discharge_recharge_min": 12,
    "pulse_c_rate": 0.5,
    "pulse_cycle_life": 7500,
    "pulse_life_yr": 25,
    "mou_mw": 70,
    "mou_ceiling_mw": 500,
}


def build(path: pathlib.Path) -> None:
    subprocess.run(
        [sys.executable, "-I", str(BUILDER), "--out", str(path)],
        cwd=ROOT,
        capture_output=True,
        text=True,
        encoding="utf-8",
        check=True,
    )


class TorusPublishedTest(unittest.TestCase):
    def test_build_is_deterministic_and_values_are_source_tagged(self):
        with tempfile.TemporaryDirectory(dir=ROOT / "prep" / "tests") as temp:
            first = pathlib.Path(temp) / "first.json"
            second = pathlib.Path(temp) / "second.json"
            build(first)
            first_bytes = first.read_bytes()
            build(second)
            second_bytes = second.read_bytes()

        self.assertEqual(first_bytes, second_bytes)
        self.assertTrue(first_bytes.endswith(b"\n"))
        self.assertNotIn("\u2014".encode("utf-8"), first_bytes)
        bundle = json.loads(first_bytes)
        self.assertEqual(set(bundle) - {"sources", "notes"}, set(EXPECTED))
        sources = {source["id"]: source for source in bundle["sources"]}
        for key, value in EXPECTED.items():
            with self.subTest(key=key):
                tagged = bundle[key]
                self.assertEqual(tagged["value"], value)
                self.assertEqual(tagged["prov"], "TORUS_PUBLISHED")
                self.assertIn(tagged["source_id"], sources)
                self.assertTrue(sources[tagged["source_id"]]["url"].startswith("https://"))

        self.assertEqual(len(bundle["events_2025_by_hour"]["value"]), 24)
        self.assertEqual(sum(bundle["events_2025_by_hour"]["value"]), 359)
        self.assertEqual(len(bundle["events_2025_by_weekday"]["value"]), 7)
        self.assertEqual(sum(bundle["events_2025_by_weekday"]["value"]), 359)
        self.assertEqual(bundle["events_2025_total"]["value"], 359)
        self.assertTrue(all(source["retrieved_utc"] == "2026-10-26" for source in sources.values()))
        self.assertTrue(
            all(source["license"] == "Torus public web page, facts only, no text copied" for source in sources.values())
        )
        self.assertEqual(len(bundle["sources"]), len(sources))
        notes = " ".join(bundle["notes"])
        for phrase in (
            "no time zone",
            "359 is the RMP case study count",
            "Station lifespan",
            "500 MW is the ceiling",
            # Torus confirmed the heatmap's hours (docs/FACTS.md heatmap_readings); "both readings" is retired.
            "Torus confirmed the hours are Mountain time (Torus, message to Craig Cossairt, Oct 27 2026)",
        ):
            self.assertIn(phrase, notes)
        self.assertNotIn("as UTC", notes)


if __name__ == "__main__":
    unittest.main()
