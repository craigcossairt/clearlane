"""Minimal deterministic SVG writer for projector charts (stdlib only).

Palettes are copied from DESIGN.md (light and dark columns). Every <text> is 24px or larger;
smaller text, an em or en dash, an unknown color token, or a chart without a footer raises.
Attributes are written in a fixed order and numbers at fixed precision, so reruns are
byte-identical.
"""
from xml.sax.saxutils import escape

WIDTH, HEIGHT = 1920, 1080
MIN_TEXT_PX = 24
FONT_UI = "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif"
FONT_MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"

PALETTES = {
    "light": {
        "bg": "#f6f5f1", "ink": "#1b1c1e", "muted": "#5a5d63", "accent": "#1c5bb8",
        "clear": "#1d8457", "clear_soft": "#e3f2ea",
        "shoulder": "#b97d0c", "shoulder_soft": "#f6eedb",
        "jam": "#bf3a29", "jam_soft": "#f8e6e2", "solar": "#d99a00",
    },
    "dark": {
        "bg": "#111316", "ink": "#ebeae6", "muted": "#a2a6ad", "accent": "#7ea9ff",
        "clear": "#3cbf84", "clear_soft": "#16291f",
        "shoulder": "#e2a73c", "shoulder_soft": "#2b2414",
        "jam": "#ee6b58", "jam_soft": "#2e1a17", "solar": "#f0c04c",
    },
}

_BANNED = ("\u2014", "\u2013")


def fmt(x):
    """Fixed-precision number for SVG attributes: up to 2 decimals, no trailing zeros."""
    s = f"{float(x):.2f}".rstrip("0").rstrip(".")
    return "0" if s in ("-0", "") else s


def _clean(s):
    s = str(s)
    for ch in _BANNED:
        if ch in s:
            raise ValueError(f"dash character U+{ord(ch):04X} in chart text: {s!r}")
    return s


class Scale:
    """Linear map from [d0, d1] to [r0, r1]."""

    def __init__(self, d0, d1, r0, r1):
        if d1 == d0:
            raise ValueError("empty domain")
        self.d0, self.d1, self.r0, self.r1 = d0, d1, r0, r1

    def __call__(self, v):
        return self.r0 + (v - self.d0) * (self.r1 - self.r0) / (self.d1 - self.d0)


class Chart:
    def __init__(self, theme, title, desc):
        if theme not in PALETTES:
            raise KeyError(theme)
        self.theme = theme
        self.pal = PALETTES[theme]
        self.title = _clean(title)
        self.desc = _clean(desc)
        self.items = []
        self.patterns = {}
        self.footer_lines = None

    def color(self, token):
        return self.pal[token]  # KeyError on anything not in DESIGN.md

    def _hatch(self, token):
        pid = "hatch-" + token.replace("_", "-")
        if pid not in self.patterns:
            c = self.color(token)
            self.patterns[pid] = (
                f'<pattern id="{pid}" width="16" height="16" patternUnits="userSpaceOnUse" '
                f'patternTransform="rotate(45)">'
                f'<rect x="0" y="0" width="16" height="16" fill="{self.color("bg")}"/>'
                f'<rect x="0" y="0" width="7" height="16" fill="{c}"/></pattern>')
        return f"url(#{pid})"

    def rect(self, x, y, w, h, token, hatch=False, stroke=None):
        fill = self._hatch(token) if hatch else self.color(token)
        st = f' stroke="{self.color(stroke)}" stroke-width="2"' if stroke else ""
        if hatch and not stroke:
            st = f' stroke="{self.color(token)}" stroke-width="2"'
        self.items.append(f'<rect x="{fmt(x)}" y="{fmt(y)}" width="{fmt(w)}" height="{fmt(h)}" '
                          f'fill="{fill}"{st}/>')

    def line(self, x1, y1, x2, y2, token, width=2, dash=None):
        d = f' stroke-dasharray="{dash}"' if dash else ""
        self.items.append(f'<line x1="{fmt(x1)}" y1="{fmt(y1)}" x2="{fmt(x2)}" y2="{fmt(y2)}" '
                          f'stroke="{self.color(token)}" stroke-width="{fmt(width)}"{d}/>')

    def polyline(self, points, token, width=3, dash=None):
        pts = " ".join(f"{fmt(x)},{fmt(y)}" for x, y in points)
        d = f' stroke-dasharray="{dash}"' if dash else ""
        self.items.append(f'<polyline points="{pts}" fill="none" stroke="{self.color(token)}" '
                          f'stroke-width="{fmt(width)}" stroke-linejoin="round"{d}/>')

    def circle(self, cx, cy, r, token):
        self.items.append(f'<circle cx="{fmt(cx)}" cy="{fmt(cy)}" r="{fmt(r)}" '
                          f'fill="{self.color(token)}"/>')

    def text(self, x, y, s, size=MIN_TEXT_PX, token="ink", anchor="start", mono=False,
             weight="normal"):
        if size < MIN_TEXT_PX:
            raise ValueError(f"text {s!r} is {size}px; the floor is {MIN_TEXT_PX}px")
        font = FONT_MONO if mono else FONT_UI
        self.items.append(f'<text x="{fmt(x)}" y="{fmt(y)}" font-family="{font}" '
                          f'font-size="{fmt(size)}" font-weight="{weight}" '
                          f'text-anchor="{anchor}" fill="{self.color(token)}">'
                          f'{escape(_clean(s))}</text>')

    def footer(self, lines, size=MIN_TEXT_PX):
        """Source files or URLs, provenance class, script name and data window."""
        if not lines:
            raise ValueError("footer needs at least one line")
        self.footer_lines = [_clean(x) for x in lines]
        self.footer_size = size

    def render(self):
        if not self.footer_lines:
            raise ValueError("chart has no footer (sources, class, script, window)")
        foot = []
        n = len(self.footer_lines)
        for i, s in enumerate(self.footer_lines):
            y = HEIGHT - 24 - (n - 1 - i) * (self.footer_size + 8)
            foot.append(f'<text x="48" y="{fmt(y)}" font-family="{FONT_UI}" '
                        f'font-size="{fmt(self.footer_size)}" font-weight="normal" '
                        f'text-anchor="start" fill="{self.color("muted")}">{escape(s)}</text>')
        defs = "".join(self.patterns[k] for k in sorted(self.patterns))
        parts = [
            f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {WIDTH} {HEIGHT}" '
            f'width="{WIDTH}" height="{HEIGHT}" role="img">',
            f"<title>{escape(self.title)}</title>",
            f"<desc>{escape(self.desc)}</desc>",
            f"<defs>{defs}</defs>",
            f'<rect x="0" y="0" width="{WIDTH}" height="{HEIGHT}" fill="{self.color("bg")}"/>',
            *self.items,
            *foot,
            "</svg>",
        ]
        return "\n".join(parts) + "\n"

    def write(self, path):
        import pathlib
        p = pathlib.Path(path)
        p.parent.mkdir(parents=True, exist_ok=True)
        with open(p, "w", encoding="utf-8", newline="\n") as f:
            f.write(self.render())
