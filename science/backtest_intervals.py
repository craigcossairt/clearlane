"""Intervals on the backtest headline numbers (issue #111, flag off_backtest_intervals).

Run from the repo root:  python -I science/backtest_intervals.py
Writes science/backtest_intervals.json and the results block in science/backtest-intervals.md.
Method and tolerances: science/backtest-intervals.md, written before computing. Values are value to
RMP's system at day-ahead prices, $/MW-day; nothing is annualized.
"""

import argparse
import datetime as dt
import math
import pathlib
import random
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from science import common  # noqa: E402
from science import crosscheck as xc  # noqa: E402

SCHEMA = "clearlane.science.backtest_intervals/v1"
SCRIPT = "science/backtest_intervals.py"
FLAG = "off_backtest_intervals"
DAYS = "public/derived/backtest_days.json"
BACKTEST = "public/derived/backtest.json"
OUT_JSON = "science/backtest_intervals.json"
OUT_MD = "science/backtest-intervals.md"

POLICIES = ("fixed_overnight", "price_only", "clearlane")
SEED = 111
SEED_CHECK = 112
RESAMPLES = 10_000
BLOCK = 7
LEVEL = 0.90
METHODS = {"moving_block": BLOCK, "stationary": BLOCK, "iid": 1}


# ------------------------------------------------------------------ pure functions


def series_from_rows(rows):
    """Complete days in date order with one value per policy, plus what was left out."""
    by_day = {}
    for r in rows:
        by_day.setdefault(r["operating_day_mt"], {})[r["policy"]] = r
    complete = [d for d in sorted(by_day) if all(p in by_day[d] for p in POLICIES)]
    incomplete = [d for d in sorted(by_day) if d not in complete]
    gaps = [
        [a, b]
        for a, b in zip(complete, complete[1:])
        if (dt.date.fromisoformat(b) - dt.date.fromisoformat(a)).days != 1
    ]
    values = {p: [float(by_day[d][p]["usd_per_mw_day"]) for d in complete] for p in POLICIES}
    flags = []
    for i, d in enumerate(complete):
        for p in POLICIES:
            row = by_day[d][p]
            if "beats_fixed_overnight" in row and row["beats_fixed_overnight"] != (
                values[p][i] > values["fixed_overnight"][i]
            ):
                flags.append({"day": d, "policy": p})
    return {
        "days": complete,
        "values": values,
        "incomplete_days": incomplete,
        "gaps": gaps,
        "flag_disagreements": flags,
    }


def moving_block_indexes(n, block, rng):
    """ceil(n / block) uniform starts over the n - block + 1 runs (no wrap), joined and cut to n."""
    out = []
    for _ in range(math.ceil(n / block)):
        s = rng.randrange(n - block + 1)
        out.extend(range(s, s + block))
    return out[:n]


def stationary_indexes(n, mean_block, rng):
    """Politis-Romano: a new uniform start with probability 1 / mean_block, else the next day (wrapping)."""
    p = 1.0 / mean_block
    out = [rng.randrange(n)]
    for _ in range(n - 1):
        out.append(rng.randrange(n) if rng.random() < p else (out[-1] + 1) % n)
    return out


def share_beating(values, fixed):
    """Percent of days with value strictly greater than fixed on the same day (ties do not beat)."""
    return 100.0 * sum(1 for v, f in zip(values, fixed) if v > f) / len(values)


def interval(stats, level=LEVEL):
    a = round((1 - level) / 2, 10)  # 0.05, not 0.04999...
    return [xc.pctl_linear(stats, a), xc.pctl_linear(stats, round(1 - a, 10))]


def point(series):
    v = series["values"]
    return {
        "p50": {p: xc.pctl_linear(v[p], 0.5) for p in POLICIES},
        "days_beating_fixed_overnight_pct": {p: share_beating(v[p], v["fixed_overnight"]) for p in POLICIES},
    }


