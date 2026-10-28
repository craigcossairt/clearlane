"""Chart: backtest spread by policy, May 1 to Oct 27 2026 (issue #106).

Run from the repo root:  python -I science/chart_backtest.py
Reads public/derived/backtest.json (BacktestResult, schema clearlane.backtest/v1, from the engine).
Writes science/charts/backtest_spread.svg (dark, stage), .light.svg (print) and .json (the plotted
values plus the input's sha256). One row per policy: a P10 to P90 bar, a P50 tick with its value,
and a mean dot, in $/MW-day from usd_per_mw_day. Values are read, never recomputed (#107 checks them).
"""
import argparse
import datetime as dt
import json
import math
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from science import common, svgplot  # noqa: E402

SCRIPT = "science/chart_backtest.py"
INPUT = "public/derived/backtest.json"
OUT = "science/charts/backtest_spread"
SCHEMA = "clearlane.backtest/v1"
UNIT = "$/MW-day"
CAPTION = [
    "Value to RMP's system at day-ahead prices.",
    "The fixed overnight rule is our comparison rule, not Torus practice.",
]
# Row order and the words written beside each row; the policy id is printed too.
POLICIES = [
    ("fixed_overnight", "Fixed overnight rule", "shoulder", False),
    ("price_only", "Price only", "accent", True),
    ("clearlane", "Clearlane", "clear", False),
]
TICK_STEP = 20

# layout
X0, X1 = 620, 1840
Y_ROW0, ROW_H = 370, 170
BAR_H = 56
MONO_EM = 0.6  # advance width of one monospace character, in em


def _months(d):
    return d.strftime("%b") + " " + str(d.day)


def window_text(w):
    a = dt.date.fromisoformat(w["start_mt"])
    b = dt.date.fromisoformat(w["end_mt"])
    missing = ", ".join(w["missing_days"]) if w["missing_days"] else "none"
    return f"{_months(a)} to {_months(b)} {b.year}, {w['days']} days, missing: {missing}"


def money(v):
    s = f"{abs(v):,.2f}"
    return ("-$" if v < 0 else "$") + s


def validate(bt):
    if bt.get("schema") != SCHEMA:
        raise ValueError(f"backtest schema is {bt.get('schema')!r}, expected {SCHEMA!r}")
    have = {p["policy"]: p for p in bt["policies"]}
    for name, *_ in POLICIES:
        if name not in have:
            raise ValueError(f"policy {name!r} missing from backtest.json")
        u = have[name]["usd_per_mw_day"]
        if not (u["p10"] <= u["p50"] <= u["p90"]):
            raise ValueError(f"{name}: percentiles out of order {u}")
        for k in ("p10", "p50", "p90", "mean"):
            if not math.isfinite(u[k]):
                raise ValueError(f"{name}: {k} is not finite")
    w = bt["window"]
    for k in ("start_mt", "end_mt", "days", "missing_days"):
        if k not in w:
            raise ValueError(f"window.{k} missing")
    return have


def axis(rows):
    vals = [0.0] + [r["usd_per_mw_day"][k] for r in rows for k in ("p10", "p50", "p90", "mean")]
    lo = math.floor(min(vals) / TICK_STEP) * TICK_STEP
    hi = math.ceil(max(vals) / TICK_STEP) * TICK_STEP
    if hi == lo:
        hi = lo + TICK_STEP
    return {"min": lo, "max": hi, "step": TICK_STEP}


def x_scale(data):
    return svgplot.Scale(data["axis"]["min"], data["axis"]["max"], X0, X1)


def build(bt, input_rec):
    have = validate(bt)
    rows = [{"policy": name, "label": label, "usd_per_mw_day": dict(have[name]["usd_per_mw_day"])}
            for name, label, *_ in POLICIES]
    data = {
        "chart": "backtest_spread", "class": "DERIVED", "script": SCRIPT, "unit": UNIT,
        "caption": " ".join(CAPTION), "input": dict(input_rec), "schema": bt["schema"],
        "window": dict(bt["window"]), "policies": rows, "axis": axis(rows),
        "marks": {"bar": "P10 to P90", "tick": "P50", "dot": "mean"},
    }
    svgs = {t: draw(t, data) for t in ("dark", "light")}
    return data, svgs


def _rect(c, x, y, w, h, fill, stroke, role):
    c.items.append(f'<rect data-role="{role}" x="{svgplot.fmt(x)}" y="{svgplot.fmt(y)}" '
                   f'width="{svgplot.fmt(w)}" height="{svgplot.fmt(h)}" fill="{fill}" '
                   f'stroke="{stroke}" stroke-width="3"/>')


def _line(c, x1, y1, x2, y2, stroke, width, role):
    c.items.append(f'<line data-role="{role}" x1="{svgplot.fmt(x1)}" y1="{svgplot.fmt(y1)}" '
                   f'x2="{svgplot.fmt(x2)}" y2="{svgplot.fmt(y2)}" stroke="{stroke}" '
                   f'stroke-width="{svgplot.fmt(width)}"/>')


def _dot(c, cx, cy, r, fill, stroke, role):
    c.items.append(f'<circle data-role="{role}" cx="{svgplot.fmt(cx)}" cy="{svgplot.fmt(cy)}" '
                   f'r="{svgplot.fmt(r)}" fill="{fill}" stroke="{stroke}" stroke-width="4"/>')


