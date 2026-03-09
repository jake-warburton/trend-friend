"""Convenience entrypoint for running the full MVP pipeline and dashboard."""

from __future__ import annotations

from app.config import load_settings
from app.jobs.compute_scores import run_trend_pipeline
from app.logging import configure_logging
from app.ui.dashboard import render_dashboard


def main() -> None:
    """Run ingestion, scoring, and print the dashboard."""

    configure_logging()
    settings = load_settings()
    ranked_scores = run_trend_pipeline(settings)
    print(render_dashboard(ranked_scores))


if __name__ == "__main__":
    main()
