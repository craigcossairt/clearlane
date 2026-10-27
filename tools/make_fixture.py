"""Build contracts/fixtures/bundle_2026-10-27.json from the research snapshot.

The fixture lets the Engine and UI lanes start before the Data lane ships the real bundle.
It is a stand-in, not data of record: the Data lane's public/data/bundle_2026-10-27.json replaces it.

Run: python -I tools/make_fixture.py
"""

import csv
import datetime as dt
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[1]
SNAPSHOT = ROOT / "research" / "data" / "pace_snapshot_2026-10-27.csv"
OUT = ROOT / "contracts" / "fixtures" / "bundle_2026-10-27.json"

DAY = dt.date(2026, 10, 27)
MDT = dt.timezone(dt.timedelta(hours=-6))  # DST ends Nov 1 2026, so Oct 27 is MDT

# EIA-930 PACE generated-basis CO2, Oct 1-25 2026 mean, keyed by hour ENDING (research/analysis/demo-story/habit.py).
CO2_HOUR_ENDING = {
    1: 697,
    2: 697,
    3: 695,
    4: 694,
    5: 698,
    6: 704,
    7: 709,
    8: 698,
    9: 623,
    10: 534,
    11: 485,
    12: 461,
    13: 455,
    14: 450,
    15: 443,
    16: 446,
    17: 464,
    18: 531,
    19: 629,
    20: 673,
    21: 676,
    22: 682,
    23: 684,
    24: 693,
}

PEERS = [
    ("ELAP_PACW-APND", "da_lmp_elap_pacw"),
    ("ELAP_PGE-APND", "da_lmp_elap_pge"),
    ("TH_SP15_GEN-APND", "da_lmp_th_sp15_gen"),
]

# Hour 0 (00:00 MT = 06:00Z) belongs to CAISO operating day Oct 26 (HE 24), which the snapshot does not hold.
HOUR0_DAM = (
    ROOT / "research" / "analysis" / "option2" / "oct" / "20260930_20261028_PRC_LMP_DAM_20261026_20_37_47_v12.csv"
)


def hour0_prices(ts_gmt: str) -> dict[tuple[str, str], float]:
    """(NODE, LMP_TYPE) -> price for one interval of a CAISO PRC_LMP DAM CSV, rounded like the snapshot."""
    with HOUR0_DAM.open(newline="", encoding="utf-8") as f:
        return {
            (r["NODE"], r["LMP_TYPE"]): round(float(r["MW"]), 2)
            for r in csv.DictReader(f)
            if r["INTERVALSTARTTIME_GMT"] == ts_gmt
        }


def main() -> None:
    with SNAPSHOT.open(newline="", encoding="utf-8") as f:
        rows = {r["interval_start_utc"]: r for r in csv.DictReader(f)}

    start = dt.datetime(DAY.year, DAY.month, DAY.day, tzinfo=MDT).astimezone(dt.UTC)
    hours, peer_cols, borrowed = [], {node: [] for node, _ in PEERS}, []
    for h in range(24):
        ts = start + dt.timedelta(hours=h)
        key = ts.isoformat()
        row = rows.get(key)
        fcst = "REAL"
        if row is None:
            # The snapshot starts at 01:00 MT. Hour 0 prices come from the Oct 26 operating day's DAM file;
            # its load, solar and wind forecasts are not cached, so they are borrowed from the next midnight.
            row = dict(rows[(ts + dt.timedelta(days=1)).isoformat()])
            dam = hour0_prices(ts.strftime("%Y-%m-%dT%H:%M:%S-00:00"))
            row["da_lmp_elap_pace"] = dam[("ELAP_PACE-APND", "LMP")]
            row["da_congestion_pace"] = dam[("ELAP_PACE-APND", "MCC")]
            for node, col in PEERS:
                row[col] = dam[(node, "LMP")]
            fcst = "ASSUMPTION"
            borrowed.append(h)
        load = float(row["da_load_fcst_pace_mw"])
        solar = max(0.0, float(row["edam_solar_fcst_pace_mw"]))
        wind = float(row["edam_wind_fcst_pace_mw"])
        hours.append(
            {
                "ts_utc": ts.strftime("%Y-%m-%dT%H:%M:%SZ"),
                "local_mt": ts.astimezone(MDT).strftime("%Y-%m-%dT%H:%M-06:00"),
                "hour_mt": h,
                "lmp_usd_mwh": float(row["da_lmp_elap_pace"]),
                "mcc_usd_mwh": float(row["da_congestion_pace"]),
                "load_fcst_mw": load,
                "solar_fcst_mw": solar,
                "wind_fcst_mw": wind,
                "net_load_mw": round(load - solar - wind, 2),
                "co2_g_kwh": CO2_HOUR_ENDING[h + 1],
                "co2_kind": "eia_profile_avg_30d",
                "prov": {"lmp": "REAL", "load": fcst, "solar": fcst, "wind": fcst, "co2": "DERIVED"},
            }
        )
        for node, col in PEERS:
            peer_cols[node].append(float(row[col]))

    # The snapshot's file time when this fixture was first built. Reading the mtime instead made every
    # checkout regenerate different bytes.
    fetched = dt.datetime(2026, 10, 27, 5, 16, 5, tzinfo=dt.UTC)
    bundle = {
        "schema": "clearlane.bundle/v1",
        "operating_day_mt": DAY.isoformat(),
        "node": "ELAP_PACE-APND",
        "data_mode": "snapshot",
        "fetched_utc": fetched.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "hours": hours,
        "peers": [{"node": node, "lmp_usd_mwh": vals} for node, vals in peer_cols.items()],
        "sources": [
            {
                "id": "caiso_prc_lmp_dam",
                "url": "http://oasis.caiso.com/oasisapi/SingleZip?queryname=PRC_LMP&market_run_id=DAM",
                "license": "public",
                "retrieved_utc": fetched.strftime("%Y-%m-%dT%H:%M:%SZ"),
            },
            {
                "id": "caiso_edam_wnd_slr_fcst",
                "url": "http://oasis.caiso.com/oasisapi/SingleZip?queryname=EDAM_WND_SLR_FORECAST_GRP",
                "license": "public",
                "retrieved_utc": fetched.strftime("%Y-%m-%dT%H:%M:%SZ"),
            },
            {
                "id": "eia930_pace_co2",
                "url": "https://www.eia.gov/electricity/gridmonitor/",
                "license": "public domain (US government)",
                "retrieved_utc": fetched.strftime("%Y-%m-%dT%H:%M:%SZ"),
            },
        ],
        "notes": [
            "FIXTURE built by tools/make_fixture.py from research/data/pace_snapshot_2026-10-27.csv; the Data lane's bundle replaces it.",
            f"hours {borrowed} (MT): prices (PACE LMP and MCC, and the peer LMPs) are from CAISO OPR_DT 2026-10-26 HE 24 "
            f"({HOUR0_DAM.relative_to(ROOT).as_posix()}); load, solar and wind are not cached for that hour, "
            "so they are borrowed from 2026-10-28 00:00 MT and tagged ASSUMPTION.",
            "co2_g_kwh is the Oct 1-25 2026 EIA-930 PACE hour-of-day mean, shifted from hour ending to hour beginning.",
        ],
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(bundle, indent=2) + "\n", encoding="utf-8", newline="\n")
    print(f"wrote {OUT.relative_to(ROOT)}: {len(hours)} hours, borrowed {borrowed}")


if __name__ == "__main__":
    main()
