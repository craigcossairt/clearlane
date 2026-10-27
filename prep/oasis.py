"""Keyless CAISO OASIS client and parsers for Data lane reports."""

import argparse
import csv
import hashlib
import io
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from prep._paths import RAW  # noqa: E402
from prep.jsonio import write_json  # noqa: E402

SINGLE_ZIP = "https://oasis.caiso.com/oasisapi/SingleZip"
GROUP_ZIP = "https://oasis.caiso.com/oasisapi/GroupZip"
EDAM_GROUP = "EDAM_WND_SLR_FORECAST_GRP"
EDAM_NS = "{http://www.caiso.com/soa/EDAMWindAndSolarForecast_v1.xsd}"
MIN_CALL_GAP_S = 5
MAX_429_ATTEMPTS = 3
RETRY_429_S = 30


class OasisError(Exception):
    def __init__(self, code: str, message: str):
        self.code = str(code)
        self.message = message
        super().__init__(f"OASIS {self.code}: {self.message}")


class _SystemClock:
    def monotonic(self) -> float:
        return time.monotonic()

    def sleep(self, seconds: float) -> None:
        time.sleep(seconds)

    def now(self) -> datetime:
        return datetime.now(timezone.utc)


_SYSTEM_CLOCK = _SystemClock()
_LAST_CALL: dict[int, tuple[object, float]] = {}


def _gmt_param(value: str | datetime) -> str:
    instant = datetime.fromisoformat(value.replace("Z", "+00:00")) if isinstance(value, str) else value
    if instant.tzinfo is None:
        instant = instant.replace(tzinfo=timezone.utc)
    instant = instant.astimezone(timezone.utc)
    return instant.strftime("%Y%m%dT%H:%M-0000")


def build_url(query: str, start: str | datetime, end: str | datetime, **params: object) -> str:
    """Build a SingleZip or GroupZip URL with inclusive/exclusive GMT bounds."""
    group = query == EDAM_GROUP or "groupid" in params
    values = dict(params)
    values.pop("base", None)
    values["startdatetime"] = _gmt_param(start)
    values["enddatetime"] = _gmt_param(end)
    if group:
        values.setdefault("groupid", query)
        values.setdefault("resultformat", 5)
        endpoint = GROUP_ZIP
    else:
        values.setdefault("queryname", query)
        values.setdefault("resultformat", 6)
        endpoint = SINGLE_ZIP
    base = str(params.get("base", endpoint)).rstrip("?")
    encoded = urllib.parse.urlencode(values)
    return f"{base}?{encoded}"


def _error_from_xml(data: bytes) -> OasisError | None:
    if b"ERR_CODE" not in data:
        return None
    try:
        root = ET.fromstring(data)
        values = {element.tag.split("}")[-1].split(":")[-1]: (element.text or "").strip() for element in root.iter()}
        code = values.get("ERR_CODE", "unknown")
        message = values.get("ERR_DESC") or values.get("ERR_MESSAGE") or values.get("ERR_MSG") or "OASIS returned an error response"
        return OasisError(code, message)
    except ET.ParseError:
        code_match = re.search(rb"ERR_CODE[^>]*>([^<]+)", data)
        message_match = re.search(rb"ERR_DESC[^>]*>([^<]+)", data)
        code = code_match.group(1).decode("ascii", "replace") if code_match else "unknown"
        message = message_match.group(1).decode("utf-8", "replace") if message_match else "OASIS returned an error response"
        return OasisError(code, message)


def check_response(raw: bytes, csv_requested: bool) -> None:
    xml_error = _error_from_xml(raw)
    if xml_error:
        raise xml_error
    if not zipfile.is_zipfile(io.BytesIO(raw)):
        raise OasisError("invalid_response", "OASIS response is not a zip archive")
    with zipfile.ZipFile(io.BytesIO(raw)) as archive:
        members = archive.namelist()
        xml_members = [name for name in members if name.lower().endswith(".xml")]
        for name in xml_members:
            error = _error_from_xml(archive.read(name))
            if error:
                raise error
        if csv_requested:
            if xml_members:
                raise OasisError("no_data", "OASIS returned XML when CSV was requested")


