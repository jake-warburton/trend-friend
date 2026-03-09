"""Render the latest ranked trends from the database."""

from __future__ import annotations

from _bootstrap import bootstrap_project_root

bootstrap_project_root()

from app.config import load_settings
from app.data.database import connect_database, initialize_database
from app.data.repositories import TrendScoreRepository
from app.logging import configure_logging
from app.ui.dashboard import render_dashboard


def main() -> None:
    """Print the latest stored trend ranking."""

    configure_logging()
    settings = load_settings()
    connection = connect_database(settings.database_path)
    initialize_database(connection)
    scores = TrendScoreRepository(connection).list_scores(limit=settings.ranking_limit)
    connection.close()
    print(render_dashboard(scores))


if __name__ == "__main__":
    main()
