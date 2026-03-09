"""Helpers for running scripts directly from the repository root."""

from __future__ import annotations

import sys
from pathlib import Path


def bootstrap_project_root() -> None:
    """Ensure the repository root is on sys.path for direct script execution."""

    project_root = Path(__file__).resolve().parents[1]
    if str(project_root) not in sys.path:
        sys.path.insert(0, str(project_root))
