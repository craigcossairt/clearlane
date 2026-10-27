"""One-command Tue-night refresh: fresh OASIS fetch, validate, then atomically write one Bundle.

Exit codes: 0 written (or dry run green); 1 data not ready or invalid, nothing changed; 2 could not run.
"""

import argparse
import hashlib
import json
import os
import shutil
import subprocess
import sys
import traceback
import urllib.error
from datetime import date, datetime, time, timedelta, timezone
from pathlib import Path
from typing import Callable

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from prep import build_bundle, mtday, oasis  # noqa: E402
from prep._paths import PUBLIC_DATA, RAW  # noqa: E402
from prep.jsonio import write_json  # noqa: E402
from prep.validate import validate_file  # noqa: E402

POLL_INTERVAL_S = 300
NOT_READY = (oasis.OasisError, RuntimeError, urllib.error.URLError)


class _Usage(Exception):
    """Bad arguments or environment: exit 2."""


def _label(day: date) -> str:
    return f"{day:%b} {day.day}"


def _deadline(value: str, now_utc: datetime) -> datetime:
    try:
        clock_time = time.fromisoformat(value)
    except ValueError as error:
        raise _Usage(f"--poll-until must be HH:MM Mountain, got {value!r}") from error
    today_mt = now_utc.astimezone(mtday.MOUNTAIN).date()
    return datetime.combine(today_mt, clock_time, tzinfo=mtday.MOUNTAIN)


def _fresh_fetcher(run_dir: Path, transport, clock) -> Callable[[str, str], tuple[bytes, dict]]:
    def get(url: str, report: str) -> tuple[bytes, dict]:
        path = run_dir / report / oasis._cache_path(url, report).name
        raw = oasis.fetch(url, path, transport=transport, clock=clock, refetch=True)
        meta = json.loads(path.with_suffix(path.suffix + ".meta.json").read_text(encoding="utf-8"))
        return raw, meta

    return get


def _check_priced(bundle: dict) -> None:
    hours = bundle.get("hours") or []
    if len(hours) != 24:
        raise ValueError(f"expected 24 priced hours, got {len(hours)}")
    for hour in hours:
        for field in ("lmp_usd_mwh", "net_load_mw", "co2_g_kwh"):
            if not isinstance(hour.get(field), (int, float)):
                raise ValueError(f"hour {hour.get('hour_mt')} has no {field}")


def _validate(path: Path) -> dict:
    validate_file(path)
    bundle = json.loads(path.read_text(encoding="utf-8"))
    _check_priced(bundle)
    return bundle


def _stats(values: list[float]) -> str:
    return f"min {min(values):.2f}  max {max(values):.2f}  mean {sum(values) / len(values):.2f}"


def _table(new: dict, base: dict | None, base_label: str) -> list[str]:
    day = new["operating_day_mt"]
    lines = [f"Per hour (Mountain, hour beginning): {day} vs {base_label}"]
    lines.append(f"{'hr':>2}  {'price':>8} {'base':>8}  {'net MW':>9} {'base':>9}  {'CO2 g':>5} {'base':>5}  co2_kind")
    for i, hour in enumerate(new["hours"]):
        old = base["hours"][i] if base else {}
        lines.append(
            f"{i:>2}  {hour['lmp_usd_mwh']:>8.2f} {old.get('lmp_usd_mwh', float('nan')):>8.2f}"
            f"  {hour['net_load_mw']:>9.2f} {old.get('net_load_mw', float('nan')):>9.2f}"
            f"  {hour['co2_g_kwh']:>5} {str(old.get('co2_g_kwh', '-')):>5}  {hour['co2_kind']}"
        )
    for field, name in (("lmp_usd_mwh", "price $/MWh"), ("net_load_mw", "net load MW"), ("co2_g_kwh", "CO2 g/kWh")):
        lines.append(f"{name:<12} {day}: {_stats([h[field] for h in new['hours']])}")
        if base:
            lines.append(f"{'':<12} {base_label}: {_stats([h[field] for h in base['hours']])}")
    return lines


def _baseline(public_dir: Path, day: date) -> tuple[dict | None, str]:
    previous = public_dir / f"bundle_{day - timedelta(days=1)}.json"
    if previous.is_file():
        return json.loads(previous.read_text(encoding="utf-8")), str(day - timedelta(days=1))
    same = public_dir / f"bundle_{day}.json"
    if same.is_file():
        return json.loads(same.read_text(encoding="utf-8")), f"{day} committed"
    return None, "no baseline"


