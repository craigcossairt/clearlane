"""Step-hour statistics: is the 5pm to 6pm price step real? (issue #108, flag off_step_stats)

Run from the repo root:  python -I science/step_stats.py
Writes science/step_stats.json and the results block in science/step-stats.md.
Definitions, null hypotheses, statistics and tolerances: science/step-stats.md, written before
computing. Step hour: docs/lanes/science.md 6.4, via science.crosscheck.step_hour (tested in core 2).
"""

import argparse
import datetime as dt
import json
import math
import pathlib
import random
import statistics
import sys
from fractions import Fraction

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from science import common  # noqa: E402
from science import crosscheck as xc  # noqa: E402

SCHEMA = "clearlane.science.step_stats/v1"
SCRIPT = "science/step_stats.py"
FLAG = "off_step_stats"
HIST = "public/data/hist_2026-05-01_2026-10-27.json"
META = "public/data/hist_2026-05-01_2026-10-27.meta.json"
CHART = "science/charts/step_hours_oct_jul.json"
NUMBERS = "public/derived/numbers.json"
OUT_JSON = "science/step_stats.json"
OUT_MD = "science/step-stats.md"

SEED = 108
PERMS = 100_000
TARGET = (17, 18)  # HB 5pm and HB 6pm
P0 = Fraction(2, 23)  # uniform over the 23 possible step hours h = 1..23
WINDOW = (dt.date(2026, 5, 1), dt.date(2026, 10, 27))
OCT = (dt.date(2026, 10, 1), dt.date(2026, 10, 27))
JUL = (dt.date(2026, 7, 1), dt.date(2026, 7, 30))
JUL31 = (dt.date(2026, 7, 1), dt.date(2026, 7, 31))

PINNED = {
    "oct_n": 27,
    "oct_k": 24,
    "oct_hb17": 9,
    "oct_hb18": 15,
    "oct_median": 15.1,
    "jul_n": 30,
    "jul_13_20": 28,
    "jul_median": 10.1,
}


# ------------------------------------------------------------------ pure functions


def binom_upper_tail(n, k, p):
    """P(X >= k) for X ~ Binomial(n, p), exact for a Fraction p."""
    q = 1 - p
    return sum((math.comb(n, j) * p**j * q ** (n - j) for j in range(k, n + 1)), Fraction(0))


def binomial_test(hours, target, p0=P0):
    """One-sided exact binomial test of landing in `target` against probability p0 per day."""
    n = len(hours)
    k = sum(1 for h in hours if h in target)
    tail = binom_upper_tail(n, k, p0)
    return {
        "n": n,
        "k": k,
        "p0": f"{p0.numerator}/{p0.denominator}",
        "expected": float(n * p0),
        "p_value": float(tail),
        "p_value_exact": f"{tail.numerator}/{tail.denominator}",
    }


def _counts(hours):
    c = [0] * 24
    for h in hours:
        c[h] += 1
    return c


def _int_stats(ca, n, ct, m):
    """Integer forms: S = 2 n m TVD and D = n m (share_a - share_b) in TARGET, for counts ca of a."""
    s = sum(abs(m * ca[h] - n * (ct[h] - ca[h])) for h in range(24))
    ka = sum(ca[h] for h in TARGET)
    kt = sum(ct[h] for h in TARGET)
    return s, m * ka - n * (kt - ka)


def tvd(a, b):
    """Total variation distance between the empirical step-hour distributions of a and b."""
    n, m = len(a), len(b)
    s, _ = _int_stats(_counts(a), n, _counts(a + b), m)
    return s / (2 * n * m)


