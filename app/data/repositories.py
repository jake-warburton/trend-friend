"""Repository helpers for reading and writing signals and scores."""

from __future__ import annotations

import json
import sqlite3
from datetime import datetime

from app.models import (
    NormalizedSignal,
    PipelineRun,
    RelatedTrend,
    SourceIngestionRun,
    TrendDetailRecord,
    TrendEvidenceItem,
    TrendExplorerRecord,
    TrendHistoryPoint,
    TrendMomentum,
    TrendSourceBreakdown,
    TrendScoreResult,
)


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


class SourceIngestionRunRepository:
    """Persist and retrieve source ingestion outcomes."""

    def __init__(self, connection: sqlite3.Connection) -> None:
        self.connection = connection

    def append_runs(self, runs: list[SourceIngestionRun]) -> None:
        """Persist source ingestion results for a pipeline run."""

        self.connection.executemany(
            """
            INSERT INTO source_ingestion_runs (
                source, fetched_at, success, item_count, duration_ms, used_fallback, error_message
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            [
                (
                    run.source,
                    run.fetched_at.isoformat(),
                    int(run.success),
                    run.item_count,
                    run.duration_ms,
                    int(run.used_fallback),
                    run.error_message,
                )
                for run in runs
            ],
        )
        self.connection.commit()

    def list_latest_runs(self) -> list[SourceIngestionRun]:
        """Return the most recent ingestion result for each source."""

        rows = self.connection.execute(
            """
            SELECT current.source, current.fetched_at, current.success, current.item_count,
                   current.duration_ms, current.used_fallback, current.error_message
            FROM source_ingestion_runs AS current
            INNER JOIN (
                SELECT source, MAX(fetched_at) AS fetched_at
                FROM source_ingestion_runs
                GROUP BY source
            ) AS latest
                ON latest.source = current.source
               AND latest.fetched_at = current.fetched_at
            ORDER BY current.source ASC
            """
        ).fetchall()
        return [
            SourceIngestionRun(
                source=row["source"],
                fetched_at=datetime.fromisoformat(row["fetched_at"]),
                success=bool(row["success"]),
                item_count=row["item_count"],
                duration_ms=row["duration_ms"],
                used_fallback=bool(row["used_fallback"]),
                error_message=row["error_message"],
            )
            for row in rows
        ]

    def list_recent_runs(self, limit_per_source: int) -> dict[str, list[SourceIngestionRun]]:
        """Return recent ingestion results for each source ordered newest first."""

        rows = self.connection.execute(
            """
            SELECT source, fetched_at, success, item_count, duration_ms, used_fallback, error_message
            FROM source_ingestion_runs
            ORDER BY fetched_at DESC, id DESC
            """
        ).fetchall()
        grouped: dict[str, list[SourceIngestionRun]] = {}
        for row in rows:
            source = row["source"]
            runs = grouped.setdefault(source, [])
            if len(runs) >= limit_per_source:
                continue
            runs.append(
                SourceIngestionRun(
                    source=source,
                    fetched_at=datetime.fromisoformat(row["fetched_at"]),
                    success=bool(row["success"]),
                    item_count=row["item_count"],
                    duration_ms=row["duration_ms"],
                    used_fallback=bool(row["used_fallback"]),
                    error_message=row["error_message"],
                )
            )
        return grouped


class PipelineRunRepository:
    """Persist and retrieve full pipeline execution summaries."""

    def __init__(self, connection: sqlite3.Connection) -> None:
        self.connection = connection

    def append_run(self, run: PipelineRun) -> None:
        """Persist one pipeline execution summary."""

        self.connection.execute(
            """
            INSERT INTO pipeline_runs (
                captured_at,
                duration_ms,
                source_count,
                successful_source_count,
                failed_source_count,
                signal_count,
                ranked_trend_count,
                top_topic,
                top_score
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                run.captured_at.isoformat(),
                run.duration_ms,
                run.source_count,
                run.successful_source_count,
                run.failed_source_count,
                run.signal_count,
                run.ranked_trend_count,
                run.top_topic,
                run.top_score,
            ),
        )
        self.connection.commit()

    def list_recent_runs(self, limit: int) -> list[PipelineRun]:
        """Return recent pipeline execution summaries ordered newest first."""

        rows = self.connection.execute(
            """
            SELECT captured_at, duration_ms, source_count, successful_source_count,
                   failed_source_count, signal_count, ranked_trend_count, top_topic, top_score
            FROM pipeline_runs
            ORDER BY captured_at DESC, id DESC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()
        return [
            PipelineRun(
                captured_at=datetime.fromisoformat(row["captured_at"]),
                duration_ms=row["duration_ms"],
                source_count=row["source_count"],
                successful_source_count=row["successful_source_count"],
                failed_source_count=row["failed_source_count"],
                signal_count=row["signal_count"],
                ranked_trend_count=row["ranked_trend_count"],
                top_topic=row["top_topic"],
                top_score=row["top_score"],
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

    def append_snapshot(self, scores: list[TrendScoreResult], captured_at: datetime) -> int:
        """Persist a timestamped ranked snapshot for historical views."""

        cursor = self.connection.execute(
            "INSERT INTO trend_runs (captured_at) VALUES (?)",
            (captured_at.isoformat(),),
        )
        run_id = int(cursor.lastrowid)
        self.connection.executemany(
            """
            INSERT INTO trend_score_snapshots (
                run_id, rank_position, topic, total_score, search_score, social_score, developer_score,
                knowledge_score, diversity_score, source_counts_json, evidence_json, latest_timestamp
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [
                (
                    run_id,
                    rank_position,
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
                for rank_position, score in enumerate(scores, start=1)
            ],
        )
        self.connection.commit()
        return run_id

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
            self._score_from_row(row) for row in rows
        ]

    def list_latest_snapshot(self, limit: int) -> tuple[datetime | None, list[TrendScoreResult]]:
        """Return the most recent stored snapshot and its capture time."""

        run_row = self.connection.execute(
            "SELECT id, captured_at FROM trend_runs ORDER BY captured_at DESC, id DESC LIMIT 1"
        ).fetchone()
        if run_row is None:
            return None, []
        rows = self.connection.execute(
            """
            SELECT topic, total_score, search_score, social_score, developer_score,
                   knowledge_score, diversity_score, source_counts_json, evidence_json, latest_timestamp
            FROM trend_score_snapshots
            WHERE run_id = ?
            ORDER BY rank_position ASC
            LIMIT ?
            """,
            (run_row["id"], limit),
        ).fetchall()
        return datetime.fromisoformat(run_row["captured_at"]), [self._score_from_row(row) for row in rows]

    def list_score_history(
        self,
        limit_runs: int,
        per_run_limit: int,
    ) -> list[tuple[datetime, list[TrendScoreResult]]]:
        """Return recent ranked snapshots ordered from newest to oldest."""

        run_rows = self.connection.execute(
            "SELECT id, captured_at FROM trend_runs ORDER BY captured_at DESC, id DESC LIMIT ?",
            (limit_runs,),
        ).fetchall()
        history: list[tuple[datetime, list[TrendScoreResult]]] = []
        for run_row in run_rows:
            score_rows = self.connection.execute(
                """
                SELECT topic, total_score, search_score, social_score, developer_score,
                       knowledge_score, diversity_score, source_counts_json, evidence_json, latest_timestamp
                FROM trend_score_snapshots
                WHERE run_id = ?
                ORDER BY rank_position ASC
                LIMIT ?
                """,
                (run_row["id"], per_run_limit),
            ).fetchall()
            history.append(
                (
                    datetime.fromisoformat(run_row["captured_at"]),
                    [self._score_from_row(row) for row in score_rows],
                )
            )
        return history

    def get_topic_history(self, topic: str, limit_runs: int) -> list[TrendHistoryPoint]:
        """Return recent history points for a single topic ordered newest first."""

        rows = self.connection.execute(
            """
            SELECT trend_runs.captured_at, trend_score_snapshots.rank_position, trend_score_snapshots.total_score
            FROM trend_score_snapshots
            INNER JOIN trend_runs ON trend_runs.id = trend_score_snapshots.run_id
            WHERE trend_score_snapshots.topic = ?
            ORDER BY trend_runs.captured_at DESC, trend_runs.id DESC
            LIMIT ?
            """,
            (topic, limit_runs),
        ).fetchall()
        return [
            TrendHistoryPoint(
                captured_at=datetime.fromisoformat(row["captured_at"]),
                rank=row["rank_position"],
                score_total=row["total_score"],
            )
            for row in rows
        ]

    def get_first_seen_at(self, topic: str) -> datetime | None:
        """Return the first captured run timestamp for a topic."""

        row = self.connection.execute(
            """
            SELECT trend_runs.captured_at
            FROM trend_score_snapshots
            INNER JOIN trend_runs ON trend_runs.id = trend_score_snapshots.run_id
            WHERE trend_score_snapshots.topic = ?
            ORDER BY trend_runs.captured_at ASC, trend_runs.id ASC
            LIMIT 1
            """,
            (topic,),
        ).fetchone()
        if row is None:
            return None
        return datetime.fromisoformat(row["captured_at"])

    def list_trend_explorer_records(self, limit: int, history_limit: int = 2) -> list[TrendExplorerRecord]:
        """Return explorer-ready records with movement fields derived from snapshots."""

        latest_captured_at, latest_scores = self.list_latest_snapshot(limit=limit)
        if latest_captured_at is None:
            return []

        records: list[TrendExplorerRecord] = []
        for rank, score in enumerate(latest_scores, start=1):
            history = self.get_topic_history(score.topic, limit_runs=history_limit)
            momentum = self._build_momentum(score.total_score, history)
            records.append(
                TrendExplorerRecord(
                    id=self._slugify_topic(score.topic),
                    name=self._format_trend_name(score.topic),
                    status=self._build_trend_status(momentum),
                    rank=rank,
                    previous_rank=momentum.previous_rank,
                    rank_change=momentum.rank_change,
                    first_seen_at=self.get_first_seen_at(score.topic),
                    latest_signal_at=score.latest_timestamp,
                    score=score,
                    momentum=momentum,
                    source_count=len(score.source_counts),
                    signal_count=sum(score.source_counts.values()),
                )
            )
        return records

    def list_trend_detail_records(
        self,
        limit: int,
        history_limit: int = 8,
        evidence_limit: int = 8,
    ) -> list[TrendDetailRecord]:
        """Return detail-ready records for the latest ranked topics."""

        latest_captured_at, latest_scores = self.list_latest_snapshot(limit=limit)
        if latest_captured_at is None:
            return []

        records: list[TrendDetailRecord] = []
        for rank, score in enumerate(latest_scores, start=1):
            history = list(reversed(self.get_topic_history(score.topic, limit_runs=history_limit)))
            momentum = self._build_momentum(score.total_score, list(reversed(history)))
            records.append(
                TrendDetailRecord(
                    id=self._slugify_topic(score.topic),
                    name=self._format_trend_name(score.topic),
                    status=self._build_trend_status(momentum),
                    rank=rank,
                    previous_rank=momentum.previous_rank,
                    rank_change=momentum.rank_change,
                    first_seen_at=self.get_first_seen_at(score.topic),
                    latest_signal_at=score.latest_timestamp,
                    score=score,
                    momentum=momentum,
                    source_count=len(score.source_counts),
                    signal_count=sum(score.source_counts.values()),
                    sources=sorted(score.source_counts),
                    history=history,
                    source_breakdown=self.get_topic_source_breakdown(score.topic),
                    evidence_items=self.get_topic_evidence(score.topic, limit=evidence_limit),
                    related_trends=[],
                )
            )
        return self._attach_related_trends(records)

    def get_topic_source_breakdown(self, topic: str) -> list[TrendSourceBreakdown]:
        """Return source-level signal coverage for a topic."""

        rows = self.connection.execute(
            """
            SELECT source, COUNT(*) AS signal_count, MAX(timestamp) AS latest_signal_at
            FROM signals
            WHERE topic = ?
            GROUP BY source
            ORDER BY signal_count DESC, source ASC
            """,
            (topic,),
        ).fetchall()
        return [
            TrendSourceBreakdown(
                source=row["source"],
                signal_count=row["signal_count"],
                latest_signal_at=datetime.fromisoformat(row["latest_signal_at"]),
            )
            for row in rows
        ]

    def get_topic_evidence(self, topic: str, limit: int) -> list[TrendEvidenceItem]:
        """Return recent evidence items for a topic ordered newest first."""

        rows = self.connection.execute(
            """
            SELECT source, signal_type, timestamp, value, evidence
            FROM signals
            WHERE topic = ?
            ORDER BY timestamp DESC, id DESC
            LIMIT ?
            """,
            (topic, limit),
        ).fetchall()
        return [
            TrendEvidenceItem(
                source=row["source"],
                signal_type=row["signal_type"],
                timestamp=datetime.fromisoformat(row["timestamp"]),
                value=row["value"],
                evidence=row["evidence"],
            )
            for row in rows
        ]

    @staticmethod
    def _score_from_row(row: sqlite3.Row) -> TrendScoreResult:
        """Build a score model from a SQLite row."""

        return TrendScoreResult(
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

    @staticmethod
    def _build_momentum(latest_total_score: float, history: list[TrendHistoryPoint]) -> TrendMomentum:
        """Build movement metrics from the two newest historical points."""

        ordered_history = sorted(history, key=lambda point: point.captured_at, reverse=True)
        previous = ordered_history[1] if len(ordered_history) > 1 else None
        absolute_delta = None
        percent_delta = None
        if previous is not None:
            absolute_delta = round(latest_total_score - previous.score_total, 1)
            if previous.score_total != 0:
                percent_delta = round((absolute_delta / previous.score_total) * 100, 1)

        return TrendMomentum(
            previous_rank=previous.rank if previous is not None else None,
            rank_change=(previous.rank - ordered_history[0].rank) if previous is not None else None,
            absolute_delta=absolute_delta,
            percent_delta=percent_delta,
        )

    @staticmethod
    def _build_trend_status(momentum: TrendMomentum) -> str:
        """Return a compact product-facing label for current movement state."""

        if momentum.previous_rank is None:
            return "new"
        if (momentum.rank_change or 0) >= 3 or (momentum.percent_delta or 0) >= 25:
            return "breakout"
        if (momentum.rank_change or 0) > 0 or (momentum.percent_delta or 0) > 0:
            return "rising"
        if (momentum.rank_change or 0) < 0 or (momentum.percent_delta or 0) < 0:
            return "cooling"
        return "steady"

    @staticmethod
    def _slugify_topic(topic: str) -> str:
        """Convert a topic to a stable slug identifier."""

        normalized = "".join(character.lower() if character.isalnum() else "-" for character in topic)
        compact = "-".join(part for part in normalized.split("-") if part)
        return compact or "trend"

    @staticmethod
    def _format_trend_name(topic: str) -> str:
        """Return a display-friendly topic name."""

        return " ".join(part.upper() if len(part) <= 3 else part.capitalize() for part in topic.split())

    def _attach_related_trends(self, records: list[TrendDetailRecord]) -> list[TrendDetailRecord]:
        """Attach compact related-trend recommendations to each detail record."""

        if not records:
            return []

        related_map: dict[str, list[RelatedTrend]] = {}
        for current in records:
            candidates: list[tuple[int, TrendDetailRecord]] = []
            current_tokens = self._topic_tokens(current.name)
            current_sources = set(current.sources)
            for candidate in records:
                if candidate.id == current.id:
                    continue
                score = 0
                if current_sources.intersection(candidate.sources):
                    score += 2
                if current.status == candidate.status:
                    score += 1
                if current_tokens.intersection(self._topic_tokens(candidate.name)):
                    score += 2
                if score > 0:
                    candidates.append((score, candidate))

            candidates.sort(key=lambda item: (-item[0], item[1].rank, -item[1].score.total_score, item[1].name))
            related_map[current.id] = [
                RelatedTrend(
                    id=item.id,
                    name=item.name,
                    status=item.status,
                    rank=item.rank,
                    score_total=item.score.total_score,
                )
                for _, item in candidates[:4]
            ]

        return [
            TrendDetailRecord(
                id=record.id,
                name=record.name,
                status=record.status,
                rank=record.rank,
                previous_rank=record.previous_rank,
                rank_change=record.rank_change,
                first_seen_at=record.first_seen_at,
                latest_signal_at=record.latest_signal_at,
                score=record.score,
                momentum=record.momentum,
                source_count=record.source_count,
                signal_count=record.signal_count,
                sources=record.sources,
                history=record.history,
                source_breakdown=record.source_breakdown,
                evidence_items=record.evidence_items,
                related_trends=related_map.get(record.id, []),
            )
            for record in records
        ]

    @staticmethod
    def _topic_tokens(value: str) -> set[str]:
        """Return simple normalized tokens for related-trend matching."""

        return {
            token
            for token in "".join(character.lower() if character.isalnum() else " " for character in value).split()
            if len(token) > 2
        }
