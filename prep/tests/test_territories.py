"""Offline tests for the PACW and PGE day-ahead history (stretch `territories`)."""

import io
import json
import pathlib
import tempfile
import unittest
import zipfile
from datetime import datetime, timedelta, timezone

from prep import build_territories as bt

ROOT = pathlib.Path(__file__).resolve().parents[2]
UTC = timezone.utc
HEADER = '"INTERVALSTARTTIME_GMT","OPR_DT","OPR_HR","NODE","LMP_TYPE","MW"\n'


def _window(start: datetime, hours: int, node: str = "ELAP_PGE-APND", skip=(), dup=()) -> bytes:
    body = HEADER
    for i in range(hours):
        t = start + timedelta(hours=i)
        if t in skip:
            continue
        for _ in range(2 if t in dup else 1):
            stamp = t.strftime("%Y-%m-%dT%H:%M:%S-00:00")
            body += f'"{stamp}","{t:%Y-%m-%d}","{t.hour + 1}","{node}","LMP","{30 + i % 24}.5"\n'
            body += f'"{stamp}","{t:%Y-%m-%d}","{t.hour + 1}","{node}","MCC","-0.5"\n'
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as archive:
        archive.writestr("prc.csv", body)
    return buf.getvalue()


OCT1 = datetime(2026, 10, 1, 6, tzinfo=UTC)


class TerritoryTest(unittest.TestCase):
    def test_days_have_24_hours_and_a_short_day_is_listed_not_filled(self):
        raw = _window(OCT1, 24 * 27, skip={OCT1})  # Oct 1 hour 0 belongs to the pre-EDAM Sep 30 trading day
        prices = bt.prices_by_hour([raw], "ELAP_PGE-APND")
        days, missing = bt.build_days("ELAP_PGE-APND", "2026-10-01", "2026-10-27", prices)
        self.assertEqual(len(days), 26)
        self.assertTrue(all(len(d["lmp_usd_mwh"]) == 24 for d in days))
        self.assertEqual([(m["day"], m["hours_present"]) for m in missing], [("2026-10-01", 23)])
        self.assertIn("EDAM began", missing[0]["reason"])
        self.assertTrue(all(v is None for d in days for v in d["co2_g_kwh"]))
        bt.check(days, prices)

    def test_a_hole_mid_window_drops_that_day_with_a_count(self):
        hole = OCT1 + timedelta(days=5, hours=13)
        prices = bt.prices_by_hour([_window(OCT1, 24 * 27, skip={hole})], "ELAP_PGE-APND")
        _, missing = bt.build_days("ELAP_PGE-APND", "2026-10-01", "2026-10-27", prices)
        self.assertEqual([(m["day"], m["hours_present"]) for m in missing], [("2026-10-06", 23)])

    def test_a_duplicated_source_value_fails_the_build(self):
        with self.assertRaisesRegex(bt.TerritoryError, "duplicate"):
            bt.prices_by_hour([_window(OCT1, 48, dup={OCT1 + timedelta(hours=3)})], "ELAP_PGE-APND")

    def test_a_planted_filled_value_fails_the_check(self):
        prices = bt.prices_by_hour([_window(OCT1, 24 * 3)], "ELAP_PGE-APND")
        days, _ = bt.build_days("ELAP_PGE-APND", "2026-10-01", "2026-10-03", prices)
        del prices["2026-10-02T15:00:00Z"]  # the day now holds a value with no source behind it
        with self.assertRaisesRegex(bt.TerritoryError, "filled"):
            bt.check(days, prices)

    def test_a_duplicated_day_or_planted_co2_fails_the_check(self):
        prices = bt.prices_by_hour([_window(OCT1, 24 * 3)], "ELAP_PGE-APND")
        days, _ = bt.build_days("ELAP_PGE-APND", "2026-10-01", "2026-10-03", prices)
        with self.assertRaisesRegex(bt.TerritoryError, "duplicate day"):
            bt.check(days + [days[0]], prices)
        days[1]["co2_g_kwh"][4] = 400.0
        with self.assertRaisesRegex(bt.TerritoryError, "price only"):
            bt.check(days, prices)

    def test_other_nodes_are_ignored(self):
        raws = [_window(OCT1, 24), _window(OCT1, 24, node="ELAP_PACW-APND")]
        self.assertEqual(len(bt.prices_by_hour(raws, "ELAP_PGE-APND")), 24)

    def test_build_writes_hist_and_meta_with_the_27_day_note(self):
        raws = [
            _window(OCT1, 24 * 27, skip={OCT1}),
            _window(OCT1 - timedelta(days=153), 24 * 181, node="ELAP_PACW-APND"),
        ]
        with tempfile.TemporaryDirectory() as tmp:
            paths = bt.build(pathlib.Path(tmp), raws, [{"id": "x"}], ["2026-10-27T18:00:00Z"])
            names = sorted(p.name for p in pathlib.Path(tmp).iterdir())
            meta = json.loads(
                paths[1].with_name("hist_pge_2026-10-01_2026-10-27.meta.json").read_text(encoding="utf-8")
            )
        self.assertEqual(
            names,
            [
                "hist_pacw_2026-05-01_2026-10-27.json",
                "hist_pacw_2026-05-01_2026-10-27.meta.json",
                "hist_pge_2026-10-01_2026-10-27.json",
                "hist_pge_2026-10-01_2026-10-27.meta.json",
            ],
        )
        self.assertEqual(meta["window"], {"start_mt": "2026-10-01", "end_mt": "2026-10-27"})
        self.assertTrue(any("27 days, 26 with all 24 hours" in n for n in meta["notes"]))
        self.assertTrue(any(bt.CO2_NOTE in n for n in meta["notes"]))

    def test_committed_files_reproduce_from_the_source_prices(self):
        for name, node, first, last in bt.TERRITORIES:
            path = ROOT / "public" / "data" / f"hist_{name}_{first}_{last}.json"
            if not path.is_file():
                self.skipTest(f"{path.name} not built")
            days = json.loads(path.read_text(encoding="utf-8"))
            meta = json.loads(path.with_name(path.name.replace(".json", ".meta.json")).read_text(encoding="utf-8"))
            self.assertEqual(meta["days"], len(days))
            self.assertGreaterEqual(days[0]["operating_day_mt"], first)
            listed = {m["day"] for m in meta["missing_days"]}
            span = (datetime.fromisoformat(last) - datetime.fromisoformat(first)).days + 1
            self.assertEqual(len(days) + len(listed), span)
            for d in days:
                self.assertEqual(len(d["lmp_usd_mwh"]), 24)
                self.assertEqual(d["co2_g_kwh"], [None] * 24)


if __name__ == "__main__":
    unittest.main()
