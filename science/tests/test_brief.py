"""Checks for science/brief.md: length, charts, citations."""
import re
import unittest

from science import common

BRIEF = common.ROOT / "science" / "brief.md"
CHARTS = ["charts/step_hours_oct_jul.light.svg", "charts/oct_price_co2.light.svg"]


def split_brief(text):
    head, sep, sources = text.partition("\n## Sources")
    if not sep:
        raise ValueError("brief has no '## Sources' section")
    return head, sources


def body_words(head):
    """Words of prose above Sources: skip image lines and HTML comments; strip markdown marks."""
    head = re.sub(r"<!--.*?-->", " ", head, flags=re.S)
    lines = [ln for ln in head.splitlines() if not ln.lstrip().startswith("![")]
    text = re.sub(r"[#*_`>|]", " ", "\n".join(lines))
    text = re.sub(r"\[(\d+(?:, ?\d+)*)\]", " ", text)  # citation markers are not words
    return [w for w in text.split() if re.search(r"[A-Za-z0-9]", w)]


class BriefTests(unittest.TestCase):
    def setUp(self):
        self.text = BRIEF.read_text(encoding="utf-8")
        self.head, self.sources = split_brief(self.text)

    def test_word_count_900_to_1100(self):
        n = len(body_words(self.head))
        self.assertTrue(900 <= n <= 1100, n)

    def test_embeds_both_light_charts_that_exist(self):
        for c in CHARTS:
            self.assertIn(f"]({c})", self.head)
            self.assertTrue((common.ROOT / "science" / c).exists(), c)

    def test_every_citation_has_a_numbered_source(self):
        cited = {int(n) for grp in re.findall(r"\[(\d+(?:, ?\d+)*)\]", self.head) for n in re.split(r", ?", grp)}
        listed = {int(n) for n in re.findall(r"^(\d+)\. ", self.sources, re.M)}
        self.assertTrue(cited)
        self.assertEqual(sorted(cited - listed), [])
        self.assertEqual(sorted(listed - cited), [])

    def test_states_its_limits(self):
        low = self.head.lower()
        for phrase in ["forecast", "average", "not marginal", "utah, wyoming", "may 1 2026", "time zone"]:
            self.assertIn(phrase, low)


class CounterTests(unittest.TestCase):
    def test_body_words_skips_images_comments_and_marks(self):
        self.assertEqual(body_words("# Title here\n![x](a.svg)\n<!-- hidden -->\nOne **two** [3].\n"),
                         ["Title", "here", "One", "two"])


if __name__ == "__main__":
    unittest.main()
