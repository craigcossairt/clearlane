"""System Critical Hours rule study, May to Oct 2026 (issue #109, flag off_sch_study).

Run from the repo root:  python -I science/sch_study.py
Writes science/sch_study.json, science/charts/sch_rules.svg and .json, and the results block in
science/sch-study.md. Definitions, statistics and tolerances: science/sch-study.md, written before
computing. Lanes: docs/lanes/science.md 6.6, via science.crosscheck.lanes.
"""

import argparse
import datetime as dt
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from science import common, svgplot  # noqa: E402
from science import crosscheck as xc  # noqa: E402

SCHEMA = "clearlane.science.sch_study/v1"
SCRIPT = "science/sch_study.py"
FLAG = "off_sch_study"
HIST = "public/data/hist_2026-05-01_2026-10-27.json"
EIA_FILES = [
    "research/data/eia930/PACE_EIA930_BALANCE_2026_Jan_Jun.csv",
    "research/data/eia930/PACE_EIA930_BALANCE_2026_Jul_Dec.csv",
]
BUNDLE = "public/data/bundle_2026-10-27.json"
ENVELOPE = "public/derived/envelope_2026-10-27.json"
TORUS = "public/data/torus_published.json"
OUT_JSON = "science/sch_study.json"
OUT_SVG = "science/charts/sch_rules.svg"
OUT_CHART_JSON = "science/charts/sch_rules.json"
OUT_MD = "science/sch-study.md"

DEMAND = "Demand (MW) (Adjusted)"
SOLAR = "Net Generation (MW) from Solar without Integrated Battery Storage (Adjusted)"
WIND = "Net Generation (MW) from Wind without Integrated Battery Storage (Adjusted)"

WINDOW = (dt.date(2026, 5, 1), dt.date(2026, 10, 27))
TOP_NET = 4
TOP_PRICE = 6  # FACTS sch_hours_today
PCTL = 0.75
FACTS_SCH_COUNT = 6  # FACTS sch_hours_today
FACTS_JAM_MIN = 47.18  # FACTS lane_jam_min_usd
FACTS_HEATMAP = [9, 41, 5, 4, 1, 3, 4, 14, 23, 26, 25, 20, 15, 33, 19, 14, 14, 8, 6, 4, 5, 34, 24, 8]

RULES = ("ours", "top6_price", "netload_p75", "top4_netload")
RULE_LABELS = {
    "ours": "Ours",
    "top6_price": "Top 6 price",
    "netload_p75": "Net load P75",
    "top4_netload": "Top 4 net load",
}
RULE_WORDS = {
    "ours": "ours: the 4 highest net-load hours plus every jam hour",
    "top6_price": "the 6 highest-price hours",
    "netload_p75": "every hour at or above the season's 75th percentile of net load",
    "top4_netload": "the 4 highest net-load hours only (ours without the jam part)",
}
STYLE = {
    "ours": ("jam", None, 6),
    "top6_price": ("accent", "18 10", 4),
    "netload_p75": ("shoulder", "4 10", 5),
    "top4_netload": ("ink", "26 8 6 8", 3),
}
READINGS = ("mountain", "utc")


# ------------------------------------------------------------------ pure functions


def top_k(values, k):
    """(the k hours with the highest values, ties to the earlier hour, sorted; tie at the boundary)."""
    order = sorted(range(len(values)), key=lambda h: (-values[h], h))
    tie = k < len(values) and values[order[k - 1]] == values[order[k]]
    return sorted(order[:k]), tie


def jam_hours(p):
    jam = xc.lanes(p)["jam_min"]
    return [h for h in range(len(p)) if p[h] >= jam]


def rule_ours(net, p):
    top, tie = top_k(net, TOP_NET)
    jam = jam_hours(p)
    return {"hours": sorted(set(top) | set(jam)), "top4": top, "jam": jam, "tie": tie}


def rule_top_price(p, n=TOP_PRICE):
    hours, tie = top_k(p, n)
    return {"hours": hours, "tie": tie}


def rule_threshold(net, thr):
    return {"hours": [h for h in range(len(net)) if net[h] >= thr]}


def rule_top4(net):
    hours, tie = top_k(net, TOP_NET)
    return {"hours": hours, "tie": tie}


