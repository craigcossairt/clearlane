"""Copy guard: banned characters, hype words and guardrail phrases in science md and svg."""
import re
import unittest

from science import common

BANNED_CHARS = {"\u2014": "em dash U+2014", "\u2013": "en dash U+2013"}
BANNED_WORDS = ["comprehensive", "robust", "seamless", "leverage", "cutting-edge", "game-changer"]
BANNED_PHRASES = ["Torus lacks", "Torus can't", "500 MW installed", "six-minute call",
                  "Utah's grid", "record peak"]


def problems(text):
    """Return a list of human-readable problems found in text."""
    found = []
    for ch, name in BANNED_CHARS.items():
        if ch in text:
            found.append(name)
    norm = text.replace("\u2019", "'")
    for w in BANNED_WORDS:
        if re.search(r"(?<![A-Za-z])" + re.escape(w), norm, re.IGNORECASE):
            found.append("word: " + w)
    for ph in BANNED_PHRASES:
        if ph.lower() in norm.lower():
            found.append("phrase: " + ph)
    return found


def science_files():
    base = common.ROOT / "science"
    return sorted(p for pat in ("*.md", "*.svg") for p in base.rglob(pat))


class GuardSelfTests(unittest.TestCase):
    def test_guard_catches_each_banned_item(self):
        for bad in ["a\u2014b", "a\u2013b", "Robust plan", "leverage it", "a game-changer",
                    "Torus lacks X", "Torus can\u2019t", "500 MW installed", "a six-minute call",
                    "Utah\u2019s grid", "a record peak", "Cutting-edge"]:
            self.assertTrue(problems(bad), bad)

    def test_guard_passes_clean_text(self):
        self.assertEqual(problems("A call of under six minutes, PacifiCorp East (Utah, Wyoming, Idaho)."), [])
        self.assertEqual(problems("Spin stays ready; the plan holds."), [])

    def test_inflected_hype_words_are_caught(self):
        self.assertEqual(problems("leveraged"), ["word: leverage"])
        self.assertEqual(problems("robustness"), ["word: robust"])


class ScienceCopyTests(unittest.TestCase):
    def test_science_md_and_svg_are_clean(self):
        bad = {}
        for p in science_files():
            found = problems(p.read_text(encoding="utf-8"))
            if found:
                bad[common.rel(p)] = found
        self.assertEqual(bad, {})


if __name__ == "__main__":
    unittest.main()
