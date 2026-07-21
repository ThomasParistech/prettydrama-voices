"""Bits shared by every Action script: repo paths and JSON writing."""

import json
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent


def write_json(path: Path, data, sort_keys: bool = False) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(data, ensure_ascii=False, indent=2, sort_keys=sort_keys) + "\n",
        encoding="utf-8",
    )
