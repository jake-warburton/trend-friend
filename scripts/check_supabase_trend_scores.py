"""Smoke test the trend score repository against Supabase/Postgres."""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from _bootstrap import bootstrap_project_root

bootstrap_project_root()

from app.config import load_settings
from app.data.postgres import connect_postgres, initialize_postgres_database
from app.data.repositories import TrendScoreRepository
from app.models import TrendScoreResult


def main() -> None:
    """Write one isolated snapshot, read it back, and remove it."""

    settings = load_settings()
    if not settings.database_url:
        raise RuntimeError("SIGNAL_EYE_DATABASE_URL is not set")

    connection = connect_postgres(settings.database_url)
    run_id: int | None = None
    try:
        initialize_postgres_database(connection)
        repository = TrendScoreRepository(connection)
        suffix = uuid4().hex[:8]
        captured_at = datetime.now(timezone.utc).replace(microsecond=0)
        scores = [
            TrendScoreResult(
                topic=f"signal-eye-smoke-alpha-{suffix}",
                total_score=91.2,
                search_score=35.0,
                social_score=21.0,
                developer_score=14.0,
                knowledge_score=11.2,
                diversity_score=10.0,
                evidence=["Smoke test alpha"],
                source_counts={"reddit": 3, "github": 1},
                latest_timestamp=captured_at,
            ),
            TrendScoreResult(
                topic=f"signal-eye-smoke-beta-{suffix}",
                total_score=73.4,
                search_score=24.0,
                social_score=18.4,
                developer_score=12.0,
                knowledge_score=9.0,
                diversity_score=10.0,
                evidence=["Smoke test beta"],
                source_counts={"google_trends": 2, "wikipedia": 1},
                latest_timestamp=captured_at,
            ),
        ]

        run_id = repository.append_snapshot(scores, captured_at)
        latest_captured_at, latest_scores = repository.list_latest_snapshot(limit=5)
        topic_history = repository.get_topic_history(scores[0].topic, limit_runs=5)

        assert latest_captured_at == captured_at, (latest_captured_at, captured_at)
        assert [score.topic for score in latest_scores[:2]] == [score.topic for score in scores]
        assert topic_history, "No history points returned for inserted topic"
        assert topic_history[0].rank == 1, topic_history[0]

        print("supabase_trend_scores:ok")
        print("run_id:", run_id)
        print("latest_snapshot_topics:", ",".join(score.topic for score in latest_scores[:2]))
        print("topic_history_points:", len(topic_history))
    finally:
        if run_id is not None:
            connection.execute("DELETE FROM trend_score_snapshots WHERE run_id = ?", (run_id,))
            connection.execute("DELETE FROM trend_runs WHERE id = ?", (run_id,))
            connection.commit()
        connection.close()


if __name__ == "__main__":
    main()
