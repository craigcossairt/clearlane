"""Deterministic atomic JSON output for committed data files."""

import json
import os
from pathlib import Path
from typing import Any


def write_json(path: Path, obj: Any) -> None:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(obj, indent=2, ensure_ascii=False, allow_nan=False) + "\n"
    tmp = path.with_suffix(path.suffix + ".tmp")
    with open(tmp, "w", encoding="utf-8", newline="\n") as stream:
        stream.write(text)
    os.replace(tmp, path)
