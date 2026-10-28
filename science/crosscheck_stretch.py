"""Second-method check of the stretch numbers (issue #112, flag off_science_methods).

Run: python -I science/crosscheck_stretch.py [--out PATH] [--no-md]

Checks five stretch outputs by our own code, separately from engine/ and prep/: the sensitivity base
case against the backtest, the call ledger's refill-window overlaps against a closed form, the marginal
CO2 table against a load-level-binned estimator, the fixed-schedule scale curve by hour-by-hour
repricing, and the real-time replay's identities and window prices. The definitions and tolerances
are in science/crosscheck-stretch.md, committed before this script was run. Stdlib only.
"""

import argparse
import bisect
import csv
import datetime as dt
import math
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from science import common  # noqa: E402
from science import crosscheck as xc  # noqa: E402

SCHEMA = "clearlane.science.crosscheck_stretch/v1"
FLAG = "off_science_methods"
MD = ROOT / "science/crosscheck-stretch.md"
OUT = ROOT / "science/crosscheck_stretch.json"
TOL = 1e-9
LB_PER_T = 2204.62262
SEASONS = {12: "DJF", 1: "DJF", 2: "DJF", 3: "MAM", 4: "MAM", 5: "MAM"}
SEASONS.update({6: "JJA", 7: "JJA", 8: "JJA", 9: "SON", 10: "SON", 11: "SON"})
SEASON_ORDER = ["DJF", "MAM", "JJA", "SON"]
INSIDE_SHARE_MIN = 0.75
# FACTS ref_station (1 MW, 2 MWh, RTE 0.88) and the race rows fixed_usd_mw_day, clearlane_usd_mw_day
REF_MWH_PER_MW = 2.0
REF_RTE = 0.88
LEGS = {"fixed_overnight": ([1, 2, 3, 4], [18, 19]), "clearlane": ([13, 14, 15], [18, 19])}
SPREAD_BANDS = [(0, 15), (15, 25), (25, 50), (50, None)]

P = {
    "sensitivity": ROOT / "public/derived/sensitivity.json",
    "backtest": ROOT / "public/derived/backtest.json",
    "backtest_days": ROOT / "public/derived/backtest_days.json",
    "hist": ROOT / "public/data/hist_2026-05-01_2026-10-27.json",
    "ledger": ROOT / "public/derived/call_ledger.json",
    "site": ROOT / "public/derived/site_default.json",
    "torus": ROOT / "public/data/torus_published.json",
    "response": ROOT / "public/data/response_tables.json",
    "eia": ROOT / "prep/data/eia_pace_hourly.csv",
    "scale": ROOT / "public/derived/scale_curve.json",
    "bundle": ROOT / "public/data/bundle_2026-10-27.json",
    "rt_replay": ROOT / "public/derived/rt_replay.json",
    "rt": ROOT / "public/data/rt_2026-05-01_2026-10-27.json",
}
FLEET = ROOT / "public/derived/fleet_2026-10-27.json"
OWNER = {
    "sensitivity.json": "engine",
    "call_ledger.json": "engine",
    "response_tables.json": "data",
    "scale_curve.json": "engine",
    "rt_replay.json": "engine",
}


# ---------------------------------------------------------------- small helpers


def close(a, b, tol):
    if a is None or b is None:
        return False
    return abs(a - b) <= tol


def stats(values):
    return {
        "p10": xc.pctl_linear(values, 0.1),
        "p50": xc.pctl_linear(values, 0.5),
        "p90": xc.pctl_linear(values, 0.9),
        "mean": sum(values) / len(values),
    }


def row(check, output, status, what, **detail):
    return {"check": check, "output": output, "owner": OWNER.get(output), "status": status, "what": what, **detail}


def status_of(ok):
    return "match" if ok else "mismatch"


def parse_utc(s):
    return dt.datetime.fromisoformat(s.replace("Z", "+00:00")).astimezone(common.UTC)


def day_range(first, last):
    d, out = dt.date.fromisoformat(first), []
    while d <= dt.date.fromisoformat(last):
        out.append(d.isoformat())
        d += dt.timedelta(days=1)
    return out


# ---------------------------------------------------------------- 1. sensitivity


def spread_bands(spreads, ties, bands):
    out = []
    for lo, hi in bands:
        days = [d for d, s in spreads.items() if s >= lo and (hi is None or s < hi)]
        out.append(
            {
                "from_usd_mwh": lo,
                "to_usd_mwh": hi,
                "days": len(days),
                "rule_ties_or_wins": sum(1 for d in days if d in ties),
            }
        )
    return out


