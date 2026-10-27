"""Shared paths for Data lane scripts."""

import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RAW = Path(os.environ.get("CLEARLANE_RAW", ROOT.parent / "clearlane-raw")).resolve()
PUBLIC_DATA = ROOT / "public" / "data"
