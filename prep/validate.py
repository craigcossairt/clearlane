"""Strict offline validation for committed Bundle JSON files."""

import json
import math
from datetime import date, datetime, time, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MOUNTAIN = timezone(timedelta(hours=-6))


def validate_bundle(bundle: dict) -> None:
    if bundle.get("schema") != "clearlane.bundle/v1":
        raise ValueError("bundle schema must be clearlane.bundle/v1")
    if bundle.get("node") != "ELAP_PACE-APND":
        raise ValueError("bundle node must be ELAP_PACE-APND")
    if bundle.get("data_mode") not in ("snapshot", "live"):
        raise ValueError("bundle data_mode is invalid")
    hours = bundle.get("hours")
    if not isinstance(hours, list) or len(hours) != 24:
        raise ValueError("bundle must have 24 hours")
    start = datetime.combine(date.fromisoformat(bundle["operating_day_mt"]), time.min, tzinfo=MOUNTAIN).astimezone(
        timezone.utc
    )
    for index, hour in enumerate(hours):
        if hour.get("hour_mt") != index:
            raise ValueError(f"hour {index} has incorrect Mountain hour")
        for field in (
            "ts_utc",
            "local_mt",
            "lmp_usd_mwh",
            "mcc_usd_mwh",
            "load_fcst_mw",
            "solar_fcst_mw",
            "wind_fcst_mw",
            "net_load_mw",
            "co2_g_kwh",
            "co2_kind",
            "prov",
        ):
            if field not in hour or hour[field] is None:
                raise ValueError(f"hour {index} is missing {field}")
        for field in (
            "lmp_usd_mwh",
            "mcc_usd_mwh",
            "load_fcst_mw",
            "solar_fcst_mw",
            "wind_fcst_mw",
            "net_load_mw",
            "co2_g_kwh",
        ):
            value = hour[field]
            if not isinstance(value, (int, float)) or not math.isfinite(value):
                raise ValueError(f"hour {index} has invalid {field}")
        if hour["solar_fcst_mw"] < 0:
            raise ValueError(f"hour {index} solar forecast is negative")
        expected_ts = (start + timedelta(hours=index)).strftime("%Y-%m-%dT%H:%M:%SZ")
        if hour["ts_utc"] != expected_ts:
            raise ValueError(f"hour {index} timestamp should be {expected_ts}")
        if hour["net_load_mw"] != round(hour["load_fcst_mw"] - hour["solar_fcst_mw"] - hour["wind_fcst_mw"], 2):
            raise ValueError(f"hour {index} net load identity failed")
        if hour["prov"] != {
            "lmp": "REAL",
            "load": "REAL",
            "solar": "REAL",
            "wind": "REAL",
            "co2": hour["prov"].get("co2"),
        }:
            raise ValueError(f"hour {index} provenance fields are incomplete")
        if hour["co2_kind"] == "eia_observed_avg" and hour["prov"].get("co2") != "REAL":
            raise ValueError(f"hour {index} observed CO2 must be REAL")
        if hour["co2_kind"] == "eia_profile_avg_30d" and hour["prov"].get("co2") != "DERIVED":
            raise ValueError(f"hour {index} profile CO2 must be DERIVED")
        if hour["co2_kind"] not in ("eia_observed_avg", "eia_profile_avg_30d"):
            raise ValueError(f"hour {index} has unknown CO2 kind")
    peers = bundle.get("peers", [])
    expected_peers = {"ELAP_PACW-APND", "ELAP_PGE-APND", "TH_SP15_GEN-APND"}
    if {peer.get("node") for peer in peers} != expected_peers:
        raise ValueError("bundle must contain the three expected peer nodes")
    for peer in peers:
        if len(peer.get("lmp_usd_mwh", [])) != 24:
            raise ValueError(f"peer {peer.get('node')} must have 24 prices")
        if any(not isinstance(value, (int, float)) or not math.isfinite(value) for value in peer["lmp_usd_mwh"]):
            raise ValueError(f"peer {peer.get('node')} has an invalid price")
    sources = bundle.get("sources")
    if not isinstance(sources, list) or not sources:
        raise ValueError("bundle sources must be a non-empty list")
    ids = [source.get("id") for source in sources]
    if len(ids) != len(set(ids)):
        raise ValueError("bundle source ids must be unique")
    if any(not str(source.get("url", "")).startswith("https://") for source in sources):
        raise ValueError("bundle source URLs must use https")
    strings = json.dumps(bundle, ensure_ascii=False)
    if "\u2014" in strings or "—" in strings:
        raise ValueError("bundle strings must not contain an em dash")


def validate_file(path: Path) -> None:
    validate_bundle(json.loads(path.read_text(encoding="utf-8")))


def validate_all(directory: Path | None = None) -> list[Path]:
    data_dir = directory or ROOT / "public" / "data"
    files = sorted(data_dir.glob("bundle_*.json"))
    for path in files:
        validate_file(path)
    return files


if __name__ == "__main__":
    paths = validate_all()
    for path in paths:
        print(f"valid: {path}")
    if not paths:
        print("no bundle files found")
