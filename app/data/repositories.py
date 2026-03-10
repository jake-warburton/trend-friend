"""Repository helpers for reading and writing signals and scores."""

from __future__ import annotations

import json
import sqlite3
from datetime import datetime

from app.topics.categorize import categorize_topic
from app.models import (
    AlertEventRecord,
    AlertRule,
    NormalizedSignal,
    PipelineRun,
    RelatedTrend,
    SourceIngestionRun,
    TrendDetailRecord,
    TrendEvidenceItem,
    TrendExplorerRecord,
    TrendGeoSummary,
    TrendHistoryPoint,
    TrendMomentum,
    TrendSourceBreakdown,
    TrendScoreResult,
    Watchlist,
    WatchlistItem,
    WatchlistShare,
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
            INSERT INTO signals (
                topic, source, signal_type, value, timestamp, evidence,
                geo_flags_json, geo_country_code, geo_region, geo_detection_mode, geo_confidence
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [
                (
                    signal.topic,
                    signal.source,
                    signal.signal_type,
                    signal.value,
                    signal.timestamp.isoformat(),
                    signal.evidence,
                    json.dumps(list(signal.geo_flags)),
                    signal.geo_country_code,
                    signal.geo_region,
                    signal.geo_detection_mode,
                    signal.geo_confidence,
                )
                for signal in signals
            ],
        )
        self.connection.commit()

    def list_signals(self) -> list[NormalizedSignal]:
        """Return all stored signals."""

        rows = self.connection.execute(
            """
            SELECT topic, source, signal_type, value, timestamp, evidence,
                   geo_flags_json, geo_country_code, geo_region, geo_detection_mode, geo_confidence
            FROM signals
            """
        ).fetchall()
        return [
            NormalizedSignal(
                topic=row["topic"],
                source=row["source"],
                signal_type=row["signal_type"],
                value=row["value"],
                timestamp=datetime.fromisoformat(row["timestamp"]),
                evidence=row["evidence"],
                geo_flags=tuple(json.loads(row["geo_flags_json"])),
                geo_country_code=row["geo_country_code"],
                geo_region=row["geo_region"],
                geo_detection_mode=row["geo_detection_mode"],
                geo_confidence=row["geo_confidence"],
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


class WatchlistRepository:
    """Persist and retrieve watchlists and simple alert rules."""

    def __init__(self, connection: sqlite3.Connection) -> None:
        self.connection = connection

    def ensure_default_watchlist(self, name: str = "Core Watchlist") -> Watchlist:
        """Return the default watchlist, creating it if necessary."""

        existing = self.get_watchlist_by_name(name)
        if existing is not None:
            return existing
        return self.create_watchlist(name)

    def list_watchlists(self) -> list[Watchlist]:
        """Return all watchlists with nested items."""

        rows = self.connection.execute(
            "SELECT id, name, created_at, updated_at FROM watchlists ORDER BY updated_at DESC, id DESC"
        ).fetchall()
        return [self._watchlist_from_row(row) for row in rows]

    def get_watchlist(self, watchlist_id: int) -> Watchlist | None:
        """Return a watchlist by id when present."""

        row = self.connection.execute(
            "SELECT id, name, created_at, updated_at FROM watchlists WHERE id = ?",
            (watchlist_id,),
        ).fetchone()
        if row is None:
            return None
        return self._watchlist_from_row(row)

    def get_watchlist_by_name(self, name: str) -> Watchlist | None:
        """Return a watchlist by name when present."""

        row = self.connection.execute(
            "SELECT id, name, created_at, updated_at FROM watchlists WHERE name = ?",
            (name,),
        ).fetchone()
        if row is None:
            return None
        return self._watchlist_from_row(row)

    def create_watchlist(self, name: str) -> Watchlist:
        """Create and return a watchlist."""

        self.connection.execute("INSERT INTO watchlists (name) VALUES (?)", (name,))
        self.connection.commit()
        return self.get_watchlist_by_name(name)  # type: ignore[return-value]

    def add_item(self, watchlist_id: int, trend_id: str, trend_name: str) -> Watchlist:
        """Add a trend to a watchlist and return the updated watchlist."""

        self.connection.execute(
            """
            INSERT OR IGNORE INTO watchlist_items (watchlist_id, trend_id, trend_name)
            VALUES (?, ?, ?)
            """,
            (watchlist_id, trend_id, trend_name),
        )
        self.connection.execute(
            "UPDATE watchlists SET updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            (watchlist_id,),
        )
        self.connection.commit()
        return self.get_watchlist(watchlist_id)  # type: ignore[return-value]

    def remove_item(self, watchlist_id: int, trend_id: str) -> Watchlist:
        """Remove a trend from a watchlist and return the updated watchlist."""

        self.connection.execute(
            "DELETE FROM watchlist_items WHERE watchlist_id = ? AND trend_id = ?",
            (watchlist_id, trend_id),
        )
        self.connection.execute(
            "UPDATE watchlists SET updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            (watchlist_id,),
        )
        self.connection.commit()
        return self.get_watchlist(watchlist_id)  # type: ignore[return-value]

    def list_alert_rules(self) -> list[AlertRule]:
        """Return all alert rules."""

        rows = self.connection.execute(
            """
            SELECT id, watchlist_id, name, rule_type, threshold, enabled, created_at
            FROM alert_rules
            ORDER BY created_at DESC, id DESC
            """
        ).fetchall()
        return [
            AlertRule(
                id=row["id"],
                watchlist_id=row["watchlist_id"],
                name=row["name"],
                rule_type=row["rule_type"],
                threshold=row["threshold"],
                enabled=bool(row["enabled"]),
                created_at=datetime.fromisoformat(row["created_at"]),
            )
            for row in rows
        ]

    def create_alert_rule(
        self,
        watchlist_id: int,
        name: str,
        rule_type: str,
        threshold: float,
        enabled: bool = True,
    ) -> AlertRule:
        """Create and return an alert rule."""

        cursor = self.connection.execute(
            """
            INSERT INTO alert_rules (watchlist_id, name, rule_type, threshold, enabled)
            VALUES (?, ?, ?, ?, ?)
            """,
            (watchlist_id, name, rule_type, threshold, int(enabled)),
        )
        self.connection.commit()
        row = self.connection.execute(
            """
            SELECT id, watchlist_id, name, rule_type, threshold, enabled, created_at
            FROM alert_rules
            WHERE id = ?
            """,
            (int(cursor.lastrowid),),
        ).fetchone()
        return AlertRule(
            id=row["id"],
            watchlist_id=row["watchlist_id"],
            name=row["name"],
            rule_type=row["rule_type"],
            threshold=row["threshold"],
            enabled=bool(row["enabled"]),
            created_at=datetime.fromisoformat(row["created_at"]),
        )

    def save_alert_events(self, events: list) -> None:
        """Persist triggered alert events."""

        from app.alerts.evaluate import AlertEvent

        self.connection.executemany(
            """
            INSERT INTO alert_events (
                rule_id, watchlist_id, trend_id, trend_name, rule_type,
                threshold, current_value, message, triggered_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [
                (
                    event.rule_id,
                    event.watchlist_id,
                    event.trend_id,
                    event.trend_name,
                    event.rule_type,
                    event.threshold,
                    event.current_value,
                    event.message,
                    event.triggered_at.isoformat(),
                )
                for event in events
            ],
        )
        self.connection.commit()

    def list_alert_events(self, unread_only: bool = False, limit: int = 50) -> list[AlertEventRecord]:
        """Return recent alert events, optionally filtered to unread only."""

        where_clause = "WHERE read = 0" if unread_only else ""
        rows = self.connection.execute(
            f"""
            SELECT id, rule_id, watchlist_id, trend_id, trend_name, rule_type,
                   threshold, current_value, message, triggered_at, read
            FROM alert_events
            {where_clause}
            ORDER BY triggered_at DESC, id DESC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()
        return [
            AlertEventRecord(
                id=row["id"],
                rule_id=row["rule_id"],
                watchlist_id=row["watchlist_id"],
                trend_id=row["trend_id"],
                trend_name=row["trend_name"],
                rule_type=row["rule_type"],
                threshold=row["threshold"],
                current_value=row["current_value"],
                message=row["message"],
                triggered_at=datetime.fromisoformat(row["triggered_at"]),
                read=bool(row["read"]),
            )
            for row in rows
        ]

    def mark_alerts_read(self, event_ids: list[int]) -> int:
        """Mark alert events as read. Returns the number of rows updated."""

        if not event_ids:
            return 0
        placeholders = ",".join("?" for _ in event_ids)
        cursor = self.connection.execute(
            f"UPDATE alert_events SET read = 1 WHERE id IN ({placeholders})",
            event_ids,
        )
        self.connection.commit()
        return cursor.rowcount

    def create_share(
        self,
        watchlist_id: int,
        share_token: str,
        created_by: int | None = None,
        is_public: bool = False,
    ) -> WatchlistShare:
        """Create a share link for a watchlist."""

        cursor = self.connection.execute(
            """
            INSERT INTO watchlist_shares (watchlist_id, share_token, created_by, is_public)
            VALUES (?, ?, ?, ?)
            """,
            (watchlist_id, share_token, created_by, int(is_public)),
        )
        self.connection.commit()
        return self.get_share_by_id(int(cursor.lastrowid))  # type: ignore[return-value]

    def get_share_by_id(self, share_id: int) -> WatchlistShare | None:
        """Return a share by id."""

        row = self.connection.execute(
            "SELECT id, watchlist_id, share_token, created_by, is_public, created_at FROM watchlist_shares WHERE id = ?",
            (share_id,),
        ).fetchone()
        if row is None:
            return None
        return self._share_from_row(row)

    def get_share_by_token(self, token: str) -> WatchlistShare | None:
        """Return a share by its token."""

        row = self.connection.execute(
            "SELECT id, watchlist_id, share_token, created_by, is_public, created_at FROM watchlist_shares WHERE share_token = ?",
            (token,),
        ).fetchone()
        if row is None:
            return None
        return self._share_from_row(row)

    def list_public_watchlists(self) -> list[tuple[Watchlist, WatchlistShare]]:
        """Return all watchlists that have a public share link."""

        rows = self.connection.execute(
            """
            SELECT ws.id, ws.watchlist_id, ws.share_token, ws.created_by, ws.is_public, ws.created_at
            FROM watchlist_shares ws
            WHERE ws.is_public = 1
            ORDER BY ws.created_at DESC
            """
        ).fetchall()
        results: list[tuple[Watchlist, WatchlistShare]] = []
        for row in rows:
            share = self._share_from_row(row)
            watchlist = self.get_watchlist(share.watchlist_id)
            if watchlist is not None:
                results.append((watchlist, share))
        return results

    def list_shares_for_watchlist(self, watchlist_id: int) -> list[WatchlistShare]:
        """Return all share links for a watchlist."""

        rows = self.connection.execute(
            """
            SELECT id, watchlist_id, share_token, created_by, is_public, created_at
            FROM watchlist_shares
            WHERE watchlist_id = ?
            ORDER BY created_at DESC
            """,
            (watchlist_id,),
        ).fetchall()
        return [self._share_from_row(row) for row in rows]

    @staticmethod
    def _share_from_row(row: sqlite3.Row) -> WatchlistShare:
        return WatchlistShare(
            id=row["id"],
            watchlist_id=row["watchlist_id"],
            share_token=row["share_token"],
            created_by=row["created_by"],
            is_public=bool(row["is_public"]),
            created_at=datetime.fromisoformat(row["created_at"]),
        )

    def get_watchlist_trend_ids(self) -> dict[int, set[str]]:
        """Return a mapping of watchlist_id -> set of trend_ids."""

        rows = self.connection.execute(
            "SELECT watchlist_id, trend_id FROM watchlist_items"
        ).fetchall()
        result: dict[int, set[str]] = {}
        for row in rows:
            result.setdefault(row["watchlist_id"], set()).add(row["trend_id"])
        return result

    def _watchlist_from_row(self, row: sqlite3.Row) -> Watchlist:
        """Build a watchlist model with nested items."""

        item_rows = self.connection.execute(
            """
            SELECT trend_id, trend_name, added_at
            FROM watchlist_items
            WHERE watchlist_id = ?
            ORDER BY added_at DESC, id DESC
            """,
            (row["id"],),
        ).fetchall()
        return Watchlist(
            id=row["id"],
            name=row["name"],
            created_at=datetime.fromisoformat(row["created_at"]),
            updated_at=datetime.fromisoformat(row["updated_at"]),
            items=[
                WatchlistItem(
                    trend_id=item["trend_id"],
                    trend_name=item["trend_name"],
                    added_at=datetime.fromisoformat(item["added_at"]),
                )
                for item in item_rows
            ],
        )


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
                    category=self._build_category(score.topic, score.source_counts),
                    status=self._build_trend_status(momentum),
                    volatility=self._build_volatility_label(momentum),
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
                    category=self._build_category(score.topic, score.source_counts),
                    status=self._build_trend_status(momentum),
                    volatility=self._build_volatility_label(momentum),
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
                    geo_summary=self.get_topic_geo_summary(score.topic),
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
            SELECT source, signal_type, timestamp, value, evidence,
                   geo_flags_json, geo_country_code, geo_region, geo_detection_mode, geo_confidence
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
                geo_flags=tuple(json.loads(row["geo_flags_json"])),
                geo_country_code=row["geo_country_code"],
                geo_region=row["geo_region"],
                geo_detection_mode=row["geo_detection_mode"],
                geo_confidence=row["geo_confidence"],
            )
            for row in rows
        ]

    def get_topic_geo_summary(self, topic: str, limit: int = 5) -> list[TrendGeoSummary]:
        """Return aggregated location coverage for a topic."""

        rows = self.connection.execute(
            """
            SELECT
                COALESCE(geo_region, geo_country_code) AS geo_label,
                geo_country_code,
                geo_region,
                COUNT(*) AS signal_count,
                SUM(CASE WHEN geo_detection_mode = 'explicit' THEN 1 ELSE 0 END) AS explicit_count,
                SUM(CASE WHEN geo_detection_mode = 'inferred' THEN 1 ELSE 0 END) AS inferred_count,
                AVG(geo_confidence) AS average_confidence
            FROM signals
            WHERE topic = ?
              AND (geo_country_code IS NOT NULL OR geo_region IS NOT NULL)
            GROUP BY geo_country_code, geo_region
            ORDER BY signal_count DESC, average_confidence DESC, geo_label ASC
            LIMIT ?
            """,
            (topic, limit),
        ).fetchall()
        return [
            TrendGeoSummary(
                label=row["geo_label"],
                country_code=row["geo_country_code"],
                region=row["geo_region"],
                signal_count=row["signal_count"],
                explicit_count=row["explicit_count"],
                inferred_count=row["inferred_count"],
                average_confidence=round(row["average_confidence"] or 0.0, 2),
            )
            for row in rows
            if row["geo_label"]
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
    def _build_volatility_label(momentum: TrendMomentum) -> str:
        """Return a compact stability label for the current movement profile."""

        rank_change = abs(momentum.rank_change or 0)
        percent_delta = abs(momentum.percent_delta or 0)
        if momentum.previous_rank is None:
            return "emerging"
        if rank_change >= 5 or percent_delta >= 40:
            return "spiking"
        if rank_change >= 2 or percent_delta >= 15:
            return "volatile"
        return "stable"

    @staticmethod
    def _build_category(topic: str, source_counts: dict[str, int]) -> str:
        """Assign a product-facing category to a trend."""

        return categorize_topic(topic, source_counts)

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
                category=record.category,
                status=record.status,
                volatility=record.volatility,
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
                geo_summary=record.geo_summary,
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
