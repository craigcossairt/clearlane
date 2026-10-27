"""Tests for the local PACE.xlsx extract and its pinned CO2 profile."""

import csv
import hashlib
import json
import pathlib
import statistics
import subprocess
import sys
import tempfile
import unittest
import zipfile
from datetime import date, datetime, timedelta, timezone
from xml.etree import ElementTree as ET

ROOT = pathlib.Path(__file__).resolve().parents[2]
SOURCE = ROOT.parent / "clearlane-raw" / "eia" / "PACE.xlsx"
CSV_PATH = ROOT / "prep" / "data" / "eia_pace_hourly.csv"
META_PATH = ROOT / "prep" / "data" / "eia_pace_hourly.meta.json"
HEADERS = [
    "BA",
    "UTC time",
    "Local date",
    "Hour",
    "Demand forecast",
    "Demand",
    "Net generation",
    "CO2 Emissions Generated",
    "CO2 Emissions Intensity for Generated Electricity",
    "CO2 Emissions Intensity for Consumed Electricity",
]
OUT_HEADERS = [
    "utc_start",
    "local_date",
    "hour_ending",
    "demand_mw",
    "demand_fcst_mw",
    "net_gen_mw",
    "co2_t",
    "co2_gen_lb_kwh",
    "co2_cons_lb_kwh",
]


def excel_serial(instant: datetime) -> str:
    base = datetime(1899, 12, 30, tzinfo=timezone.utc)
    return str((instant - base).total_seconds() / 86400)


def write_synthetic_workbook(path: pathlib.Path) -> None:
    strings = HEADERS + ["PACE", "2025-07-01", "2025-07-02"]
    string_ids = {value: index for index, value in enumerate(strings)}
    shared = ET.Element("{http://schemas.openxmlformats.org/spreadsheetml/2006/main}sst")
    for value in strings:
        si = ET.SubElement(shared, "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}si")
        ET.SubElement(si, "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}t").text = value
    main = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
    sheet = ET.Element(main + "worksheet")
    data = ET.SubElement(sheet, main + "sheetData")

    def column_name(index: int) -> str:
        result = ""
        while index:
            index, remainder = divmod(index - 1, 26)
            result = chr(65 + remainder) + result
        return result

    def add_row(number: int, values: list[str | None], shared_values: set[int] = frozenset()):
        row = ET.SubElement(data, main + "row", r=str(number))
        for index, value in enumerate(values, 1):
            if value is None:
                continue
            attrs = {"r": f"{column_name(index)}{number}"}
            if index in shared_values:
                attrs["t"] = "s"
                value = str(string_ids[value])
            cell = ET.SubElement(row, main + "c", attrs)
            ET.SubElement(cell, main + "v").text = value

    add_row(1, HEADERS, set(range(1, len(HEADERS) + 1)))
    day = date(2025, 7, 1)
    rows = [
        [
            "PACE",
            excel_serial(datetime(2025, 7, 1, 7, tzinfo=timezone.utc)),
            str((day - date(1899, 12, 30)).days),
            "1",
            "4500",
            "4400",
            "4200",
            "100",
            "0.5",
            "0.6",
        ],
        [
            "PACE",
            excel_serial(datetime(2025, 7, 1, 8, tzinfo=timezone.utc)),
            str((day - date(1899, 12, 30)).days),
            "2",
            "4600",
            "4550",
            "4300",
            "",
            "",
            "",
        ],
        [
            "PACE",
            excel_serial(datetime(2025, 7, 2, 7, tzinfo=timezone.utc)),
            str((day + timedelta(days=1) - date(1899, 12, 30)).days),
            "1",
            "4700",
            "4650",
            "4400",
            "110",
            "0.55",
            "0.65",
        ],
    ]
    shared_cols = {1}
    for number, values in enumerate(rows, 2):
        add_row(number, values, shared_cols)

    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("xl/sharedStrings.xml", ET.tostring(shared, encoding="utf-8", xml_declaration=True))
        archive.writestr("xl/worksheets/sheet1.xml", ET.tostring(sheet, encoding="utf-8", xml_declaration=True))


