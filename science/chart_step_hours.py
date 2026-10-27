"""Chart: hour of each day's largest price step, October vs July 2026 (issue #103).

Run from the repo root:  python -I science/chart_step_hours.py
Writes science/charts/step_hours_oct_jul.svg (dark, stage), .light.svg (print) and .json.
Step hour: docs/lanes/science.md 6.4, via science.crosscheck.step_summary (the tested function).
"""
import argparse
import datetime as dt
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from science import common, svgplot  # noqa: E402
from science import crosscheck as xc  # noqa: E402

SCRIPT = "science/chart_step_hours.py"
OUT = "science/charts/step_hours_oct_jul"
OCT = ("research/analysis/option2/oct/20260930_20261028_PRC_LMP_DAM_*.csv", dt.date(2026, 10, 1), dt.date(2026, 10, 27))
JUL = ("research/analysis/option2/jul/20260630_20260730_PRC_LMP_DAM_*.csv", dt.date(2026, 7, 1), dt.date(2026, 7, 30))

# layout
X0, X1 = 170, 1860
Y_TOP, Y_BASE = 370, 800
Y_MAX = 16
HOUR_LABELS = {0: "12am", 3: "3am", 6: "6am", 9: "9am", 12: "12pm", 15: "3pm", 18: "6pm", 21: "9pm"}


def series(summary):
    return [summary["by_hour"].get(str(h), 0) for h in range(24)]


def build(oct_days, jul_days, meta):
    so, sj = xc.step_summary(oct_days), xc.step_summary(jul_days)
    oc, jc = series(so), series(sj)
    data = {
        "chart": "step_hours_oct_jul", "class": "DERIVED", "script": SCRIPT, "node": xc.NODE,
        "definition": "largest p[h] - p[h-1], h = 1..23, Mountain day from 06:00Z, ties to the earliest h",
        "inputs": meta["inputs"],
        "october": {"first_day": min(oct_days).isoformat(), "last_day": max(oct_days).isoformat(),
                    "n_days": so["n_days"], "counts_by_hb": oc, "hb17_or_18": oc[17] + oc[18],
                    "median_step": round(so["median_step"], 5)},
        "july": {"first_day": min(jul_days).isoformat(), "last_day": max(jul_days).isoformat(),
                 "n_days": sj["n_days"], "counts_by_hb": jc, "hb13_to_20": sum(jc[13:21]),
                 "median_step": round(sj["median_step"], 5)},
    }
    oct_label = meta.get("oct_label") or (
        f"{data['october']['hb17_or_18']} of {so['n_days']} October days: HB 5pm or 6pm")
    jul_label = meta.get("jul_label") or (
        f"July: {data['july']['hb13_to_20']} of {sj['n_days']} between HB 1pm and 8pm")
    data["labels"] = {"october": oct_label, "july": jul_label}
    svgs = {t: draw(t, data, oct_label, jul_label, meta["footer"]) for t in ("dark", "light")}
    return data, svgs


def draw(theme, data, oct_label, jul_label, footer):
    c = svgplot.Chart(
        theme, "Hour of each day's largest price step, October vs July 2026",
        f"Bar chart by hour beginning, Mountain time. {oct_label}. {jul_label}. "
        "October bars are solid, July bars are hatched. PacifiCorp East day-ahead prices.")
    oc, jc = data["october"]["counts_by_hb"], data["july"]["counts_by_hb"]
    x = svgplot.Scale(0, 24, X0, X1)
    y = svgplot.Scale(0, Y_MAX, Y_BASE, Y_TOP)
    gw = (X1 - X0) / 24
    bw = gw * 0.38

    c.text(X0 - 120, 84, "When does the day's biggest price jump land?", size=52, weight="bold")
    c.text(X0 - 120, 136, "PacifiCorp East day-ahead price, largest rise from one hour to the next, each day",
           size=30, token="muted")
    # direct labels with swatches (pattern and text, never color alone)
    c.rect(X0 - 120, 176, 44, 44, "jam")
    c.text(X0 - 60, 214, oct_label, size=44, mono=True, weight="bold")
    c.rect(X0 - 120, 246, 44, 44, "accent", hatch=True)
    c.text(X0 - 60, 284, jul_label, size=44, mono=True, weight="bold")

    for v in range(0, Y_MAX + 1, 5):
        c.line(X0, y(v), X1, y(v), "muted", 1, dash="4 6")
        c.text(X0 - 16, y(v) + 9, str(v), size=26, token="muted", anchor="end", mono=True)
    c.text(X0 - 16, Y_TOP - 22, "days", size=26, token="muted", anchor="end")

    for h in range(24):
        gx = x(h) + gw * 0.1
        if oc[h]:
            c.rect(gx, y(oc[h]), bw, Y_BASE - y(oc[h]), "jam")
        if jc[h]:
            c.rect(gx + bw + 4, y(jc[h]), bw, Y_BASE - y(jc[h]), "accent", hatch=True)
    for h in (17, 18):  # the two October bars the headline counts
        c.text(x(h) + gw * 0.1 + bw / 2, y(oc[h]) - 12, str(oc[h]), size=40, mono=True, anchor="middle",
               weight="bold")
    c.line(X0, Y_BASE, X1, Y_BASE, "ink", 2)
    for h, lab in HOUR_LABELS.items():
        cx = x(h) + gw / 2  # center of the hour's bar pair
        c.line(cx, Y_BASE, cx, Y_BASE + 10, "ink", 2)
        c.text(cx, Y_BASE + 44, lab, size=28, anchor="middle")
    c.text((X0 + X1) / 2, Y_BASE + 94, "hour beginning, Mountain time", size=30, token="muted", anchor="middle")
    c.footer(footer)
    return c.render()


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--oct", nargs="+", default=[OCT[0]])
    ap.add_argument("--jul", nargs="+", default=[JUL[0]])
    a = ap.parse_args(argv)
    of, jf = xc.expand(a.oct), xc.expand(a.jul)
    od, oskip = xc.mountain_window(common.read_oasis_lmp(of, xc.NODE), OCT[1], OCT[2])
    jd, jskip = xc.mountain_window(common.read_oasis_lmp(jf, xc.NODE), JUL[1], JUL[2])
    if oskip or jskip:
        raise SystemExit(f"skipped days: {oskip} {jskip}")
    meta = {"inputs": common.input_record(of + jf), "footer": [
        "Source: CAISO OASIS day-ahead LMP, ELAP_PACE-APND, " + common.rel(of[0]),
        "and " + common.rel(jf[0]),
        f"DERIVED. {SCRIPT}. Mountain days Oct 1 to 27 (27) and Jul 1 to 30 (30), 2026; ties go to the earlier hour.",
    ]}
    data, svgs = build(od, jd, meta)
    common.write_json(ROOT / (OUT + ".json"), data)
    common.write_text(ROOT / (OUT + ".svg"), svgs["dark"])
    common.write_text(ROOT / (OUT + ".light.svg"), svgs["light"])
    print(data["labels"]["october"], "|", data["labels"]["july"], "| medians",
          data["october"]["median_step"], data["july"]["median_step"])


if __name__ == "__main__":
    main()