def _default_tests() -> bool:
    command = [sys.executable, "-I", "-m", "unittest", "discover", "-s", "prep/tests", "-t", "."]
    print("running: " + " ".join(command[1:]), flush=True)
    return subprocess.run(command, cwd=ROOT).returncode == 0


def run(
    argv: list[str] | None = None,
    transport=None,
    clock=None,
    public_dir: Path | None = None,
    raw_dir: Path | None = None,
    run_tests: Callable[[], bool] | None = None,
    build_fn: Callable[..., dict] | None = None,
) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--day", required=True, help="Mountain operating day, YYYY-MM-DD")
    parser.add_argument("--dry-run", action="store_true", help="fetch, build and validate; write nothing")
    parser.add_argument("--poll-until", help="retry the fetch every 300 s until this Mountain HH:MM")
    parser.add_argument("--oasis-base", help="override the OASIS endpoint (testing)")
    try:
        args = parser.parse_args(argv)
    except SystemExit as error:
        return 2 if error.code else 0

    clock = clock or oasis._SYSTEM_CLOCK
    public_dir = Path(public_dir or PUBLIC_DATA)
    raw_dir = Path(raw_dir or RAW)
    build_fn = build_fn or build_bundle.build
    try:
        day = date.fromisoformat(args.day)
        mtday.mountain_day_hours(day)
        deadline = _deadline(args.poll_until, clock.now()) if args.poll_until else None
        stamp = clock.now().astimezone(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        run_dir = raw_dir / "refresh" / f"{day}-{stamp}"
        try:
            run_dir.mkdir(parents=True, exist_ok=True)
            (run_dir / ".probe").write_text("ok", encoding="utf-8")
            (run_dir / ".probe").unlink()
        except OSError as error:
            raise _Usage(f"raw folder not writable: {run_dir} ({error})") from error
    except (_Usage, ValueError) as error:
        print(f"error: {error}", file=sys.stderr)
        return 2

    destination = public_dir / f"bundle_{day}.json"
    print(f"refresh {day}: raw run folder {run_dir}", flush=True)
    try:
        while True:
            try:
                bundle = build_fn(
                    day.isoformat(),
                    fetch_raw=_fresh_fetcher(run_dir, transport, clock),
                    oasis_base=args.oasis_base,
                    write=False,
                )
                break
            except NOT_READY as error:
                print(f"not ready: {type(error).__name__}: {error}", flush=True)
                if deadline is None or clock.now() + timedelta(seconds=POLL_INTERVAL_S) > deadline:
                    when = f" by {args.poll_until}" if args.poll_until else ""
                    print(f"{_label(day)} prices not posted{when}; stay on {_label(day - timedelta(days=1))}")
                    return 1
                print(f"retrying in {POLL_INTERVAL_S} s (until {args.poll_until} MT)", flush=True)
                clock.sleep(POLL_INTERVAL_S)

        temp = run_dir / f"bundle_{day}.json"
        write_json(temp, bundle)
        try:
            bundle = _validate(temp)
        except ValueError as error:
            print(f"invalid bundle, nothing written: {error}")
            return 1

        base, base_label = _baseline(public_dir, day)
        for line in _table(bundle, base, base_label):
            print(line)
        print(f"fetched_utc {bundle['fetched_utc']}; built file sha256 {hashlib.sha256(temp.read_bytes()).hexdigest()}")
        if base and base_label.endswith("committed"):
            same = bundle["hours"] == base["hours"]
            print(f"hours identical to committed {destination.name}: {'yes' if same else 'NO'}")

        if args.dry_run:
            print(f"DRY RUN: would write {destination}")
            return 0

        previous = destination.read_bytes() if destination.is_file() else None
        staged = destination.with_suffix(".json.tmp")
        shutil.copyfile(temp, staged)
        os.replace(staged, destination)
        print(f"wrote {destination}")
        if not (run_tests or _default_tests)():
            if previous is None:
                destination.unlink()
            else:
                destination.write_bytes(previous)
            print("prep unittests failed after writing; restored public/data, nothing changed")
            return 1
        rel = destination.relative_to(ROOT).as_posix() if destination.is_relative_to(ROOT) else str(destination)
        print("Next, for Integration:")
        for command in (
            f"git add {rel}",
            f"npx tsx engine/cli/numbers.ts {rel}",
            f"npx tsx engine/cli/envelope.ts {rel}",
            "npm run check:all",
        ):
            print(f"  {command}")
        return 0
    except Exception:  # noqa: BLE001 - any crash is "could not run", and nothing was replaced
        traceback.print_exc()
        return 2


if __name__ == "__main__":
    sys.exit(run())
