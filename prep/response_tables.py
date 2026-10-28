"""Marginal CO2, forecast-residual and price-response tables for PACE (stretch `response-tables`).

Writes public/data/response_tables.json (prov DERIVED) with three tables:
  (a) marginal_co2: OLS slope of the hourly change in EIA CO2 on the hourly change in net generation
      (generation basis) and in demand (consumed basis), per Mountain hour of day x meteorological season.
  (b) forecast_residuals: whole-day vectors of PACE demand forecast minus demand, May to Oct 2026.
  (c) price_response: slope of the DA LMP on net load per Mountain hour of day.
Each bin carries n, R2 and a seeded 90% bootstrap interval; a bin whose interval spans zero is flagged
inconclusive, never dropped.

Usage:
    python -I prep/response_tables.py fetch   # paced OASIS SLD_FCST and EDAM wind/solar for May to Oct 2026
    python -I prep/response_tables.py build   # writes public/data/response_tables.json
"""

import argparse
import csv
import json
import random
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from prep import oasis  # noqa: E402
from prep._paths import PUBLIC_DATA  # noqa: E402
from prep.jsonio import write_json  # noqa: E402

UTC = timezone.utc
SCHEMA = "clearlane.response_tables/v1"
SEED = 20261027
RESAMPLES = 1000
LO_PCT, HI_PCT = 0.05, 0.95
LB_PER_T = 2204.62262
EIA_CSV = ROOT / "prep" / "data" / "eia_pace_hourly.csv"
EIA_META = ROOT / "prep" / "data" / "eia_pace_hourly.meta.json"
HIST = ROOT / "public" / "data" / "hist_2026-05-01_2026-10-27.json"
EIA930_FILES = ("PACE_EIA930_BALANCE_2026_Jan_Jun.csv", "PACE_EIA930_BALANCE_2026_Jul_Dec.csv")
EIA930_URL = "https://www.eia.gov/electricity/gridmonitor/"
OASIS_LICENSE = (
    "CAISO Terms of Use (https://www.caiso.com/privacy-terms-of-use): limited license, credit California ISO"
)
EIA_LICENSE = "Public domain; credit the U.S. Energy Information Administration."
RESIDUAL_WINDOW = ("2026-05-01", "2026-10-31")
NET_LOAD_WINDOWS = (
    ("2026-05-01", "2026-05-31"),
    ("2026-05-31", "2026-06-30"),
    ("2026-06-30", "2026-07-30"),
    ("2026-07-30", "2026-08-29"),
    ("2026-08-29", "2026-09-28"),
    ("2026-09-28", "2026-10-28"),
)
SEASONS = {
    12: "DJF",
    1: "DJF",
    2: "DJF",
    3: "MAM",
    4: "MAM",
    5: "MAM",
    6: "JJA",
    7: "JJA",
    8: "JJA",
    9: "SON",
    10: "SON",
    11: "SON",
}
BAD_RULES = (
    "demand missing or at most 0",
    "forecast missing or at most 0",
    "demand outside 0.5x to 1.5x the forecast",
)
CAVEATS = {
    "marginal_co2": [
        "EIA's hourly CO2 is fuel-type generation times EIA emission factors, so the slope measures fuel-mix "
        "response, not plant heat rates.",
        "PACE exports in most hours, and midday curtailment is invisible in net generation, which can bias midday factors.",
        "Method after Siler-Evans, Azevedo and Morgan 2012 (citation UNVERIFIED, not opened).",
    ],
    "forecast_residuals": [
        "Residual = EIA-930 day-ahead demand forecast minus reported demand; positive means over-forecast."
    ],
    "price_response": [
        "A slope of the PACE day-ahead price on PACE net load is confounded by gas prices, imports and the wider "
        "EDAM footprint that sets the price. It is a DERIVED association, not a causal price impact.",
    ],
}
ASSUMPTIONS = [
    f"Bootstrap: seed {SEED}, {RESAMPLES} resamples of (x, y) pairs with replacement; the interval is the 5th and "
    "95th percentile by nearest rank on the sorted slopes (index floor(p x (resamples - 1))). ASSUMPTION.",
    "Seasons are meteorological: DJF, MAM, JJA, SON. ASSUMPTION.",
    "Hours are Mountain prevailing clock time of the hour start, from the UTC start with written-out DST dates; "
    "the repeated 1am on Nov 2 2025 joins hour 1. ASSUMPTION.",
    "Bad-hour rules (ASSUMPTION): " + "; ".join(BAD_RULES) + ".",
]


