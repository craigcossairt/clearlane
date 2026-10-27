"""Chart: October hour-of-day price vs average CO2 intensity, PacifiCorp East (issue #104).

Run from the repo root:  python -I science/chart_price_co2.py
Writes science/charts/oct_price_co2.svg (dark), .light.svg (print) and .json.
Price: mean PACE day-ahead LMP by hour beginning MT, Mountain days Oct 1 to 25 2026.
CO2 source order: ../clearlane-raw/eia/PACE.xlsx ("CO2 Emissions Intensity for Generated
Electricity", lb/kWh x 453.592), else co2_g_kwh in the hist file, else FACTS co2_profile_he_oct.
EIA hours are hour ENDING local: hour beginning h uses HE h+1.
"""
import argparse
import datetime as dt
import json
import pathlib
import sys
import xml.etree.ElementTree as ET
import zipfile

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from science import common, svgplot  # noqa: E402
from science import crosscheck as xc  # noqa: E402

SCRIPT = "science/chart_price_co2.py"
OUT = "science/charts/oct_price_co2"
FIRST, LAST = dt.date(2026, 10, 1), dt.date(2026, 10, 25)
LB_TO_G = 453.592
CO2_HEADER = "CO2 Emissions Intensity for Generated Electricity"
SHEET = "Published Hourly Data"
PRICE_DEFAULT = "research/data/oasis/dam_oct/*.csv"
HIST = "public/data/hist_2026-05-01_2026-10-27.json"
CAPTION = ("CO2 is estimated, using EIA average emissions for PacifiCorp East (Utah, Wyoming, Idaho); "
           "it is not marginal emissions.")
# FACTS co2_profile_he_oct (g/kWh, hour ENDING 1..24, Oct 1 to 25 2026): fallback 3 only.
FACTS_PROFILE_HE = [697, 697, 695, 694, 698, 704, 709, 698, 623, 534, 485, 461,
                    455, 450, 443, 446, 464, 531, 629, 673, 676, 682, 684, 693]
X_NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
R_NS = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"
HOUR_TICKS = {0: "12am", 3: "3am", 6: "6am", 9: "9am", 12: "12pm", 15: "3pm", 18: "6pm", 21: "9pm"}


def excel_date(serial):
    return dt.date(1899, 12, 30) + dt.timedelta(days=int(float(serial)))


def _col(ref):
    return ref.rstrip("0123456789")


def read_pace_co2(path, first, last):
    """{(local date, hour beginning): g/kWh} from PACE.xlsx, streamed with iterparse."""
    with zipfile.ZipFile(path) as z:
        wb = ET.fromstring(z.read("xl/workbook.xml"))
        rid = next(s.get(R_NS + "id") for s in wb.iter(X_NS + "sheet") if s.get("name") == SHEET)
        rels = ET.fromstring(z.read("xl/_rels/workbook.xml.rels"))
        target = next(r.get("Target") for r in rels if r.get("Id") == rid)
        strings = []
        with z.open("xl/sharedStrings.xml") as f:
            for _, el in ET.iterparse(f):
                if el.tag == X_NS + "si":
                    strings.append("".join(t.text or "" for t in el.iter(X_NS + "t")))
                    el.clear()
        cols, out = None, {}
        with z.open("xl/" + target) as f:
            rows = _rows(f, strings)
            for cells in rows:
                if cols is None:
                    inv = {v: k for k, v in cells.items()}
                    cols = (inv["Local date"], inv["Hour"], inv[CO2_HEADER])
                    continue
                dc, hc, vc = cols
                if dc not in cells or hc not in cells or vc not in cells:
                    continue
                d = excel_date(cells[dc])
                if first <= d <= last:
                    out[(d, int(float(cells[hc])) - 1)] = float(cells[vc]) * LB_TO_G
    return out


