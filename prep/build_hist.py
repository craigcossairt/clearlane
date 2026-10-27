"""Build the May 1 to Oct 27 HistDay window from cached CAISO and EIA data."""

import argparse
import csv
import json
import math
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

from prep import mtday, oasis
from prep._paths import PUBLIC_DATA, ROOT
from prep.jsonio import write_json

NODES = ("ELAP_PACE-APND", "ELAP_PACW-APND", "ELAP_PGE-APND", "TH_SP15_GEN-APND")
WINDOWS = (
    ("2026-05-01", "2026-05-31"),
    ("2026-05-31", "2026-06-30"),
    ("2026-06-30", "2026-07-30"),
    ("2026-07-30", "2026-08-29"),
    ("2026-08-29", "2026-09-28"),
    ("2026-09-28", "2026-10-28"),
)
OASIS_LICENSE = (
    "CAISO Terms of Use (https://www.caiso.com/privacy-terms-of-use): limited license, credit California ISO"
)
EIA_LICENSE = "Public domain; credit the U.S. Energy Information Administration."
UTC = timezone.utc


def _stamp(value: str) -> str:
    instant = datetime.fromisoformat(value.replace("Z", "+00:00"))
    return instant.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")


def _day_record(
    day: str, prices: dict[str, float], co2: dict[str, float]
) -> tuple[dict | None, dict | None, list[int]]:
    stamps = [_stamp(ts.isoformat()) for ts in mtday.mountain_day_hours(day)]
    present = [i for i, stamp in enumerate(stamps) if stamp in prices]
    if len(present) != 24:
        if day == "2026-05-01":
            reason = "EDAM began on the operating day; the previous-day HE24 price is unavailable."
        else:
            reason = f"Fewer than 24 priced Mountain hours are present ({len(present)} of 24)."
        return None, {"day": day, "hours_present": len(present), "reason": reason}, []
    day_prices = [float(prices[stamp]) for stamp in stamps]
    if any(not math.isfinite(value) for value in day_prices):
        raise ValueError(f"non-finite price on {day}")
    co2_values = [round(co2[stamp], 1) if stamp in co2 and co2[stamp] > 0 else None for stamp in stamps]
    null_hours = [i for i, value in enumerate(co2_values) if value is None]
    return {"operating_day_mt": day, "lmp_usd_mwh": day_prices, "co2_g_kwh": co2_values}, None, null_hours


def _eia_data() -> tuple[dict[str, float], dict]:
    path = ROOT / "prep" / "data" / "eia_pace_hourly.csv"
    with path.open(newline="", encoding="utf-8") as stream:
        rows = list(csv.DictReader(stream))
    co2 = {}
    for row in rows:
        raw = row.get("co2_gen_lb_kwh", "")
        if raw:
            value = float(raw) * 453.592
            if value > 0:
                co2[_stamp(row["utc_start"])] = value
    meta = json.loads((ROOT / "prep" / "data" / "eia_pace_hourly.meta.json").read_text(encoding="utf-8"))
    return co2, meta


def _call_url(start_day: str, end_day: str) -> str:
    start = datetime.fromisoformat(start_day).replace(tzinfo=UTC) + timedelta(hours=6)
    end = datetime.fromisoformat(end_day).replace(tzinfo=UTC) + timedelta(hours=6)
    return oasis.build_url("PRC_LMP", start, end, market_run_id="DAM", version=12, node=",".join(NODES))


def build(fetch_only: bool = False, out: Path | None = None) -> list[dict]:
    price_by_hour: dict[str, float] = {}
    sources = []
    fetched = []
    for index, (start_day, end_day) in enumerate(WINDOWS, start=1):
        url = _call_url(start_day, end_day)
        cache_path = oasis._cache_path(url, "prc_lmp")
        raw = oasis.fetch(url, cache_path)
        meta_path = cache_path.with_suffix(cache_path.suffix + ".meta.json")
        if not meta_path.is_file():
            raise RuntimeError(f"cache metadata missing: {meta_path}")
        meta = json.loads(meta_path.read_text(encoding="utf-8"))
        fetched.append(meta["retrieved_utc"])
        sources.append(
            {
                "id": f"caiso_prc_lmp_dam_history_{index}",
                "url": url,
                "license": OASIS_LICENSE,
                "retrieved_utc": meta["retrieved_utc"],
            }
        )
        if fetch_only:
            continue
        for timestamp, entries in oasis.parse_prc_lmp(raw).items():
            for entry in entries:
                if entry["node"] == NODES[0] and entry["lmp_type"] == "LMP":
                    price_by_hour[_stamp(timestamp)] = float(entry["value"])
    if fetch_only:
        print("Fetched or verified all six PRC_LMP history windows; no output files written.")
        return []

    co2, eia_meta = _eia_data()
    eia_time = eia_meta["workbook_file_time_utc"]
    fetched.append(eia_time)
    sources.append(
        {"id": "eia_pace_co2", "url": eia_meta["source_url"], "license": EIA_LICENSE, "retrieved_utc": eia_time}
    )
    days = []
    missing = []
    null_hours = {}
    current = date(2026, 5, 1)
    last = date(2026, 10, 27)
    while current <= last:
        day = current.isoformat()
        record, absent, nulls = _day_record(day, price_by_hour, co2)
        if record is not None:
            days.append(record)
            if nulls:
                null_hours[day] = nulls
        else:
            missing.append(absent)
        current += timedelta(days=1)
    meta = {
        "schema": "clearlane.hist_meta/v1",
        "window": {"start_mt": "2026-05-01", "end_mt": "2026-10-27"},
        "days": len(days),
        "missing_days": missing,
        "co2_null_hours": null_hours,
        "sources": sources,
        "fetched_utc": max(fetched),
        "notes": [
            "Price data: California ISO OASIS. EIA PACE CO2 data is public domain; credit the U.S. Energy Information Administration."
        ],
    }
    data_path = out or PUBLIC_DATA / "hist_2026-05-01_2026-10-27.json"
    meta_path = data_path.with_name("hist_2026-05-01_2026-10-27.meta.json")
    write_json(data_path, days)
    write_json(meta_path, meta)
    print("Missing days: " + (", ".join(f"{item['day']} ({item['hours_present']}/24)" for item in missing) or "none"))
    print(f"wrote {data_path}: {len(days)} days; metadata {meta_path}")
    return days


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--fetch-only", action="store_true")
    parser.add_argument("--out", type=Path)
    args = parser.parse_args()
    build(args.fetch_only, args.out)


if __name__ == "__main__":
    main()
