"""Independent cross-check of the pinned Oct 27 numbers from raw public files (issue #102).

Run from the repo root:  python -I science/crosscheck.py [--day 2026-10-27] [...]
Writes science/crosscheck.json and the results table in science/crosscheck.md.
Definitions: docs/lanes/science.md 6.1 to 6.6 and 6.9; claim text in docs/FACTS.md.
"""
import argparse
import csv
import datetime as dt
import json
import math
import pathlib
import statistics
import sys
import xml.etree.ElementTree as ET

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from science import common, dp  # noqa: E402

SCHEMA = "clearlane.science.crosscheck/v1"
SCRIPT = "science/crosscheck.py"
NODE = "ELAP_PACE-APND"
RTE = 0.88  # ASSUMPTION, split as sqrt on each leg
USABLE_MWH = 2.0
FIXED_CHARGE = [1, 2, 3, 4]      # HB 1am to 4am
DISCHARGE = [18, 19]             # HB 6pm to 7pm
TIMETABLE_CHARGE = [13, 14, 15]  # HB 1pm to 3pm, an Oct 27 result
# Current FACTS pins for the backtest rows (docs/FACTS.md, after #213); the older pins are in the md history.
FACTS_CLEARLANE_P10 = 1.28
FACTS_CLEARLANE_P50 = 38.69
FACTS_CLEARLANE_P90 = 116.00
FACTS_SHARE_BEATING_PCT = 91
FACTS_CYCLES_FIXED = 365
FACTS_CYCLES_PRICE_ONLY = 625

FUEL_COLUMNS = {
    "coal": "Net Generation (MW) from Coal (Adjusted)",
    "gas": "Net Generation (MW) from Natural Gas (Adjusted)",
    "hydro": "Net Generation (MW) from Hydropower Excluding Pumped Storage (Adjusted)",
    "solar": "Net Generation (MW) from Solar without Integrated Battery Storage (Adjusted)",
    "wind": "Net Generation (MW) from Wind without Integrated Battery Storage (Adjusted)",
    "geothermal": "Net Generation (MW) from Geothermal (Adjusted)",
    "other": "Net Generation (MW) from Other Fuel Sources (Adjusted)",
}

DEF = {
    "prices": ["research/analysis/option2/oct/20260930_20261028_PRC_LMP_DAM_*.csv",
               "research/data/caiso2/*.csv"],
    "step_oct": ["research/analysis/option2/oct/20260930_20261028_PRC_LMP_DAM_*.csv"],
    "step_jul": ["research/analysis/option2/jul/20260630_20260730_PRC_LMP_DAM_*.csv"],
    "fossil_oct_lmp": ["research/data/oasis/dam_oct/*.csv"],
    "fossil_jul_lmp": ["research/data/oasis/dam_jul/*.csv"],
    "eia": ["research/data/eia930/PACE_EIA930_BALANCE_2026_Jul_Dec.csv"],
    "load": ["research/data/caiso3/*.csv"],
    "windsolar": ["research/data/caiso4/*.xml"],
    "snapshot": "research/data/pace_snapshot_2026-10-27.csv",
    # #107: backtest and history
    "hist": "public/data/hist_2026-05-01_2026-10-27.json",
    "backtest": "public/derived/backtest.json",
    "backtest_days": "public/derived/backtest_days.json",
    "site": "public/derived/site_default.json",
    "bundle": "public/data/bundle_2026-10-27.json",
    "raw_may": ["research/data/caiso7/20260425_20260524_*.csv"],
    "raw_jul": ["research/data/oasis/dam_jul/*.csv"],
    "raw_oct": ["research/analysis/option2/oct/20260930_20261028_PRC_LMP_DAM_*.csv"],
}


# ------------------------------------------------------------------ pure functions

def race_value(p, charge, discharge, rte=RTE, mwh=USABLE_MWH):
    """$ per MW-day: sell mwh*sqrt(rte) at mean discharge price, buy mwh/sqrt(rte) at mean charge."""
    leg = math.sqrt(rte)
    mc = sum(p[h] for h in charge) / len(charge)
    md = sum(p[h] for h in discharge) / len(discharge)
    return mwh * leg * md - mwh / leg * mc


def step_hour(p):
    """(h, step) for the largest p[h] - p[h-1], h = 1..23; ties go to the earliest h."""
    best_h, best = None, None
    for h in range(1, 24):
        s = p[h] - p[h - 1]
        if best is None or s > best:
            best_h, best = h, s
    return best_h, best


def step_summary(days):
    hours, steps, per_day = {}, [], {}
    for d in sorted(days):
        h, s = step_hour(days[d])
        hours[str(h)] = hours.get(str(h), 0) + 1
        steps.append(s)
        per_day[d.isoformat()] = {"hb": h, "step": round(s, 5)}
    return {"n_days": len(days), "by_hour": dict(sorted(hours.items(), key=lambda kv: int(kv[0]))),
            "median_step": statistics.median(steps), "per_day": per_day}


def count_in(summary, hb_range):
    return sum(n for h, n in summary["by_hour"].items() if int(h) in hb_range)


def fossil_share(row):
    vals = {k: max(common.num(row.get(c)) or 0.0, 0.0) for k, c in FUEL_COLUMNS.items()}
    total = sum(vals.values())
    return (vals["coal"] + vals["gas"]) / total if total > 0 else None


def deciles(hours):
    """hours: [(utc_start, lmp, share 0..1)]. Rank by LMP then time; 10 equal bins, cheapest first."""
    n = len(hours)
    if n % 10:
        raise ValueError(f"{n} hours do not split into 10 equal deciles")
    k = n // 10
    ranked = sorted(hours, key=lambda x: (x[1], x[0]))
    out = []
    for i in range(10):
        b = ranked[i * k:(i + 1) * k]
        out.append({"decile": i + 1, "n": k,
                    "mean_lmp": sum(x[1] for x in b) / k,
                    "mean_share_pct": 100.0 * sum(x[2] for x in b) / k})
    return out


