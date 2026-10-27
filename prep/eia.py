"""Extract a compact PACE hourly CSV from the local EIA workbook."""

import argparse
import csv
import hashlib
import json
import os
import re
import sys
import urllib.request
import zipfile
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
RAW = Path(os.environ.get("CLEARLANE_RAW", ROOT.parent / "clearlane-raw")).resolve()
SOURCE_URL = "https://www.eia.gov/electricity/gridmonitor/knownissues/xls/PACE.xlsx"
BASE_DATE = datetime(1899, 12, 30, tzinfo=timezone.utc)
CUTOFF = date(2025, 7, 1)
XLSX_NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
HEADERS = [
    "utc_start",
    "local_date",
    "hour_ending",
    "demand_mw",
    "demand_fcst_mw",
    "net_gen_mw",
    "co2_t",
    "co2_gen_lb_kwh",
    "co2_cons_lb_kwh",
]
SOURCE_COLUMNS = {
    "BA": "ba",
    "UTC time": "utc_time",
    "Local date": "local_date",
    "Hour": "hour_ending",
    "Demand": "demand_mw",
    "Demand forecast": "demand_fcst_mw",
    "Net generation": "net_gen_mw",
    "CO2 Emissions Generated": "co2_t",
    "CO2 Emissions Intensity for Generated Electricity": "co2_gen_lb_kwh",
    "CO2 Emissions Intensity for Consumed Electricity": "co2_cons_lb_kwh",
}


def _column_number(reference: str) -> int:
    match = re.match(r"[A-Z]+", reference)
    if match is None:
        raise ValueError(f"invalid cell reference: {reference}")
    result = 0
    for letter in match.group():
        result = result * 26 + ord(letter) - ord("A") + 1
    return result


def _shared_strings(archive: zipfile.ZipFile) -> list[str]:
    values = []
    with archive.open("xl/sharedStrings.xml") as stream:
        for _, element in ET.iterparse(stream, events=("end",)):
            if element.tag == XLSX_NS + "si":
                values.append("".join(part.text or "" for part in element.iter() if part.tag == XLSX_NS + "t"))
                element.clear()
    return values


def _cell_value(cell: ET.Element, shared: list[str]) -> str:
    value = cell.find(XLSX_NS + "v")
    raw = value.text if value is not None and value.text is not None else ""
    if cell.get("t") == "s" and raw:
        return shared[int(raw)]
    if cell.get("t") == "inlineStr":
        return "".join(part.text or "" for part in cell.iter() if part.tag == XLSX_NS + "t")
    return raw


def _excel_date(serial: str) -> date:
    return (BASE_DATE + timedelta(days=float(serial))).date()


def _utc_start(serial: str) -> str:
    hour_ending_utc = BASE_DATE + timedelta(days=float(serial))
    interval_start = hour_ending_utc - timedelta(hours=1)
    return interval_start.strftime("%Y-%m-%dT%H:%M:%SZ")


def iter_records(workbook: Path):
    """Stream records from worksheet 1, keyed by the workbook's header labels."""
    with zipfile.ZipFile(workbook) as archive:
        shared = _shared_strings(archive)
        header_map = None
        with archive.open("xl/worksheets/sheet1.xml") as stream:
            for _, element in ET.iterparse(stream, events=("end",)):
                if element.tag != XLSX_NS + "row":
                    continue
                cells = {_column_number(cell.get("r", "")): _cell_value(cell, shared) for cell in element.findall(XLSX_NS + "c")}
                element.clear()
                if header_map is None:
                    normalized = {str(value).strip().casefold(): column for column, value in cells.items()}
                    missing = [name for name in SOURCE_COLUMNS if name.casefold() not in normalized]
                    if missing:
                        raise ValueError(f"PACE.xlsx is missing columns: {', '.join(missing)}")
                    header_map = {target: normalized[source.casefold()] for source, target in SOURCE_COLUMNS.items()}
                    continue

                def read(name: str) -> str:
                    return cells.get(header_map[name], "").strip()

                if read("ba").casefold() != "pace":
                    continue
                if not read("local_date") or not read("utc_time"):
                    continue
                local_date = _excel_date(read("local_date"))
                if local_date < CUTOFF:
                    continue
                hour = read("hour_ending")
                record = {
                    "utc_start": _utc_start(read("utc_time")),
                    "local_date": local_date.isoformat(),
                    "hour_ending": str(int(float(hour))) if hour else "",
                }
                for field in HEADERS[3:]:
                    record[field] = read(field)
                yield record
    if header_map is None:
        raise ValueError("PACE.xlsx sheet 1 has no header row")


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with open(path, "rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _write_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(value, indent=2, ensure_ascii=False, allow_nan=False) + "\n"
    temp = path.with_suffix(path.suffix + ".tmp")
    with open(temp, "w", encoding="utf-8", newline="\n") as stream:
        stream.write(text)
    os.replace(temp, path)


def extract(workbook: Path, out_csv: Path, out_meta: Path) -> dict[str, object]:
    workbook = Path(workbook)
    out_csv = Path(out_csv)
    out_meta = Path(out_meta)
    out_csv.parent.mkdir(parents=True, exist_ok=True)
    tmp_csv = out_csv.with_suffix(out_csv.suffix + ".tmp")
    count = 0
    first = last = last_co2 = None
    with open(tmp_csv, "w", newline="", encoding="utf-8") as stream:
        writer = csv.DictWriter(stream, fieldnames=HEADERS, extrasaction="raise", lineterminator="\n")
        writer.writeheader()
        for row in iter_records(workbook):
            writer.writerow(row)
            count += 1
            first = first or row["utc_start"]
            last = row["utc_start"]
            if row["co2_gen_lb_kwh"]:
                last_co2 = row["utc_start"]
    os.replace(tmp_csv, out_csv)
    file_time = datetime.fromtimestamp(workbook.stat().st_mtime, timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    metadata = {
        "source_url": SOURCE_URL,
        "license": "Public domain; credit the U.S. Energy Information Administration.",
        "workbook_sha256": _sha256(workbook),
        "workbook_file_time_utc": file_time,
        "workbook_file_time_kind": "source workbook file time (filesystem modification time)",
        "first_utc_start": first,
        "last_utc_start": last,
        "row_count": count,
        "last_co2_utc_start": last_co2,
    }
    _write_json(out_meta, metadata)
    print(f"wrote {out_csv}: {count} rows, CO2 through {last_co2}")
    print(f"wrote {out_meta}")
    return metadata


def _download() -> Path:
    destination_dir = RAW / "eia"
    destination_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    destination = destination_dir / f"PACE_{stamp}.xlsx"
    temp = destination.with_suffix(destination.suffix + ".tmp")
    with urllib.request.urlopen(SOURCE_URL, timeout=120) as response, open(temp, "wb") as stream:
        while chunk := response.read(1024 * 1024):
            stream.write(chunk)
    os.replace(temp, destination)
    return destination


def main() -> None:
    parser = argparse.ArgumentParser()
    action = parser.add_mutually_exclusive_group()
    action.add_argument("--extract", action="store_true")
    action.add_argument("--fetch", action="store_true")
    parser.add_argument("--workbook", type=Path, default=RAW / "eia" / "PACE.xlsx")
    parser.add_argument("--out", type=Path, default=ROOT / "prep" / "data" / "eia_pace_hourly.csv")
    parser.add_argument("--meta", type=Path, default=ROOT / "prep" / "data" / "eia_pace_hourly.meta.json")
    args = parser.parse_args()
    workbook = _download() if args.fetch else args.workbook
    extract(workbook, args.out, args.meta)


if __name__ == "__main__":
    main()