def permutation_test(a, b, b_perms=PERMS, seed=SEED):
    """Label-permutation test of a vs b on TVD (quoted) and the TARGET share difference (secondary).

    One random.Random(seed) shuffles the pooled hours b_perms times; the first len(a) are relabeled a.
    p = (1 + count of permuted statistics >= observed) / (1 + b_perms). Integer statistics, so ties
    compare exactly.
    """
    n, m = len(a), len(b)
    pool = list(a) + list(b)
    ct = _counts(pool)
    s_obs, d_obs = _int_stats(_counts(a), n, ct, m)
    rng = random.Random(seed)
    ge_s = ge_d = 0
    for _ in range(b_perms):
        rng.shuffle(pool)
        s, d = _int_stats(_counts(pool[:n]), n, ct, m)
        ge_s += s >= s_obs
        ge_d += d >= d_obs

    def result(ge):
        p = (1 + ge) / (1 + b_perms)
        return {"n_ge": ge, "p_value": p, "mc_se": math.sqrt(p * (1 - p) / b_perms)}

    return {
        "seed": seed,
        "b_perms": b_perms,
        "n_a": n,
        "n_b": m,
        "statistic": "TVD = 1/2 sum_h |f_a(h) - f_b(h)|; secondary: share in HB 17 or 18, a minus b",
        "observed": {"tvd": s_obs / (2 * n * m), "share_17_18_diff": d_obs / (n * m)},
        "tvd": result(ge_s),
        "share_17_18_diff": result(ge_d),
    }


def days_from_rows(rows, first, last):
    """({date: 24 prices} in [first, last], [{day, prices}] skipped). Never fills a short day."""
    by_day = {dt.date.fromisoformat(r["operating_day_mt"]): r["lmp_usd_mwh"] for r in rows}
    days, skipped = {}, []
    d = first
    while d <= last:
        p = by_day.get(d)
        n = 0 if p is None else sum(1 for x in p if isinstance(x, (int, float)))
        if p is not None and len(p) == 24 and n == 24:
            days[d] = [float(x) for x in p]
        else:
            skipped.append({"day": d.isoformat(), "prices": n})
        d += dt.timedelta(days=1)
    return days, skipped


def per_day_steps(days):
    out = {}
    for d in sorted(days):
        h, s = xc.step_hour(days[d])
        out[d.isoformat()] = {"hb": h, "step": round(s, 5)}
    return out


def window_hours(per_day, first, last):
    return [v["hb"] for k, v in sorted(per_day.items()) if first <= dt.date.fromisoformat(k) <= last]


def window_steps(per_day, first, last):
    return [v["step"] for k, v in sorted(per_day.items()) if first <= dt.date.fromisoformat(k) <= last]


def month_lines(per_day):
    months = {}
    for k in sorted(per_day):
        months.setdefault(k[:7], []).append((k, per_day[k]))
    out = {}
    for mo, rows in months.items():
        c = _counts([v["hb"] for _, v in rows])
        top = max(c)
        out[mo] = {
            "days": len(rows),
            "modal_hb": [h for h in range(24) if c[h] == top],
            "count_at_mode": top,
            "median_step": round(statistics.median(v["step"] for _, v in rows), 5),
            "first_day": rows[0][0],
            "last_day": rows[-1][0],
        }
    return out


def hb_label(h):
    return f"HB {12 if h % 12 == 0 else h % 12}{'am' if h < 12 else 'pm'}"


# ------------------------------------------------------------------ checks against pins