def net_load(load, solar, wind):
    return load - max(solar, 0.0) - wind


def lanes(p):
    lo, hi = min(p), max(p)
    rng = hi - lo
    return {"min": lo, "max": hi, "range": rng, "clear_max": lo + 0.25 * rng,
            "jam_min": hi - 0.25 * rng, "min_hb": p.index(lo), "max_hb": p.index(hi)}


def rounds_equal(value, pinned, decimals):
    return round(value, decimals) == round(pinned, decimals)


# ------------------------------------------------------------------ readers

def expand(patterns):
    out = []
    for pat in patterns:
        p = pathlib.Path(pat)
        base = p if p.is_absolute() else ROOT / p
        hits = sorted(base.parent.glob(base.name))
        if not hits:
            raise FileNotFoundError(pat)
        out.extend(hits)
    return out


def mountain_window(series, first, last):
    days, skipped = common.group_mountain_days(series)
    keep = {d: v for d, v in days.items() if first <= d <= last}
    skip = [(d, n) for d, n in skipped if first <= d <= last]
    return keep, skip


def read_load(paths, area="PACE"):
    out = {}
    for path in paths:
        with open(path, encoding="utf-8", newline="") as f:
            for r in csv.DictReader(f):
                if r["TAC_AREA_NAME"] == area and r["MARKET_RUN_ID"] == "DAM":
                    t = common.parse_oasis_time(r["INTERVALSTARTTIME_GMT"])
                    if t in out:
                        raise ValueError(f"duplicate load hour {t}")
                    out[t] = float(r["MW"])
    return out


def read_windsolar(paths, grp="PACE"):
    """{utc_start: (solar, wind)}; sub-hourly rows would be averaged to hours (none seen)."""
    acc = {}
    for path in paths:
        for el in ET.parse(path).getroot().iter():
            if not el.tag.endswith("REPORT_DATA"):
                continue
            f = {c.tag.split("}")[-1]: (c.text or "") for c in el}
            if f.get("BAA_GRP_ID") != grp:
                continue
            t = common.parse_oasis_time(f["INTERVAL_START_GMT"]).replace(minute=0)
            acc.setdefault(t, []).append((float(f["SOLAR"]), float(f["WIND"])))
    sub_hourly = any(len(v) > 1 for v in acc.values())
    return ({t: (sum(s for s, _ in v) / len(v), sum(w for _, w in v) / len(v)) for t, v in acc.items()},
            sub_hourly)


def read_snapshot(path):
    with open(path, encoding="utf-8", newline="") as f:
        rows = list(csv.DictReader(f))
    for r in rows:
        r["utc"] = common.parse_oasis_time(r["interval_start_utc"].replace("Z", "+00:00"))
    return rows


# ------------------------------------------------------------------ backtest and history (#107)

def pctl_linear(values, q):
    """Hyndman-Fan type 7 (linear interpolation, numpy's default)."""
    v = sorted(values)
    h = (len(v) - 1) * q
    lo = math.floor(h)
    hi = min(lo + 1, len(v) - 1)
    return v[lo] + (h - lo) * (v[hi] - v[lo])


def pctl_nearest(values, q):
    """Nearest rank: the ceil(q * n)-th smallest value (1-based), at least the first."""
    v = sorted(values)
    return v[max(1, math.ceil(q * len(v) - 1e-12)) - 1]


def summarize(values):
    return {"n": len(values), "mean": sum(values) / len(values),
            "linear": {k: pctl_linear(values, q) for k, q in (("p10", 0.1), ("p50", 0.5), ("p90", 0.9))},
            "nearest_rank": {k: pctl_nearest(values, q) for k, q in (("p10", 0.1), ("p50", 0.5), ("p90", 0.9))}}


def dominance_violations(stats):
    """clearlane P10, P50, P90 must each be at or below price_only's (science.md 6.7)."""
    out = []
    for k in ("p10", "p50", "p90"):
        c, p = stats["clearlane"][k], stats["price_only"][k]
        if c > p:
            out.append(f"{k}: clearlane {c:g} > price_only {p:g}")
    return out


def fixed_overnight_day(p):
    """fixed_overnight per MW-day: the full 0 to 500 kWh swing, HB 1 to 4 in, HB 18 to 19 out."""
    return race_value(p, FIXED_CHARGE, DISCHARGE)


def share_beating(clear, fixed):
    """Percent of days on which clearlane is strictly greater than fixed_overnight (ties do not beat)."""
    days = sorted(fixed)
    return 100.0 * sum(1 for d in days if clear[d] > fixed[d]) / len(days)


def cycles_per_year(daily_cycles):
    """Mean of the daily Pulse cycle counts times 365, the convention of backtest.json."""
    return 365.0 * sum(daily_cycles) / len(daily_cycles)


def fixed_overnight_cycles(pulse_kwh, rte):
    """Cycles on stored energy for the fixed rule: it drains the full store each evening.

    Counted from the grid side so the definition is exercised: the grid receives pulse_kwh x eta, and
    stored energy out is that divided by eta again (#213), over the usable capacity.
    """
    eta = math.sqrt(rte)
    return (pulse_kwh * eta) / eta / pulse_kwh


def window_check(hist_days, raw_hours, first, last):
    """Days in [first, last] with a hist row, and the missing ones with the raw hour count."""
    have = set(hist_days)
    missing, n = [], 0
    d = first
    while d <= last:
        if d.isoformat() in have:
            n += 1
        else:
            missing.append(d.isoformat())
        d += dt.timedelta(days=1)
    return {"days": n, "missing_days": missing,
            "raw_hours_on_missing": {m: raw_hours.get(dt.date.fromisoformat(m), 0) for m in missing}}


