"""Build a deterministic Mountain-day Bundle from cached CAISO and EIA inputs."""

import argparse
import csv
import json
import sys
from datetime import date, datetime, time, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from prep import mtday, oasis
from prep._paths import PUBLIC_DATA, RAW
from prep.jsonio import write_json
from prep.validate import validate_bundle

NODES = ("ELAP_PACE-APND", "ELAP_PACW-APND", "ELAP_PGE-APND", "TH_SP15_GEN-APND")
OASIS_LICENSE = (
    "CAISO Terms of Use (https://www.caiso.com/privacy-terms-of-use): limited license, credit California ISO"
)
EIA_LICENSE = "Public domain; credit the U.S. Energy Information Administration."
UTC = timezone.utc


def _round2(value: float) -> float:
    return round(float(value) + 0.0, 2)


def _iso(dt: datetime) -> str:
    return dt.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")


def _hour(ts: str) -> datetime:
    return datetime.fromisoformat(ts.replace("Z", "+00:00")).astimezone(UTC)


def _co2_profile(rows: list[dict[str, str]], ts: str, start: str, end: str) -> tuple[int | None, int]:
    target = _hour(ts).time()
    values = []
    for row in rows:
        if not start <= row["local_date"] <= end or not row["co2_gen_lb_kwh"]:
            continue
        instant = _hour(row["utc_start"])
        if instant.time() == target:
            values.append(float(row["co2_gen_lb_kwh"]) * 453.592)
    return (round(sum(values) / len(values)) if values else None, len(values))


def _eia_rows() -> list[dict[str, str]]:
    path = ROOT / "prep" / "data" / "eia_pace_hourly.csv"
    with path.open(newline="", encoding="utf-8") as stream:
        return list(csv.DictReader(stream))


def _cache(url: str, report: str, refetch: bool) -> tuple[bytes, dict[str, str]]:
    path = oasis._cache_path(url, report)
    raw = oasis.fetch(url, path, refetch=refetch)
    meta_path = path.with_suffix(path.suffix + ".meta.json")
    if not meta_path.is_file():
        raise RuntimeError(f"cache metadata missing: {meta_path}")
    return raw, json.loads(meta_path.read_text(encoding="utf-8"))


def _url(query: str, start: datetime, end: datetime, report: str) -> str:
    if report == "prc_lmp":
        return oasis.build_url("PRC_LMP", start, end, market_run_id="DAM", version=12, node=",".join(NODES))
    if report == "sld_fcst":
        return oasis.build_url("SLD_FCST", start, end, market_run_id="DAM", version=1)
    return oasis.build_url(oasis.EDAM_GROUP, start, end, version=1)