def eia_net_load(row):
    """Demand minus max(0, solar) minus wind, from the (Adjusted) columns; None if a cell is blank."""
    d, s, w = (common.num(row.get(c)) for c in (DEMAND, SOLAR, WIND))
    if d is None or s is None or w is None:
        return None
    return d - max(s, 0.0) - w


def eia_days(rows):
    """({date: 24 net loads by HB} for complete Mountain days, {date: complete hours} for the rest)."""
    seen, by_day = {}, {}
    for r in rows:
        t = r["utc_start"]
        v = eia_net_load(r)
        if t in seen and seen[t] != v:
            raise ValueError(f"EIA-930 hour {t.isoformat()} differs between files: {seen[t]} vs {v}")
        seen[t] = v
        d, h = common.mountain_hb(t)
        by_day.setdefault(d, {})[h] = v
    days, incomplete = {}, {}
    for d in sorted(by_day):
        hours = by_day[d]
        good = [h for h in range(24) if hours.get(h) is not None]
        if len(good) == 24:
            days[d] = [hours[h] for h in range(24)]
        else:
            incomplete[d] = len(good)
    return days, incomplete


def reading_weights(counts, reading):
    """Call weights by Mountain hour beginning: label h as HB h MT, or as UTC h = MT (h - 6) mod 24."""
    total = sum(counts)
    w = [0.0] * 24
    for h, c in enumerate(counts):
        w[h if reading == "mountain" else (h - 6) % 24] += c / total
    return w


def shape(flags):
    """f(h): share of days on which hour h is flagged, from {day: [hours]}."""
    n = len(flags)
    f = [0] * 24
    for hours in flags.values():
        for h in hours:
            f[h] += 1
    return [c / n for c in f]


def overlap(f, w, mean_per_day):
    cov = sum(a * b for a, b in zip(f, w))
    budget = mean_per_day / 24
    return {"coverage": cov, "budget": budget, "lift": cov / budget if budget else None}


def jaccard(a, b):
    return 1.0 if not (a or b) else len(a & b) / len(a | b)


def spread_labels(ys, gap, lo, hi):
    """Label y positions at least `gap` apart in [lo, hi]: push down from lo, then pull back up from hi."""
    order = sorted(range(len(ys)), key=lambda i: (ys[i], i))
    pos = []
    for i in order:
        pos.append(max(ys[i], lo) if not pos else max(ys[i], pos[-1] + gap))
    for n in range(len(pos) - 1, -1, -1):
        pos[n] = min(pos[n], hi) if n == len(pos) - 1 else min(pos[n], pos[n + 1] - gap)
    out = [0.0] * len(ys)
    for i, y in zip(order, pos):
        out[i] = y
    return out


# ------------------------------------------------------------------ chart

X0, X1 = 200, 1450
Y1_TOP, Y1_BASE = 210, 520
Y2_TOP, Y2_BASE = 640, 860
CALL_MAX = 45
HOUR_LABELS = {0: "12am", 3: "3am", 6: "6am", 9: "9am", 12: "12pm", 15: "3pm", 18: "6pm", 21: "9pm"}