def bootstrap(series, method, b=RESAMPLES, seed=SEED):
    """90% percentile intervals of P50 and the share beating fixed_overnight, by one resampling method."""
    v = series["values"]
    n = len(series["days"])
    draw = stationary_indexes if method == "stationary" else moving_block_indexes
    block = METHODS[method]
    rng = random.Random(seed)
    p50 = {p: [] for p in POLICIES}
    share = {p: [] for p in POLICIES}
    for _ in range(b):
        idx = draw(n, block, rng)
        fixed = [v["fixed_overnight"][i] for i in idx]
        for p in POLICIES:
            x = [v[p][i] for i in idx]
            p50[p].append(xc.pctl_linear(x, 0.5))
            share[p].append(share_beating(x, fixed))
    return {
        "method": method,
        "block_len": block,
        "resamples": b,
        "seed": seed,
        "level": LEVEL,
        "p50": {p: interval(p50[p]) for p in POLICIES},
        "days_beating_fixed_overnight_pct": {p: interval(share[p]) for p in POLICIES},
    }


def usd(x):
    return f"-${-x:,.2f}" if x < 0 else f"${x:,.2f}"


# ------------------------------------------------------------------ checks and report


def compare_point(pt, series, bt):
    pol = {p["policy"]: p for p in bt["policies"]}
    rows = {}
    for p in POLICIES:
        pin = pol[p]["usd_per_mw_day"]["p50"]
        sci = pt["p50"][p]
        rows[f"p50_{p}"] = {
            "pinned": pin,
            "science": sci,
            "abs_diff": abs(sci - pin),
            "tolerance": "$0.01; 2 dp",
            "status": "match" if abs(sci - pin) <= 0.01 and xc.rounds_equal(sci, pin, 2) else "mismatch",
        }
        pin = pol[p]["days_beating_fixed_overnight_pct"]
        sci = pt["days_beating_fixed_overnight_pct"][p]
        rows[f"beating_{p}"] = {
            "pinned": pin,
            "science": sci,
            "abs_diff": abs(sci - pin),
            "tolerance": "0.01 percentage point",
            "status": "match" if abs(sci - pin) <= 0.01 else "mismatch",
        }
    w = bt["window"]
    days = series["days"]
    ok = (
        len(days) == w["days"]
        and not series["gaps"]
        and not series["incomplete_days"]
        and days[-1] == w["end_mt"]
        and all(m not in days for m in w["missing_days"])
    )
    rows["day_set"] = {
        "pinned": {"days": w["days"], "missing_days": w["missing_days"], "end_mt": w["end_mt"]},
        "science": {
            "days": len(days),
            "first": days[0],
            "last": days[-1],
            "gaps": series["gaps"],
            "incomplete_days": series["incomplete_days"],
        },
        "tolerance": "exact",
        "status": "match" if ok else "mismatch",
    }
    rows["beats_flags"] = {
        "pinned": "strict greater than on the row values",
        "science": {"disagreements": series["flag_disagreements"]},
        "tolerance": "none disagree",
        "status": "match" if not series["flag_disagreements"] else "mismatch",
    }
    return rows


def seed_stability(series, main_runs, b):
    out = {}
    for m in ("moving_block", "stationary"):
        other = bootstrap(series, m, b, SEED_CHECK)
        out[m] = {
            "seed": SEED_CHECK,
            "max_endpoint_change_usd": max(
                abs(x - y) for p in POLICIES for x, y in zip(main_runs[m]["p50"][p], other["p50"][p])
            ),
            "max_endpoint_change_pct_points": max(
                abs(x - y)
                for p in POLICIES
                for x, y in zip(
                    main_runs[m]["days_beating_fixed_overnight_pct"][p], other["days_beating_fixed_overnight_pct"][p]
                )
            ),
        }
    return out