def compare_hist_raw(hist, raw_days, first, last):
    """Every hour of every raw Mountain day in [first, last] against the hist row for that day."""
    hours, worst, worst_at, absent = 0, 0.0, None, []
    for d in sorted(raw_days):
        if not first <= d <= last:
            continue
        row = hist.get(d.isoformat())
        if row is None:
            absent.append(d.isoformat())
            continue
        for h in range(24):
            diff = abs(row[h] - raw_days[d][h])
            hours += 1
            if worst_at is None or diff > worst:
                worst, worst_at = diff, {"day": d.isoformat(), "hb": h}
    return {"hours": hours, "max_abs_diff": worst, "worst": worst_at, "days_absent": absent}


def _load_json(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def _resolve(path):
    p = pathlib.Path(path)
    return p if p.is_absolute() else ROOT / p


def backtest_checks(a):
    """The #107 rows. Returns (checks, notes, inputs); rows stay pending when an input is absent."""
    paths = {k: _resolve(getattr(a, k)) for k in ("hist", "backtest", "backtest_days", "site", "bundle")}
    absent = [common.rel(p) if p.is_relative_to(ROOT) else str(p) for p in paths.values() if not p.exists()]
    if absent:
        return None, [f"#107 rows pending: missing {', '.join(absent)}"], []
    raw_globs = {"may": a.raw_may, "jul": a.raw_jul, "oct": a.raw_oct}
    raw_files = {k: expand(v) for k, v in raw_globs.items()}
    hist_list = _load_json(paths["hist"])
    bt = _load_json(paths["backtest"])
    bdays = _load_json(paths["backtest_days"])
    site = _load_json(paths["site"])["site"]
    bundle = _load_json(paths["bundle"])
    hist = {r["operating_day_mt"]: r["lmp_usd_mwh"] for r in hist_list}
    pol = {p["policy"]: p["usd_per_mw_day"] for p in bt["policies"]}
    eng = {}
    for r in bdays:
        eng.setdefault(r["policy"], {})[r["operating_day_mt"]] = r["usd_per_mw_day"]
    checks, notes = {}, []
    dp_inputs = [paths["hist"], paths["site"]]

    # ---- window: hist days vs raw May (May 1 has 23 priced hours)
    first = dt.date.fromisoformat(bt["window"]["start_mt"])
    last = dt.date.fromisoformat(bt["window"]["end_mt"])
    _, skipped = common.group_mountain_days(common.read_oasis_lmp(raw_files["may"], NODE))
    raw_hours = {d: n for d, n in skipped}
    w = window_check(sorted(hist), raw_hours, first, last)
    bad_rows = sorted(d for d, p in hist.items() if len(p) != 24 or not all(math.isfinite(x) for x in p))
    sci = {"days": w["days"], "missing_days": w["missing_days"], "raw_hours_on_missing": w["raw_hours_on_missing"],
           "hist_rows_not_24_finite": bad_rows}
    pv = {"facts_days": 179, "backtest_json": {"days": bt["window"]["days"], "missing_days": bt["window"]["missing_days"]}}
    ok = (w["days"] == 179 == bt["window"]["days"] and w["missing_days"] == bt["window"]["missing_days"]
          == ["2026-05-01"] and not bad_rows)
    checks["backtest_days"] = entry(
        "backtest_days", "days", pv, sci, "exact", ok,
        "Mountain days May 1 to Oct 27 with a 24-price hist row; missing days listed with raw OASIS hours.",
        [paths["hist"], paths["backtest"]] + raw_files["may"])

    # ---- hist vs raw OASIS
    spans = {"may": (dt.date(2026, 5, 1), dt.date(2026, 5, 23)), "jul": (dt.date(2026, 7, 1), dt.date(2026, 7, 30)),
             "oct": (dt.date(2026, 10, 1), dt.date(2026, 10, 27))}
    sci, ok = {}, True
    for k, (f0, f1) in spans.items():
        days, _ = common.group_mountain_days(common.read_oasis_lmp(raw_files[k], NODE))
        r = compare_hist_raw(hist, days, f0, f1)
        r["max_abs_diff"] = round(r["max_abs_diff"], 9)
        sci[k] = r
        ok = ok and r["max_abs_diff"] <= 0.00001 + 1e-12 and not r["days_absent"]
    want_hours = {"may": 22 * 24, "jul": 30 * 24, "oct": 27 * 24}
    ok = ok and all(sci[k]["hours"] == want_hours[k] for k in spans)
    notes.append("hist vs raw: May 1 is not in the hist file (23 hours), so May compares May 2 to 23 "
                 f"({want_hours['may']} hours).")
    checks["hist_vs_raw_prices"] = entry(
        "hist_vs_raw_prices", "$/MWh", "raw OASIS, every hour", sci, "within 0.00001 every hour", ok,
        "Hist lmp_usd_mwh against raw OASIS DAM LMP for ELAP_PACE-APND, Mountain days from 06:00Z.",
        [paths["hist"]] + raw_files["may"] + raw_files["jul"] + raw_files["oct"])

    # ---- bundle Oct 27 HB 0
    h0 = next(h for h in bundle["hours"] if h["hour_mt"] == 0)
    raw_oct, _ = common.group_mountain_days(common.read_oasis_lmp(raw_files["oct"], NODE))
    raw_h0 = raw_oct[dt.date(2026, 10, 27)][0]
    sci = {"bundle_hb0": h0["lmp_usd_mwh"], "raw_hb0": r5(raw_h0), "ts_utc": h0["ts_utc"],
           "hist_hb0": hist["2026-10-27"][0]}
    ok = abs(h0["lmp_usd_mwh"] - raw_h0) <= 0.005 and abs(h0["lmp_usd_mwh"] - 46.11) > 0.005 \
        and abs(raw_h0 - 30.21857) <= 0.00001
    checks["bundle_oct27_hb0"] = entry(
        "bundle_oct27_hb0", "$/MWh", {"raw": 30.21857, "not": 46.11}, sci,
        "bundle within its cent precision of raw; not 46.11", ok,
        "Bundle hours[hour_mt == 0] against raw OASIS Oct 27 06:00Z (CAISO OPR_DT Oct 26 HE24).",
        [paths["bundle"]] + raw_files["oct"])

    # ---- fixed_overnight from the hist file
    days = sorted(d for d in hist if first.isoformat() <= d <= last.isoformat())
    fixed = {d: fixed_overnight_day(hist[d]) for d in days}
    fs = summarize(list(fixed.values()))
    eng_fixed = eng.get("fixed_overnight", {})
    per_day = max(abs(fixed[d] - eng_fixed[d]) for d in days) if set(eng_fixed) >= set(days) else None
    method_ok = {m: all(abs(fs[m][k] - pol["fixed_overnight"][k]) <= 0.01 for k in ("p10", "p50", "p90"))
                 for m in ("linear", "nearest_rank")}
    matched = [m for m, v in method_ok.items() if v]
    sci = {"n": fs["n"], "mean": r5(fs["mean"]), "linear": {k: r5(v) for k, v in fs["linear"].items()},
           "nearest_rank": {k: r5(v) for k, v in fs["nearest_rank"].items()},
           "max_abs_diff_per_day_vs_backtest_days": None if per_day is None else round(per_day, 9)}
    ok = (bool(matched) and abs(fs["mean"] - pol["fixed_overnight"]["mean"]) <= 0.01
          and per_day is not None and per_day <= 0.01)
    checks["backtest_fixed_overnight"] = entry(
        "backtest_fixed_overnight", "$/MW-day", {k: r5(v) for k, v in pol["fixed_overnight"].items()}, sci,
        "0.01 each (P10, P50, P90 under the matching method, mean); 0.01 every day", ok,
        "Reference race per hist day: sell 2 x sqrt(0.88) MWh at mean HB 18 to 19, buy 2 / sqrt(0.88) at "
        "mean HB 1 to 4; percentiles both ways.", [paths["hist"], paths["backtest"], paths["backtest_days"]])
    checks["percentile_method"] = entry(
        "percentile_method", "method", "linear (engine.md 6.4)", {"matches": matched}, "the matching method",
        matched == ["linear"], "Which percentile method reproduces backtest.json fixed_overnight to $0.01.",
        [paths["backtest"]])

    # ---- price_only by an independent DP
    host = [float(x) for x in site["host_load_kw_15m"]]
    st = site["station"]
    po_runs = {d: dp.price_only_day(hist[d], host, pulse_kw=st["pulse_kw"], pulse_kwh=st["pulse_kwh"],
                                    rte=st["rte"]["value"], export_limit_kw=site["export_limit_kw"]["value"])
               for d in days}
    po = {d: po_runs[d]["usd_per_mw_day"] for d in days}
    ps = summarize(list(po.values()))
    eng_po = eng.get("price_only", {})
    diffs = {d: po[d] - eng_po[d] for d in days if d in eng_po}
    over = sorted(d for d, x in diffs.items() if abs(x) > 0.01)
    worst = max(diffs, key=lambda d: abs(diffs[d])) if diffs else None
    sci = {"p50_linear": r5(ps["linear"]["p50"]), "p50_nearest_rank": r5(ps["nearest_rank"]["p50"]),
           "p10_linear": r5(ps["linear"]["p10"]), "p90_linear": r5(ps["linear"]["p90"]), "mean": r5(ps["mean"]),
           "days_compared": len(diffs), "days_over_0.01": len(over),
           "max_abs_diff_per_day": None if worst is None else round(abs(diffs[worst]), 9),
           "worst_day": worst, "first_days_over": over[:5]}
    ok = abs(ps["linear"]["p50"] - pol["price_only"]["p50"]) <= 0.01
    checks["backtest_price_only_p50"] = entry(
        "backtest_price_only_p50", "$/MW-day", r5(pol["price_only"]["p50"]), sci, "0.01 on P50 (linear)", ok,
        "Independent stdlib DP (science/dp.py): 96 steps, 41 levels of 12.5 kWh, 4 up and 5 down at the meter, "
        "sqrt(0.88) each leg, discharge at most host load (export limit 0), start and end level 2, W = 0.",
        dp_inputs + [paths["backtest"], paths["backtest_days"]])

    # ---- dominance and clearlane
    viol = dominance_violations({"clearlane": pol["clearlane"], "price_only": pol["price_only"]})
    viol_sci = dominance_violations({"clearlane": pol["clearlane"],
                                     "price_only": {k: ps["linear"][k] for k in ("p10", "p50", "p90")}})
    eng_cl = eng.get("clearlane", {})
    day_viol = sorted(d for d in days if d in eng_cl and eng_cl[d] > po[d] + 1e-9)
    checks["backtest_dominance"] = entry(
        "backtest_dominance", "$/MW-day", "clearlane <= price_only at P10, P50, P90",
        {"violations_vs_backtest_json": viol, "violations_vs_science_dp": viol_sci,
         "days_clearlane_above_science_price_only": len(day_viol), "first_such_days": day_viol[:5]},
        "each <=", not viol and not viol_sci,
        "Order statistics of backtest.json clearlane against price_only (engine) and the science DP.",
        [paths["backtest"], paths["backtest_days"]] + dp_inputs)

    cl_vals = [eng_cl[d] for d in days if d in eng_cl]
    cs = summarize(cl_vals) if len(cl_vals) == len(days) else None
    if cs is None:
        notes.append("clearlane_p50 left pending: backtest_days.json lacks clearlane rows for some days.")
        checks["clearlane_p50"] = entry("clearlane_p50", "$/MW-day", FACTS_CLEARLANE_P50, None, None, False,
                                        "Waits on a complete backtest_days.json.", [paths["backtest_days"]])
    else:
        sci = {"p50_linear": r5(cs["linear"]["p50"]), "p50_nearest_rank": r5(cs["nearest_rank"]["p50"]),
               "n": cs["n"], "below_science_price_only_p50": cs["linear"]["p50"] <= ps["linear"]["p50"]}
        ok = (abs(cs["linear"]["p50"] - pol["clearlane"]["p50"]) <= 0.01 and rounds_equal(cs["linear"]["p50"], FACTS_CLEARLANE_P50, 2)
              and cs["linear"]["p50"] <= ps["linear"]["p50"])
        checks["clearlane_p50"] = entry(
            "clearlane_p50", "$/MW-day", {"facts": FACTS_CLEARLANE_P50, "backtest_json": r5(pol["clearlane"]["p50"])}, sci,
            "0.01 vs backtest.json; rounds equal at 2 dp; at or below the science price_only P50", ok,
            "P50 of backtest_days.json clearlane rows (not recomputed: needs the engine's wear, calls and "
            "re-plan), both methods; ordered against the science DP.", [paths["backtest_days"], paths["backtest"]])

    clear = {d: eng_cl[d] for d in days if d in eng_cl}
    if len(clear) == len(days):
        share_eng = share_beating(clear, {d: eng_fixed[d] for d in days})
        share_sci_fixed = share_beating(clear, fixed)
        cl_stats = next(p for p in bt["policies"] if p["policy"] == "clearlane")
        sci = {"pct_engine_fixed": round(share_eng, 5), "pct_science_fixed": round(share_sci_fixed, 5),
               "days": len(days), "ties": sum(1 for d in days if clear[d] == fixed[d])}
        ok = (abs(share_sci_fixed - cl_stats["days_beating_fixed_overnight_pct"]) <= 0.01
              and rounds_equal(share_sci_fixed, FACTS_SHARE_BEATING_PCT, 0))
        checks["share_days_beating"] = entry(
            "share_days_beating", "% of days", {"facts": f"{FACTS_SHARE_BEATING_PCT}%", "backtest_json": r5(cl_stats["days_beating_fixed_overnight_pct"])},
            sci, "0.01 percentage point; rounds equal at 0 dp", ok,
            "Days with clearlane (backtest_days.json) strictly above the science fixed_overnight value, of all days.",
            [paths["backtest_days"], paths["hist"], paths["backtest"]])

    # ---- clearlane P10 and P90 against the current FACTS pins (#218)
    if cs is not None:
        want = {"p10": FACTS_CLEARLANE_P10, "p90": FACTS_CLEARLANE_P90}
        sci = {f"{k}_linear": r5(cs["linear"][k]) for k in want}
        ok = all(abs(cs["linear"][k] - pol["clearlane"][k]) <= 0.01 and rounds_equal(cs["linear"][k], want[k], 2)
                 for k in want)
        checks["clearlane_p10_p90"] = entry(
            "clearlane_p10_p90", "$/MW-day",
            {"facts": want, "backtest_json": {k: r5(pol["clearlane"][k]) for k in want}}, sci,
            "0.01 vs backtest.json; rounds equal at 2 dp", ok,
            "P10 and P90 (linear) of the backtest_days.json clearlane rows.",
            [paths["backtest_days"], paths["backtest"]])

    # ---- Pulse cycles a year on stored energy (#213, #218)
    cyc_fixed = cycles_per_year([fixed_overnight_cycles(st["pulse_kwh"], st["rte"]["value"]) for _ in days])
    cyc_po = cycles_per_year([po_runs[d]["pulse_cycles"] for d in days])
    stored_gap = max(abs(po_runs[d]["pulse_cycles"] - po_runs[d]["discharged_kwh"] / math.sqrt(st["rte"]["value"])
                         / st["pulse_kwh"]) for d in days)
    bt_fixed = next(p for p in bt["policies"] if p["policy"] == "fixed_overnight")["pulse_cycles_per_yr"]
    bt_po = next(p for p in bt["policies"] if p["policy"] == "price_only")["pulse_cycles_per_yr"]
    checks["cycles_per_year_by_policy_fixed_overnight"] = entry(
        "cycles_per_year_by_policy_fixed_overnight", "cycles/yr",
        {"facts": FACTS_CYCLES_FIXED, "backtest_json": r5(bt_fixed)}, {"science": r5(cyc_fixed), "days": len(days)},
        "0.01 vs backtest.json; rounds equal at 0 dp",
        abs(cyc_fixed - bt_fixed) <= 0.01 and rounds_equal(cyc_fixed, FACTS_CYCLES_FIXED, 0),
        "Fixed rule drains the full 500 kWh store once a day; cycles on stored energy (grid kWh / sqrt(0.88) / "
        "500), mean per day x 365.", [paths["site"], paths["backtest"]])
    checks["cycles_per_year_by_policy_price_only"] = entry(
        "cycles_per_year_by_policy_price_only", "cycles/yr",
        {"facts": FACTS_CYCLES_PRICE_ONLY, "backtest_json": r5(bt_po)},
        {"science": r5(cyc_po), "days": len(days), "max_abs_gap_level_path_vs_grid_over_eta": round(stored_gap, 12)},
        "0.01 vs backtest.json; rounds equal at 0 dp",
        abs(cyc_po - bt_po) <= 0.01 and rounds_equal(cyc_po, FACTS_CYCLES_PRICE_ONLY, 0),
        "Science DP level path: kWh leaving the store each day over 500 kWh, mean per day x 365.",
        dp_inputs + [paths["backtest"]])
    notes.append("Not recomputed (need the engine's wear, calls and re-plan): wear_usd_mwh, "
                 "cycles_per_year_by_policy_clearlane, clearlane_dp_usd_mw_day, dp_race_ratio, cycles_today.")

    inputs = [paths[k] for k in paths] + [p for v in raw_files.values() for p in v]
    return checks, notes, inputs


# ------------------------------------------------------------------ checks

def entry(key, unit, pinned, science, tolerance, ok, method, inputs, second=None):
    """One check. `status` always reflects the primary (raw) path; `second_path` is informational."""
    status = "pending" if science is None else ("match" if ok else "mismatch")
    e = {"facts_key": key, "numbers_key": None, "unit": unit,
         "pinned": {"facts": pinned, "numbers_json": None}, "science": science,
         "tolerance": tolerance, "status": status, "method": method,
         "inputs": sorted(common.rel(p) for p in inputs)}
    if second is not None:
        e["second_path"] = second
    return e


def r5(x):
    return round(x, 5)


def run(a):
    day = dt.date.fromisoformat(a.day)
    files = {k: expand(getattr(a, k)) for k in
             ("prices", "step_oct", "step_jul", "fossil_oct_lmp", "fossil_jul_lmp", "eia", "load", "windsolar")}
    snap_path = ROOT / a.snapshot if not pathlib.Path(a.snapshot).is_absolute() else pathlib.Path(a.snapshot)
    tt = [int(x) for x in a.timetable_hours.split(",")]
    checks, notes = {}, []

    # ---- Oct 27 Mountain-day prices (raw OASIS; conflicting duplicates across files raise)
    series = common.read_oasis_lmp(files["prices"], NODE)
    days, _ = common.group_mountain_days(series)
    if day not in days:
        raise SystemExit(f"no 24-hour Mountain day {day} in {files['prices']}")
    p = days[day]
    snap = read_snapshot(snap_path)
    sp = [float(r["da_lmp_elap_pace"]) for r in snap]
    snap_hb0 = snap[-1]
    notes.append(f"Mountain day {day} HB 0 from raw OASIS = {p[0]:.5f}; snapshot HB 0 row is "
                 f"{snap_hb0['local_mt']} MT = {float(snap_hb0['da_lmp_elap_pace']):.5f}.")
    diffs = [abs(p[(i + 1) % 24] - sp[i]) for i in range(23)]
    notes.append(f"Raw OASIS vs snapshot, HB 1 to 23: max abs difference {max(diffs):.5f} $/MWh.")

    # Second path: the snapshot's cent-rounded prices in hour-beginning order (row i is HB i+1;
    # its last row is Oct 28 HB 0, which no race window uses).
    sp_hb = [sp[23]] + sp[:23]
    f_snap = race_value(sp_hb, FIXED_CHARGE, DISCHARGE)
    c_snap = race_value(sp_hb, tt, DISCHARGE)
    snap_src = "snapshot da_lmp_elap_pace (prices rounded to cents)"

    def second(v, pv, dp):
        return {"source": snap_src, "value": r5(v), "passes_tolerance": rounds_equal(v, pv, dp)}

    pin = {"fixed": 20.0647, "clear": 58.4053}
    f_val = race_value(p, FIXED_CHARGE, DISCHARGE)
    c_val = race_value(p, tt, DISCHARGE)
    mc_f = sum(p[h] for h in FIXED_CHARGE) / 4
    mc_t = sum(p[h] for h in tt) / len(tt)
    md = sum(p[h] for h in DISCHARGE) / 2
    rm = "Reference station 1 MW, 2 MWh, RTE 0.88 split sqrt per leg; value = 2*sqrt(0.88)*mean(discharge) - 2/sqrt(0.88)*mean(charge)"
    race_in = files["prices"]
    checks["fixed_usd_mw_day"] = entry(
        "fixed_usd_mw_day", "$/MW-day", pin["fixed"], r5(f_val), "rounds equal at 4 dp and within 0.01",
        rounds_equal(f_val, pin["fixed"], 4) and abs(f_val - pin["fixed"]) <= 0.01,
        rm + f"; charge HB 1-4 (mean {mc_f:.4f}), discharge HB 18-19 (mean {md:.4f}).", race_in + [snap_path],
        second(f_snap, pin["fixed"], 4))
    checks["clearlane_usd_mw_day"] = entry(
        "clearlane_usd_mw_day", "$/MW-day", pin["clear"], r5(c_val), "rounds equal at 4 dp and within 0.01",
        rounds_equal(c_val, pin["clear"], 4) and abs(c_val - pin["clear"]) <= 0.01,
        rm + f"; charge HB {','.join(map(str, tt))} (mean {mc_t:.4f}), same discharge.", race_in + [snap_path],
        second(c_snap, pin["clear"], 4))
    ratio = c_val / f_val
    checks["race_ratio"] = entry("race_ratio", "ratio", 2.911, r5(ratio), "rounds equal at 3 dp",
                                 rounds_equal(ratio, 2.911, 3), "clearlane_usd_mw_day / fixed_usd_mw_day.",
                                 race_in + [snap_path], second(c_snap / f_snap, 2.911, 3))
    for key, base, sbase, mw, pv, dp in (("fixed_70", f_val, f_snap, 70, 1404.5, 1),
                                         ("clearlane_70", c_val, c_snap, 70, 4088.4, 1),
                                         ("fixed_500", f_val, f_snap, 500, 10032, 0),
                                         ("clearlane_500", c_val, c_snap, 500, 29203, 0)):
        v = base * mw
        checks[key] = entry(key, "$/day", pv, round(v, 3), f"rounds equal at {dp} dp", rounds_equal(v, pv, dp),
                            f"Reference value x {mw} MW; assumes every MW behaves like the reference station "
                            "and the fleet does not move prices.", race_in + [snap_path],
                            {"source": snap_src, "value": round(sbase * mw, 3),
                             "passes_tolerance": rounds_equal(sbase * mw, pv, dp)})

    # ---- lanes, both ways
    lt = lanes(p)
    ls = lanes(sp)
    for key, field, pv in (("lane_clear_max_usd", "clear_max", 29.98), ("lane_jam_min_usd", "jam_min", 47.18)):
        ok = rounds_equal(lt[field], pv, 2) and rounds_equal(ls[field], pv, 2)
        checks[key] = entry(key, "$/MWh", pv,
                            {"mountain_day": r5(lt[field]), "snapshot_rows": r5(ls[field])},
                            "rounds equal at 2 dp (both ways)", ok,
                            f"Day min + 25% of range (clear) or max - 25% (jam). Mountain day {day}: min "
                            f"{lt['min']:.5f} at HB {lt['min_hb']}, max {lt['max']:.5f} at HB {lt['max_hb']}, "
                            f"range {lt['range']:.5f}. Snapshot rows (HB 0 = Oct 28 00:00): min {ls['min']:.5f}, "
                            f"max {ls['max']:.5f}, range {ls['range']:.5f}.",
                            race_in + [snap_path])

    # ---- step hours
    oct_days, oct_skip = mountain_window(common.read_oasis_lmp(files["step_oct"], NODE),
                                         dt.date(2026, 10, 1), dt.date(2026, 10, 27))
    so = step_summary(oct_days)
    n1718 = count_in(so, range(17, 19))
    ok = (so["n_days"] == 27 and n1718 == 24 and so["by_hour"].get("17") == 9 and so["by_hour"].get("18") == 15
          and rounds_equal(so["median_step"], 15.1, 1))
    checks["oct_step_hour_days"] = entry(
        "oct_step_hour_days", "days", {"days": 27, "hb17_or_18": 24, "hb17": 9, "hb18": 15, "median_step": 15.1},
        {"days": so["n_days"], "hb17_or_18": n1718, "hb17": so["by_hour"].get("17", 0),
         "hb18": so["by_hour"].get("18", 0), "median_step": r5(so["median_step"]), "by_hour": so["by_hour"],
         "skipped_days": [d.isoformat() for d, _ in oct_skip]},
        "counts exact; median rounds equal at 1 dp", ok,
        "Per Mountain day Oct 1 to 27 (06:00Z start): h in 1..23 maximizing p[h]-p[h-1], ties to earliest; "
        "no cross-midnight step.", files["step_oct"])
    jul_days, jul_skip = mountain_window(common.read_oasis_lmp(files["step_jul"], NODE),
                                         dt.date(2026, 7, 1), dt.date(2026, 7, 30))
    sj = step_summary(jul_days)
    n13_20 = count_in(sj, range(13, 21))
    ok = sj["n_days"] == 30 and n13_20 == 28 and rounds_equal(sj["median_step"], 10.1, 1)
    checks["jul_step_hour_spread"] = entry(
        "jul_step_hour_spread", "days", {"days": 30, "hb13_to_20": 28, "median_step": 10.1},
        {"days": sj["n_days"], "hb13_to_20": n13_20, "median_step": r5(sj["median_step"]),
         "by_hour": sj["by_hour"], "skipped_days": [d.isoformat() for d, _ in jul_skip]},
        "counts exact; median rounds equal at 1 dp", ok,
        "Same step definition, Mountain days Jul 1 to 30.", files["step_jul"])

    # ---- fossil deciles
    eia = {}
    for path in files["eia"]:
        for r in common.read_eia930(path):
            eia[r["utc_start"]] = r
    for key, lmp_files, first, last, pv in (
            ("fossil_priciest_oct", files["fossil_oct_lmp"], dt.date(2026, 10, 1), dt.date(2026, 10, 25),
             {"top_lmp": 67.3, "top_share_pct": 85.1, "bottom_lmp": 23.0, "bottom_share_pct": 39.8}),
            ("fossil_priciest_jul", files["fossil_jul_lmp"], dt.date(2026, 7, 1), dt.date(2026, 7, 30),
             {"top_lmp": 65.2, "top_share_pct": 76.3, "bottom_lmp": 12.9, "bottom_share_pct": 52.2})):
        lmp = common.read_oasis_lmp(lmp_files, NODE)
        lo = common.utc_start(first, 0)
        hi = common.utc_start(last, 23)
        hours, unmatched, blank = [], 0, 0
        for t in sorted(x for x in lmp if lo <= x <= hi):
            row = eia.get(t)
            sh = fossil_share(row) if row else None
            if sh is None:
                unmatched += 1
                continue
            blank += sum(1 for c in FUEL_COLUMNS.values() if common.num(row.get(c)) is None)
            hours.append((t, lmp[t], sh))
        b = deciles(hours)
        sci = {"top_lmp": r5(b[9]["mean_lmp"]), "top_share_pct": r5(b[9]["mean_share_pct"]),
               "bottom_lmp": r5(b[0]["mean_lmp"]), "bottom_share_pct": r5(b[0]["mean_share_pct"]),
               "n_hours": len(hours), "unmatched_hours": unmatched, "blank_fuel_cells": blank}
        ok = (rounds_equal(sci["top_lmp"], pv["top_lmp"], 1) and rounds_equal(sci["bottom_lmp"], pv["bottom_lmp"], 1)
              and abs(sci["top_share_pct"] - pv["top_share_pct"]) <= 0.1
              and abs(sci["bottom_share_pct"] - pv["bottom_share_pct"]) <= 0.1)
        checks[key] = entry(key, "$/MWh and % fossil", pv, sci,
                            "LMP rounds equal at 1 dp; shares within 0.1 point", ok,
                            f"Hours with UTC start in Mountain days {first} to {last}, joined to EIA-930 on UTC "
                            "start (end minus 1 h); share = coal+gas over coal, gas, hydro, solar w/o battery, wind "
                            "w/o battery, geothermal, other ((Adjusted), negatives and blanks as 0); ranked by LMP, "
                            "ties by time; deciles of n/10.", list(lmp_files) + list(files["eia"]))

    # ---- net load, two paths
    load = read_load(files["load"])
    ws, sub_hourly = read_windsolar(files["windsolar"])
    notes.append("caiso4 rows are hourly; no sub-hourly averaging was needed." if not sub_hourly
                 else "caiso4 had sub-hourly rows; averaged to hours.")
    notes.append("caiso3 filter: TAC_AREA_NAME == PACE and MARKET_RUN_ID == DAM (24 rows, LOAD_TYPE 1). "
                 "caiso4 filter: BAA_GRP_ID == PACE.")
    raw_nl, snap_nl = {}, {}
    for r in snap:
        t = r["utc"]
        hb = common.mountain_hb(t)
        snap_nl[hb] = net_load(float(r["da_load_fcst_pace_mw"]), float(r["edam_solar_fcst_pace_mw"]),
                               float(r["edam_wind_fcst_pace_mw"]))
        if t in load and t in ws:
            raw_nl[hb] = net_load(load[t], ws[t][0], ws[t][1])
    k15, k18 = (day, 15), (day, 18)
    common_keys = sorted(set(raw_nl) & set(snap_nl))
    max_path_diff = max(abs(raw_nl[k] - snap_nl[k]) for k in common_keys)
    sci = {"raw_hb15": round(raw_nl[k15], 3), "raw_hb18": round(raw_nl[k18], 3),
           "raw_climb": round(raw_nl[k18] - raw_nl[k15], 3),
           "snapshot_hb15": round(snap_nl[k15], 3), "snapshot_hb18": round(snap_nl[k18], 3),
           "snapshot_climb": round(snap_nl[k18] - snap_nl[k15], 3),
           "max_abs_diff_raw_vs_snapshot_mw": round(max_path_diff, 3), "hours_compared": len(common_keys)}
    pv = {"hb15": 604.6, "hb18": 4259.1, "climb": 3654.51}
    ok = all(abs(sci[f"{w}_{k}"] - pv[k]) <= 0.1 for w in ("raw", "snapshot") for k in ("hb15", "hb18", "climb")) \
        and max_path_diff <= 0.1
    checks["net_load_climb_mw"] = entry(
        "net_load_climb_mw", "MW", pv, sci, "within 0.1 MW each; paths within 0.1 MW at every hour", ok,
        "Net load = PACE DA load forecast - max(EDAM solar, 0) - EDAM wind (forecasts, not metered); "
        "path 1 raw caiso3 + caiso4, path 2 snapshot columns.",
        list(files["load"]) + list(files["windsolar"]) + [snap_path])

    for key in ("clearlane_p50", "share_days_beating"):
        checks[key] = {"facts_key": key, "numbers_key": None, "unit": "$/MW-day" if key == "clearlane_p50" else "%",
                       "pinned": {"facts": "PENDING-ENGINE", "numbers_json": None}, "science": None,
                       "tolerance": None, "status": "pending",
                       "method": "Not computed in #102; waits on public/derived/backtest.json and the hist file (#107).",
                       "inputs": []}
    bchecks, bnotes, binputs = backtest_checks(a)
    if bchecks:
        checks.update(bchecks)
    notes.extend(bnotes)

    all_inputs = set(binputs)
    for lst in files.values():
        all_inputs.update(lst)
    all_inputs.add(snap_path)
    out = {"schema": SCHEMA, "operating_day_mt": day.isoformat(), "script": SCRIPT,
           "inputs": common.input_record(all_inputs), "checks": checks, "notes": notes}
    return out


def table(out):
    def show(v):
        if isinstance(v, dict):
            return "; ".join(f"{k} {show(x)}" for k, x in v.items() if k not in ("by_hour", "per_day"))
        if isinstance(v, list):
            return ", ".join(map(str, v)) or "none"
        return "n/a" if v is None else str(v)
    lines = ["| FACTS key | Pinned | Science | Tolerance | Status |", "|---|---|---|---|---|"]
    for k, c in out["checks"].items():
        sec = c.get("second_path")
        extra = f" (snapshot cents: {sec['value']}, {'passes' if sec['passes_tolerance'] else 'fails'})" if sec else ""
        lines.append(f"| {k} | {show(c['pinned']['facts'])} | {show(c['science'])}{extra} | {show(c['tolerance'])} | "
                     f"{c['status']} |")
    n = {s: sum(1 for c in out["checks"].values() if c["status"] == s) for s in ("match", "mismatch", "pending")}
    lines += ["", f"Scoreboard: {n['match']} match, {n['mismatch']} mismatch, {n['pending']} pending.", ""]
    lines += ["Notes:", ""] + [f"- {x}" for x in out["notes"]]
    return "\n".join(lines)


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--day", default="2026-10-27", help="Mountain operating day")
    ap.add_argument("--snapshot", default=DEF["snapshot"])
    ap.add_argument("--timetable-hours", default=",".join(map(str, TIMETABLE_CHARGE)),
                    help="charge hours beginning, comma separated (an Oct 27 result)")
    for k in ("prices", "step_oct", "step_jul", "fossil_oct_lmp", "fossil_jul_lmp", "eia", "load", "windsolar"):
        ap.add_argument("--" + k.replace("_", "-"), dest=k, nargs="+", default=DEF[k])
    for k in ("hist", "backtest", "backtest_days", "site", "bundle"):
        ap.add_argument("--" + k.replace("_", "-"), dest=k, default=DEF[k])
    for k in ("raw_may", "raw_jul", "raw_oct"):
        ap.add_argument("--" + k.replace("_", "-"), dest=k, nargs="+", default=DEF[k])
    ap.add_argument("--out-json", default="science/crosscheck.json")
    ap.add_argument("--out-md", default="science/crosscheck.md")
    a = ap.parse_args(argv)
    out = run(a)
    common.write_json(ROOT / a.out_json, out)
    common.write_results(ROOT / a.out_md, table(out))
    for k, c in out["checks"].items():
        print(f"{c['status']:9s} {k}")


if __name__ == "__main__":
    main()