def check_sensitivity(sens, bt, bt_days, hist):
    rows = []
    pol = {p["policy"]: p for p in bt["policies"]}
    c, f = pol["clearlane"], pol["fixed_overnight"]
    want = {
        "usd_per_mw_day": c["usd_per_mw_day"]["mean"] - f["usd_per_mw_day"]["mean"],
        "co2_t_per_mw_day": c["co2_t_per_mw_day"]["mean"] - f["co2_t_per_mw_day"]["mean"],
        "calls_unanswerable_pct_points": c["calls_unanswerable_pct"]["heatmap_as_mt"]
        - f["calls_unanswerable_pct"]["heatmap_as_mt"],
    }
    got = sens["base"]["gap"]
    diffs = {k: abs(got[k] - want[k]) for k in want}
    rows.append(
        row(
            "sensitivity_base_vs_backtest",
            "sensitivity.json",
            status_of(all(d <= TOL for d in diffs.values())),
            "base.gap = clearlane minus fixed_overnight means in backtest.json (CO2 estimated)",
            science=want,
            published=got,
            abs_diff=diffs,
            inputs=[common.rel(P["sensitivity"]), common.rel(P["backtest"])],
        )
    )

    bad, absent = [], []
    for a in sens["axes"]:
        if "gap_base" not in a:
            absent.append(f"{a['key']} ({a.get('status')})")
            continue
        if not all(close(a["gap_base"][k], got[k], TOL) for k in want):
            bad.append(a["key"])
    be = sens["break_even"]
    x1 = [s for s in be["daily_spread"]["scanned"] if s["x"] == 1]
    xw = [s for s in be["wear_usd_mwh"]["scanned"] if s["x"] == sens["wear_usd_mwh"]]
    scans_ok = (
        len(x1) == 1
        and len(xw) == 1
        and close(x1[0]["gap_usd_per_mw_day"], got["usd_per_mw_day"], TOL)
        and close(xw[0]["gap_usd_per_mw_day"], got["usd_per_mw_day"], TOL)
    )
    rows.append(
        row(
            "sensitivity_base_internal",
            "sensitivity.json",
            status_of(not bad and scans_ok),
            "every axis gap_base and the spread x 1 and wear x W scans equal base.gap",
            axes_disagreeing=bad,
            axes_without_gap_base=absent,
            scans_equal_base=scans_ok,
            inputs=[common.rel(P["sensitivity"])],
        )
    )

    by_policy = {}
    for r in bt_days:
        by_policy.setdefault(r["policy"], {})[r["operating_day_mt"]] = r["usd_per_mw_day"]
    clear, fixed = by_policy["clearlane"], by_policy["fixed_overnight"]
    prices = {d["operating_day_mt"]: d["lmp_usd_mwh"] for d in hist}
    spreads = {day: max(prices[day]) - min(prices[day]) for day in sorted(clear)}
    ties = {day for day in clear if clear[day] <= fixed[day]}
    bands = spread_bands(spreads, ties, SPREAD_BANDS)
    pub = be["by_day_spread"]
    mean_spread = sum(spreads.values()) / len(spreads)
    pub_bands = [{k: b[k] for k in ("from_usd_mwh", "to_usd_mwh", "days", "rule_ties_or_wins")} for b in pub["bands"]]
    ok = (
        len(spreads) == pub["days"]
        and len(ties) == pub["rule_ties_or_wins"]
        and bands == pub_bands
        and close(mean_spread, be["daily_spread"]["base_mean_daily_spread_usd_mwh"], TOL)
    )
    rows.append(
        row(
            "sensitivity_by_day_spread",
            "sensitivity.json",
            status_of(ok),
            "days where the off-peak rule ties or beats Clearlane, by daily price spread (value comparison)",
            science={
                "days": len(spreads),
                "rule_ties_or_wins": len(ties),
                "bands": bands,
                "mean_daily_spread_usd_mwh": mean_spread,
            },
            published={
                "days": pub["days"],
                "rule_ties_or_wins": pub["rule_ties_or_wins"],
                "bands": pub_bands,
                "mean_daily_spread_usd_mwh": be["daily_spread"]["base_mean_daily_spread_usd_mwh"],
            },
            inputs=[common.rel(P["backtest_days"]), common.rel(P["hist"]), common.rel(P["sensitivity"])],
        )
    )
    return rows


# ---------------------------------------------------------------- 2. call ledger


def poisson_quantile(mean, q):
    """Smallest k with P(X <= k) >= q for X ~ Poisson(mean), summed in log space."""
    if mean <= 0:
        return 0
    log_p, cdf, k = -mean, 0.0, 0
    limit = int(mean + 50 * math.sqrt(mean) + 100)
    while k <= limit:
        cdf += math.exp(log_p)
        if cdf >= q:
            return k
        k += 1
        log_p += math.log(mean) - math.log(k)
    return limit


def same_day_prob(by_weekday, days_per_weekday):
    """Probability two given calls share a day: same weekday label, then the same day of it."""
    n = sum(by_weekday)
    total = 0.0
    for nw, dw in zip(by_weekday, days_per_weekday):
        pairs = nw * (nw - 1)
        if pairs == 0:
            continue
        if dw == 0:
            raise ValueError("a weekday with calls has no window days")
        total += pairs / (n * (n - 1)) / dw
    return total


def call_energy_kwh(kw, duration_s, ramp_s):
    return kw * (duration_s - ramp_s / 2) / 3600