def draw_chart(theme, shapes, means, calls, footer):
    c = svgplot.Chart(
        theme,
        "System Critical Hours: four rules over May to October 2026",
        "Line chart of the share of season days each rule flags each hour beginning, Mountain time, for four "
        "rules labeled in text: "
        + "; ".join(f"{RULE_LABELS[k]}, {RULE_WORDS[k]}" for k in RULES)
        + ". Below, bars of the 2025 RMP calls by hour in Mountain time, confirmed by Torus. "
        "PacifiCorp East day-ahead prices and EIA-930 net load.",
    )
    gw = (X1 - X0) / 24
    xc_ = lambda h: X0 + gw * (h + 0.5)  # noqa: E731
    y1 = svgplot.Scale(0, 1, Y1_BASE, Y1_TOP)
    y2 = svgplot.Scale(0, CALL_MAX, Y2_BASE, Y2_TOP)

    c.text(48, 76, "Which hours does each System Critical Hours rule flag?", size=50, weight="bold")
    c.text(
        48,
        124,
        "Share of season days each hour is flagged; PacifiCorp East, May to October 2026",
        size=30,
        token="muted",
    )
    c.text(48, 176, "share of days flagged; labels give each rule's mean hours flagged a day", size=26, token="muted")
    for v in (0, 0.25, 0.5, 0.75, 1.0):
        c.line(X0, y1(v), X1, y1(v), "muted", 1, dash="4 6")
        c.text(X0 - 14, y1(v) + 9, f"{round(v * 100)}%", size=26, token="muted", anchor="end", mono=True)
    ends = []
    for k in RULES:
        token, dash, width = STYLE[k]
        c.polyline([(xc_(h), y1(shapes[k][h])) for h in range(24)], token, width=width, dash=dash)
        ends.append(y1(shapes[k][23]))
    ly = spread_labels(ends, 40.0, Y1_TOP + 10, Y1_BASE + 20)
    for k, y_end, y_lab in zip(RULES, ends, ly):
        token, dash, width = STYLE[k]
        c.line(xc_(23), y_end, X1 + 24, y_lab - 9, token, 2)
        c.text(X1 + 32, y_lab, f"{RULE_LABELS[k]}, {means[k]:.1f} a day", size=28, token=token, weight="bold")
    c.line(X0, Y1_BASE, X1, Y1_BASE, "ink", 2)
    for h, lab in HOUR_LABELS.items():
        c.line(xc_(h), Y1_BASE, xc_(h), Y1_BASE + 10, "ink", 2)
        c.text(xc_(h), Y1_BASE + 40, lab, size=26, anchor="middle")

    c.text(
        48,
        Y2_TOP - 36,
        "2025 RMP calls by hour, Mountain time, confirmed by Torus (TORUS_PUBLISHED)",
        size=28,
        token="muted",
    )
    bw = gw * 0.7
    for h in range(24):
        c.rect(xc_(h) - bw / 2, y2(calls[h]), bw, Y2_BASE - y2(calls[h]), "accent", hatch=True)
        c.text(xc_(h), y2(calls[h]) - 8, str(calls[h]), size=24, anchor="middle", mono=True)
    c.line(X0, Y2_BASE, X1, Y2_BASE, "ink", 2)
    for h, lab in HOUR_LABELS.items():
        c.text(xc_(h), Y2_BASE + 34, lab, size=26, anchor="middle")
    c.text((X0 + X1) / 2, Y2_BASE + 74, "hour beginning, Mountain time", size=26, token="muted", anchor="middle")
    c.footer(footer)
    return c.render()


# ------------------------------------------------------------------ study


def _path(p):
    p = pathlib.Path(p)
    return p if p.is_absolute() else ROOT / p


def season(hist_rows, eia_by_day, eia_incomplete):
    hist = {}
    short = {}
    for r in hist_rows:
        d = dt.date.fromisoformat(r["operating_day_mt"])
        p = r["lmp_usd_mwh"]
        if len(p) == 24 and all(isinstance(x, (int, float)) for x in p):
            hist[d] = [float(x) for x in p]
        else:
            short[d] = len(p)
    days, skipped = [], []
    d = WINDOW[0]
    while d <= WINDOW[1]:
        why = []
        if d not in hist:
            why.append(f"hist file has {short[d]} prices" if d in short else "no hist row")
        if d not in eia_by_day:
            why.append(f"EIA-930 has {eia_incomplete[d]} complete hours" if d in eia_incomplete else "no EIA-930 hours")
        if why:
            skipped.append({"day": d.isoformat(), "reason": "; ".join(why)})
        else:
            days.append(d)
        d += dt.timedelta(days=1)
    return days, hist, skipped


def oct27_row(bundle, envelope, hist_jam_check=None):
    hours = sorted(bundle["hours"], key=lambda r: r["ts_utc"])
    hbs = [common.mountain_hb(common.parse_oasis_time(r["ts_utc"].replace("Z", "+00:00")))[1] for r in hours]
    if hbs != list(range(24)):
        raise ValueError(f"bundle hours are not HB 0..23: {hbs}")
    net = [r["load_fcst_mw"] - max(r["solar_fcst_mw"], 0.0) - r["wind_fcst_mw"] for r in hours]
    p = [r["lmp_usd_mwh"] for r in hours]
    ours = rule_ours(net, p)
    env = [
        common.mountain_hb(common.parse_oasis_time(h["ts_utc"].replace("Z", "+00:00")))[1]
        for h in envelope["hours"]
        if h["system_critical"]
    ]
    net_diff = max(abs(a - r["net_load_mw"]) for a, r in zip(net, hours))
    jam_min = xc.lanes(p)["jam_min"]
    ok = sorted(env) == ours["hours"] and len(env) == FACTS_SCH_COUNT
    return {
        "inputs_used": "bundle CAISO day-ahead forecasts and prices (the engine's inputs), not EIA-930 actuals",
        "science": ours,
        "envelope_system_critical_hb": sorted(env),
        "facts_sch_hours_today": FACTS_SCH_COUNT,
        "status": "match" if ok else "mismatch",
        "net_load_max_abs_diff_vs_bundle": net_diff,
        "net_load_status": "match" if net_diff <= 0.01 else "mismatch",
        "jam_min": jam_min,
        "jam_min_status": "match" if xc.rounds_equal(jam_min, FACTS_JAM_MIN, 2) else "mismatch",
        "other_rules": {"top6_price": rule_top_price(p)["hours"], "top4_netload": rule_top4(net)["hours"]},
    }