def draw(theme, data):
    win = window_text(data["window"])
    p50s = "; ".join(f"{r['policy']} P50 {money(r['usd_per_mw_day']['p50'])}" for r in data["policies"])
    c = svgplot.Chart(
        theme, "Backtest spread of daily value by policy, May to October 2026",
        f"One row per policy: a bar from P10 to P90 of daily value in {UNIT}, a tick at P50 and a dot "
        f"at the mean. {p50s}. Window {win}. {' '.join(CAPTION)}")
    x = x_scale(data)
    ax = data["axis"]

    c.text(48, 84, "One good day proves little: daily value over the whole backtest", size=52,
           weight="bold")
    c.text(48, 136, f"{UNIT}, one simulated Torus-style station, {win}", size=30, token="muted")
    c.text(48, 190, "Bar: P10 to P90 of daily values.  Tick and number: P50.  Dot: mean.", size=30)

    y_top = Y_ROW0 - 60
    y_bot = Y_ROW0 + ROW_H * (len(POLICIES) - 1) + 70
    for v in range(int(ax["min"]), int(ax["max"]) + 1, ax["step"]):
        zero = v == 0
        c.line(x(v), y_top, x(v), y_bot, "ink" if zero else "muted", 2 if zero else 1,
               dash=None if zero else "4 6")
        c.text(x(v), y_bot + 40, money(v).replace(".00", ""), size=26, token="muted", anchor="middle",
               mono=True)
    c.text((X0 + X1) / 2, y_bot + 86, f"value per MW per day ({UNIT})", size=28, token="muted",
           anchor="middle")

    pal = c.pal
    for i, ((name, label, token, hatch), row) in enumerate(zip(POLICIES, data["policies"])):
        u = row["usd_per_mw_day"]
        cy = Y_ROW0 + i * ROW_H
        c.text(48, cy - 4, label, size=40, weight="bold")
        c.text(48, cy + 36, name, size=26, token="muted", mono=True)
        fill = c._hatch(token) if hatch else pal[token + "_soft"] if token + "_soft" in pal else pal["bg"]
        _rect(c, x(u["p10"]), cy - BAR_H / 2, x(u["p90"]) - x(u["p10"]), BAR_H, fill, pal[token], "p10-p90")
        for v, anchor, dx in ((u["p10"], "end", -12), (u["p90"], "start", 12)):
            s = money(v)
            w = len(s) * MONO_EM * 26 + 8
            bx = x(v) + dx - (w - 4 if anchor == "end" else 4)
            c.items.append(f'<rect x="{svgplot.fmt(bx)}" y="{svgplot.fmt(cy - 18)}" width="{svgplot.fmt(w)}" '
                           f'height="36" fill="{pal["bg"]}"/>')  # keeps grid lines out of the label
            c.text(x(v) + dx, cy + 9, s, size=26, token="muted", anchor=anchor, mono=True)
        _line(c, x(u["p50"]), cy - BAR_H / 2 - 14, x(u["p50"]), cy + BAR_H / 2 + 14, pal["ink"], 6, "p50")
        c.text(x(u["p50"]), cy - BAR_H / 2 - 24, f"P50 {money(u['p50'])}", size=40, anchor="middle",
               mono=True, weight="bold")
        _dot(c, x(u["mean"]), cy + BAR_H / 2 + 30, 11, pal[token], pal["ink"], "mean")
        c.text(x(u["mean"]) + 20, cy + BAR_H / 2 + 39, f"mean {money(u['mean'])}", size=26, mono=True)

    c.text(48, 940, CAPTION[0] + " " + CAPTION[1], size=28)
    inp = data["input"]
    c.footer([
        f"Source: {inp['path']} (engine backtest, {data['schema']}), sha256 {inp['sha256'][:12]}",
        f"DERIVED. {SCRIPT}. Window {win}. Simulated station on REAL PACE day-ahead prices.",
    ])
    return c.render()


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--input", default=str(ROOT / INPUT))
    ap.add_argument("--out", default=str(ROOT / OUT), help="output path without extension")
    a = ap.parse_args(argv)
    src = pathlib.Path(a.input)
    if not src.exists():
        print(f"chart_backtest: {src.name} not found at {src}. It comes from the engine lane "
              f"({INPUT} on main); nothing written.", file=sys.stderr)
        return 2
    with open(src, encoding="utf-8") as f:
        bt = json.load(f)
    try:
        rel = common.rel(src)
    except ValueError:
        rel = src.name
    data, svgs = build(bt, {"path": rel, "sha256": common.sha256(src)})
    out = pathlib.Path(a.out)
    common.write_json(out.with_name(out.name + ".json"), data)
    common.write_text(out.with_name(out.name + ".svg"), svgs["dark"])
    common.write_text(out.with_name(out.name + ".light.svg"), svgs["light"])
    print("; ".join(f"{r['policy']} P10 {r['usd_per_mw_day']['p10']:.2f} P50 {r['usd_per_mw_day']['p50']:.2f} "
                    f"P90 {r['usd_per_mw_day']['p90']:.2f} mean {r['usd_per_mw_day']['mean']:.2f}"
                    for r in data["policies"]))
    return 0


if __name__ == "__main__":
    sys.exit(main())