def refill_window_s(start_s, energy_kwh, host_15m, ceiling_kw, full_kw, extra_kw, duration_s, day_s=86400):
    """Seconds from a call's start until Spin holds its energy again, refilling at
    min(full_kw, ceiling - host - extra_kw) per 15-minute interval; cut at the day's end."""
    t = start_s + duration_s
    remaining = energy_kwh
    while remaining > 1e-12:
        if t >= day_s:
            return day_s - start_s
        i = int(t // 900)
        end = min((i + 1) * 900, day_s)
        power = max(0.0, min(full_kw, ceiling_kw - host_15m[i] - extra_kw))
        if power > 0:
            need = remaining / power * 3600
            if t + need <= end:
                return t + need - start_s
            remaining -= power * (end - t) / 3600
        t = end
    return t - start_s


def pair_inside_prob(ha, hb, win):
    """For two calls with hour labels ha and hb and uniform whole minutes, the probability that the
    later one starts before the earlier start plus its window (equal starts count). win is per minute."""
    if ha > hb:
        ha, hb = hb, ha
    count = 0
    if ha == hb:
        for m in range(60):
            w = win[60 * ha + m]
            if w > 0:
                count += 1  # equal minutes
            later = min(59, math.ceil(m + w / 60) - 1) - m
            count += 2 * max(0, later)
    else:
        d = hb - ha
        for m in range(60):
            x = m + (win[60 * ha + m] - 3600 * d) / 60
            count += min(60, max(0, math.ceil(x)))
    return count / 3600


def expected_overlaps(by_hour, win, c):
    total = 0.0
    for ha in range(24):
        for hb in range(ha, 24):
            pairs = by_hour[ha] * (by_hour[ha] - 1) / 2 if ha == hb else by_hour[ha] * by_hour[hb]
            if pairs:
                total += pairs * pair_inside_prob(ha, hb, win)
    return c * total


def recount_inside(starts_by_day, win):
    n = 0
    for day in sorted(starts_by_day):
        s = sorted(starts_by_day[day])
        for a, b in zip(s, s[1:]):
            if b - a < win[int(a // 60)]:
                n += 1
    return n


def ledger_windows(site, ledger):
    st = site["site"]["station"]
    inp = ledger["inputs"]
    kw, dur, ramp = inp["requested_kw"]["value"], inp["call_duration_s"]["value"], inp["ramp_s"]["value"]
    energy = min(call_energy_kwh(kw, dur, ramp), st["spin_kwh"])
    full_kw = min(st["spin_kw"], st["spin_kwh"] * 60 / st["spin_recharge_min"])
    host = site["site"]["host_load_kw_15m"]
    ceiling = site["site"]["host_ceiling_kw"]
    w_full = dur + energy / full_kw * 3600
    windows = {
        "full": [w_full] * 1440,
        "host": [refill_window_s(60 * m, energy, host, ceiling, full_kw, 0, dur) for m in range(1440)],
        "pulse": [refill_window_s(60 * m, energy, host, ceiling, full_kw, st["pulse_kw"], dur) for m in range(1440)],
    }
    params = {
        "call_energy_kwh": energy,
        "full_refill_kw": full_kw,
        "w_full_s": w_full,
        "w_host_s_min": min(windows["host"]),
        "w_host_s_max": max(windows["host"]),
        "w_pulse_s_max": max(windows["pulse"]),
    }
    return windows, params


def ledger_rows_by_reading(ledger):
    out = {}
    for r in ledger["rows"]:
        out.setdefault(r["reading"], []).append(r)
    return out


def starts_by_day(rows):
    seen, out = set(), {}
    for r in rows:
        if r["call_id"] in seen:
            continue
        seen.add(r["call_id"])
        day = dt.date.fromisoformat(r["operating_day_mt"])
        sec = (parse_utc(r["start_utc"]) - common.utc_start(day, 0)).total_seconds()
        out.setdefault(r["operating_day_mt"], []).append(sec)
    return out


def check_ledger(ledger, site, torus):
    rows = []
    by_reading = ledger_rows_by_reading(ledger)
    pub_reading = {p["reading"]: p for p in ledger["per_reading"]}
    by_hour = torus["events_2025_by_hour"]["value"]
    by_weekday = torus["events_2025_by_weekday"]["value"]
    n_calls = sum(by_hour)
    missing = set(ledger["window"]["missing_days"])
    usable = [d for d in day_range(ledger["window"]["start_mt"], ledger["window"]["end_mt"]) if d not in missing]

    # recount from rows
    recount, ok = {}, True
    for reading in sorted(by_reading):
        rs = by_reading[reading]
        calls = {}
        for r in rs:
            calls.setdefault(r["call_id"], r)
        per_day = {}
        for c in calls.values():
            per_day[c["operating_day_mt"]] = per_day.get(c["operating_day_mt"], 0) + 1
        hours = [0] * 24
        weekdays = [0] * 7
        for c in calls.values():
            hours[c["heatmap_hour"]] += 1
            weekdays[c["heatmap_weekday"]] += 1
        rc = {
            "calls": len(calls),
            "days_with_calls": len(per_day),
            "max_calls_one_day": max(per_day.values()),
            "labels_equal_heatmap": hours == by_hour and weekdays == by_weekday,
        }
        pub = pub_reading[reading]
        ok = ok and rc["labels_equal_heatmap"]
        ok = ok and all(rc[k] == pub[k] for k in ("calls", "days_with_calls", "max_calls_one_day"))
        recount[reading] = rc
    summary_bad = []
    for s in ledger["summary"]:
        rs = [r for r in by_reading[s["reading"]] if r["policy"] == s["policy"]]
        okn = sum(1 for r in rs if r["delivered_pct"] >= 90)
        mine = {
            "calls": len(rs),
            "delivered_at_or_above_90_pct_share": okn / len(rs) * 100,
            "unanswerable_calls": len(rs) - okn,
            "shortfall_calls": sum(1 for r in rs if r["shortfall_kwh"] > 1e-6),
            "shortfall_kwh": sum(r["shortfall_kwh"] for r in rs),
        }
        for k, v in mine.items():
            if not close(v, s[k], TOL):
                summary_bad.append(f"{s['reading']}/{s['policy']}/{k}")
    dens = ledger["replay_density"]
    dens_mine = {
        "calls_per_reading": n_calls,
        "backtest_days": len(usable),
        "calls_per_day": n_calls / len(usable),
        "rate_2025_per_day": n_calls / 365,
        "ratio_to_2025_rate": (n_calls / len(usable)) / (n_calls / 365),
    }
    dens_bad = [k for k, v in dens_mine.items() if not close(v, dens[k], TOL)]
    rows.append(
        row(
            "ledger_recount",
            "call_ledger.json",
            status_of(ok and not summary_bad and not dens_bad),
            "calls, days, labels, delivered shares, shortfalls and density recounted from the rows",
            science={"per_reading": recount, "replay_density": dens_mine},
            published={
                "per_reading": {
                    r: {k: pub_reading[r][k] for k in ("calls", "days_with_calls", "max_calls_one_day")}
                    for r in sorted(pub_reading)
                },
                "replay_density": {k: dens[k] for k in dens_mine},
            },
            summary_fields_disagreeing=summary_bad,
            density_fields_disagreeing=dens_bad,
            inputs=[common.rel(P["ledger"]), common.rel(P["torus"])],
        )
    )

    # closed form, Mountain reading
    windows, params = ledger_windows(site, ledger)
    d_w = [sum(1 for d in usable if dt.date.fromisoformat(d).weekday() == w) for w in range(7)]
    c = same_day_prob(by_weekday, d_w)
    e = {k: expected_overlaps(by_hour, windows[k], c) for k in ("full", "host", "pulse")}
    lo, hi = poisson_quantile(e["full"], 0.05), poisson_quantile(e["pulse"], 0.95)
    observed = pub_reading["mt"]["calls_inside_prior_refill_window"]
    ratio = len(usable) / 365
    rows.append(
        row(
            "ledger_overlap_closed_form",
            "call_ledger.json",
            status_of(lo <= observed <= hi),
            "calls inside the prior refill window: closed form at the ledger's density vs the replay (Mountain)",
            science={
                "same_day_prob": c,
                "expected_full": e["full"],
                "expected_host_central": e["host"],
                "expected_pulse": e["pulse"],
                "accept_lo": lo,
                "accept_hi": hi,
                "expected_host_at_2025_rate": e["host"] * ratio * ratio,
                "window_days_by_weekday": d_w,
                **params,
            },
            published={"calls_inside_prior_refill_window": observed},
            inputs=[common.rel(P["ledger"]), common.rel(P["site"]), common.rel(P["torus"])],
        )
    )

    # recount from the ledger's own start times
    for reading in sorted(by_reading):
        starts = starts_by_day(by_reading[reading])
        rc = {k: recount_inside(starts, windows[k]) for k in ("full", "host", "pulse")}
        obs = pub_reading[reading]["calls_inside_prior_refill_window"]
        rows.append(
            row(
                f"ledger_overlap_recount_{reading}",
                "call_ledger.json",
                status_of(rc["full"] <= obs <= rc["pulse"]),
                "calls inside the prior refill window recounted from the ledger's start times"
                + (" (Mountain, the stage reading)" if reading == "mt" else " (UTC reading: a sensitivity only)"),
                science={"recount_full": rc["full"], "recount_host": rc["host"], "recount_pulse": rc["pulse"]},
                published={"calls_inside_prior_refill_window": obs},
                for_stage=reading == "mt",
                inputs=[common.rel(P["ledger"]), common.rel(P["site"])],
            )
        )
    return rows


# ---------------------------------------------------------------- 3. marginal CO2


def _f(s):
    s = (s or "").strip()
    return float(s) if s else None


def read_pace(path):
    with open(path, newline="", encoding="utf-8") as f:
        return [
            {
                "utc": parse_utc(r["utc_start"]),
                "demand": _f(r["demand_mw"]),
                "fcst": _f(r["demand_fcst_mw"]),
                "net_gen": _f(r["net_gen_mw"]),
                "co2_t": _f(r["co2_t"]),
                "co2_cons": _f(r["co2_cons_lb_kwh"]),
            }
            for r in csv.DictReader(f)
        ]


def good_hour(r):
    d, f = r["demand"], r["fcst"]
    if d is None or d <= 0 or f is None or f <= 0:
        return False
    return 0.5 * f <= d <= 1.5 * f


def co2_pairs(rows):
    """Per basis, (season, hour, level, dx, dy) for consecutive UTC hours, keyed to the second hour."""
    pairs = {"generated": [], "consumed": []}
    skipped = 0
    for a, b in zip(rows, rows[1:]):
        if b["utc"] - a["utc"] != common.HOUR:
            skipped += 1
            continue
        day, hour = common.mountain_hb(b["utc"])
        season = SEASONS[day.month]
        if None not in (a["co2_t"], b["co2_t"], a["net_gen"], b["net_gen"]) and min(a["net_gen"], b["net_gen"]) > 0:
            pairs["generated"].append(
                (season, hour, b["net_gen"], b["net_gen"] - a["net_gen"], b["co2_t"] - a["co2_t"])
            )
        else:
            skipped += 1
        if good_hour(a) and good_hour(b) and None not in (a["co2_cons"], b["co2_cons"]):
            ca = a["co2_cons"] * a["demand"] * 1000 / LB_PER_T
            cb = b["co2_cons"] * b["demand"] * 1000 / LB_PER_T
            pairs["consumed"].append((season, hour, b["demand"], b["demand"] - a["demand"], cb - ca))
    return pairs, skipped


def ols(xs, ys):
    n = len(xs)
    mx, my = sum(xs) / n, sum(ys) / n
    sxx = sum((x - mx) ** 2 for x in xs)
    sxy = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
    syy = sum((y - my) ** 2 for y in ys)
    slope = sxy / sxx
    return slope, my - slope * mx, (sxy * sxy) / (sxx * syy) if syy else 1.0


def decile_cuts(values):
    return [xc.pctl_linear(values, k / 10) for k in range(1, 10)]


def load_bin(value, cuts):
    return bisect.bisect_right(cuts, value)


def weighted_cell(bins, slope_by_bin):
    used = [slope_by_bin[b] for b in bins if slope_by_bin.get(b) is not None]
    return sum(used) / len(used) if used else None


def binned_by_hour(ps):
    """Load-binned value per Mountain hour for one season's pairs (season, hour, level, dx, dy)."""
    cuts = decile_cuts([p[2] for p in ps])
    groups = {}
    for p in ps:
        groups.setdefault(load_bin(p[2], cuts), []).append(p)
    slope_by_bin = {
        k: ols([p[3] for p in g], [p[4] for p in g])[0] * 1000 if len(g) >= 3 else None for k, g in groups.items()
    }
    cells = {}
    for p in ps:
        cells.setdefault(p[1], []).append(load_bin(p[2], cuts))
    return {h: weighted_cell(bins, slope_by_bin) for h, bins in cells.items()}


def demean_by_hour(ps):
    sums = {}
    for p in ps:
        s = sums.setdefault(p[1], [0, 0.0, 0.0])
        s[0] += 1
        s[1] += p[3]
        s[2] += p[4]
    return [(p[0], p[1], p[2], p[3] - sums[p[1]][1] / sums[p[1]][0], p[4] - sums[p[1]][2] / sums[p[1]][0]) for p in ps]


def check_co2(response, eia_rows):
    table = response["tables"]["marginal_co2"]
    pairs, skipped = co2_pairs(eia_rows)
    pub = {(b["basis"], b["season"], b["hour_mt"]): b for b in table["bins"]}
    rows = []

    # reproduction
    cells = {}
    for basis, ps in pairs.items():
        for p in ps:
            cells.setdefault((basis, p[0], p[1]), []).append(p)
    worst = {"slope": 0.0, "r2": 0.0}
    bad = []
    for key in sorted(set(cells) | set(pub)):
        ps, b = cells.get(key, []), pub.get(key)
        if b is None or len(ps) < 3:
            bad.append("/".join(map(str, key)))
            continue
        slope, _, r2 = ols([p[3] for p in ps], [p[4] for p in ps])
        ds, dr = abs(slope * 1000 - b["slope"]), abs(r2 - b["r2"])
        worst["slope"], worst["r2"] = max(worst["slope"], ds), max(worst["r2"], dr)
        if len(ps) != b["n"] or ds > 0.05 + TOL or dr > 0.00005 + TOL:
            bad.append("/".join(map(str, key)))
    rows.append(
        row(
            "co2_reproduction",
            "response_tables.json",
            status_of(not bad and skipped == table["pairs_skipped"]),
            "hour-of-day OLS slopes, n and R2 of the estimated marginal CO2 table, reproduced from the EIA CSV",
            science={
                "bins": len(cells),
                "pairs_skipped": skipped,
                "max_abs_slope_diff_g_kwh": worst["slope"],
                "max_abs_r2_diff": worst["r2"],
            },
            published={"bins": len(pub), "pairs_skipped": table["pairs_skipped"]},
            bins_disagreeing=bad,
            inputs=[common.rel(P["eia"]), common.rel(P["response"])],
        )
    )

    # load-level second method (the test), and a post hoc diagnostic that is not a test: the same
    # estimator after removing each hour's mean change, to see whether the daily ramp drives the gap
    for basis in ("generated", "consumed"):
        inside, outside, inconclusive, inside_dm = 0, [], 0, 0
        cells_out = []
        for season in SEASON_ORDER:
            ps = [p for p in pairs[basis] if p[0] == season]
            if not ps:
                continue
            values, values_dm = binned_by_hour(ps), binned_by_hour(demean_by_hour(ps))
            for hour in range(24):
                b = pub.get((basis, season, hour))
                if b is None or hour not in values:
                    continue
                if b["inconclusive"]:
                    inconclusive += 1
                    continue
                v, v_dm = values[hour], values_dm.get(hour)
                if v is not None and b["lo"] <= v <= b["hi"]:
                    inside += 1
                else:
                    outside.append(f"{season} {hour:02d}h")
                if v_dm is not None and b["lo"] <= v_dm <= b["hi"]:
                    inside_dm += 1
                cells_out.append(
                    {"season": season, "hour_mt": hour, "load_binned": v, "load_binned_hour_demeaned": v_dm,
                     "lo": b["lo"], "hi": b["hi"]}
                )
        n = inside + len(outside)
        share = inside / n if n else None
        rows.append(
            row(
                f"co2_load_binned_{basis}",
                "response_tables.json",
                status_of(share is not None and share >= INSIDE_SHARE_MIN),
                f"estimated marginal CO2 ({basis} basis): load-binned value inside the hour-of-day OLS interval",
                science={
                    "conclusive_cells": n,
                    "inside": inside,
                    "inside_share": share,
                    "inconclusive_cells": inconclusive,
                    "cells_outside": outside,
                },
                post_hoc_diagnostic={
                    "not_a_test": True,
                    "method": "load-binned slopes after subtracting each (season, hour) cell's mean change in x and y",
                    "inside": inside_dm,
                    "inside_share": inside_dm / n if n else None,
                },
                published={"bins": sum(1 for k in pub if k[0] == basis)},
                cells=cells_out,
                inputs=[common.rel(P["eia"]), common.rel(P["response"])],
            )
        )
    return rows


# ---------------------------------------------------------------- 4. scale curve


def leg_volumes(charge_hb, discharge_hb, mwh=REF_MWH_PER_MW, rte=REF_RTE):
    q = [0.0] * 24
    for h in charge_hb:
        q[h] -= mwh / math.sqrt(rte) / len(charge_hb)
    for h in discharge_hb:
        q[h] += mwh * math.sqrt(rte) / len(discharge_hb)
    return q


def reprice_value(prices, q, slopes, fleet_mw):
    total = 0.0
    for h in range(24):
        if q[h]:
            total += (prices[h] - slopes[h] * fleet_mw * q[h]) * q[h]
    return total


def check_scale(scale, response, bundle):
    rows = []
    pr = {b["hour_mt"]: b for b in response["tables"]["price_response"]["bins"]}
    bad = []
    for h in scale["slopes"]["hours"]:
        b = pr.get(h["hb"])
        if b is None or any(h[k] != b[k] for k in ("slope", "lo", "hi", "n")):
            bad.append(h["hb"])
            continue
        if (h["used"], h["used_lo"], h["used_hi"]) != (max(0, b["slope"]), max(0, b["lo"]), max(0, b["hi"])):
            bad.append(h["hb"])
    rows.append(
        row(
            "scale_slopes_vs_response",
            "scale_curve.json",
            status_of(not bad and len(scale["slopes"]["hours"]) == 24),
            "scale-curve slopes equal the price_response table, clamped at zero",
            hours_disagreeing=bad,
            inputs=[common.rel(P["scale"]), common.rel(P["response"])],
        )
    )

    hours = sorted(scale["slopes"]["hours"], key=lambda h: h["hb"])
    used = [h["used"] for h in hours]
    used_lo = [h["used_lo"] for h in hours]
    used_hi = [h["used_hi"] for h in hours]
    prices = [None] * 24
    for h in bundle["hours"]:
        prices[h["hour_mt"]] = h["lmp_usd_mwh"]
    for s in scale["series"]:
        if s["id"] not in LEGS:
            rows.append(
                row(
                    f"scale_{s['id']}",
                    "scale_curve.json",
                    "not cross-checked",
                    "a re-planning DP with price impact has no second method here",
                    inputs=[common.rel(P["scale"])],
                )
            )
            continue
        charge, discharge = LEGS[s["id"]]
        q = leg_volumes(charge, discharge)
        taker = reprice_value(prices, q, used, 0)
        worst, pts = 0.0, []
        ok = close(taker, s["price_taker_usd_per_mw_day"], 0.01)
        ok = ok and s["traded_hb"] == sorted(charge + discharge)
        for p in s["points"]:
            f = p["fleet_mw"]
            mine = {
                "usd_per_mw_day": reprice_value(prices, q, used, f),
                "band_low_usd_per_mw_day": reprice_value(prices, q, used_hi, f),
                "band_high_usd_per_mw_day": reprice_value(prices, q, used_lo, f),
            }
            for k, v in mine.items():
                worst = max(worst, abs(v - p[k]))
                ok = ok and close(v, p[k], 0.01)
            ok = ok and close(p["usd_per_day"], p["usd_per_mw_day"] * f, 0.01)
            ok = ok and close(mine["usd_per_mw_day"] * f, p["usd_per_day"], 0.01 * f)
            ok = ok and close(p["discharged_mwh_per_mw"], sum(x for x in q if x > 0), TOL)
            pts.append({"fleet_mw": f, **mine})
        rows.append(
            row(
                f"scale_{s['id']}",
                "scale_curve.json",
                status_of(ok),
                f"{s['label']}: repriced hour by hour from the bundle prices",
                science={"price_taker_usd_per_mw_day": taker, "points": pts, "max_abs_diff_usd_per_mw_day": worst},
                published={
                    "price_taker_usd_per_mw_day": s["price_taker_usd_per_mw_day"],
                    "points": [
                        {
                            k: p[k]
                            for k in (
                                "fleet_mw",
                                "usd_per_mw_day",
                                "band_low_usd_per_mw_day",
                                "band_high_usd_per_mw_day",
                            )
                        }
                        for p in s["points"]
                    ],
                },
                inputs=[common.rel(P["scale"]), common.rel(P["bundle"])],
            )
        )
    return rows


# ---------------------------------------------------------------- 5. real-time replay


def window_means(day_ts, day_lmp, hbs):
    vals = [p for ts, p in zip(day_ts, day_lmp) if common.mountain_hb(parse_utc(ts))[1] in hbs]
    return sum(vals) / len(vals)


def check_rt(rt_replay, bt_days, rt, hist):
    rows = []
    days = rt_replay["days"]
    clear = {r["operating_day_mt"]: r["usd_per_mw_day"] for r in bt_days if r["policy"] == "clearlane"}
    hold_diffs = [abs(d["settled_usd_per_mw_day"]["hold"] - clear[d["operating_day_mt"]]) for d in days]
    dev_ok = all(d["deviation_mwh_per_mw"]["hold"] == 0 for d in days)
    rows.append(
        row(
            "rt_hold_identity",
            "rt_replay.json",
            status_of(len(days) == len(clear) and max(hold_diffs) <= 1e-6 and dev_ok),
            "holding the day-ahead plan settles at its day-ahead value, day by day",
            science={"days": len(days), "max_abs_diff_usd_per_mw_day": max(hold_diffs)},
            published={"days": rt_replay["window"]["days"]},
            inputs=[common.rel(P["rt_replay"]), common.rel(P["backtest_days"])],
        )
    )

    bad_regret = []
    for d in days:
        for p in ("hold", "replan"):
            r = d["regret_usd_per_mw_day"][p]
            want = d["net_usd_per_mw_day"]["foresight"] - d["net_usd_per_mw_day"][p]
            if not close(r, want, TOL) or r < -TOL:
                bad_regret.append(f"{d['operating_day_mt']}/{p}")
    summ = rt_replay["summary"]
    bad_sum = []
    for field, pols in (
        ("settled_usd_per_mw_day", ("hold", "replan", "foresight")),
        ("net_usd_per_mw_day", ("hold", "replan", "foresight")),
        ("regret_usd_per_mw_day", ("hold", "replan")),
    ):
        for p in pols:
            mine = stats([d[field][p] for d in days])
            for k, v in mine.items():
                if not close(v, summ[field][p][k], TOL):
                    bad_sum.append(f"{field}/{p}/{k}")
    sums = {p: sum(d["regret_usd_per_mw_day"][p] for d in days) for p in ("hold", "replan")}
    for p in sums:
        if not close(sums[p], summ["regret_sum_usd_per_mw"][p], 1e-6):
            bad_sum.append(f"regret_sum/{p}")
    recovers = (sums["hold"] - sums["replan"]) / sums["hold"] * 100
    if not close(recovers, summ["replan_recovers_pct"], TOL):
        bad_sum.append("replan_recovers_pct")
    net = [(d["net_usd_per_mw_day"]["replan"], d["net_usd_per_mw_day"]["hold"]) for d in days]
    counts = {
        "days_replan_above_hold": sum(1 for r, h in net if r > h),
        "days_replan_below_hold": sum(1 for r, h in net if r < h),
        "days_replan_equal_hold": sum(1 for r, h in net if r == h),
    }
    for k, v in counts.items():
        if v != summ[k]:
            bad_sum.append(k)
    rows.append(
        row(
            "rt_identities_and_summary",
            "rt_replay.json",
            status_of(not bad_regret and not bad_sum),
            "regret = foresight minus policy net, never below zero; summary statistics and day counts recomputed",
            science={"replan_recovers_pct": recovers, "regret_sum_usd_per_mw": sums, **counts},
            published={
                "replan_recovers_pct": summ["replan_recovers_pct"],
                "regret_sum_usd_per_mw": summ["regret_sum_usd_per_mw"],
                **{k: summ[k] for k in counts},
            },
            regret_days_disagreeing=bad_regret,
            summary_fields_disagreeing=bad_sum,
            inputs=[common.rel(P["rt_replay"])],
        )
    )

    mid, eve = set(rt_replay["windows_mt"]["midday_hb"]), set(rt_replay["windows_mt"]["evening_hb"])
    rt_days = {d["operating_day_mt"]: d for d in rt["days"]}
    da_days = {d["operating_day_mt"]: d["lmp_usd_mwh"] for d in hist}
    worst, bad = 0.0, []
    rt_below = da_below = 0
    for d in days:
        r = rt_days[d["operating_day_mt"]]
        da = da_days[d["operating_day_mt"]]
        mine = {
            "rt_midday_usd_mwh": window_means(r["ts_utc"], r["lmp_usd_mwh"], mid),
            "rt_evening_usd_mwh": window_means(r["ts_utc"], r["lmp_usd_mwh"], eve),
            "da_midday_usd_mwh": sum(da[h] for h in sorted(mid)) / len(mid),
            "da_evening_usd_mwh": sum(da[h] for h in sorted(eve)) / len(eve),
        }
        for k, v in mine.items():
            worst = max(worst, abs(v - d[k]))
            if not close(v, d[k], 1e-6):
                bad.append(f"{d['operating_day_mt']}/{k}")
        flag = mine["rt_evening_usd_mwh"] < mine["rt_midday_usd_mwh"]
        rt_below += flag
        da_below += mine["da_evening_usd_mwh"] < mine["da_midday_usd_mwh"]
        if flag != d["rt_evening_below_midday"]:
            bad.append(f"{d['operating_day_mt']}/rt_evening_below_midday")
    ok = (
        not bad
        and rt_below == summ["rt_evening_below_midday_days"]
        and da_below == summ["da_evening_below_midday_days"]
    )
    rows.append(
        row(
            "rt_window_prices",
            "rt_replay.json",
            status_of(ok),
            "midday and evening mean RT and DA prices recomputed from the REAL price files",
            science={
                "rt_evening_below_midday_days": rt_below,
                "da_evening_below_midday_days": da_below,
                "max_abs_diff_usd_mwh": worst,
            },
            published={
                "rt_evening_below_midday_days": summ["rt_evening_below_midday_days"],
                "da_evening_below_midday_days": summ["da_evening_below_midday_days"],
            },
            days_disagreeing=bad,
            inputs=[common.rel(P["rt_replay"]), common.rel(P["rt"]), common.rel(P["hist"])],
        )
    )
    return rows


# ---------------------------------------------------------------- 6. absent outputs


def absent_rows():
    traces = sorted(
        common.rel(p) for p in (ROOT / "public/derived").glob("*") if "rainflow" in p.name or "trace" in p.name
    )
    rows = [
        row(
            "wear_rainflow",
            "wear rainflow",
            "not cross-checked",
            "no trace file" if not traces else "trace file present but no second method built: " + ", ".join(traces),
        ),
        row(
            "fleet_envelope_sum",
            "fleet envelope",
            "not cross-checked",
            "no fleet file" if not FLEET.exists() else "fleet file present but no second method built",
        ),
        row(
            "co2_price_response",
            "response_tables.json",
            "not cross-checked",
            "the price_response table gets no second method here",
        ),
        row(
            "co2_forecast_residuals",
            "response_tables.json",
            "not cross-checked",
            "the forecast_residuals table gets no second method here",
        ),
        row(
            "sensitivity_other_axes",
            "sensitivity.json",
            "not cross-checked",
            "axes and the two_way grid are not re-run; only the base-case rows above",
        ),
    ]
    return rows


# ---------------------------------------------------------------- run


# Issues filed for the mismatches of the run on Wed Oct 28 2026, one per owner and table.
FILED = {
    "sensitivity_base_internal": (
        247,
        "[engine] sensitivity.json: dp_soc_states gap_base has a null calls field (science #112 cross-check)",
    ),
    "co2_load_binned_generated": (
        248,
        "[data] response_tables.json marginal CO2: hourly factors fail a load-binned second method (science #112)",
    ),
    "co2_load_binned_consumed": (
        248,
        "[data] response_tables.json marginal CO2: hourly factors fail a load-binned second method (science #112)",
    ),
}


def mismatches(rows):
    out = []
    for r in rows:
        if r["status"] != "mismatch":
            continue
        issue, title = FILED.get(r["check"], (None, f"[{r['owner']}] {r['output']}: {r['check']} disagrees"))
        out.append({"check": r["check"], "owner": r["owner"], "issue": issue, "title": title})
    return out


def run():
    load = xc._load_json
    rows = []
    rows += check_sensitivity(load(P["sensitivity"]), load(P["backtest"]), load(P["backtest_days"]), load(P["hist"]))
    rows += check_ledger(load(P["ledger"]), load(P["site"]), load(P["torus"]))
    rows += check_co2(load(P["response"]), read_pace(P["eia"]))
    rows += check_scale(load(P["scale"]), load(P["response"]), load(P["bundle"]))
    rows += check_rt(load(P["rt_replay"]), load(P["backtest_days"]), load(P["rt"]), load(P["hist"]))
    rows += absent_rows()
    counts = {s: sum(1 for r in rows if r["status"] == s) for s in ("match", "mismatch", "not cross-checked")}
    return {
        "schema": SCHEMA,
        "flag": FLAG,
        "stage": "not read by the stage app",
        "prov": "DERIVED",
        "tolerances": common.rel(MD),
        "checks": rows,
        "counts": counts,
        "mismatches": mismatches(rows),
        "inputs": common.input_record(P.values()),
    }


def _n(x, d=2):
    if x is None:
        return "none"
    if isinstance(x, bool):
        return "yes" if x else "no"
    if isinstance(x, int):
        return f"{x:,}"
    return f"{x:,.{d}f}"


def results_md(res):
    by = {r["check"]: r for r in res["checks"]}
    c = res["counts"]
    out = [
        f"Run by `python -I science/crosscheck_stretch.py`. {c['match']} match, {c['mismatch']} mismatch, "
        f"{c['not cross-checked']} not cross-checked. JSON: `science/crosscheck_stretch.json`.",
        "",
        "| Check | Output | Status | What |",
        "|---|---|---|---|",
    ]
    for r in res["checks"]:
        out.append(f"| `{r['check']}` | `{r['output']}` | {r['status']} | {r['what']} |")
    s = by["sensitivity_base_vs_backtest"]
    d = by["sensitivity_by_day_spread"]
    lc = by["ledger_overlap_closed_form"]["science"]
    lr = by["ledger_overlap_recount_mt"]["science"]
    obs = by["ledger_overlap_closed_form"]["published"]["calls_inside_prior_refill_window"]
    out += [
        "",
        "### Sensitivity (`public/derived/sensitivity.json` vs `public/derived/backtest.json`)",
        "",
        f"- Base gap from the backtest means: ${_n(s['science']['usd_per_mw_day'], 4)}/MW-day, "
        f"{_n(s['science']['co2_t_per_mw_day'], 4)} t CO2/MW-day (estimated), "
        f"{_n(s['science']['calls_unanswerable_pct_points'], 4)} percentage points of calls unanswerable "
        f"(Mountain reading). Largest difference from the file: "
        f"{max(s['abs_diff'].values()):.1e}.",
        f"- By-day spread (`backtest_days.json`, hist file): the rule ties or beats Clearlane on "
        f"{d['science']['rule_ties_or_wins']} of {d['science']['days']} days by value comparison (file: "
        f"{d['published']['rule_ties_or_wins']} of {d['published']['days']}); mean daily spread "
        f"${_n(d['science']['mean_daily_spread_usd_mwh'], 4)}/MWh.",
        "",
        "### Call ledger (`public/derived/call_ledger.json`, `public/derived/site_default.json`)",
        "",
        f"- One call takes {_n(lc['call_energy_kwh'], 2)} kWh from Spin; at {_n(lc['full_refill_kw'], 0)} kW "
        f"Spin is full again {_n(lc['w_full_s'], 0)} s after the start. Under the host ceiling with no Pulse "
        f"charge the window runs {_n(lc['w_host_s_min'], 0)} s to {_n(lc['w_host_s_max'], 0)} s by start time.",
        f"- Two calls share a Mountain day with probability {lc['same_day_prob']:.5f}. Closed-form expected "
        f"count: {_n(lc['expected_full'], 1)} (full refill), {_n(lc['expected_host_central'], 1)} (host "
        f"ceiling, central), {_n(lc['expected_pulse'], 1)} (Pulse charging at full rating). Accept range "
        f"{lc['accept_lo']} to {lc['accept_hi']}; the replay counts {obs} (Mountain).",
        f"- Recount from the ledger's own start times: {lr['recount_full']} (full refill), "
        f"{lr['recount_host']} (host ceiling), {lr['recount_pulse']} (Pulse charging).",
        f"- At the 2025 call rate instead of the replay's density, the central closed form gives "
        f"{_n(lc['expected_host_at_2025_rate'], 1)} such calls over the window (closed form only, SIMULATED).",
        "",
        "### Estimated marginal CO2 (`prep/data/eia_pace_hourly.csv` vs `public/data/response_tables.json`)",
        "",
    ]
    rep = by["co2_reproduction"]
    out.append(
        f"- Reproduction: {rep['science']['bins']} bins, pairs skipped {rep['science']['pairs_skipped']} "
        f"(file {rep['published']['pairs_skipped']}); largest slope difference "
        f"{rep['science']['max_abs_slope_diff_g_kwh']:.3f} g/kWh, largest R2 difference "
        f"{rep['science']['max_abs_r2_diff']:.5f}; bins disagreeing: {len(rep['bins_disagreeing'])}."
    )
    for basis in ("generated", "consumed"):
        row_ = by[f"co2_load_binned_{basis}"]
        r, dx = row_["science"], row_["post_hoc_diagnostic"]
        below = sum(1 for c in row_["cells"] if c["load_binned"] is not None and c["load_binned"] < c["lo"])
        above = sum(1 for c in row_["cells"] if c["load_binned"] is not None and c["load_binned"] > c["hi"])
        outside = ", ".join(r["cells_outside"]) if r["cells_outside"] else "none"
        out.append(
            f"- Load-binned, {basis} basis: {r['inside']} of {r['conclusive_cells']} conclusive cells inside the "
            f"OLS interval ({_n(r['inside_share'] * 100 if r['inside_share'] is not None else None, 1)}%), "
            f"{r['inconclusive_cells']} inconclusive; below the interval in {below}, above it in {above}. "
            f"Post hoc, not a test: after removing each hour's mean change, {dx['inside']} of "
            f"{r['conclusive_cells']} fall inside. Outside: {outside}."
        )
    out += ["", "### Scale curve (`public/derived/scale_curve.json`, `public/data/bundle_2026-10-27.json`)", ""]
    for sid in LEGS:
        r = by[f"scale_{sid}"]
        out.append(
            f"- `{sid}`: price taker ${_n(r['science']['price_taker_usd_per_mw_day'], 4)}/MW-day (file "
            f"${_n(r['published']['price_taker_usd_per_mw_day'], 4)}); largest point difference "
            f"${r['science']['max_abs_diff_usd_per_mw_day']:.1e}/MW-day."
        )
    h = by["rt_hold_identity"]["science"]
    w = by["rt_window_prices"]
    i = by["rt_identities_and_summary"]["science"]
    out += [
        "",
        "### Real-time replay (`public/derived/rt_replay.json`, `public/data/rt_2026-05-01_2026-10-27.json`)",
        "",
        f"- Hold vs the backtest day values: largest difference ${h['max_abs_diff_usd_per_mw_day']:.1e}/MW-day "
        f"over {h['days']} days.",
        f"- Replan recovers {_n(i['replan_recovers_pct'], 2)}% of hold's regret; replan nets more than hold on "
        f"{i['days_replan_above_hold']} days and less on {i['days_replan_below_hold']}.",
        f"- RT evening below RT midday on {w['science']['rt_evening_below_midday_days']} days (file "
        f"{w['published']['rt_evening_below_midday_days']}); DA on {w['science']['da_evening_below_midday_days']} "
        f"(file {w['published']['da_evening_below_midday_days']}); largest window-price difference "
        f"${w['science']['max_abs_diff_usd_mwh']:.1e}/MWh.",
        "",
        "### Mismatches",
        "",
    ]
    if res["mismatches"]:
        out += [
            f"- `{m['check']}` (owner: {m['owner']}): "
            + (f"#{m['issue']} {m['title']}" if m["issue"] else f"not filed yet: {m['title']}")
            for m in res["mismatches"]
        ]
    else:
        out.append("None.")
    return "\n".join(out)


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--out", default=str(OUT))
    ap.add_argument("--no-md", action="store_true")
    a = ap.parse_args(argv)
    res = run()
    common.write_json(a.out, res)
    if not a.no_md:
        common.write_results(MD, results_md(res))
    c = res["counts"]
    print(f"{c['match']} match, {c['mismatch']} mismatch, {c['not cross-checked']} not cross-checked")
    for m in res["mismatches"]:
        print(f"MISMATCH {m['check']} ({m['owner']})")


if __name__ == "__main__":
    main()