def _pace(clock: object) -> None:
    key = id(clock)
    previous = _LAST_CALL.get(key)
    now = clock.monotonic()
    if previous is not None and previous[0] is clock:
        delay = MIN_CALL_GAP_S - (now - previous[1])
        if delay > 0:
            clock.sleep(delay)
    _LAST_CALL[key] = (clock, clock.monotonic())


def _request(url: str, transport: Callable[[str], bytes] | None) -> bytes:
    if transport is not None:
        result = transport(url)
        return result.read() if hasattr(result, "read") else bytes(result)
    with urllib.request.urlopen(url, timeout=60) as response:
        return response.read()


def _now(clock: object) -> str:
    value = clock.now()
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def fetch(
    url: str,
    cache_path: str | Path,
    transport: Callable[[str], bytes] | None = None,
    clock: object | None = None,
    refetch: bool = False,
) -> bytes:
    """Fetch, validate and cache one raw OASIS response, honoring pacing."""
    cache_path = Path(cache_path)
    cache_path.parent.mkdir(parents=True, exist_ok=True)
    csv_requested = urllib.parse.parse_qs(urllib.parse.urlparse(url).query).get("resultformat", ["6"])[0] == "6"
    if cache_path.is_file() and not refetch:
        raw = cache_path.read_bytes()
        check_response(raw, csv_requested)
        return raw

    active_clock = clock or _SYSTEM_CLOCK
    last_error = None
    for attempt in range(MAX_429_ATTEMPTS):
        _pace(active_clock)
        try:
            raw = _request(url, transport)
        except urllib.error.HTTPError as error:
            if error.code == 429:
                last_error = OasisError("429", "rate limited by OASIS")
                if attempt + 1 < MAX_429_ATTEMPTS:
                    active_clock.sleep(RETRY_429_S)
                    continue
                raise last_error from error
            raise OasisError(str(error.code), error.reason or "HTTP error") from error
        check_response(raw, csv_requested)
        tmp = cache_path.with_suffix(cache_path.suffix + ".tmp")
        tmp.write_bytes(raw)
        tmp.replace(cache_path)
        write_json(
            cache_path.with_suffix(cache_path.suffix + ".meta.json"),
            {
                "url": url,
                "retrieved_utc": _now(active_clock),
                "sha256": hashlib.sha256(raw).hexdigest(),
                "bytes": len(raw),
            },
        )
        return raw
    raise last_error or OasisError("fetch_failed", "OASIS fetch failed")


def _csv_rows(raw: bytes) -> list[dict[str, str]]:
    if zipfile.is_zipfile(io.BytesIO(raw)):
        with zipfile.ZipFile(io.BytesIO(raw)) as archive:
            names = [name for name in archive.namelist() if name.lower().endswith(".csv")]
            if not names:
                raise OasisError("no_csv", "OASIS zip contains no CSV member")
            data = archive.read(names[0])
    else:
        data = raw
    return list(csv.DictReader(io.StringIO(data.decode("utf-8-sig", errors="strict"), newline="")))


def _xml_document(raw: bytes) -> bytes:
    if zipfile.is_zipfile(io.BytesIO(raw)):
        with zipfile.ZipFile(io.BytesIO(raw)) as archive:
            names = [name for name in archive.namelist() if name.lower().endswith(".xml")]
            if not names:
                raise OasisError("no_xml", "OASIS zip contains no XML member")
            return archive.read(names[0])
    return raw


def _timestamp(value: str) -> str:
    instant = datetime.fromisoformat(value.strip().replace("Z", "+00:00"))
    if instant.tzinfo is None:
        instant = instant.replace(tzinfo=timezone.utc)
    return instant.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _hour(value: str) -> int:
    return int(value.strip())


