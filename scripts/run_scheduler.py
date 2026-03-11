"""Run the ingestion pipeline and web export on a configurable interval.

Supports graceful shutdown via SIGTERM/SIGINT and writes a health file
after each run so the web dashboard can display freshness information.
"""

from __future__ import annotations

import json
import logging
import signal
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from time import perf_counter

from _bootstrap import bootstrap_project_root

bootstrap_project_root()

from app.config import load_settings, Settings
from app.jobs.compute_scores import run_trend_pipeline
from app.logging import configure_logging

LOGGER = logging.getLogger(__name__)

_shutdown_requested = False


def request_shutdown(signum: int, _frame: object) -> None:
    """Mark that a graceful shutdown has been requested."""

    global _shutdown_requested
    _shutdown_requested = True
    LOGGER.info("Shutdown requested (signal %s), finishing current run...", signum)


def write_health_file(path: Path, status: str, duration_ms: int, error: str | None = None) -> None:
    """Write a JSON health file after each pipeline run."""

    path.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "timestamp": datetime.now(tz=timezone.utc).isoformat().replace("+00:00", "Z"),
        "status": status,
        "durationMs": duration_ms,
    }
    if error is not None:
        payload["error"] = error
    path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


def run_pipeline_with_export(settings: Settings) -> None:
    """Execute the full pipeline and then export web data."""

    started_at = perf_counter()
    try:
        run_trend_pipeline(settings)
        export_web_data(settings)
        duration_ms = round((perf_counter() - started_at) * 1000)
        write_health_file(settings.health_file_path, status="ok", duration_ms=duration_ms)
        LOGGER.info("Pipeline run completed in %dms", duration_ms)
    except Exception as error:
        duration_ms = round((perf_counter() - started_at) * 1000)
        write_health_file(settings.health_file_path, status="error", duration_ms=duration_ms, error=str(error))
        LOGGER.exception("Pipeline run failed after %dms: %s", duration_ms, error)


def export_web_data(settings: Settings) -> None:
    """Re-export all web-facing JSON payloads from stored data."""

    from app.exports.web_data import export_web_data_payloads

    export_web_data_payloads(settings)


def main() -> None:
    """Run the pipeline on a fixed interval until shutdown is requested."""

    configure_logging()
    settings = load_settings()
    interval_seconds = settings.poll_interval_minutes * 60

    signal.signal(signal.SIGTERM, request_shutdown)
    signal.signal(signal.SIGINT, request_shutdown)

    LOGGER.info(
        "Scheduler starting — poll interval: %d minutes",
        settings.poll_interval_minutes,
    )

    while not _shutdown_requested:
        run_pipeline_with_export(settings)
        if _shutdown_requested:
            break
        LOGGER.info("Next run in %d minutes", settings.poll_interval_minutes)
        sleep_with_check(interval_seconds)

    LOGGER.info("Scheduler stopped")


def sleep_with_check(total_seconds: int, check_interval: int = 5) -> None:
    """Sleep in small increments so shutdown signals are handled promptly."""

    elapsed = 0
    while elapsed < total_seconds and not _shutdown_requested:
        time.sleep(min(check_interval, total_seconds - elapsed))
        elapsed += check_interval


if __name__ == "__main__":
    main()