def build(
    day: str,
    out: Path | None = None,
    refetch: bool = False,
    co2_window: tuple[str, str] | None = None,
    co2_window_days: int = 30,
) -> dict:
    mountain_day = date.fromisoformat(day)
    timestamps = mtday.mountain_day_hours(mountain_day)
    start_mt = datetime.combine(mountain_day, time.min, tzinfo=mtday.MOUNTAIN).astimezone(UTC)
    next_start = start_mt + timedelta(days=1)
    op_prev = mountain_day - timedelta(days=1)
    op_day = mountain_day
    fetched = []
    sources = []

    price_url = _url("PRC_LMP", start_mt, next_start, "prc_lmp")
    raw, meta = _cache(price_url, "prc_lmp", refetch)
    fetched.append(meta["retrieved_utc"])
    sources.append(
        {"id": "caiso_prc_lmp_dam", "url": price_url, "license": OASIS_LICENSE, "retrieved_utc": meta["retrieved_utc"]}
    )
    price_by_hour = {}
    for entries in oasis.parse_prc_lmp(raw).values():
        for entry in entries:
            price_by_hour.setdefault(entry["ts_utc"], {})[(entry["node"], entry["lmp_type"])] = entry["value"]

    forecasts = {"load": {}, "wind": {}, "solar": {}}
    # Each CAISO operating day is 07:00Z to 07:00Z. The previous day's response includes
    # HE24 at the Mountain-day boundary (06:00Z), and the current day's response covers hours 1..23.
    prev_start = datetime.combine(op_prev, time.min, tzinfo=UTC) + timedelta(hours=7)
    day_start = datetime.combine(op_day, time.min, tzinfo=UTC) + timedelta(hours=7)
    calls = (
        (op_prev, prev_start, prev_start + timedelta(days=1)),
        (op_day, day_start, day_start + timedelta(days=1)),
    )
    for operating_day, lower, upper in calls:
        for report in ("sld_fcst", "edam_wind_solar"):
            url = _url(report, lower, upper, report)
            raw, meta = _cache(url, report, refetch)
            fetched.append(meta["retrieved_utc"])
            source_id = "caiso_sld_fcst_dam" if report == "sld_fcst" else "caiso_edam_wnd_slr"
            sources.append(
                {
                    "id": f"{source_id}_{operating_day:%Y%m%d}",
                    "url": url,
                    "license": OASIS_LICENSE,
                    "retrieved_utc": meta["retrieved_utc"],
                }
            )
            if report == "sld_fcst":
                for ts, row in oasis.parse_sld_fcst(raw).items():
                    forecasts["load"][ts] = row["load_fcst_mw"]
            else:
                parsed, _ = oasis.parse_edam_wind_solar(raw)
                for ts, row in parsed.items():
                    forecasts["solar"][ts] = row["solar_mw"]
                    forecasts["wind"][ts] = row["wind_mw"]

    co2_rows = _eia_rows()
    if co2_window is None:
        if co2_window_days < 1:
            raise ValueError("CO2 window must contain at least one day")
        window_start = mountain_day - timedelta(days=co2_window_days + 1)
        window_end = mountain_day - timedelta(days=2)
        # 30 observed Mountain dates ending two days before D; the latest EIA day can be incomplete.
        window_start_s = window_start.isoformat()
        window_end_s = window_end.isoformat()
    else:
        window_start_s, window_end_s = co2_window
    meta_path = ROOT / "prep" / "data" / "eia_pace_hourly.meta.json"
    eia_meta = json.loads(meta_path.read_text(encoding="utf-8"))
    eia_time = eia_meta["workbook_file_time_utc"]
    fetched.append(eia_time)
    sources.append(
        {"id": "eia_pace_co2", "url": eia_meta["source_url"], "license": EIA_LICENSE, "retrieved_utc": eia_time}
    )
    observed = {row["utc_start"]: row for row in co2_rows if row["co2_gen_lb_kwh"]}

    hours = []
    co2_ns = {}
    for i, instant in enumerate(timestamps):
        ts = _iso(instant)
        prices = price_by_hour.get(ts, {})
        required = [(NODES[0], "LMP"), (NODES[0], "MCC")]
        if any(key not in prices for key in required):
            raise RuntimeError(f"missing PACE LMP or MCC at {ts}")
        for kind in ("load", "solar", "wind"):
            if ts not in forecasts[kind]:
                raise RuntimeError(f"missing {kind} forecast at {ts}")
        load = _round2(forecasts["load"][ts])
        solar = max(0.0, _round2(forecasts["solar"][ts]))
        wind = _round2(forecasts["wind"][ts])
        co2row = observed.get(ts)
        if co2row:
            co2 = round(float(co2row["co2_gen_lb_kwh"]) * 453.592)
            co2_kind, co2_prov = "eia_observed_avg", "REAL"
        else:
            co2, n = _co2_profile(co2_rows, ts, window_start_s, window_end_s)
            if co2 is None or n == 0:
                raise RuntimeError(f"no observed CO2 profile for {ts} in {window_start_s}:{window_end_s}")
            co2_ns[str(i)] = n
            co2_kind, co2_prov = "eia_profile_avg_30d", "DERIVED"
        hours.append(
            {
                "ts_utc": ts,
                "local_mt": mtday.local_mt(ts),
                "hour_mt": i,
                "lmp_usd_mwh": _round2(prices[(NODES[0], "LMP")]),
                "mcc_usd_mwh": _round2(prices[(NODES[0], "MCC")]),
                "load_fcst_mw": load,
                "solar_fcst_mw": solar,
                "wind_fcst_mw": wind,
                "net_load_mw": _round2(load - solar - wind),
                "co2_g_kwh": co2,
                "co2_kind": co2_kind,
                "prov": {"lmp": "REAL", "load": "REAL", "solar": "REAL", "wind": "REAL", "co2": co2_prov},
            }
        )
    peers = []
    for node in NODES[1:]:
        vals = []
        for instant in timestamps:
            ts = _iso(instant)
            price = price_by_hour.get(ts, {}).get((node, "LMP"))
            if price is None:
                raise RuntimeError(f"missing peer {node} price at {ts}")
            vals.append(_round2(price))
        peers.append({"node": node, "lmp_usd_mwh": vals})
    notes = [
        f"Hour 0 comes from CAISO OPR_DT {op_prev.isoformat()}, HE24 (the previous CAISO operating day).",
        "Price and forecast data: California ISO OASIS.",
        f"CO2 fallback profile window: {window_start_s} through {window_end_s}; observed sample counts by Mountain hour: {json.dumps(co2_ns, sort_keys=True)}.",
    ]
    result = {
        "schema": "clearlane.bundle/v1",
        "operating_day_mt": day,
        "node": NODES[0],
        "data_mode": "snapshot",
        "fetched_utc": max(fetched),
        "hours": hours,
        "peers": peers,
        "sources": sources,
        "notes": notes,
    }
    validate_bundle(result)
    destination = out or PUBLIC_DATA / f"bundle_{day}.json"
    write_json(destination, result)
    return result


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--day", required=True)
    parser.add_argument("--refetch", action="store_true")
    parser.add_argument("--co2-window-days", type=int, default=30)
    parser.add_argument("--co2-window")
    parser.add_argument("--out", type=Path)
    args = parser.parse_args()
    window = tuple(args.co2_window.split(":")) if args.co2_window else None
    if window and len(window) != 2:
        parser.error("--co2-window must be START:END")
    result = build(args.day, args.out, args.refetch, window, args.co2_window_days)
    print(f"wrote {args.out or PUBLIC_DATA / f'bundle_{args.day}.json'}: {len(result['hours'])} hours")


if __name__ == "__main__":
    main()
