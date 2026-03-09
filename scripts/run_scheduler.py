"""Run the ingestion pipeline on a fixed interval."""

from __future__ import annotations

import time

from app.config import load_settings
from app.jobs.compute_scores import run_trend_pipeline
from app.logging import configure_logging


def main() -> None:
    """Run the ingestion pipeline every 30 minutes."""

    configure_logging()
    settings = load_settings()
    while True:
        run_trend_pipeline(settings)
        time.sleep(30 * 60)


if __name__ == "__main__":
    main()
