"""Regression tests for the runnable copies of the research oracles."""

import pathlib
import re
import subprocess
import sys
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[2]
RAW_WORKBOOK = ROOT.parent / "clearlane-raw" / "eia" / "PACE.xlsx"
REFERENCE = ROOT / "prep" / "reference"


def run_oracle(script: str, *args: str) -> str:
    result = subprocess.run(
        [sys.executable, "-I", str(REFERENCE / script), *args],
        cwd=ROOT,
        capture_output=True,
        text=True,
        encoding="utf-8",
        check=True,
    )
    return result.stdout


class ReferenceOracleTest(unittest.TestCase):
    def test_fix_pins_research_values_and_call_shares(self):
        output = run_oracle("fix.py", "research", "prep/reference/stage_numbers.py")
        for expected in (
            "price-only (value $65.79/MW-day)",
            "local 276/359=77%; UTC->MDT 186/359=52%; UTC->MST 156/359=43%",
            "wear $10/MWh: gross $57.54/MW-day",
            "local 142/359=40%; UTC->MDT 65/359=18%; UTC->MST 51/359=14%",
            "gross $55.56/MW-day",
            "July: wear-10 gross mean $48.52/MW-day",
            "Oct: wear-10 gross mean $39.71/MW-day",
        ):
            with self.subTest(expected=expected):
                self.assertIn(expected, output)

    def test_stage_numbers_pins_snapshot_and_backtest_values(self):
        output = run_oracle("stage_numbers.py", "research")
        for expected in (
            "price-only plan value $65.79/MW-day",
            "July 2026: 30 days; price-only 1MW/2MWh daily value mean $51.74",
            "Oct 1-25 2026: 25 days; price-only 1MW/2MWh daily value mean $48.68",
            "price-only value $4,605",
            "price-only value $32,896",
            "$2,551 at Oct 27 DA prices",
        ):
            with self.subTest(expected=expected):
                self.assertIn(expected, output)

    def test_habit_pins_value_and_fleet_scale(self):
        output = run_oracle("habit.py", "research")
        self.assertRegex(output, re.compile(r"value \$\s*20\.06/MW-day"))
        for expected in (
            "charge cost $39.53/MWh",
            "timetable vs habit: value x2.91",
            "70 MW: habit $1,405/day, -18.4 t CO2/day ; timetable $4,088/day, +18.9 t CO2/day",
            "500 MW: habit $10,032/day, -131.2 t CO2/day ; timetable $29,203/day, +134.9 t CO2/day",
        ):
            with self.subTest(expected=expected):
                self.assertIn(expected, output)

    @unittest.skipUnless(RAW_WORKBOOK.is_file(), f"local-only workbook missing: {RAW_WORKBOOK}")
    def test_co2_profile_pins_workbook_values(self):
        output = run_oracle("co2.py", str(RAW_WORKBOOK))
        self.assertIn("HE16   446  n=25", output)
        self.assertIn("HE19   629  n=25", output)


if __name__ == "__main__":
    unittest.main()