# ---------- statistics ----------


def ols(xs: list[float], ys: list[float]) -> tuple[float, float, float]:
    """Slope, intercept and R2 of y on x with an intercept."""
    n = len(xs)
    if n < 3:
        raise ValueError("need at least 3 points")
    mx, my = sum(xs) / n, sum(ys) / n
    sxx = sum((x - mx) ** 2 for x in xs)
    if sxx == 0:
        raise ValueError("x has no variance")
    sxy = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
    syy = sum((y - my) ** 2 for y in ys)
    slope = sxy / sxx
    r2 = (sxy * sxy) / (sxx * syy) if syy else 1.0
    return slope, my - slope * mx, r2


def bootstrap(xs: list[float], ys: list[float], rng: random.Random) -> tuple[float, float]:
    n = len(xs)
    slopes = []
    for _ in range(RESAMPLES):
        idx = [rng.randrange(n) for _ in range(n)]
        bx = [xs[i] for i in idx]
        if max(bx) == min(bx):
            continue
        slopes.append(ols(bx, [ys[i] for i in idx])[0])
    slopes.sort()
    k = len(slopes) - 1
    return slopes[int(LO_PCT * k)], slopes[int(HI_PCT * k)]


def fit(xs: list[float], ys: list[float], rng: random.Random, scale: float = 1.0, digits: int = 4) -> dict:
    if len(xs) < 3 or max(xs) == min(xs):
        return {"n": len(xs), "slope": None, "lo": None, "hi": None, "r2": None, "inconclusive": True}
    slope, _, r2 = ols(xs, ys)
    lo, hi = bootstrap(xs, ys, rng)
    return {
        "n": len(xs),
        "slope": round(slope * scale, digits),
        "lo": round(lo * scale, digits),
        "hi": round(hi * scale, digits),
        "r2": round(r2, 4),
        "inconclusive": lo <= 0 <= hi,
    }


# ---------- inputs ----------


def _num(value: str) -> float | None:
    return float(value) if value not in ("", None) else None


# US Mountain DST in UTC, written out (no zoneinfo): MDT (UTC-6) inside these spans, MST (UTC-7) outside.
MDT_SPANS = (
    (datetime(2025, 3, 9, 9, tzinfo=UTC), datetime(2025, 11, 2, 8, tzinfo=UTC)),
    (datetime(2026, 3, 8, 9, tzinfo=UTC), datetime(2026, 11, 1, 8, tzinfo=UTC)),
)


def mountain(utc_start: str) -> datetime:
    """Mountain prevailing clock time of a UTC hour start (naive)."""
    instant = datetime.fromisoformat(utc_start.replace("Z", "+00:00"))
    mdt = any(lo <= instant < hi for lo, hi in MDT_SPANS)
    return (instant - timedelta(hours=6 if mdt else 7)).replace(tzinfo=None)


def read_eia(path: Path = EIA_CSV) -> list[dict]:
    """EIA rows with the Mountain date and hour of day (hour beginning) derived from the UTC start, so the
    repeated hour on Nov 2 2025 (EIA hour ending 25) folds into hour 1."""
    with path.open(newline="", encoding="utf-8") as stream:
        rows = []
        for row in csv.DictReader(stream):
            local = mountain(row["utc_start"])
            rows.append(
                {
                    "utc": row["utc_start"],
                    "date": local.date().isoformat(),
                    "hour": local.hour,
                    "demand": _num(row["demand_mw"]),
                    "fcst": _num(row["demand_fcst_mw"]),
                    "net_gen": _num(row["net_gen_mw"]),
                    "co2_t": _num(row["co2_t"]),
                    "co2_cons_lb_kwh": _num(row["co2_cons_lb_kwh"]),
                }
            )
    return rows