def parse_prc_lmp(raw: bytes) -> dict[str, list[dict[str, object]]]:
    rows: dict[str, list[dict[str, object]]] = {}
    for source in _csv_rows(raw):
        if source.get("LMP_TYPE") not in ("LMP", "MCC"):
            continue
        ts = _timestamp(source["INTERVALSTARTTIME_GMT"])
        row = {
            "ts_utc": ts,
            "opr_dt": source["OPR_DT"],
            "opr_hr": _hour(source["OPR_HR"]),
            "node": source["NODE"],
            "lmp_type": source["LMP_TYPE"],
            "value": float(source["MW"]),
        }
        rows.setdefault(ts, []).append(row)
    return {ts: rows[ts] for ts in sorted(rows)}


def parse_sld_fcst(raw: bytes) -> dict[str, dict[str, object]]:
    rows = {}
    for source in _csv_rows(raw):
        if source.get("TAC_AREA_NAME") != "PACE":
            continue
        ts = _timestamp(source["INTERVALSTARTTIME_GMT"])
        rows[ts] = {
            "ts_utc": ts,
            "opr_dt": source["OPR_DT"],
            "opr_hr": _hour(source["OPR_HR"]),
            "area": source["TAC_AREA_NAME"],
            "load_fcst_mw": float(source["MW"]),
        }
    return {ts: rows[ts] for ts in sorted(rows)}


def parse_edam_wind_solar(raw: bytes) -> tuple[dict[str, dict[str, object]], int]:
    root = ET.fromstring(_xml_document(raw))
    rows: dict[str, dict[str, object]] = {}
    clamps = 0
    for element in root.iter(EDAM_NS + "REPORT_DATA"):
        fields = {child.tag.removeprefix(EDAM_NS): child.text or "" for child in element}
        if fields.get("BAA_GRP_ID") != "PACE":
            continue
        ts = _timestamp(fields["INTERVAL_START_GMT"])
        solar = float(fields["SOLAR"])
        if solar < 0:
            clamps += 1
            solar = 0.0
        rows[ts] = {
            "ts_utc": ts,
            "solar_mw": solar,
            "wind_mw": float(fields["WIND"]),
        }
    return {ts: rows[ts] for ts in sorted(rows)}, clamps


def _cache_path(url: str, query: str) -> Path:
    params = urllib.parse.parse_qs(urllib.parse.urlparse(url).query)
    start = params["startdatetime"][0].replace(":", "")
    end = params["enddatetime"][0].replace(":", "")
    nodes = params.get("node", [""])[0].replace(",", "_")
    suffix = f"_{nodes}" if nodes else ""
    return RAW / "oasis" / query.lower() / f"{start}_{end}{suffix}.zip"


def main() -> None:
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="command", required=True)
    fetch_parser = sub.add_parser("fetch")
    fetch_parser.add_argument("report", choices=("prc_lmp", "sld_fcst", "edam_wind_solar"))
    fetch_parser.add_argument("--start", required=True)
    fetch_parser.add_argument("--end", required=True)
    fetch_parser.add_argument("--nodes", default="ELAP_PACE-APND")
    fetch_parser.add_argument("--refetch", action="store_true")
    fetch_parser.add_argument("--oasis-base", default=None)
    args = parser.parse_args()

    if args.report == "prc_lmp":
        query, params = "PRC_LMP", {"market_run_id": "DAM", "version": 12, "node": args.nodes}
    elif args.report == "sld_fcst":
        query, params = "SLD_FCST", {"market_run_id": "DAM", "version": 1}
    else:
        query, params = EDAM_GROUP, {"version": 1}
    if args.oasis_base:
        params["base"] = args.oasis_base
    url = build_url(query, args.start, args.end, **params)
    cache = _cache_path(url, args.report)
    raw = fetch(url, cache, refetch=args.refetch)
    if args.report == "prc_lmp":
        count = sum(len(rows) for rows in parse_prc_lmp(raw).values())
    elif args.report == "sld_fcst":
        count = len(parse_sld_fcst(raw))
    else:
        parsed, clamps = parse_edam_wind_solar(raw)
        count = len(parsed)
        print(f"negative solar values clamped: {clamps}")
    print(f"{args.report}: {count} rows; cache {cache}")


if __name__ == "__main__":
    main()