def reproduction(per_day, chart, numbers):
    oh, jh = window_hours(per_day, *OCT), window_hours(per_day, *JUL)
    os_, js = window_steps(per_day, *OCT), window_steps(per_day, *JUL)
    oc, jc = _counts(oh), _counts(jh)
    o_med, j_med = statistics.median(os_), statistics.median(js)
    nums = {r["key"]: r["value"] for r in numbers}
    rows = {
        "oct_step_hour_days": {
            "pinned": {
                "n": PINNED["oct_n"],
                "k": PINNED["oct_k"],
                "hb17": PINNED["oct_hb17"],
                "hb18": PINNED["oct_hb18"],
            },
            "science": {"n": len(oh), "k": oc[17] + oc[18], "hb17": oc[17], "hb18": oc[18]},
            "tolerance": "counts exact",
        },
        "oct_step_hour_days_numbers_json": {
            "pinned": {"n": nums.get("oct_step_hour_days_total"), "k": nums.get("oct_step_hour_days_at_5_or_6")},
            "science": {"n": len(oh), "k": oc[17] + oc[18]},
            "tolerance": "exact",
        },
        "oct_step_median_usd": {
            "pinned": {"facts": PINNED["oct_median"], "numbers_json": nums.get("oct_step_median_usd")},
            "science": round(o_med, 5),
            "tolerance": "rounds equal at 1 dp to FACTS; within 0.00001 of numbers.json",
        },
        "jul_step_hour_spread": {
            "pinned": {"n": PINNED["jul_n"], "k_13_20": PINNED["jul_13_20"], "median": PINNED["jul_median"]},
            "science": {"n": len(jh), "k_13_20": sum(jc[13:21]), "median": round(j_med, 5)},
            "tolerance": "counts exact; median rounds equal at 1 dp",
        },
        "hist_vs_raw_oasis_counts": {
            "pinned": {"october": chart["october"]["counts_by_hb"], "july": chart["july"]["counts_by_hb"]},
            "science": {"october": oc, "july": jc},
            "tolerance": "equal at every hour",
        },
    }
    ok = {
        "oct_step_hour_days": rows["oct_step_hour_days"]["pinned"] == rows["oct_step_hour_days"]["science"],
        "oct_step_hour_days_numbers_json": (
            rows["oct_step_hour_days_numbers_json"]["pinned"] == rows["oct_step_hour_days_numbers_json"]["science"]
        ),
        "oct_step_median_usd": (
            xc.rounds_equal(o_med, PINNED["oct_median"], 1)
            and nums.get("oct_step_median_usd") is not None
            and abs(o_med - nums["oct_step_median_usd"]) <= 1e-5
        ),
        "jul_step_hour_spread": (
            len(jh) == PINNED["jul_n"]
            and sum(jc[13:21]) == PINNED["jul_13_20"]
            and xc.rounds_equal(j_med, PINNED["jul_median"], 1)
        ),
        "hist_vs_raw_oasis_counts": oc == chart["october"]["counts_by_hb"] and jc == chart["july"]["counts_by_hb"],
    }
    for k in rows:
        rows[k]["status"] = "match" if ok[k] else "mismatch"
    return rows


# ------------------------------------------------------------------ report


def _p(x):
    """p-values: 3 significant digits, plain decimals down to 0.000001, scientific below that."""
    if x >= 1e-3:
        return f"{x:.3g}"
    return f"{x:.6f}".rstrip("0") if x >= 1e-6 else f"{x:.2e}"


def quote(perm):
    """One sentence for the proof drawer, from the October vs July (Jul 1 to 30) permutation test."""
    t = perm["tvd"]
    if t["n_ge"] == 0:
        how = (
            f"none of {perm['b_perms']:,} random relabelings of the days as October or July gave step-hour "
            f"distributions as far apart as the real ones (permutation p about {_p(t['p_value'])}, the "
            "smallest this test can report)"
        )
    else:
        how = (
            f"{t['n_ge']:,} of {perm['b_perms']:,} random relabelings of the days as October or July gave "
            f"step-hour distributions as far apart as the real ones (permutation p {_p(t['p_value'])})"
        )
    return (
        f"The hour of the day's largest price step differs between July and October 2026: {how}. "
        f"Source: {HIST} (REAL PACE day-ahead prices); DERIVED by {SCRIPT}, seed {perm['seed']}."
    )