def quote(out):
    c = out["point"]["p50"]["clearlane"]
    lo, hi = out["bootstrap"]["moving_block"]["p50"]["clearlane"]
    s = out["point"]["days_beating_fixed_overnight_pct"]["clearlane"]
    slo, shi = out["bootstrap"]["moving_block"]["days_beating_fixed_overnight_pct"]["clearlane"]
    return (
        f"Clearlane's median daily value: {usd(c)} per MW-day of value to RMP's system at day-ahead prices, 90% "
        f"interval {usd(lo)} to {usd(hi)}; it beat a battery on a fixed off-peak rule on {s:.0f}% of days (90% "
        f"interval {slo:.1f}% to {shi:.1f}%). 7-day moving-block bootstrap of {DAYS}, seed {out['seed']}; DERIVED "
        f"by {SCRIPT}."
    )


def results_md(out):
    f = f"`{DAYS}`"
    sha = {r["path"]: r["sha256"][:12] for r in out["inputs"]}
    bs = out["bootstrap"]
    s = out["series"]
    pc = out["point_vs_backtest_json"]
    lines = [
        f"Run: `python -I {SCRIPT}`, seed {out['seed']}, {out['resamples']:,} resamples per method. Input {f} "
        f"(sha256 {sha[DAYS]}...); point checks against `{BACKTEST}` (sha256 {sha[BACKTEST]}...). Every value "
        "below is DERIVED from these files; dollars are $/MW-day of value to RMP's system at day-ahead prices.",
        "",
        f"Days: {len(s['days'])} consecutive days, {s['days'][0]} to {s['days'][-1]} ({f}); gaps: "
        f"{len(s['gaps'])}; days missing a policy: {len(s['incomplete_days'])}.",
        "",
        "### Point values vs the summary",
        "",
        f"| Check | From {f} | `{BACKTEST}` | Abs diff | Tolerance | Status |",
        "|---|---|---|---|---|---|",
    ]
    for p in POLICIES:
        r = pc[f"p50_{p}"]
        lines.append(
            f"| P50 {p} | {r['science']:.6f} | {r['pinned']:.6f} | {r['abs_diff']:.2g} | {r['tolerance']} | "
            f"{r['status']} |"
        )
    for p in POLICIES:
        r = pc[f"beating_{p}"]
        lines.append(
            f"| days beating fixed overnight, {p} (%) | {r['science']:.6f} | {r['pinned']:.6f} | "
            f"{r['abs_diff']:.2g} | {r['tolerance']} | {r['status']} |"
        )
    r = pc["day_set"]
    lines.append(
        f"| day set | {r['science']['days']} days to {r['science']['last']} | {r['pinned']['days']} days, "
        f"missing {', '.join(r['pinned']['missing_days'])} | | {r['tolerance']} | {r['status']} |"
    )
    r = pc["beats_flags"]
    lines.append(
        f"| `beats_fixed_overnight` flags vs strict greater than | {len(r['science']['disagreements'])} "
        f"disagree | | | {r['tolerance']} | {r['status']} |"
    )
    lines += [
        "",
        f"### 90% intervals on P50, $/MW-day (source {f})",
        "",
        "| Policy | Point P50 | 7-day moving block | Stationary, mean block 7 | Reference: independent days "
        "| Point inside both block intervals |",
        "|---|---|---|---|---|---|",
    ]
    for p in POLICIES:
        pt = out["point"]["p50"][p]
        mb, st, iid = (bs[m]["p50"][p] for m in ("moving_block", "stationary", "iid"))
        inside = mb[0] <= pt <= mb[1] and st[0] <= pt <= st[1]
        lines.append(
            f"| {p} | {usd(pt)} | {usd(mb[0])} to {usd(mb[1])} | {usd(st[0])} to {usd(st[1])} | "
            f"{usd(iid[0])} to {usd(iid[1])} | {'yes' if inside else 'no'} |"
        )
    ratios = [
        (bs["moving_block"]["p50"][p][1] - bs["moving_block"]["p50"][p][0])
        / (bs["iid"]["p50"][p][1] - bs["iid"]["p50"][p][0])
        for p in POLICIES
    ]
    lines += [
        "",
        f"The 7-day moving-block intervals on P50 are {min(ratios):.1f} to {max(ratios):.1f} times as wide as the "
        "independent-days reference, so the day-to-day correlation matters.",
        "",
        f"### 90% intervals on days beating the fixed overnight rule, % of days (source {f})",
        "",
        "| Policy | Point | 7-day moving block | Stationary, mean block 7 | Reference: independent days |",
        "|---|---|---|---|---|",
    ]
    for p in POLICIES:
        pt = out["point"]["days_beating_fixed_overnight_pct"][p]
        mb, st, iid = (bs[m]["days_beating_fixed_overnight_pct"][p] for m in ("moving_block", "stationary", "iid"))
        lines.append(
            f"| {p} | {pt:.1f} | {mb[0]:.1f} to {mb[1]:.1f} | {st[0]:.1f} to {st[1]:.1f} | "
            f"{iid[0]:.1f} to {iid[1]:.1f} |"
        )
    st = out["seed_stability"]
    lines += [
        "",
        "Ties do not beat, so fixed_overnight is 0 on every resample.",
        "",
        f"Seed check (seed {st['moving_block']['seed']}, not a result): the largest endpoint change is "
        f"{usd(st['moving_block']['max_endpoint_change_usd'])} and "
        f"{st['moving_block']['max_endpoint_change_pct_points']:.2f} percentage points for the moving block, "
        f"{usd(st['stationary']['max_endpoint_change_usd'])} and "
        f"{st['stationary']['max_endpoint_change_pct_points']:.2f} for the stationary bootstrap.",
        "",
        "Quote: " + out["quote"],
    ]
    return "\n".join(lines) + "\n"