def run(a):
    hist_p, bundle_p, env_p, torus_p = (_path(x) for x in (a.hist, a.bundle, a.envelope, a.torus))
    eia_p = [_path(x) for x in a.eia]
    rows = []
    for p in sorted(eia_p):
        rows.extend(common.read_eia930(p))
    eia_by_day, eia_incomplete = eia_days(rows)
    days, hist, skipped = season(xc._load_json(hist_p), eia_by_day, eia_incomplete)
    all_net = [v for d in days for v in eia_by_day[d]]
    thr = xc.pctl_linear(all_net, PCTL)

    per_day, ties = {}, {"ours": 0, "top6_price": 0, "top4_netload": 0}
    for d in days:
        net, p = eia_by_day[d], hist[d]
        r = {
            "ours": rule_ours(net, p),
            "top6_price": rule_top_price(p),
            "netload_p75": rule_threshold(net, thr),
            "top4_netload": rule_top4(net),
        }
        for k in ties:
            ties[k] += bool(r[k]["tie"])
        per_day[d.isoformat()] = {k: r[k]["hours"] for k in RULES}
        per_day[d.isoformat()]["jam"] = r["ours"]["jam"]

    flags = {k: {d: v[k] for d, v in per_day.items()} for k in RULES}
    shapes = {k: shape(flags[k]) for k in RULES}
    means = {k: sum(len(v) for v in flags[k].values()) / len(days) for k in RULES}

    months = {}
    for d, v in per_day.items():
        m = months.setdefault(d[:7], {"days": 0, "jam": 0, **{k: 0 for k in RULES}})
        m["days"] += 1
        m["jam"] += len(v["jam"])
        for k in RULES:
            m[k] += len(v[k])
    for m in months.values():
        m["mean_per_day"] = {k: m[k] / m["days"] for k in RULES}
        m["mean_per_day"]["jam"] = m["jam"] / m["days"]

    torus = xc._load_json(torus_p)
    calls = list(torus["events_2025_by_hour"]["value"])
    heat_ok = calls == FACTS_HEATMAP and sum(calls) == 359
    weights = {r: reading_weights(calls, r) for r in READINGS}
    ov = {k: {r: overlap(shapes[k], weights[r], means[k]) for r in READINGS} for k in RULES}
    sets = {k: {(d, h) for d, hs in flags[k].items() for h in hs} for k in RULES}
    jac = {k: jaccard(sets["ours"], sets[k]) for k in RULES if k != "ours"}

    out = {
        "schema": SCHEMA,
        "script": SCRIPT,
        "flag": FLAG,
        "class": "DERIVED",
        "inputs": common.input_record([hist_p, bundle_p, env_p, torus_p] + eia_p),
        "rules": RULE_WORDS,
        "parameters": {
            "top_net": TOP_NET,
            "top_price": TOP_PRICE,
            "percentile": PCTL,
            "jam": "price at or over the day's max minus 25% of its range",
        },
        "season": {
            "window": [WINDOW[0].isoformat(), WINDOW[1].isoformat()],
            "days": len(days),
            "first": days[0].isoformat(),
            "last": days[-1].isoformat(),
            "skipped": skipped,
            "netload_p75_mw": thr,
        },
        "per_day": per_day,
        "boundary_ties": ties,
        "mean_per_day": means,
        "months": months,
        "shape": shapes,
        "heatmap": {
            "counts": calls,
            "sum": sum(calls),
            "matches_facts": heat_ok,
            "readings": {
                "mountain": "label h is HB h MT; confirmed by Torus (FACTS heatmap_readings)",
                "utc": "sensitivity only, not for stage: MT hour = (h - 6) mod 24",
            },
        },
        "overlap": ov,
        "jaccard_vs_ours": jac,
        "oct27": oct27_row(xc._load_json(bundle_p), xc._load_json(env_p)),
    }
    chart = {
        "chart": "sch_rules",
        "class": "DERIVED",
        "script": SCRIPT,
        "inputs": out["inputs"],
        "season": {k: out["season"][k] for k in ("first", "last", "days")},
        "share_of_days_flagged_by_hb": {k: [round(x, 5) for x in shapes[k]] for k in RULES},
        "mean_flagged_per_day": {k: round(means[k], 5) for k in RULES},
        "labels": {k: f"{RULE_LABELS[k]}, {means[k]:.1f} a day" for k in RULES},
        "calls_2025_by_hb_mountain": calls,
    }
    footer = [
        f"Sources: {HIST} (CAISO day-ahead LMP, ELAP_PACE-APND); EIA-930 PACE balance, research/data/eia930/",
        f"(Adjusted demand, solar and wind); calls: {TORUS} (TORUS_PUBLISHED). Rules are our proposal.",
        f"DERIVED. {SCRIPT}. Mountain days {out['season']['first']} to {out['season']['last']} "
        f"({len(days)} days); EIA-930 values are metered actuals, not CAISO forecasts.",
    ]
    svg = draw_chart("dark", {k: chart["share_of_days_flagged_by_hb"][k] for k in RULES}, means, calls, footer)
    return out, chart, svg