def bad_reason(row: dict) -> str | None:
    demand, fcst = row["demand"], row["fcst"]
    if demand is None or demand <= 0:
        return BAD_RULES[0]
    if fcst is None or fcst <= 0:
        return BAD_RULES[1]
    if not 0.5 * fcst <= demand <= 1.5 * fcst:
        return BAD_RULES[2]
    return None


def _consecutive(a: dict, b: dict) -> bool:
    ta = datetime.fromisoformat(a["utc"].replace("Z", "+00:00"))
    tb = datetime.fromisoformat(b["utc"].replace("Z", "+00:00"))
    return tb - ta == timedelta(hours=1)


# ---------- tables ----------


def marginal_co2(rows: list[dict], rng: random.Random) -> dict:
    bins: dict[tuple[str, str, int], tuple[list[float], list[float]]] = {}
    skipped = 0
    for a, b in zip(rows, rows[1:]):
        if not _consecutive(a, b):
            skipped += 1
            continue
        key_season = SEASONS[int(b["date"][5:7])]
        if None not in (a["co2_t"], b["co2_t"], a["net_gen"], b["net_gen"]) and min(a["net_gen"], b["net_gen"]) > 0:
            xs, ys = bins.setdefault(("generated", key_season, b["hour"]), ([], []))
            xs.append(b["net_gen"] - a["net_gen"])
            ys.append(b["co2_t"] - a["co2_t"])
        else:
            skipped += 1
        if bad_reason(a) is None and bad_reason(b) is None and None not in (a["co2_cons_lb_kwh"], b["co2_cons_lb_kwh"]):
            cons_a = a["co2_cons_lb_kwh"] * a["demand"] * 1000 / LB_PER_T
            cons_b = b["co2_cons_lb_kwh"] * b["demand"] * 1000 / LB_PER_T
            xs, ys = bins.setdefault(("consumed", key_season, b["hour"]), ([], []))
            xs.append(b["demand"] - a["demand"])
            ys.append(cons_b - cons_a)
    out = []
    for basis, season, hour in sorted(
        bins, key=lambda k: (k[0] != "generated", "DJF MAM JJA SON".split().index(k[1]), k[2])
    ):
        xs, ys = bins[(basis, season, hour)]
        out.append({"basis": basis, "season": season, "hour_mt": hour, **fit(xs, ys, rng, scale=1000, digits=1)})
    return {
        "unit": "g CO2 per kWh (slope in t/MWh x 1,000)",
        "x": {"generated": "hourly change in EIA net generation, MW", "consumed": "hourly change in EIA demand, MW"},
        "y": {
            "generated": "hourly change in EIA CO2 emissions generated, t",
            "consumed": "hourly change in consumed CO2, t = co2_cons_lb_kwh x demand_mw x 1000 / 2204.62262",
        },
        "window": {"first_utc": rows[0]["utc"], "last_utc": rows[-1]["utc"]},
        "pairs_skipped": skipped,
        "bins": out,
    }


def forecast_residuals(rows: list[dict]) -> dict:
    first, last = RESIDUAL_WINDOW
    by_day: dict[str, list[float | None]] = {}
    bad = []
    for row in rows:
        reason = bad_reason(row)
        if reason:
            bad.append(
                {
                    "utc_start": row["utc"],
                    "local_date": row["date"],
                    "hour_mt": row["hour"],
                    "demand_mw": row["demand"],
                    "forecast_mw": row["fcst"],
                    "rule": reason,
                    "in_window": first <= row["date"] <= last,
                }
            )
        if not first <= row["date"] <= last:
            continue
        day = by_day.setdefault(row["date"], [None] * 24)
        if 0 <= row["hour"] < 24:
            day[row["hour"]] = None if reason else round(row["fcst"] - row["demand"], 1)
    days = [{"local_date": d, "residual_mw": v} for d, v in sorted(by_day.items())]
    complete = [d for d in days if None not in d["residual_mw"]]
    return {
        "unit": "MW, forecast minus demand",
        "window": {"start_mt": first, "end_mt": days[-1]["local_date"] if days else last},
        "days": days,
        "complete_days": len(complete),
        "bad_hours": bad,
        "bad_hour_rules": list(BAD_RULES),
    }