def run(a):
    days_p, bt_p = (ROOT / p if not pathlib.Path(p).is_absolute() else pathlib.Path(p) for p in (a.days, a.backtest))
    series = series_from_rows(xc._load_json(days_p))
    bt = xc._load_json(bt_p)
    pt = point(series)
    runs = {m: bootstrap(series, m, a.resamples, a.seed) for m in METHODS}
    out = {
        "schema": SCHEMA,
        "script": SCRIPT,
        "flag": FLAG,
        "class": "DERIVED",
        "unit": "usd_per_mw_day, value to RMP's system at day-ahead prices; share in % of days",
        "inputs": common.input_record([days_p, bt_p]),
        "seed": a.seed,
        "resamples": a.resamples,
        "block_len": BLOCK,
        "level": LEVEL,
        "interval_method": "percentile, linear interpolation (Hyndman-Fan type 7) of the resampled statistics",
        "percentile_method": "linear (Hyndman-Fan type 7)",
        "series": {"days": series["days"], "gaps": series["gaps"], "incomplete_days": series["incomplete_days"]},
        "point": pt,
        "point_vs_backtest_json": compare_point(pt, series, bt),
        "bootstrap": runs,
        "seed_stability": seed_stability(series, runs, a.resamples),
    }
    out["quote"] = quote(out)
    return out


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--days", default=DAYS)
    ap.add_argument("--backtest", default=BACKTEST)
    ap.add_argument("--seed", type=int, default=SEED)
    ap.add_argument("--resamples", type=int, default=RESAMPLES)
    ap.add_argument("--out", default=str(ROOT / OUT_JSON))
    ap.add_argument("--md", default=str(ROOT / OUT_MD))
    ap.add_argument("--no-md", action="store_true", help="write the JSON only")
    a = ap.parse_args(argv)
    out = run(a)
    common.write_json(a.out, out)
    if not a.no_md:
        common.write_results(a.md, results_md(out))
    print("point checks:", {k: v["status"] for k, v in out["point_vs_backtest_json"].items()})
    for m in ("moving_block", "stationary"):
        print(m, "p50:", {p: [round(x, 2) for x in v] for p, v in out["bootstrap"][m]["p50"].items()})
    print(out["quote"])
    return out


if __name__ == "__main__":
    main()