def _rows(f, strings):
    """Yield {column letter: value} per sheet row, clearing parsed elements as it goes."""
    for _, el in ET.iterparse(f):
        if el.tag != X_NS + "row":
            continue
        cells = {}
        for c in el.findall(X_NS + "c"):
            v = c.find(X_NS + "v")
            if v is not None:
                cells[_col(c.get("r"))] = strings[int(v.text)] if c.get("t") == "s" else v.text
        el.clear()
        yield cells


def hourly_means(vals):
    """{(date, hb): v} -> ([mean or None] * 24, [n] * 24)."""
    acc = [[] for _ in range(24)]
    for (_, hb), v in vals.items():
        acc[hb].append(v)
    return [sum(a) / len(a) if a else None for a in acc], [len(a) for a in acc]


def facts_fallback():
    return ([float(v) for v in FACTS_PROFILE_HE], [25] * 24,
            "FACTS co2_profile_he_oct (DERIVED from EIA PACE.xlsx), hour ending shifted to hour beginning")


def price_means(paths):
    days, skipped = xc.mountain_window(common.read_oasis_lmp(paths, xc.NODE), FIRST, LAST)
    if skipped:
        raise SystemExit(f"skipped price days {skipped}")
    return hourly_means({(d, h): p[h] for d, p in days.items() for h in range(24)})


def hb_label(h):
    return f"HB {12 if h % 12 == 0 else h % 12}{'am' if h < 12 else 'pm'}"


def build(price, price_n, co2, co2_n, co2_source, footer, inputs):
    data = {"chart": "oct_price_co2", "class": "DERIVED", "script": SCRIPT, "node": xc.NODE,
            "window": {"first_day": FIRST.isoformat(), "last_day": LAST.isoformat()},
            "hour_convention": "hour beginning, Mountain time; CO2 HB h uses EIA HE h+1",
            "price_usd_mwh_by_hb": [round(v, 5) for v in price], "price_n_by_hb": price_n,
            "co2_g_kwh_by_hb": [round(v, 3) for v in co2], "co2_n_by_hb": co2_n, "co2_source": co2_source,
            "priciest_hb": max(range(24), key=lambda h: (price[h], -h)),
            "cleanest_hb": min(range(24), key=lambda h: (co2[h], h)),
            "cheapest_hb": min(range(24), key=lambda h: (price[h], h)),
            "caption": CAPTION, "inputs": inputs}
    return data, {t: draw(t, data, footer) for t in ("dark", "light")}


