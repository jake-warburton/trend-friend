"""Repository helpers for reading and writing signals and scores."""

from __future__ import annotations

import json
import sqlite3
from datetime import datetime

from app.models import NormalizedSignal, TrendScoreResult


class SignalRepository:
    """Persist normalized topic signals."""

    def __init__(self, connection: sqlite3.Connection) -> None:
        self.connection = connection

    def replace_signals(self, signals: list[NormalizedSignal]) -> None:
        """Replace stored signals with the latest ingestion run."""

        self.connection.execute("DELETE FROM signals")
        self.connection.executemany(
            """
            INSERT INTO signals (topic, source, signal_type, value, timestamp, evidence)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            [
                (
                    signal.topic,
                    signal.source,
                    signal.signal_type,
                    signal.value,
                    signal.timestamp.isoformat(),
                    signal.evidence,
                )
                for signal in signals
            ],
        )
        self.connection.commit()

    def list_signals(self) -> list[NormalizedSignal]:
        """Return all stored signals."""

        rows = self.connection.execute(
            "SELECT topic, source, signal_type, value, timestamp, evidence FROM signals"
        ).fetchall()
        return [
            NormalizedSignal(
                topic=row["topic"],
                source=row["source"],
                signal_type=row["signal_type"],
                value=row["value"],
                timestamp=datetime.fromisoformat(row["timestamp"]),
                evidence=row["evidence"],
            )
            for row in rows
        ]


class TrendScoreRepository:
    """Persist and retrieve ranked trend scores."""

    def __init__(self, connection: sqlite3.Connection) -> None:
        self.connection = connection

    def replace_scores(self, scores: list[TrendScoreResult]) -> None:
        """Replace stored scores with the latest ranking run."""

        self.connection.execute("DELETE FROM trend_scores")
        self.connection.executemany(
            """
            INSERT INTO trend_scores (
                topic, total_score, search_score, social_score, developer_score,
                knowledge_score, diversity_score, source_counts_json, evidence_json, latest_timestamp
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [
                (
                    score.topic,
                    score.total_score,
                    score.search_score,
                    score.social_score,
                    score.developer_score,
                    score.knowledge_score,
                    score.diversity_score,
                    json.dumps(score.source_counts, sort_keys=True),
                    json.dumps(score.evidence),
                    score.latest_timestamp.isoformat(),
                )
                for score in scores
            ],
        )
        self.connection.commit()

    def list_scores(self, limit: int) -> list[TrendScoreResult]:
        """Return ranked scores from persistent storage."""

        rows = self.connection.execute(
            """
            SELECT topic, total_score, search_score, social_score, developer_score,
                   knowledge_score, diversity_score, source_counts_json, evidence_json, latest_timestamp
            FROM trend_scores
            ORDER BY total_score DESC, topic ASC, latest_timestamp ASC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()
        return [
            TrendScoreResult(
                topic=row["topic"],
                total_score=row["total_score"],
                search_score=row["search_score"],
                social_score=row["social_score"],
                developer_score=row["developer_score"],
                knowledge_score=row["knowledge_score"],
                diversity_score=row["diversity_score"],
                source_counts=json.loads(row["source_counts_json"]),
                evidence=json.loads(row["evidence_json"]),
                latest_timestamp=datetime.fromisoformat(row["latest_timestamp"]),
            )
            for row in rows
        ]
