"""Offline OASIS client, parser and Mountain-time contract tests."""

import io
import json
import pathlib
import tempfile
import unittest
import zipfile
from datetime import datetime, timedelta, timezone
from urllib.error import HTTPError
from urllib.parse import parse_qs, urlparse
from xml.etree import ElementTree as ET

from prep import mtday, oasis

ROOT = pathlib.Path(__file__).resolve().parents[2]
FIXTURES = ROOT / "prep" / "tests" / "fixtures" / "oasis"


def zipped(name: str, member: str) -> bytes:
    data = (FIXTURES / name).read_bytes()
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr(member, data)
    return buf.getvalue()


def zipped_bytes(data: bytes, member: str) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr(member, data)
    return buf.getvalue()


class FakeClock:
    def __init__(self):
        self.seconds = 0.0
        self.sleeps = []

    def monotonic(self):
        return self.seconds

    def sleep(self, seconds):
        self.sleeps.append(seconds)
        self.seconds += seconds

    def now(self):
        return datetime(2026, 10, 27, tzinfo=timezone.utc) + timedelta(seconds=self.seconds)


class OasisUrlTest(unittest.TestCase):
    def test_build_url_uses_gmt_bounds_and_query_parameters(self):
        url = oasis.build_url(
            "PRC_LMP",
            "2026-10-27T06:00:00Z",
            "2026-10-28T06:00:00Z",
            market_run_id="DAM",
            version=12,
            node="ELAP_PACE-APND",
            resultformat=6,
        )
        query = parse_qs(urlparse(url).query)
        self.assertEqual(urlparse(url).path, "/oasisapi/SingleZip")
        self.assertEqual(query["queryname"], ["PRC_LMP"])
        self.assertEqual(query["startdatetime"], ["20261027T06:00-0000"])
        self.assertEqual(query["enddatetime"], ["20261028T06:00-0000"])
        self.assertEqual(query["node"], ["ELAP_PACE-APND"])

    def test_build_url_selects_group_zip_for_edam(self):
        url = oasis.build_url(
            "EDAM_WND_SLR_FORECAST_GRP",
            "2026-10-27T06:00Z",
            "2026-10-28T06:00Z",
            version=1,
        )
        query = parse_qs(urlparse(url).query)
        self.assertEqual(urlparse(url).path, "/oasisapi/GroupZip")
        self.assertEqual(query["groupid"], ["EDAM_WND_SLR_FORECAST_GRP"])
        self.assertEqual(query["resultformat"], ["5"])


class OasisParserTest(unittest.TestCase):
    def test_prc_lmp_filters_components_sorts_and_parses_hour(self):
        rows = oasis.parse_prc_lmp(zipped("prc_lmp.csv", "sample.csv"))
        times = list(rows)
        self.assertEqual(times, sorted(times))
        self.assertTrue(all(ts.endswith("Z") for ts in times))
        self.assertEqual(rows["2026-10-27T12:00:00Z"][0]["opr_hr"], 6)
        self.assertEqual(rows["2026-10-27T12:00:00Z"][0]["lmp_type"], "LMP")
        types = {row["lmp_type"] for bucket in rows.values() for row in bucket}
        self.assertEqual(types, {"LMP", "MCC"})
        self.assertAlmostEqual(rows["2026-10-27T12:00:00Z"][0]["value"], 44.09045)

    def test_sld_fcst_keeps_only_pace_and_sorts(self):
        rows = oasis.parse_sld_fcst(zipped("sld_fcst.csv", "sample.csv"))
        self.assertEqual(list(rows), sorted(rows))
        self.assertEqual(len(rows), 2)
        self.assertTrue(all(row["area"] == "PACE" for row in rows.values()))
        self.assertEqual(rows["2026-10-27T07:00:00Z"]["opr_hr"], 1)
        self.assertEqual(rows["2026-10-27T07:00:00Z"]["load_fcst_mw"], 4947.0)

    def test_edam_keeps_pace_clamps_negative_solar_and_counts_clamps(self):
        root = ET.fromstring((FIXTURES / "edam.xml").read_bytes())
        namespace = "{http://www.caiso.com/soa/EDAMWindAndSolarForecast_v1.xsd}"
        root.find(f".//{namespace}SOLAR").text = "-2"
        raw_xml = ET.tostring(root, encoding="utf-8")
        rows, clamps = oasis.parse_edam_wind_solar(zipped_bytes(raw_xml, "sample.xml"))
        self.assertEqual(list(rows), sorted(rows))
        self.assertEqual(set(rows), {"2026-10-27T07:00:00Z", "2026-10-27T08:00:00Z", "2026-10-27T09:00:00Z"})
        self.assertEqual(rows["2026-10-27T07:00:00Z"]["solar_mw"], 0.0)
        self.assertEqual(clamps, 1)

    def test_error_xml_in_csv_zip_raises_oasis_error(self):
        raw = zipped("error_1004.xml", "error.xml")
        with self.assertRaises(oasis.OasisError) as raised:
            oasis.check_response(raw, csv_requested=True)
        self.assertEqual(raised.exception.code, "1004")
        self.assertIn("31 days", raised.exception.message)

    def test_error_xml_in_group_zip_raises_oasis_error(self):
        raw = zipped("error_1004.xml", "error.xml")
        with self.assertRaises(oasis.OasisError) as raised:
            oasis.check_response(raw, csv_requested=False)
        self.assertEqual(raised.exception.code, "1004")