def price_response(prices: dict[str, float], net_load: dict[str, float], rng: random.Random, basis: str) -> dict:
    bins: dict[int, tuple[list[float], list[float]]] = {h: ([], []) for h in range(24)}
    for stamp, price in sorted(prices.items()):
        if stamp in net_load:
            hour = (datetime.fromisoformat(stamp.replace("Z", "+00:00")) - timedelta(hours=6)).hour
            bins[hour][0].append(net_load[stamp])
            bins[hour][1].append(price)
    out = [{"hour_mt": h, **fit(*bins[h], rng, digits=6)} for h in range(24)]
    for row in out:
        row["slope_usd_mwh_per_100mw"] = None if row["slope"] is None else round(row["slope"] * 100, 4)
    return {
        "unit": "$/MWh per MW of net load",
        "x": "net load, MW (" + basis + ")",
        "y": "PACE day-ahead LMP, $/MWh (public/data/hist_2026-05-01_2026-10-27.json)",
        "net_load_basis": basis,
        "bins": out,
    }


# ---------- net load ----------


def _utc(day: str) -> datetime:
    return datetime.fromisoformat(day).replace(tzinfo=UTC) + timedelta(hours=6)


NO_DATA_DAYS: list[str] = []


def _edam_days() -> list[str]:
    """Request start days for the EDAM wind/solar group. The GroupZip answers one CAISO trading day per call
    whatever the window (observed Oct 28 2026): a start of D 06:00Z returns trading day D-1 (07:00Z to 06:00Z)."""
    first = datetime.fromisoformat(NET_LOAD_WINDOWS[0][0])
    last = datetime.fromisoformat(NET_LOAD_WINDOWS[-1][1])
    return [(first + timedelta(days=i)).date().isoformat() for i in range((last - first).days + 1)]


def oasis_net_load(transport=None, clock=None, log=print) -> tuple[dict[str, float], list[dict]]:
    load: dict[str, float] = {}
    wind_solar: dict[str, dict] = {}
    sources = []
    calls = [("SLD_FCST", "sld_fcst", {"market_run_id": "DAM", "version": 1}, s, e) for s, e in NET_LOAD_WINDOWS]
    for day in _edam_days():
        end = (datetime.fromisoformat(day) + timedelta(days=1)).date().isoformat()
        calls.append((oasis.EDAM_GROUP, "edam_wind_solar", {"version": 1}, day, end))
    for query, report, params, start, end in calls:
        url = oasis.build_url(query, _utc(start), _utc(end), **params)
        path = oasis._cache_path(url, report)
        hit = path.is_file()
        try:
            raw = oasis.fetch(url, path, transport=transport, clock=clock)
        except oasis.OasisError as error:
            if report != "edam_wind_solar" or error.code != "1000":
                raise
            log(f"no data {report} {start}: {error}; those hours have no net load")
            NO_DATA_DAYS.append(start)
            continue
        meta = json.loads(path.with_suffix(path.suffix + ".meta.json").read_text(encoding="utf-8"))
        sources.append({"url": url, "license": OASIS_LICENSE, "retrieved_utc": meta["retrieved_utc"]})
        log(f"{'cache' if hit else 'fetched'} {report} {start}")
        if report == "sld_fcst":
            load.update({ts: row["load_fcst_mw"] for ts, row in oasis.parse_sld_fcst(raw).items()})
        else:
            wind_solar.update(oasis.parse_edam_wind_solar(raw)[0])
    net = {
        ts: round(load[ts] - wind_solar[ts]["solar_mw"] - wind_solar[ts]["wind_mw"], 3)
        for ts in load
        if ts in wind_solar
    }
    return net, sources


