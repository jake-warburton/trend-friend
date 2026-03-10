"""Tests for the scheduler health file and configuration."""

from __future__ import annotations

import json
from pathlib import Path

from app.config import load_settings


def test_health_file_write(tmp_path: Path) -> None:
    """write_health_file creates valid JSON with expected fields."""

    import sys
    sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
    from run_scheduler import write_health_file

    health_path = tmp_path / "last_run.json"
    write_health_file(health_path, status="ok", duration_ms=1234)

    payload = json.loads(health_path.read_text(encoding="utf-8"))
    assert payload["status"] == "ok"
    assert payload["durationMs"] == 1234
    assert "timestamp" in payload
    assert "error" not in payload


def test_health_file_write_with_error(tmp_path: Path) -> None:
    """write_health_file includes error field when provided."""

    import sys
    sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
    from run_scheduler import write_health_file

    health_path = tmp_path / "last_run.json"
    write_health_file(health_path, status="error", duration_ms=500, error="boom")

    payload = json.loads(health_path.read_text(encoding="utf-8"))
    assert payload["status"] == "error"
    assert payload["error"] == "boom"


def test_poll_interval_default() -> None:
    """Default poll interval should be 30 minutes."""

    settings = load_settings()
    assert settings.poll_interval_minutes == 30


def test_health_file_creates_parent_dirs(tmp_path: Path) -> None:
    """write_health_file creates parent directories if they don't exist."""

    import sys
    sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
    from run_scheduler import write_health_file

    health_path = tmp_path / "nested" / "dir" / "last_run.json"
    write_health_file(health_path, status="ok", duration_ms=0)
    assert health_path.exists()