def results_md(out):
    h = f"`{HIST}`"
    i = {r["path"]: r["sha256"][:12] for r in out["inputs"]}
    w = out["window"]
    rep = out["reproduction"]
    lines = [
        f"Run: `python -I {SCRIPT}`, seed {out['seed']}, {out['b_perms']:,} permutations. Input {h} "
        f"(REAL, sha256 {i[HIST]}...); every value below is DERIVED from it unless a row names another file.",
        "",
        f"Days: {w['days']} of {w['calendar_days']} in {w['first']} to {w['last']} ({h}). Skipped and listed, "
        "never filled: "
        + "; ".join(
            f"{s['day']} ({s['prices']} prices in the file; `{META}` lists {s['meta_hours_present']} hours present)"
            for s in w["skipped"]
        )
        + ".",
        "",
        "### Reproduction",
        "",
        "| Check | Pinned | Science, from " + h + " | Tolerance | Status |",
        "|---|---|---|---|---|",
    ]
    r = rep["oct_step_hour_days"]
    lines.append(
        f"| oct_step_hour_days (FACTS) | {r['pinned']['k']} of {r['pinned']['n']}; HB 5pm "
        f"{r['pinned']['hb17']}, HB 6pm {r['pinned']['hb18']} | {r['science']['k']} of {r['science']['n']}; "
        f"HB 5pm {r['science']['hb17']}, HB 6pm {r['science']['hb18']} | {r['tolerance']} | {r['status']} |"
    )
    r = rep["oct_step_hour_days_numbers_json"]
    lines.append(
        f"| oct_step_hour_days_at_5_or_6, _total (`{NUMBERS}`) | {r['pinned']['k']} of {r['pinned']['n']} "
        f"| {r['science']['k']} of {r['science']['n']} | {r['tolerance']} | {r['status']} |"
    )
    r = rep["oct_step_median_usd"]
    lines.append(
        f"| oct_step_median_usd (FACTS; `{NUMBERS}`) | ${r['pinned']['facts']}; "
        f"{r['pinned']['numbers_json']:.5f} | {r['science']:.5f} | {r['tolerance']} | {r['status']} |"
    )
    r = rep["jul_step_hour_spread"]
    lines.append(
        f"| jul_step_hour_spread (FACTS), Jul 1 to 30 | {r['pinned']['k_13_20']} of {r['pinned']['n']} in "
        f"HB 1pm to 8pm; median ${r['pinned']['median']} | {r['science']['k_13_20']} of {r['science']['n']}; "
        f"median {r['science']['median']:.5f} | {r['tolerance']} | {r['status']} |"
    )
    r = rep["hist_vs_raw_oasis_counts"]
    lines.append(
        f"| step hours by hour vs raw OASIS (`{CHART}`) | October and July counts by hour | "
        f"{'equal' if r['status'] == 'match' else 'differ'} at every hour | {r['tolerance']} | {r['status']} |"
    )
    lines += [
        "",
        "### Test 1: exact binomial, landing in HB 5pm or HB 6pm, null p0 = 2/23",
        "",
        "| Window | Days n | Days in HB 5pm or 6pm, k | Expected under H0 | One-sided p, P(X >= k) |",
        "|---|---|---|---|---|",
    ]
    for key, name in (("october", "Oct 1 to 27"), ("july", "Jul 1 to 30"), ("july_1_31", "Jul 1 to 31 (sensitivity)")):
        b = out["binomial"][key]
        lines.append(f"| {name} | {b['n']} | {b['k']} | {b['expected']:.2f} | {_p(b['p_value'])} |")
    lines += [
        "",
        f"Source: {h}. Exact rational tail; the exact fractions are in `{OUT_JSON}`.",
        "",
        "### Test 2: permutation test, October vs July step-hour distributions (the one to quote)",
        "",
        "| Comparison | Observed TVD | Permutations with TVD >= observed | p | Monte Carlo s.e. | "
        "Secondary: share in HB 5pm or 6pm, Oct minus Jul (p) |",
        "|---|---|---|---|---|---|",
    ]
    for key, name in (
        ("october_vs_july", "Oct 1 to 27 vs Jul 1 to 30"),
        ("october_vs_july_1_31", "Oct 1 to 27 vs Jul 1 to 31 (sensitivity)"),
    ):
        t = out["permutation"][key]
        lines.append(
            f"| {name} | {t['observed']['tvd']:.4f} | {t['tvd']['n_ge']:,} of {t['b_perms']:,} | "
            f"{_p(t['tvd']['p_value'])} | {_p(t['tvd']['mc_se'])} | "
            f"{t['observed']['share_17_18_diff']:.4f} ({_p(t['share_17_18_diff']['p_value'])}) |"
        )
    t = out["permutation"]["october_vs_july"]
    floor = 1 / (1 + t["b_perms"])
    lines += ["", f"Source: {h}; seed {t['seed']}, one `random.Random` instance per comparison."]
    if t["tvd"]["n_ge"] == 0:
        lines.append(
            f"No permutation reached the observed TVD, so p is the add-one floor 1 / ({t['b_perms']:,} + 1), "
            f"about {_p(floor)}, the smallest p this many permutations can report. With none in "
            f"{t['b_perms']:,}, a 95% upper bound on the true p is about 3 / {t['b_perms']:,} = "
            f"{_p(3 / t['b_perms'])} (the rule of three)."
        )
    lines += ["", "Quote (Jul 1 to 30 comparison): " + out["quote"]]
    lines += [
        "",
        "### Monthly lines",
        "",
        "| Month | Days | Modal step hour | Days at the mode | Median step, $/MWh |",
        "|---|---|---|---|---|",
    ]
    for mo, v in out["months"].items():
        span = f"{v['first_day'][5:]} to {v['last_day'][5:]}"
        lines.append(
            f"| {mo} ({span}) | {v['days']} | {', '.join(hb_label(x) for x in v['modal_hb'])} | "
            f"{v['count_at_mode']} | {v['median_step']:.2f} |"
        )
    lines += ["", f"Source: {h}; per-day step hours and amounts are in `{OUT_JSON}`."]
    return "\n".join(lines) + "\n"


