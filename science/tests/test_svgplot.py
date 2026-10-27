"""Tests for science/svgplot.py: palette provenance, text size floor, valid output."""
import pathlib
import re
import unittest
import xml.etree.ElementTree as ET

from science import common, svgplot

NS = "{http://www.w3.org/2000/svg}"


def design_tokens():
    """Parse DESIGN.md's token table into {"light": {...}, "dark": {...}}."""
    text = (common.ROOT / "DESIGN.md").read_text(encoding="utf-8")
    out = {"light": {}, "dark": {}}
    for line in text.splitlines():
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        if len(cells) < 3 or not cells[0].startswith("`--"):
            continue
        names = [n.strip(" `").lstrip("-") for n in cells[0].split("/")]
        lights = re.findall(r"#[0-9a-fA-F]{6}", cells[1])
        darks = re.findall(r"#[0-9a-fA-F]{6}", cells[2])
        for n, lo, da in zip(names, lights, darks):
            out["light"][n.replace("-", "_")] = lo.lower()
            out["dark"][n.replace("-", "_")] = da.lower()
    return out


def sample(theme="dark"):
    c = svgplot.Chart(theme, "Sample chart", "A test chart with bars and a line.")
    c.rect(100, 100, 50, 300, "clear")
    c.rect(160, 100, 50, 300, "jam", hatch=True)
    c.polyline([(100, 500), (200, 450), (300, 520)], "accent", 4)
    c.text(100, 80, "Direct label 24 of 27", size=40, mono=True)
    c.footer(["Source: research/x.csv", "DERIVED, science/chart.py, Oct 1 to 27 2026"])
    return c


class PaletteTests(unittest.TestCase):
    def test_every_hex_in_svgplot_appears_in_design_md(self):
        src = (common.ROOT / "science" / "svgplot.py").read_text(encoding="utf-8")
        design = (common.ROOT / "DESIGN.md").read_text(encoding="utf-8").lower()
        hexes = set(h.lower() for h in re.findall(r"#[0-9a-fA-F]{6}\b", src))
        self.assertTrue(hexes)
        self.assertEqual(sorted(h for h in hexes if h not in design), [])

    def test_palettes_match_design_columns(self):
        tokens = design_tokens()
        self.assertEqual(svgplot.PALETTES["light"], tokens["light"])
        self.assertEqual(svgplot.PALETTES["dark"], tokens["dark"])


class RenderTests(unittest.TestCase):
    def test_renders_parseable_svg_with_title_desc_viewbox(self):
        for theme in ("dark", "light"):
            root = ET.fromstring(sample(theme).render())
            self.assertEqual(root.get("viewBox"), "0 0 1920 1080")
            self.assertIsNotNone(root.find(NS + "title"))
            self.assertIsNotNone(root.find(NS + "desc"))
            self.assertIsNotNone(root.find(".//" + NS + "pattern"))

    def test_every_text_is_24px_or_larger(self):
        root = ET.fromstring(sample().render())
        texts = root.iter(NS + "text")
        sizes = [float(t.get("font-size")) for t in texts]
        self.assertTrue(sizes)
        self.assertTrue(all(s >= 24 for s in sizes), sizes)

    def test_small_text_raises(self):
        c = svgplot.Chart("dark", "t", "d")
        with self.assertRaises(ValueError):
            c.text(0, 0, "tiny", size=23)

    def test_dash_characters_raise(self):
        c = svgplot.Chart("dark", "t", "d")
        with self.assertRaises(ValueError):
            c.text(0, 0, "a \u2014 b")
        with self.assertRaises(ValueError):
            svgplot.Chart("dark", "a \u2013 b", "d")

    def test_requires_footer(self):
        c = svgplot.Chart("dark", "t", "d")
        with self.assertRaises(ValueError):
            c.render()

    def test_render_is_deterministic(self):
        self.assertEqual(sample().render(), sample().render())

    def test_unknown_token_raises(self):
        c = svgplot.Chart("dark", "t", "d")
        with self.assertRaises(KeyError):
            c.rect(0, 0, 1, 1, "#ff00ff")

    def test_scale_maps_domain_to_range(self):
        s = svgplot.Scale(0, 10, 100, 200)
        self.assertEqual(s(0), 100)
        self.assertEqual(s(5), 150)
        self.assertEqual(s(10), 200)


if __name__ == "__main__":
    unittest.main()
