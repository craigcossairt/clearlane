"""Offline tests for the one-command Tue-night refresh (fake OASIS transport, temp folders)."""

import contextlib
import hashlib
import io
import json
import pathlib
import tempfile
import unittest
import zipfile
from datetime import datetime, timedelta, timezone
from urllib.parse import parse_qs, urlparse

from prep import build_bundle, refresh_tonight

ROOT = pathlib.Path(__file__).resolve().parents[2]
FIXTURES = ROOT / "prep" / "tests" / "fixtures" / "oasis"
DAY = "2026-10-28"
UTC = timezone.utc


def _zip(member: str, data: bytes) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr(member, data)
    return buf.getvalue()


def _hours(params: dict) -> list[datetime]:
    start = datetime.strptime(params["startdatetime"][0], "%Y%m%dT%H:%M-0000").replace(tzinfo=UTC)
    end = datetime.strptime(params["enddatetime"][0], "%Y%m%dT%H:%M-0000").replace(tzinfo=UTC)
    return [start + timedelta(hours=i) for i in range(int((end - start).total_seconds() // 3600))]


def _gmt(instant: datetime) -> str:
    return instant.strftime("%Y-%m-%dT%H:%M:%S-00:00")


class FakeOasis:
    """Answers PRC_LMP, SLD_FCST and the EDAM group with synthetic data; drop_hours removes price hours."""

    def __init__(self, drop_hours: int = 0, error: bool = False):
        self.drop_hours = drop_hours
        self.error = error
        self.urls = []

    def __call__(self, url: str) -> bytes:
        self.urls.append(url)
        params = parse_qs(urlparse(url).query)
        if self.error:
            return _zip("error.xml", (FIXTURES / "error_1004.xml").read_bytes())
        hours = _hours(params)
        if params.get("groupid"):
            rows = "".join(
                f"<REPORT_DATA><INTERVAL_START_GMT>{_gmt(h)}</INTERVAL_START_GMT><BAA_GRP_ID>PACE</BAA_GRP_ID>"
                f"<SOLAR>{max(0, 6 - abs(h.hour - 19)) * 100}</SOLAR><WIND>{1000 + h.hour}</WIND></REPORT_DATA>"
                for h in hours
            )
            xml = f'<OASISEDAMWindAndSolarForecast xmlns="http://www.caiso.com/soa/EDAMWindAndSolarForecast_v1.xsd">{rows}</OASISEDAMWindAndSolarForecast>'
            return _zip("edam.xml", xml.encode())
        if params["queryname"][0] == "SLD_FCST":
            header = '"INTERVALSTARTTIME_GMT","OPR_DT","OPR_HR","TAC_AREA_NAME","MW"\n'
            body = "".join(f'"{_gmt(h)}","{h:%Y-%m-%d}","{h.hour}","PACE","{5000 + h.hour}"\n' for h in hours)
            return _zip("sld.csv", (header + body).encode())
        header = '"INTERVALSTARTTIME_GMT","OPR_DT","OPR_HR","NODE","LMP_TYPE","MW"\n'
        body = ""
        for h in hours[: len(hours) - self.drop_hours]:
            for n, node in enumerate(build_bundle.NODES):
                body += f'"{_gmt(h)}","{h:%Y-%m-%d}","{h.hour}","{node}","LMP","{20 + h.hour + n}.123"\n'
                body += f'"{_gmt(h)}","{h:%Y-%m-%d}","{h.hour}","{node}","MCC","-0.5"\n'
        return _zip("prc.csv", (header + body).encode())


class FakeClock:
    def __init__(self, start: datetime):
        self.start = start
        self.seconds = 0.0
        self.sleeps = []

    def monotonic(self):
        return self.seconds

    def sleep(self, seconds):
        self.sleeps.append(seconds)
        self.seconds += seconds

    def now(self):
        return self.start + timedelta(seconds=self.seconds)


def _hashes(folder: pathlib.Path) -> dict[str, str]:
    return {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(folder.iterdir())}


class RefreshTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        base = pathlib.Path(self.temp.name)
        self.public = base / "public"
        self.raw = base / "raw"
        self.public.mkdir()
        (self.public / "bundle_2026-10-27.json").write_bytes((ROOT / "public/data/bundle_2026-10-27.json").read_bytes())
        (self.public / "torus_published.json").write_text("{}\n", encoding="utf-8")
        self.before = _hashes(self.public)
        self.tests_ran = []
        # 9:16pm MT Tue Oct 27
        self.clock = FakeClock(datetime(2026, 10, 28, 3, 16, tzinfo=UTC))

    def tearDown(self):
        self.temp.cleanup()

    def run_refresh(self, *args, transport=None, build_fn=None):
        out = io.StringIO()
        with contextlib.redirect_stdout(out), contextlib.redirect_stderr(out):
            code = refresh_tonight.run(
                ["--day", DAY, *args],
                transport=transport or FakeOasis(),
                clock=self.clock,
                public_dir=self.public,
                raw_dir=self.raw,
                run_tests=lambda: self.tests_ran.append(True) or True,
                build_fn=build_fn,
            )
        return code, out.getvalue()

    def test_success_writes_validated_bundle_via_temp_then_replace(self):
        code, out = self.run_refresh()
        self.assertEqual(code, 0, out)
        written = self.public / f"bundle_{DAY}.json"
        bundle = json.loads(written.read_text(encoding="utf-8"))
        self.assertEqual(len(bundle["hours"]), 24)
        self.assertEqual(bundle["hours"][0]["ts_utc"], "2026-10-28T06:00:00Z")
        self.assertFalse(list(self.public.glob("*.tmp")))
        runs = list((self.raw / "refresh").iterdir())
        self.assertEqual([p.name for p in runs], ["2026-10-28-20261028T031600Z"])
        self.assertEqual((runs[0] / written.name).read_bytes(), written.read_bytes())
        self.assertEqual(self.tests_ran, [True])
        self.assertIn("git add", out)
        self.assertIn("vs 2026-10-27", out)

    def test_fetches_are_fresh_every_run(self):
        transport = FakeOasis()
        self.run_refresh("--dry-run", transport=transport)
        self.run_refresh("--dry-run", transport=transport)
        self.assertEqual(len(transport.urls), 10)

    def test_dry_run_writes_nothing(self):
        code, out = self.run_refresh("--dry-run")
        self.assertEqual(code, 0, out)
        self.assertIn(f"DRY RUN: would write {self.public / f'bundle_{DAY}.json'}", out)
        self.assertEqual(_hashes(self.public), self.before)
        self.assertEqual(self.tests_ran, [])

    def test_oasis_error_exits_1_and_changes_nothing(self):
        code, out = self.run_refresh(transport=FakeOasis(error=True))
        self.assertEqual(code, 1, out)
        self.assertIn("Oct 28 prices not posted; stay on Oct 27", out)
        self.assertEqual(_hashes(self.public), self.before)

    def test_23_hour_day_exits_1_and_changes_nothing(self):
        code, out = self.run_refresh(transport=FakeOasis(drop_hours=1))
        self.assertEqual(code, 1, out)
        self.assertEqual(_hashes(self.public), self.before)

    def test_planted_bad_bundle_fails_validation_and_changes_nothing(self):
        def bad_build(day, **kwargs):
            bundle = build_bundle.build(day, **kwargs)
            bundle["hours"][7]["lmp_usd_mwh"] = None
            return bundle

        code, out = self.run_refresh(build_fn=bad_build)
        self.assertEqual(code, 1, out)
        self.assertIn("invalid bundle, nothing written", out)
        self.assertEqual(_hashes(self.public), self.before)

    def test_failed_unittests_restore_public_data(self):
        out = io.StringIO()
        with contextlib.redirect_stdout(out):
            code = refresh_tonight.run(
                ["--day", DAY],
                transport=FakeOasis(),
                clock=self.clock,
                public_dir=self.public,
                raw_dir=self.raw,
                run_tests=lambda: False,
            )
        self.assertEqual(code, 1, out.getvalue())
        self.assertEqual(_hashes(self.public), self.before)

    def test_poll_until_retries_every_300_s_then_exits_1(self):
        code, out = self.run_refresh("--poll-until", "22:00", transport=FakeOasis(error=True))
        self.assertEqual(code, 1, out)
        self.assertIn("Oct 28 prices not posted by 22:00; stay on Oct 27", out)
        # 9:16pm to 10:00pm: retries at 300 s steps while the next try still lands before 22:00.
        self.assertEqual(self.clock.sleeps.count(300), 8)
        self.assertEqual(_hashes(self.public), self.before)

    def test_poll_succeeds_once_prices_post(self):
        transport = FakeOasis(error=True)
        original = transport.__call__

        def flaky(url):
            if len(transport.urls) >= 2:
                transport.error = False
            return original(url)

        code, out = self.run_refresh("--poll-until", "22:00", transport=flaky)
        self.assertEqual(code, 0, out)
        self.assertTrue((self.public / f"bundle_{DAY}.json").is_file())

    def test_bad_arguments_and_unwritable_raw_exit_2(self):
        self.assertEqual(self.run_refresh("--poll-until", "late")[0], 2)
        out = io.StringIO()
        with contextlib.redirect_stderr(out), contextlib.redirect_stdout(out):
            self.assertEqual(refresh_tonight.run(["--day", "2026-13-01"], public_dir=self.public, raw_dir=self.raw), 2)
            self.assertEqual(refresh_tonight.run([], public_dir=self.public, raw_dir=self.raw), 2)
        blocker = self.raw.parent / "raw_is_a_file"
        blocker.write_text("x", encoding="utf-8")
        with contextlib.redirect_stderr(out), contextlib.redirect_stdout(out):
            self.assertEqual(refresh_tonight.run(["--day", DAY], clock=self.clock, raw_dir=blocker), 2)
        self.assertEqual(_hashes(self.public), self.before)


if __name__ == "__main__":
    unittest.main()
