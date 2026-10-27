"""Tests for science/chart_price_co2.py: xlsx reader, hour shift, means, chart."""
import datetime as dt
import pathlib
import tempfile
import unittest
import xml.etree.ElementTree as ET
import zipfile

from science import chart_price_co2 as ch
from science import common

NS = "{http://www.w3.org/2000/svg}"
FACTS_HE = [697, 697, 695, 694, 698, 704, 709, 698, 623, 534, 485, 461,
            455, 450, 443, 446, 464, 531, 629, 673, 676, 682, 684, 693]


def tiny_xlsx(path, rows):
    """rows: [(excel_serial_date, hour_ending, lb_per_kwh)] in a one-sheet workbook."""
    ns = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"'
    rns = 'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"'
    strings = ["BA", "Local date", "Hour", "CO2 Emissions Intensity for Generated Electricity", "PACE"]
    sst = "".join(f"<si><t>{s}</t></si>" for s in strings)
    body = ('<row r="1"><c r="A1" t="s"><v>0</v></c><c r="C1" t="s"><v>1</v></c>'
            '<c r="D1" t="s"><v>2</v></c><c r="CK1" t="s"><v>3</v></c></row>')
    for i, (d, he, v) in enumerate(rows, start=2):
        body += (f'<row r="{i}"><c r="A{i}" t="s"><v>4</v></c><c r="C{i}"><v>{d}</v></c>'
                 f'<c r="D{i}"><v>{he}</v></c><c r="CK{i}"><v>{v}</v></c></row>')
    with zipfile.ZipFile(path, "w") as z:
        z.writestr("xl/workbook.xml", f'<workbook {ns} {rns}><sheets>'
                   '<sheet name="Published Hourly Data" sheetId="1" r:id="rId1"/></sheets></workbook>')
        z.writestr("xl/_rels/workbook.xml.rels",
                   '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
                   '<Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>')
        z.writestr("xl/sharedStrings.xml", f"<sst {ns}>{sst}</sst>")
        z.writestr("xl/worksheets/sheet1.xml", f"<worksheet {ns}><sheetData>{body}</sheetData></worksheet>")


class ReaderTests(unittest.TestCase):
    def test_excel_serial(self):
        self.assertEqual(ch.excel_date("46296"), dt.date(2026, 10, 1))

    def test_reader_converts_units_and_shifts_he_to_hb(self):
        with tempfile.TemporaryDirectory() as d:
            p = pathlib.Path(d) / "t.xlsx"
            # Oct 1 2026: HE 1 -> HB 0, HE 24 -> HB 23; Sep 30 row is outside the window
            tiny_xlsx(p, [(46296, 1, 1.0), (46296, 24, 2.0), (46295, 5, 9.0)])
            got = ch.read_pace_co2(p, dt.date(2026, 10, 1), dt.date(2026, 10, 1))
        self.assertEqual(got, {(dt.date(2026, 10, 1), 0): 453.592, (dt.date(2026, 10, 1), 23): 907.184})


class MeansTests(unittest.TestCase):
    def test_hourly_means_with_n(self):
        vals = {(dt.date(2026, 10, 1), 0): 10.0, (dt.date(2026, 10, 2), 0): 20.0, (dt.date(2026, 10, 1), 1): 5.0}
        means, n = ch.hourly_means(vals)
        self.assertEqual((means[0], n[0], means[1], n[1]), (15.0, 2, 5.0, 1))
        self.assertIsNone(means[2])
        self.assertEqual(n[2], 0)

    def test_facts_fallback_is_hb_shifted(self):
        means, n, source = ch.facts_fallback()
        self.assertEqual(means[0], 697.0)   # HB 0 = HE 1
        self.assertEqual(means[23], 693.0)  # HB 23 = HE 24
        self.assertIn("co2_profile_he_oct", source)


class ChartTests(unittest.TestCase):
    def test_chart_parses_has_caption_and_floor(self):
        price = [30.0 + h for h in range(24)]
        co2 = [700.0 - 10 * h for h in range(24)]
        data, svgs = ch.build(price, [25] * 24, co2, [25] * 24, "synthetic", ["footer"], [])
        self.assertEqual(data["priciest_hb"], 23)
        self.assertEqual(data["cleanest_hb"], 23)
        for theme in ("dark", "light"):
            root = ET.fromstring(svgs[theme])
            texts = list(root.iter(NS + "text"))
            self.assertTrue(all(float(t.get("font-size")) >= 24 for t in texts))
            joined = " ".join(t.text or "" for t in texts)
            self.assertIn(ch.CAPTION, joined)
            self.assertIn("hour beginning, Mountain time", joined)


@unittest.skipUnless((common.RAW / "eia" / "PACE.xlsx").exists(), "needs ../clearlane-raw/eia/PACE.xlsx")
class RealDataTests(unittest.TestCase):
    def test_pace_xlsx_matches_facts_profile_within_1(self):
        vals = ch.read_pace_co2(common.RAW / "eia" / "PACE.xlsx", dt.date(2026, 10, 1), dt.date(2026, 10, 25))
        means, n = ch.hourly_means(vals)
        self.assertEqual(n, [25] * 24)
        diffs = [abs(means[h] - FACTS_HE[h]) for h in range(24)]
        self.assertLessEqual(max(diffs), 1.0, diffs)


if __name__ == "__main__":
    unittest.main()