def eia_net_load() -> tuple[dict[str, float], list[dict]]:
    """Fallback: EIA-930 demand minus solar and wind generation (research/data/eia930)."""
    net = {}
    for name in EIA930_FILES:
        with (ROOT / "research" / "data" / "eia930" / name).open(newline="", encoding="utf-8-sig") as stream:
            for row in csv.DictReader(stream):
                end = datetime.strptime(row["UTC Time at End of Hour"], "%m/%d/%Y %I:%M:%S %p").replace(tzinfo=UTC)
                parts = [row.get("Demand (MW)")] + [
                    row.get(k)
                    for k in row
                    if k.startswith("Net Generation (MW) from") and ("Solar" in k or "Wind" in k) and "(" not in k[25:]
                ]
                if not parts[0]:
                    continue
                renew = sum(float(p) for p in parts[1:] if p)
                net[(end - timedelta(hours=1)).strftime("%Y-%m-%dT%H:%M:%SZ")] = float(parts[0]) - renew
    return net, [
        {"url": EIA930_URL, "license": EIA_LICENSE, "files": [f"research/data/eia930/{n}" for n in EIA930_FILES]}
    ]


def hist_prices(path: Path = HIST) -> dict[str, float]:
    out = {}
    for day in json.loads(path.read_text(encoding="utf-8")):
        start = _utc(day["operating_day_mt"])
        for h, price in enumerate(day["lmp_usd_mwh"]):
            out[(start + timedelta(hours=h)).strftime("%Y-%m-%dT%H:%M:%SZ")] = price
    return out


# ---------- build ----------


def build(out: Path | None = None, transport=None, clock=None, offline_net_load: bool = False) -> dict:
    rng = random.Random(SEED)
    rows = read_eia()
    eia_meta = json.loads(EIA_META.read_text(encoding="utf-8"))
    eia_source = {
        "url": eia_meta["source_url"],
        "license": EIA_LICENSE,
        "retrieved_utc": eia_meta["workbook_file_time_utc"],
        "file": "prep/data/eia_pace_hourly.csv",
    }
    try:
        if offline_net_load:
            raise oasis.OasisError("offline", "net-load fetch skipped")
        net_load, nl_sources = oasis_net_load(transport, clock)
        basis = "CAISO SLD_FCST day-ahead load forecast minus EDAM day-ahead solar and wind forecast, as in the bundle"
    except (oasis.OasisError, OSError) as error:
        net_load, nl_sources = eia_net_load()
        basis = f"EIA-930 demand minus solar and wind generation; the OASIS net-load fetch was not available ({error})"
    doc = {
        "schema": SCHEMA,
        "prov": "DERIVED",
        "assumptions": ASSUMPTIONS,
        "tables": {
            "marginal_co2": {
                **marginal_co2(rows, rng),
                "prov": "DERIVED",
                "sources": [eia_source],
                "caveats": CAVEATS["marginal_co2"],
            },
            "forecast_residuals": {
                **forecast_residuals(rows),
                "prov": "DERIVED",
                "sources": [eia_source],
                "caveats": CAVEATS["forecast_residuals"],
            },
            "price_response": {
                **price_response(hist_prices(), net_load, rng, basis),
                "edam_no_data_request_days": list(NO_DATA_DAYS),
                "prov": "DERIVED",
                "sources": nl_sources
                + [{"file": "public/data/hist_2026-05-01_2026-10-27.json", "license": OASIS_LICENSE}],
                "caveats": CAVEATS["price_response"],
            },
        },
    }
    path = out or PUBLIC_DATA / "response_tables.json"
    write_json(path, doc)
    return doc


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("command", choices=("fetch", "build"))
    parser.add_argument("--out", type=Path)
    parser.add_argument("--eia-net-load", action="store_true", help="skip OASIS and use the EIA-930 net-load fallback")
    args = parser.parse_args()
    if args.command == "fetch":
        net, _ = oasis_net_load()
        print(f"net load: {len(net)} hours cached")
        return 0
    doc = build(args.out, offline_net_load=args.eia_net_load)
    t = doc["tables"]
    print(
        f"marginal_co2 bins {len(t['marginal_co2']['bins'])}; residual days {len(t['forecast_residuals']['days'])}; "
        f"bad hours {len(t['forecast_residuals']['bad_hours'])}; price_response basis: {t['price_response']['net_load_basis']}"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