def _pct(x):
    return f"{100 * x:.1f}%"


def results_md(out):
    h = f"`{HIST}`"
    e = "`research/data/eia930/PACE_EIA930_BALANCE_2026_*.csv`"
    t = f"`{TORUS}`"
    s = out["season"]
    sha = {r["path"]: r["sha256"][:12] for r in out["inputs"]}
    lines = [
        f"Run: `python -I {SCRIPT}`. Inputs: {h} (sha256 {sha[HIST]}...), {e} "
        f"({', '.join(sha[p] + '...' for p in EIA_FILES)}), {t} (sha256 {sha[TORUS]}...), "
        f"`{BUNDLE}` (sha256 {sha[BUNDLE]}...) and `{ENVELOPE}` (sha256 {sha[ENVELOPE]}...). "
        "Every value below is DERIVED from these files.",
        "",
        f"Season: {s['days']} Mountain days, {s['first']} to {s['last']}, with 24 prices in {h} and 24 complete "
        f"hours in {e}. Skipped and listed, never filled: "
        + "; ".join(f"{x['day']} ({x['reason']})" for x in s["skipped"])
        + ".",
        "",
        f"Net-load P75 threshold over the season's hours ({e}): {s['netload_p75_mw']:,.1f} MW. "
        f"Ties at the boundary of a top-k rule: {out['boundary_ties']['ours']} days for ours, "
        f"{out['boundary_ties']['top6_price']} for top 6 price.",
        "",
        "### Oct 27, from the engine's own inputs",
        "",
    ]
    o = out["oct27"]
    lines += [
        "| Row | Hours flagged (HB, Mountain) | Count | Status |",
        "|---|---|---|---|",
        f"| ours on `{BUNDLE}` forecasts and prices: top 4 net load {o['science']['top4']}, jam {o['science']['jam']} "
        f"| {o['science']['hours']} | {len(o['science']['hours'])} | {o['status']} |",
        f"| engine `system_critical` in `{ENVELOPE}`; FACTS sch_hours_today {o['facts_sch_hours_today']} | "
        f"{o['envelope_system_critical_hb']} | {len(o['envelope_system_critical_hb'])} | |",
        f"| net load from `{BUNDLE}` forecasts vs its `net_load_mw` (max abs diff {o['net_load_max_abs_diff_vs_bundle']:.3f} MW) "
        f"| | | {o['net_load_status']} |",
        f"| jam threshold from `{BUNDLE}` prices: {o['jam_min']:.4f} vs FACTS lane_jam_min_usd ${FACTS_JAM_MIN} | | | "
        f"{o['jam_min_status']} |",
        f"| for contrast, top 6 price on `{BUNDLE}` | {o['other_rules']['top6_price']} | "
        f"{len(o['other_rules']['top6_price'])} | |",
        "",
        "EIA-930 values are metered actuals and differ from the CAISO day-ahead forecasts the engine plans on; the "
        "Oct 27 row uses the forecasts, the season uses the actuals. EIA-930 has no complete Oct 27 in these files.",
        "",
        f"### Hours flagged per month (source {h} and {e})",
        "",
        "| Month | Days | " + " | ".join(RULE_LABELS[k] for k in RULES) + " | Jam hours (part of ours) |",
        "|---|---|" + "---|" * (len(RULES) + 1),
    ]
    for mo, m in sorted(out["months"].items()):
        lines.append(
            f"| {mo} | {m['days']} | "
            + " | ".join(f"{m[k]} ({m['mean_per_day'][k]:.1f} a day)" for k in RULES + ("jam",))
            + " |"
        )
    total_jam = sum(m["jam"] for m in out["months"].values())
    lines.append(
        f"| season | {s['days']} | "
        + " | ".join(f"{sum(m[k] for m in out['months'].values())} ({out['mean_per_day'][k]:.1f} a day)" for k in RULES)
        + f" | {total_jam} ({total_jam / s['days']:.1f} a day) |"
    )
    lines += [
        "",
        f"### Overlap with the 2025 call counts by hour (calls: {t}, TORUS_PUBLISHED; flags: {h} and {e})",
        "",
        "Coverage is the expected share of calls landing in a flagged hour if the 2025 call hours fall on a random "
        "season day; lift is coverage divided by the share of hours flagged (1.0 is no better than random). The "
        "Mountain reading is the one FACTS records as confirmed by Torus; the UTC column is a sensitivity check "
        "only and is not for stage.",
        "",
        "| Rule | Hours flagged a day | Share of hours | Coverage, Mountain | Lift, Mountain | Coverage, UTC "
        "(sensitivity) | Lift, UTC (sensitivity) | Jaccard with ours |",
        "|---|---|---|---|---|---|---|---|",
    ]
    for k in RULES:
        mt, ut = out["overlap"][k]["mountain"], out["overlap"][k]["utc"]
        j = "1.000" if k == "ours" else f"{out['jaccard_vs_ours'][k]:.3f}"
        lines.append(
            f"| {RULE_WORDS[k]} | {out['mean_per_day'][k]:.2f} | {_pct(mt['budget'])} | {_pct(mt['coverage'])} "
            f"| {mt['lift']:.2f} | {_pct(ut['coverage'])} | {ut['lift']:.2f} | {j} |"
        )
    hm = out["heatmap"]
    lines += [
        "",
        f"Call counts in {t} match FACTS rmp_heatmap_by_hour: {'yes' if hm['matches_facts'] else 'no'} "
        f"(sum {hm['sum']}).",
        "",
        f"Chart: `{OUT_SVG}` (Mountain reading only); plotted values in `{OUT_CHART_JSON}`.",
    ]
    return "\n".join(lines) + "\n"


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--hist", default=HIST)
    ap.add_argument("--eia", nargs="+", default=EIA_FILES)
    ap.add_argument("--bundle", default=BUNDLE)
    ap.add_argument("--envelope", default=ENVELOPE)
    ap.add_argument("--torus", default=TORUS)
    ap.add_argument("--out-dir", default=None, help="write the three outputs here instead of science/")
    ap.add_argument("--no-md", action="store_true", help="do not touch the md")
    a = ap.parse_args(argv)
    out, chart, svg = run(a)
    if a.out_dir:
        d = pathlib.Path(a.out_dir)
        paths = (d / "sch_study.json", d / "sch_rules.json", d / "sch_rules.svg")
    else:
        paths = (ROOT / OUT_JSON, ROOT / OUT_CHART_JSON, ROOT / OUT_SVG)
    common.write_json(paths[0], out)
    common.write_json(paths[1], chart)
    common.write_text(paths[2], svg)
    if not a.no_md:
        common.write_results(ROOT / OUT_MD, results_md(out))
    print(
        "oct27:",
        out["oct27"]["status"],
        out["oct27"]["science"]["hours"],
        "engine",
        out["oct27"]["envelope_system_critical_hb"],
    )
    print("season days:", out["season"]["days"], "skipped:", [x["day"] for x in out["season"]["skipped"]])
    print("mean per day:", {k: round(v, 2) for k, v in out["mean_per_day"].items()})
    print("coverage MT:", {k: round(v["mountain"]["coverage"], 3) for k, v in out["overlap"].items()})
    return out


if __name__ == "__main__":
    main()