class EiaExtractTest(unittest.TestCase):
    def test_synthetic_xlsx_maps_named_columns_and_preserves_blanks(self):
        with tempfile.TemporaryDirectory(dir=ROOT / "prep" / "tests") as temp:
            temp = pathlib.Path(temp)
            workbook = temp / "synthetic.xlsx"
            out_csv = temp / "extract.csv"
            out_meta = temp / "extract.meta.json"
            write_synthetic_workbook(workbook)
            result = subprocess.run(
                [
                    sys.executable,
                    "-I",
                    str(ROOT / "prep" / "eia.py"),
                    "--extract",
                    "--workbook",
                    str(workbook),
                    "--out",
                    str(out_csv),
                    "--meta",
                    str(out_meta),
                ],
                cwd=ROOT,
                capture_output=True,
                text=True,
                encoding="utf-8",
                check=True,
            )
            self.assertIn("3 rows", result.stdout)
            with out_csv.open(newline="", encoding="utf-8") as stream:
                rows = list(csv.DictReader(stream))
            self.assertEqual(list(rows[0]), OUT_HEADERS)
            self.assertEqual(len(rows), 3)
            self.assertEqual(rows[0]["utc_start"], "2025-07-01T06:00:00Z")
            self.assertEqual(rows[0]["local_date"], "2025-07-01")
            self.assertEqual(rows[0]["hour_ending"], "1")
            self.assertEqual(rows[0]["demand_fcst_mw"], "4500")
            self.assertEqual(rows[0]["co2_t"], "100")
            self.assertEqual(rows[1]["co2_gen_lb_kwh"], "")
            self.assertEqual(rows[1]["co2_cons_lb_kwh"], "")
            metadata = json.loads(out_meta.read_text(encoding="utf-8"))
            self.assertEqual(metadata["row_count"], 3)
            self.assertEqual(metadata["workbook_sha256"], hashlib.sha256(workbook.read_bytes()).hexdigest())
            self.assertEqual(metadata["first_utc_start"], "2025-07-01T06:00:00Z")
            self.assertEqual(metadata["last_utc_start"], "2025-07-02T06:00:00Z")

    def test_committed_extract_pins_october_co2_profile_and_metadata(self):
        with CSV_PATH.open(newline="", encoding="utf-8") as stream:
            rows = list(csv.DictReader(stream))
        self.assertEqual(list(rows[0]), OUT_HEADERS)
        self.assertLess(CSV_PATH.stat().st_size, 1_500_000)
        oct_rows = [row for row in rows if "2026-10-01" <= row["local_date"] <= "2026-10-25" and row["co2_gen_lb_kwh"]]
        grouped = {}
        for row in oct_rows:
            grouped.setdefault(int(row["hour_ending"]), []).append(float(row["co2_gen_lb_kwh"]) * 453.592)
        expected = {
            1: 697,
            2: 697,
            3: 695,
            4: 694,
            5: 698,
            6: 704,
            7: 709,
            8: 698,
            9: 623,
            10: 534,
            11: 485,
            12: 461,
            13: 455,
            14: 450,
            15: 443,
            16: 446,
            17: 464,
            18: 531,
            19: 629,
            20: 673,
            21: 676,
            22: 682,
            23: 684,
            24: 693,
        }
        self.assertEqual({hour: round(statistics.mean(values)) for hour, values in grouped.items()}, expected)
        metadata = json.loads(META_PATH.read_text(encoding="utf-8"))
        self.assertEqual(metadata["row_count"], len(rows))
        self.assertEqual(metadata["last_co2_utc_start"], "2026-10-26T05:00:00Z")
        self.assertIn("file time", metadata["workbook_file_time_kind"])

    @unittest.skipUnless(SOURCE.is_file(), f"local-only workbook missing: {SOURCE}")
    def test_extract_metadata_matches_local_workbook_hash(self):
        metadata = json.loads(META_PATH.read_text(encoding="utf-8"))
        self.assertEqual(metadata["workbook_sha256"], hashlib.sha256(SOURCE.read_bytes()).hexdigest())


if __name__ == "__main__":
    unittest.main()
