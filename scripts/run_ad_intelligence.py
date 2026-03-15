"""Run ad intelligence ingestion as a standalone daily job."""

from __future__ import annotations

from _bootstrap import bootstrap_project_root

bootstrap_project_root()

from app.config import load_settings
from app.jobs.compute_scores import run_ad_intelligence_pipeline
from app.logging import configure_logging


def main() -> None:
    """Execute a single ad intelligence ingestion and re-score run."""

    configure_logging()
    settings = load_settings()
    run_ad_intelligence_pipeline(settings)


if __name__ == "__main__":
    main()