def run(a):
    hist_p, meta_p, chart_p, num_p = (
        ROOT / p if not pathlib.Path(p).is_absolute() else pathlib.Path(p) for p in (a.hist, a.meta, a.chart, a.numbers)
    )
    rows = xc._load_json(hist_p)
    meta = xc._load_json(meta_p)
    days, skipped = days_from_rows(rows, *WINDOW)
    meta_missing = {m["day"]: m for m in meta.get("missing_days", [])}
    for s in skipped:
        m = meta_missing.get(s["day"], {})
        s["meta_hours_present"] = m.get("hours_present")
        s["meta_reason"] = m.get("reason")
    per_day = per_day_steps(days)
    oh, jh, j31 = (window_hours(per_day, *w) for w in (OCT, JUL, JUL31))
    out = {
        "schema": SCHEMA,
        "script": SCRIPT,
        "flag": FLAG,
        "class": "DERIVED",
        "definition": "step hour: largest p[h] - p[h-1], h = 1..23, Mountain day, ties to the earliest h",
        "inputs": common.input_record([hist_p, meta_p, chart_p, num_p]),
        "seed": a.seed,
        "b_perms": a.perms,
        "target_hb": list(TARGET),
        "window": {
            "first": WINDOW[0].isoformat(),
            "last": WINDOW[1].isoformat(),
            "calendar_days": (WINDOW[1] - WINDOW[0]).days + 1,
            "days": len(days),
            "skipped": skipped,
        },
        "windows": {
            "october": [d.isoformat() for d in OCT],
            "july": [d.isoformat() for d in JUL],
            "july_1_31": [d.isoformat() for d in JUL31],
        },
        "per_day": per_day,
        "reproduction": reproduction(per_day, xc._load_json(chart_p), xc._load_json(num_p)),
        "binomial": {
            "october": binomial_test(oh, TARGET),
            "july": binomial_test(jh, TARGET),
            "july_1_31": binomial_test(j31, TARGET),
        },
        "permutation": {
            "october_vs_july": permutation_test(oh, jh, a.perms, a.seed),
            "october_vs_july_1_31": permutation_test(oh, j31, a.perms, a.seed),
        },
        "months": month_lines(per_day),
    }
    out["quote"] = quote(out["permutation"]["october_vs_july"])
    return out


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--hist", default=HIST)
    ap.add_argument("--meta", default=META)
    ap.add_argument("--chart", default=CHART)
    ap.add_argument("--numbers", default=NUMBERS)
    ap.add_argument("--seed", type=int, default=SEED)
    ap.add_argument("--perms", type=int, default=PERMS)
    ap.add_argument("--out", default=str(ROOT / OUT_JSON))
    ap.add_argument("--md", default=str(ROOT / OUT_MD))
    ap.add_argument("--no-md", action="store_true", help="write the JSON only")
    a = ap.parse_args(argv)
    out = run(a)
    common.write_json(a.out, out)
    if not a.no_md:
        common.write_results(a.md, results_md(out))
    rep = out["reproduction"]
    print("reproduction:", {k: v["status"] for k, v in rep.items()})
    print("binomial p:", {k: _p(v["p_value"]) for k, v in out["binomial"].items()})
    print("permutation TVD p:", {k: _p(v["tvd"]["p_value"]) for k, v in out["permutation"].items()})
    return out


if __name__ == "__main__":
    main()