class OasisFetchTest(unittest.TestCase):
    def test_fetch_paces_calls_caches_metadata_and_reuses_cache(self):
        clock = FakeClock()
        raw = zipped("prc_lmp.csv", "sample.csv")
        calls = []

        def transport(url):
            calls.append(url)
            return raw

        with tempfile.TemporaryDirectory(dir=ROOT / "prep" / "tests") as temp:
            cache = pathlib.Path(temp) / "day.zip"
            first = oasis.fetch("https://example.invalid/?resultformat=6", cache, transport, clock)
            second = oasis.fetch("https://example.invalid/?resultformat=6", cache, transport, clock)
            self.assertEqual(first, raw)
            self.assertEqual(second, raw)
            self.assertEqual(len(calls), 1)
            meta = json.loads(cache.with_suffix(".zip.meta.json").read_text(encoding="utf-8"))
            self.assertEqual(meta["url"], calls[0])
            self.assertEqual(meta["bytes"], len(raw))
            self.assertEqual(len(meta["sha256"]), 64)

        clock2 = FakeClock()
        with tempfile.TemporaryDirectory(dir=ROOT / "prep" / "tests") as temp:
            oasis.fetch("https://example.invalid/?resultformat=6", pathlib.Path(temp) / "a.zip", transport, clock2)
            oasis.fetch("https://example.invalid/?resultformat=6", pathlib.Path(temp) / "b.zip", transport, clock2)
        self.assertIn(5.0, clock2.sleeps)

    def test_fetch_retries_429_with_30_second_backoff_then_succeeds(self):
        clock = FakeClock()
        raw = zipped("prc_lmp.csv", "sample.csv")
        calls = []

        def transport(url):
            calls.append(url)
            if len(calls) == 1:
                raise HTTPError(url, 429, "Too Many Requests", {}, None)
            return raw

        with tempfile.TemporaryDirectory(dir=ROOT / "prep" / "tests") as temp:
            result = oasis.fetch("https://example.invalid/?resultformat=6", pathlib.Path(temp) / "a.zip", transport, clock)
        self.assertEqual(result, raw)
        self.assertEqual(len(calls), 2)
        self.assertIn(30, clock.sleeps)

    def test_fetch_stops_after_three_429_responses(self):
        clock = FakeClock()
        calls = []

        def transport(url):
            calls.append(url)
            raise HTTPError(url, 429, "Too Many Requests", {}, None)

        with tempfile.TemporaryDirectory(dir=ROOT / "prep" / "tests") as temp:
            with self.assertRaises(oasis.OasisError) as raised:
                oasis.fetch("https://example.invalid/?resultformat=6", pathlib.Path(temp) / "a.zip", transport, clock)
        self.assertEqual(len(calls), 3)
        self.assertEqual(raised.exception.code, "429")

    def test_refetch_bypasses_an_existing_cache(self):
        clock = FakeClock()
        raw = zipped("prc_lmp.csv", "sample.csv")
        calls = []

        def transport(url):
            calls.append(url)
            return raw

        with tempfile.TemporaryDirectory(dir=ROOT / "prep" / "tests") as temp:
            cache = pathlib.Path(temp) / "a.zip"
            oasis.fetch("https://example.invalid/?resultformat=6", cache, transport, clock)
            oasis.fetch("https://example.invalid/?resultformat=6", cache, transport, clock, refetch=True)
        self.assertEqual(len(calls), 2)


class OasisHourParsingTest(unittest.TestCase):
    def test_opr_hour_accepts_padded_and_unpadded_values(self):
        self.assertEqual(oasis._hour("01"), 1)
        self.assertEqual(oasis._hour("1"), 1)


class MountainDayTest(unittest.TestCase):
    def test_mountain_day_and_hour_zero_caiso_mapping(self):
        hours = mtday.mountain_day_hours("2026-10-27")
        self.assertEqual(len(hours), 24)
        self.assertEqual(hours[0].strftime("%Y-%m-%dT%H:%M:%SZ"), "2026-10-27T06:00:00Z")
        self.assertEqual(mtday.local_mt(hours[0]), "2026-10-27T00:00-06:00")
        self.assertEqual(mtday.caiso_operating_days("2026-10-27"), ("2026-10-26", "2026-10-27"))
        self.assertEqual(mtday.caiso_operating_hour("2026-10-27", 0), ("2026-10-26", 24))
        self.assertEqual(mtday.caiso_operating_hour("2026-10-27", 1), ("2026-10-27", 1))

    def test_fixed_mountain_mapping_rejects_days_outside_window(self):
        with self.assertRaises(ValueError):
            mtday.mountain_day_hours("2026-11-01")


if __name__ == "__main__":
    unittest.main()