def draw(theme, d, footer):
    price, co2 = d["price_usd_mwh_by_hb"], d["co2_g_kwh_by_hb"]
    pr, cl = d["priciest_hb"], d["cleanest_hb"]
    c = svgplot.Chart(
        theme, "October price and average CO2 by hour, PacifiCorp East",
        f"Two aligned bar panels by hour beginning, Mountain time, Oct 1 to 25 2026. Top: mean day-ahead "
        f"price, priciest {hb_label(pr)} at ${price[pr]:.1f}/MWh. Bottom: mean CO2 intensity, cleanest "
        f"{hb_label(cl)} at {co2[cl]:.0f} g/kWh. {CAPTION}")
    x0, x1 = 230, 1860
    x = svgplot.Scale(0, 24, x0, x1)
    gw = (x1 - x0) / 24
    bw = gw * 0.7
    c.text(48, 76, "The cheap midday hours are also the lower-CO2 hours", size=50, weight="bold")
    c.text(48, 122, "PacifiCorp East, Oct 1 to 25 2026, mean of 25 days at each hour", size=30, token="muted")

    def panel(vals, top, base, vmax, step, unit, name, token, hatch, mark, mark_text):
        y = svgplot.Scale(0, vmax, base, top)
        for v in range(0, int(vmax) + 1, step):
            c.line(x0, y(v), x1, y(v), "muted", 1, dash="4 6")
            c.text(x0 - 14, y(v) + 9, str(v), size=24, token="muted", anchor="end", mono=True)
        c.text(x0 - 14, top - 22, unit, size=26, token="muted", anchor="end")
        c.text(x0 + 8, top - 22, name, size=28, weight="bold")
        for h in range(24):
            c.rect(x(h) + (gw - bw) / 2, y(vals[h]), bw, base - y(vals[h]), token, hatch=hatch,
                   stroke="ink" if h == mark else None)
        c.line(x0, base, x1, base, "ink", 2)
        mx = x(mark) + gw / 2
        ly = y(max(vals)) - 18  # above the panel's tallest bar, so the label never covers a bar
        anchor = "end" if mark >= 14 else "start"
        c.line(mx, ly + 6, mx, y(vals[mark]) - 4, "ink", 2)
        c.text(mx + (-14 if anchor == "end" else 14), ly, mark_text, size=40, mono=True,
               anchor=anchor, weight="bold")

    panel(price, 220, 470, 70, 20, "$/MWh", "Mean day-ahead price (solid bars)", "accent", False, pr,
          f"Priciest: {hb_label(pr)}, ${price[pr]:.1f}")
    panel(co2, 580, 820, 1000, 250, "g/kWh", "Mean CO2 intensity, estimated (hatched bars)", "muted", True, cl,
          f"Cleanest: {hb_label(cl)}, {co2[cl]:.0f} g/kWh")
    for h, lab in HOUR_TICKS.items():
        c.text(x(h) + gw / 2, 858, lab, size=26, anchor="middle")
    c.text((x0 + x1) / 2, 898, "hour beginning, Mountain time", size=28, token="muted", anchor="middle")
    c.text(48, 944, CAPTION, size=26)
    c.footer(footer)
    return c.render()


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--prices", nargs="+", default=[PRICE_DEFAULT])
    ap.add_argument("--pace-xlsx", default=str(common.RAW / "eia" / "PACE.xlsx"))
    ap.add_argument("--hist", default=HIST)
    a = ap.parse_args(argv)
    pf = xc.expand(a.prices)
    price, price_n = price_means(pf)
    xlsx, hist = pathlib.Path(a.pace_xlsx), ROOT / a.hist
    inputs = list(pf)
    if xlsx.exists():
        co2, co2_n = hourly_means(read_pace_co2(xlsx, FIRST, LAST))
        source = "EIA PACE.xlsx, CO2 Emissions Intensity for Generated Electricity (lb/kWh x 453.592)"
        src_short = "EIA-930 PACE.xlsx (local copy, ../clearlane-raw/eia/PACE.xlsx)"
        inputs.append(xlsx)
    elif hist.exists():
        vals = {}
        for day in json.loads(hist.read_text(encoding="utf-8")):
            d = dt.date.fromisoformat(day["date"])
            if FIRST <= d <= LAST and day.get("co2_g_kwh"):
                for h, v in enumerate(day["co2_g_kwh"]):
                    vals[(d, h)] = float(v)
        co2, co2_n = hourly_means(vals)
        source = src_short = f"co2_g_kwh in {common.rel(hist)}"
        inputs.append(hist)
    else:
        co2, co2_n, source = facts_fallback()
        src_short = "FACTS co2_profile_he_oct"
    if None in co2 or None in price:
        raise SystemExit("an hour has no data")
    footer = [f"Price: CAISO OASIS day-ahead LMP, ELAP_PACE-APND, {common.rel(pf[0])}",
              f"CO2: {src_short}; EIA hour ending h+1 plotted at hour beginning h",
              f"DERIVED. {SCRIPT}. Mountain days Oct 1 to 25 2026 (n = 25 per hour)."]
    data, svgs = build(price, price_n, co2, co2_n, source, footer, common.input_record(inputs))
    common.write_json(ROOT / (OUT + ".json"), data)
    common.write_text(ROOT / (OUT + ".svg"), svgs["dark"])
    common.write_text(ROOT / (OUT + ".light.svg"), svgs["light"])
    print("co2 source:", source)
    print("price n", sorted(set(price_n)), "co2 n", sorted(set(co2_n)))
    print("priciest", data["priciest_hb"], "cleanest", data["cleanest_hb"], "cheapest", data["cheapest_hb"])


if __name__ == "__main__":
    main()
