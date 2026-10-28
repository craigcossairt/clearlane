"""HistDay price history for Torus's other territories, PACW and PGE (stretch `territories`, flag `ff_territories`).

Reads the cached May to Oct PRC_LMP DAM windows (build_hist requested all four nodes, so no fetch is needed) and writes:
  public/data/hist_pacw_2026-05-01_2026-10-27.json   (+ .meta.json)
  public/data/hist_pge_2026-10-01_2026-10-27.json    (+ .meta.json)
Price only: co2_g_kwh is all null. A day without all 24 Mountain hours is left out and listed, never filled.
"""

import argparse
import json
import math
import sys
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from prep import build_hist, mtday, oasis  # noqa: E402
from prep._paths import PUBLIC_DATA  # noqa: E402
from prep.jsonio import write_json  # noqa: E402

TERRITORIES = (
    ("pacw", "ELAP_PACW-APND", "2026-05-01", "2026-10-27"),
    ("pge", "ELAP_PGE-APND", "2026-10-01", "2026-10-27"),
)
CO2_NOTE = "price only; CO2 for PACW and PGE is out of scope"
EDAM_START = {"ELAP_PACW-APND": "2026-05-01", "ELAP_PGE-APND": "2026-10-01"}


class TerritoryError(ValueError):
    pass


def prices_by_hour(windows: list[bytes], node: str) -> dict[str, float]:
    """LMP by UTC hour start for one node. A timestamp seen twice is an error, never silently overwritten."""
    out: dict[str, float] = {}
    for raw in windows:
        for stamp, rows in oasis.parse_prc_lmp(raw).items():
            for row in rows:
                if row["node"] != node or row["lmp_type"] != "LMP":
                    continue
                key = build_hist._stamp(stamp)
                if key in out:
                    raise TerritoryError(f"duplicate {node} price at {key}")
                value = float(row["value"])
                if not math.isfinite(value):
                    raise TerritoryError(f"non-finite {node} price at {key}")
                out[key] = value
    return out


def _stamps(day: str) -> list[str]:
    return [build_hist._stamp(ts.isoformat()) for ts in mtday.mountain_day_hours(day)]


def build_days(node: str, first: str, last: str, prices: dict[str, float]) -> tuple[list[dict], list[dict]]:
    days, missing = [], []
    current, end = date.fromisoformat(first), date.fromisoformat(last)
    while current <= end:
        day = current.isoformat()
        stamps = _stamps(day)
        present = [s for s in stamps if s in prices]
        if len(present) == 24:
            days.append({"operating_day_mt": day, "lmp_usd_mwh": [prices[s] for s in stamps], "co2_g_kwh": [None] * 24})
        else:
            if day == EDAM_START[node]:
                reason = "EDAM began for this node on the operating day; the previous-day HE24 price is unavailable."
            else:
                reason = f"Fewer than 24 priced Mountain hours are present ({len(present)} of 24)."
            missing.append({"day": day, "hours_present": len(present), "reason": reason})
        current += timedelta(days=1)
    return days, missing


def check(days: list[dict], prices: dict[str, float]) -> None:
    """Every value must be the source price at its own hour: nothing filled, nothing duplicated."""
    seen = set()
    for record in days:
        day = record["operating_day_mt"]
        if day in seen:
            raise TerritoryError(f"duplicate day {day}")
        seen.add(day)
        if len(record["lmp_usd_mwh"]) != 24 or len(record["co2_g_kwh"]) != 24:
            raise TerritoryError(f"{day} does not have 24 hours")
        if any(v is not None for v in record["co2_g_kwh"]):
            raise TerritoryError(f"{day} carries CO2; territories are price only")
        for stamp, value in zip(_stamps(day), record["lmp_usd_mwh"]):
            if stamp not in prices:
                raise TerritoryError(f"{day} has a filled value at {stamp}")
            if prices[stamp] != value:
                raise TerritoryError(f"{day} value at {stamp} differs from the source")


def _windows() -> tuple[list[bytes], list[dict], list[str]]:
    raws, sources, fetched = [], [], []
    for index, (start_day, end_day) in enumerate(build_hist.WINDOWS, start=1):
        url = build_hist._call_url(start_day, end_day)
        path = oasis._cache_path(url, "prc_lmp")
        if not path.is_file():
            raise FileNotFoundError(f"history cache missing: {path}; run python -I prep/build_hist.py --fetch-only")
        raws.append(oasis.fetch(url, path))
        meta = json.loads(path.with_suffix(path.suffix + ".meta.json").read_text(encoding="utf-8"))
        fetched.append(meta["retrieved_utc"])
        sources.append(
            {
                "id": f"caiso_prc_lmp_dam_history_{index}",
                "url": url,
                "license": build_hist.OASIS_LICENSE,
                "retrieved_utc": meta["retrieved_utc"],
            }
        )
    return raws, sources, fetched


def build(out_dir: Path | None = None, raws: list[bytes] | None = None, sources=None, fetched=None) -> list[Path]:
    if raws is None:
        raws, sources, fetched = _windows()
    written = []
    for name, node, first, last in TERRITORIES:
        prices = prices_by_hour(raws, node)
        days, missing = build_days(node, first, last, prices)
        check(days, prices)
        notes = [
            f"Day-ahead (EDAM) LMP at {node} from California ISO OASIS PRC_LMP DAM, by Mountain hour beginning.",
            CO2_NOTE + ": co2_g_kwh is null in every hour.",
            "Days without all 24 Mountain hours are left out and listed in missing_days, never filled.",
            "Wattsmart is a Rocky Mountain Power program, so on this node the envelope is a format proposal only.",
        ]
        if name == "pge":
            notes.append(
                "Portland General Electric joined EDAM on Oct 1 2026 (research/notes/utah-grid.findings.md), "
                "so this window is only 27 days."
            )
        meta = {
            "schema": "clearlane.hist_meta/v1",
            "window": {"start_mt": first, "end_mt": last},
            "days": len(days),
            "missing_days": missing,
            "co2_null_hours": {d["operating_day_mt"]: list(range(24)) for d in days},
            "sources": sources,
            "fetched_utc": max(fetched),
            "notes": notes,
        }
        path = (out_dir or PUBLIC_DATA) / f"hist_{name}_{first}_{last}.json"
        write_json(path, days)
        write_json(path.with_name(path.name.replace(".json", ".meta.json")), meta)
        print(f"wrote {path.name}: {len(days)} days; missing " + (", ".join(m["day"] for m in missing) or "none"))
        written.append(path)
    return written


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--out-dir", type=Path)
    build(parser.parse_args().out_dir)


if __name__ == "__main__":
    main()
