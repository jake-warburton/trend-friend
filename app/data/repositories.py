"""Repository helpers for reading and writing signals and scores."""

from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from typing import Any, Mapping

from app.data.connection import DatabaseConnection
from app.data.write_helpers import execute_insert_and_return_id
from app.topics.categorize import categorize_topic
from app.topics.display import build_display_name
from app.models import (
    AlertEventRecord,
    AlertRule,
    BreakoutPredictionSummary,
    TrendAudienceSegment,
    NotificationChannel,
    NotificationLogEntry,
    NormalizedSignal,
    OpportunitySummary,
    PipelineRun,
    RelatedTrend,
    RunDigest,
    SeasonalityResult,
    SourceIngestionRun,
    TrendDetailRecord,
    DigestMover,
    TrendEvidenceItem,
    TrendForecast,
    TrendExplorerRecord,
    TrendGeoSummary,
    TrendHistoryPoint,
    TrendMomentum,
    TrendPrimaryEvidence,
    TrendSourceContribution,
    TrendSourceBreakdown,
    TrendScoreResult,
    Watchlist,
    WatchlistShareAccessPoint,
    WatchlistItem,
    WatchlistShareEvent,
    WatchlistShare,
)

RowMapping = Mapping[str, Any]


def sql_placeholders(connection: DatabaseConnection, count: int) -> str:
    """Return a positional placeholder list for the current connection dialect.

    Centralizing this keeps repository logic independent from one concrete
    database engine.
    """

    return connection.dialect.placeholders(count)


class SignalRepository:
    """Persist normalized topic signals."""

    def __init__(self, connection: DatabaseConnection) -> None:
        self.connection = connection

    def replace_signals(self, signals: list[NormalizedSignal]) -> None:
        """Replace stored signals with the latest ingestion run."""

        self.connection.execute("DELETE FROM signals")
        self.connection.executemany(
            """
            INSERT INTO signals (
                topic, source, signal_type, value, timestamp, evidence,
                evidence_url, language_code, audience_flags_json, market_flags_json,
                geo_flags_json, geo_country_code, geo_region, geo_detection_mode, geo_confidence
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [
                (
                    signal.topic,
                    signal.source,
                    signal.signal_type,
                    signal.value,
                    signal.timestamp.isoformat(),
                    signal.evidence,
                    signal.evidence_url,
                    signal.language_code,
                    json.dumps(list(signal.audience_flags)),
                    json.dumps(list(signal.market_flags)),
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
                   evidence_url, language_code, audience_flags_json, market_flags_json,
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
                evidence_url=row["evidence_url"],
                language_code=row["language_code"],
                audience_flags=tuple(json.loads(row["audience_flags_json"])),
                market_flags=tuple(json.loads(row["market_flags_json"])),
                geo_flags=tuple(json.loads(row["geo_flags_json"])),
                geo_country_code=row["geo_country_code"],
                geo_region=row["geo_region"],
                geo_detection_mode=row["geo_detection_mode"],
                geo_confidence=row["geo_confidence"],
            )
            for row in rows
        ]


class PublishedPayloadRepository:
    """Persist prebuilt web payloads for frontend reads."""

    def __init__(self, connection: DatabaseConnection) -> None:
        self.connection = connection

    def replace_payloads(self, payloads: list[tuple[str, str, str]]) -> None:
        """Upsert one JSON payload row per payload key."""

        self.connection.executemany(
            """
            INSERT INTO published_payloads (payload_key, generated_at, payload_json)
            VALUES (?, ?, ?)
            ON CONFLICT(payload_key)
            DO UPDATE SET
                generated_at = excluded.generated_at,
                payload_json = excluded.payload_json,
                updated_at = CURRENT_TIMESTAMP
            """,
            payloads,
        )
        self.connection.commit()


class SourceIngestionRunRepository:
    """Persist and retrieve source ingestion outcomes."""

    def __init__(self, connection: DatabaseConnection) -> None:
        self.connection = connection

    def append_runs(self, runs: list[SourceIngestionRun]) -> None:
        """Persist source ingestion results for a pipeline run."""

        self.connection.executemany(
            """
            INSERT INTO source_ingestion_runs (
                source, fetched_at, success, raw_item_count, item_count, kept_item_count, duration_ms,
                raw_topic_count, merged_topic_count, duplicate_topic_count, duplicate_topic_rate,
                used_fallback, error_message
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [
                (
                    run.source,
                    run.fetched_at.isoformat(),
                    int(run.success),
                    run.raw_item_count,
                    run.item_count,
                    run.kept_item_count,
                    run.duration_ms,
                    run.raw_topic_count,
                    run.merged_topic_count,
                    run.duplicate_topic_count,
                    run.duplicate_topic_rate,
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
            SELECT current.source, current.fetched_at, current.success, current.raw_item_count, current.item_count,
                   current.kept_item_count, current.duration_ms, current.raw_topic_count, current.merged_topic_count,
                   current.duplicate_topic_count, current.duplicate_topic_rate, current.used_fallback, current.error_message
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
                raw_item_count=row["raw_item_count"],
                item_count=row["item_count"],
                kept_item_count=row["kept_item_count"],
                duration_ms=row["duration_ms"],
                raw_topic_count=row["raw_topic_count"],
                merged_topic_count=row["merged_topic_count"],
                duplicate_topic_count=row["duplicate_topic_count"],
                duplicate_topic_rate=row["duplicate_topic_rate"],
                used_fallback=bool(row["used_fallback"]),
                error_message=row["error_message"],
            )
            for row in rows
        ]

    def list_recent_runs(self, limit_per_source: int) -> dict[str, list[SourceIngestionRun]]:
        """Return recent ingestion results for each source ordered newest first."""

        rows = self.connection.execute(
            """
            SELECT source, fetched_at, success, raw_item_count, item_count, kept_item_count, duration_ms,
                   raw_topic_count, merged_topic_count, duplicate_topic_count, duplicate_topic_rate,
                   used_fallback, error_message
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
                    raw_item_count=row["raw_item_count"],
                    item_count=row["item_count"],
                    kept_item_count=row["kept_item_count"],
                    duration_ms=row["duration_ms"],
                    raw_topic_count=row["raw_topic_count"],
                    merged_topic_count=row["merged_topic_count"],
                    duplicate_topic_count=row["duplicate_topic_count"],
                    duplicate_topic_rate=row["duplicate_topic_rate"],
                    used_fallback=bool(row["used_fallback"]),
                    error_message=row["error_message"],
                )
            )
        return grouped


class PipelineRunRepository:
    """Persist and retrieve full pipeline execution summaries."""

    def __init__(self, connection: DatabaseConnection) -> None:
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
                top_score,
                raw_topic_count,
                merged_topic_count,
                duplicate_topic_count,
                duplicate_topic_rate,
                multi_source_trend_count,
                low_evidence_trend_count
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
                run.raw_topic_count,
                run.merged_topic_count,
                run.duplicate_topic_count,
                run.duplicate_topic_rate,
                run.multi_source_trend_count,
                run.low_evidence_trend_count,
            ),
        )
        self.connection.commit()

    def list_recent_runs(self, limit: int) -> list[PipelineRun]:
        """Return recent pipeline execution summaries ordered newest first."""

        rows = self.connection.execute(
            """
            SELECT captured_at, duration_ms, source_count, successful_source_count,
                   failed_source_count, signal_count, ranked_trend_count, top_topic, top_score,
                   raw_topic_count, merged_topic_count, duplicate_topic_count, duplicate_topic_rate,
                   multi_source_trend_count, low_evidence_trend_count
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
                raw_topic_count=row["raw_topic_count"],
                merged_topic_count=row["merged_topic_count"],
                duplicate_topic_count=row["duplicate_topic_count"],
                duplicate_topic_rate=row["duplicate_topic_rate"],
                multi_source_trend_count=row["multi_source_trend_count"],
                low_evidence_trend_count=row["low_evidence_trend_count"],
            )
            for row in rows
        ]


class NotificationRepository:
    """Persist and retrieve notification channels plus delivery logs."""

    def __init__(self, connection: DatabaseConnection) -> None:
        self.connection = connection

    def list_channels(self, owner_user_id: int | None = None) -> list[NotificationChannel]:
        """Return configured channels for one owner scope."""

        if owner_user_id is None:
            rows = self.connection.execute(
                """
                SELECT id, owner_user_id, channel_type, destination, label, enabled, created_at
                FROM notification_channels
                WHERE owner_user_id IS NULL
                ORDER BY created_at DESC, id DESC
                """
            ).fetchall()
        else:
            rows = self.connection.execute(
                """
                SELECT id, owner_user_id, channel_type, destination, label, enabled, created_at
                FROM notification_channels
                WHERE owner_user_id = ?
                ORDER BY created_at DESC, id DESC
                """,
                (owner_user_id,),
            ).fetchall()
        return [self._channel_from_row(row) for row in rows]

    def list_all_channels(self) -> list[NotificationChannel]:
        """Return all configured channels across owners."""

        rows = self.connection.execute(
            """
            SELECT id, owner_user_id, channel_type, destination, label, enabled, created_at
            FROM notification_channels
            ORDER BY created_at DESC, id DESC
            """
        ).fetchall()
        return [self._channel_from_row(row) for row in rows]

    def get_channel(self, channel_id: int, owner_user_id: int | None = None) -> NotificationChannel | None:
        """Return one channel when it belongs to the requested owner scope."""

        if owner_user_id is None:
            row = self.connection.execute(
                """
                SELECT id, owner_user_id, channel_type, destination, label, enabled, created_at
                FROM notification_channels
                WHERE id = ? AND owner_user_id IS NULL
                """,
                (channel_id,),
            ).fetchone()
        else:
            row = self.connection.execute(
                """
                SELECT id, owner_user_id, channel_type, destination, label, enabled, created_at
                FROM notification_channels
                WHERE id = ? AND owner_user_id = ?
                """,
                (channel_id, owner_user_id),
            ).fetchone()
        if row is None:
            return None
        return self._channel_from_row(row)

    def create_channel(
        self,
        channel_type: str,
        destination: str,
        label: str = "",
        owner_user_id: int | None = None,
        enabled: bool = True,
    ) -> NotificationChannel:
        """Create and return a notification channel."""

        channel_id = execute_insert_and_return_id(
            self.connection,
            """
            INSERT INTO notification_channels (owner_user_id, channel_type, destination, label, enabled)
            VALUES (?, ?, ?, ?, ?)
            """,
            (owner_user_id, channel_type, destination, label, int(enabled)),
        )
        self.connection.commit()
        row = self.connection.execute(
            """
            SELECT id, owner_user_id, channel_type, destination, label, enabled, created_at
            FROM notification_channels
            WHERE id = ?
            """,
            (channel_id,),
        ).fetchone()
        return self._channel_from_row(row)

    def delete_channel(self, channel_id: int, owner_user_id: int | None = None) -> bool:
        """Delete one channel if it belongs to the requested owner scope."""

        if owner_user_id is None:
            cursor = self.connection.execute(
                "DELETE FROM notification_channels WHERE id = ? AND owner_user_id IS NULL",
                (channel_id,),
            )
        else:
            cursor = self.connection.execute(
                "DELETE FROM notification_channels WHERE id = ? AND owner_user_id = ?",
                (channel_id, owner_user_id),
            )
        self.connection.commit()
        return cursor.rowcount > 0

    def append_log(
        self,
        channel_id: int,
        payload_json: str,
        status_code: int | None,
        error: str | None,
        sent_at: datetime,
    ) -> NotificationLogEntry:
        """Persist one delivery attempt."""

        log_id = execute_insert_and_return_id(
            self.connection,
            """
            INSERT INTO notification_log (channel_id, sent_at, payload_json, status_code, error)
            VALUES (?, ?, ?, ?, ?)
            """,
            (channel_id, sent_at.isoformat(), payload_json, status_code, error),
        )
        self.connection.commit()
        row = self.connection.execute(
            """
            SELECT id, channel_id, sent_at, payload_json, status_code, error
            FROM notification_log
            WHERE id = ?
            """,
            (log_id,),
        ).fetchone()
        return self._log_from_row(row)

    def list_recent_logs(
        self,
        channel_id: int,
        limit: int = 5,
    ) -> list[NotificationLogEntry]:
        """Return recent delivery attempts for one channel."""

        rows = self.connection.execute(
            """
            SELECT id, channel_id, sent_at, payload_json, status_code, error
            FROM notification_log
            WHERE channel_id = ?
            ORDER BY sent_at DESC, id DESC
            LIMIT ?
            """,
            (channel_id, limit),
        ).fetchall()
        return [self._log_from_row(row) for row in rows]

    @staticmethod
    def _channel_from_row(row: RowMapping) -> NotificationChannel:
        return NotificationChannel(
            id=row["id"],
            owner_user_id=row["owner_user_id"],
            channel_type=row["channel_type"],
            destination=row["destination"],
            label=row["label"],
            enabled=bool(row["enabled"]),
            created_at=datetime.fromisoformat(row["created_at"]),
        )

    @staticmethod
    def _log_from_row(row: RowMapping) -> NotificationLogEntry:
        return NotificationLogEntry(
            id=row["id"],
            channel_id=row["channel_id"],
            sent_at=datetime.fromisoformat(row["sent_at"]),
            payload_json=row["payload_json"],
            status_code=row["status_code"],
            error=row["error"],
        )


class WatchlistRepository:
    """Persist and retrieve watchlists and simple alert rules."""

    def __init__(self, connection: DatabaseConnection) -> None:
        self.connection = connection

    def ensure_default_watchlist(self, name: str = "Core Watchlist", owner_user_id: int | None = None) -> Watchlist:
        """Return the default watchlist, creating it if necessary."""

        existing = self.get_watchlist_by_name(name, owner_user_id=owner_user_id)
        if existing is not None:
            return existing
        return self.create_watchlist(name, owner_user_id=owner_user_id)

    def list_watchlists(self, owner_user_id: int | None = None) -> list[Watchlist]:
        """Return all watchlists with nested items."""

        query = "SELECT id, name, owner_user_id, default_share_duration_days, created_at, updated_at FROM watchlists"
        parameters: tuple[object, ...] = ()
        if owner_user_id is None:
            query += " WHERE owner_user_id IS NULL"
        else:
            query += " WHERE owner_user_id = ?"
            parameters = (owner_user_id,)
        query += " ORDER BY updated_at DESC, id DESC"
        rows = self.connection.execute(query, parameters).fetchall()
        return [self._watchlist_from_row(row) for row in rows]

    def get_watchlist(self, watchlist_id: int) -> Watchlist | None:
        """Return a watchlist by id when present."""

        row = self.connection.execute(
            "SELECT id, name, owner_user_id, default_share_duration_days, created_at, updated_at FROM watchlists WHERE id = ?",
            (watchlist_id,),
        ).fetchone()
        if row is None:
            return None
        return self._watchlist_from_row(row)

    def get_watchlist_for_owner(self, watchlist_id: int, owner_user_id: int | None) -> Watchlist | None:
        """Return a watchlist by id only when it belongs to the given owner."""

        if owner_user_id is None:
            row = self.connection.execute(
                """
                SELECT id, name, owner_user_id, created_at, updated_at
                , default_share_duration_days
                FROM watchlists
                WHERE id = ? AND owner_user_id IS NULL
                """,
                (watchlist_id,),
            ).fetchone()
        else:
            row = self.connection.execute(
                """
                SELECT id, name, owner_user_id, created_at, updated_at
                , default_share_duration_days
                FROM watchlists
                WHERE id = ? AND owner_user_id = ?
                """,
                (watchlist_id, owner_user_id),
            ).fetchone()
        if row is None:
            return None
        return self._watchlist_from_row(row)

    def get_watchlist_by_name(self, name: str, owner_user_id: int | None = None) -> Watchlist | None:
        """Return a watchlist by name when present."""

        if owner_user_id is None:
            row = self.connection.execute(
                """
                SELECT id, name, owner_user_id, created_at, updated_at
                , default_share_duration_days
                FROM watchlists
                WHERE name = ? AND owner_user_id IS NULL
                """,
                (name,),
            ).fetchone()
        else:
            row = self.connection.execute(
                """
                SELECT id, name, owner_user_id, created_at, updated_at
                , default_share_duration_days
                FROM watchlists
                WHERE name = ? AND owner_user_id = ?
                """,
                (name, owner_user_id),
            ).fetchone()
        if row is None:
            return None
        return self._watchlist_from_row(row)

    def create_watchlist(self, name: str, owner_user_id: int | None = None) -> Watchlist:
        """Create and return a watchlist."""

        self.connection.execute(
            "INSERT INTO watchlists (name, owner_user_id, default_share_duration_days) VALUES (?, ?, NULL)",
            (name, owner_user_id),
        )
        self.connection.commit()
        return self.get_watchlist_by_name(name, owner_user_id=owner_user_id)  # type: ignore[return-value]

    def update_default_share_duration(
        self,
        watchlist_id: int,
        owner_user_id: int | None,
        default_share_duration_days: int | None,
    ) -> Watchlist | None:
        """Persist the default share expiry policy for a watchlist."""

        if owner_user_id is None:
            cursor = self.connection.execute(
                """
                UPDATE watchlists
                SET default_share_duration_days = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ? AND owner_user_id IS NULL
                """,
                (default_share_duration_days, watchlist_id),
            )
        else:
            cursor = self.connection.execute(
                """
                UPDATE watchlists
                SET default_share_duration_days = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ? AND owner_user_id = ?
                """,
                (default_share_duration_days, watchlist_id, owner_user_id),
            )
        self.connection.commit()
        if cursor.rowcount == 0:
            return None
        return self.get_watchlist(watchlist_id)

    def add_item(self, watchlist_id: int, trend_id: str, trend_name: str) -> Watchlist:
        """Add a trend to a watchlist and return the updated watchlist."""

        self._insert_watchlist_item_if_missing(watchlist_id, trend_id, trend_name)
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

    def list_alert_rules(self, owner_user_id: int | None = None) -> list[AlertRule]:
        """Return all alert rules."""

        if owner_user_id is None:
            rows = self.connection.execute(
                """
                SELECT ar.id, ar.watchlist_id, ar.name, ar.rule_type, ar.threshold, ar.enabled, ar.created_at
                FROM alert_rules ar
                INNER JOIN watchlists w ON w.id = ar.watchlist_id
                WHERE w.owner_user_id IS NULL
                ORDER BY ar.created_at DESC, ar.id DESC
                """
            ).fetchall()
        else:
            rows = self.connection.execute(
                """
                SELECT ar.id, ar.watchlist_id, ar.name, ar.rule_type, ar.threshold, ar.enabled, ar.created_at
                FROM alert_rules ar
                INNER JOIN watchlists w ON w.id = ar.watchlist_id
                WHERE w.owner_user_id = ?
                ORDER BY ar.created_at DESC, ar.id DESC
                """,
                (owner_user_id,),
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

    def list_all_alert_rules(self) -> list[AlertRule]:
        """Return all alert rules across owners for pipeline evaluation."""

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

        alert_rule_id = execute_insert_and_return_id(
            self.connection,
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
            (alert_rule_id,),
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

    def list_alert_events(
        self,
        unread_only: bool = False,
        limit: int = 50,
        owner_user_id: int | None = None,
    ) -> list[AlertEventRecord]:
        """Return recent alert events, optionally filtered to unread only."""

        conditions: list[str] = []
        parameters: list[object] = []
        if unread_only:
            conditions.append("ae.read = 0")
        if owner_user_id is None:
            conditions.append("w.owner_user_id IS NULL")
        else:
            conditions.append("w.owner_user_id = ?")
            parameters.append(owner_user_id)
        where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""
        parameters.append(limit)
        rows = self.connection.execute(
            f"""
            SELECT ae.id, ae.rule_id, ae.watchlist_id, ae.trend_id, ae.trend_name, ae.rule_type,
                   ae.threshold, ae.current_value, ae.message, ae.triggered_at, ae.read
            FROM alert_events ae
            INNER JOIN watchlists w ON w.id = ae.watchlist_id
            {where_clause}
            ORDER BY ae.triggered_at DESC, ae.id DESC
            LIMIT ?
            """,
            tuple(parameters),
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

    def mark_alerts_read(self, event_ids: list[int], owner_user_id: int | None = None) -> int:
        """Mark alert events as read. Returns the number of rows updated."""

        if not event_ids:
            return 0
        placeholders = sql_placeholders(self.connection, len(event_ids))
        if owner_user_id is None:
            cursor = self.connection.execute(
                f"""
                UPDATE alert_events
                SET read = 1
                WHERE id IN (
                    SELECT ae.id
                    FROM alert_events ae
                    INNER JOIN watchlists w ON w.id = ae.watchlist_id
                    WHERE ae.id IN ({placeholders}) AND w.owner_user_id IS NULL
                )
                """,
                event_ids,
            )
        else:
            cursor = self.connection.execute(
                f"""
                UPDATE alert_events
                SET read = 1
                WHERE id IN (
                    SELECT ae.id
                    FROM alert_events ae
                    INNER JOIN watchlists w ON w.id = ae.watchlist_id
                    WHERE ae.id IN ({placeholders}) AND w.owner_user_id = ?
                )
                """,
                [*event_ids, owner_user_id],
            )
        self.connection.commit()
        return cursor.rowcount

    def create_share(
        self,
        watchlist_id: int,
        share_token: str,
        created_by: int | None = None,
        is_public: bool = False,
        show_creator: bool = False,
        expires_at: datetime | None = None,
        use_watchlist_default_expiry: bool = False,
    ) -> WatchlistShare:
        """Create a share link for a watchlist."""

        if expires_at is None and use_watchlist_default_expiry:
            watchlist = self.get_watchlist(watchlist_id)
            expires_at = self._resolve_default_share_expiry(watchlist)

        share_id = execute_insert_and_return_id(
            self.connection,
            """
            INSERT INTO watchlist_shares (watchlist_id, share_token, created_by, is_public, show_creator, expires_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                watchlist_id,
                share_token,
                created_by,
                int(is_public),
                int(show_creator),
                expires_at.isoformat() if expires_at is not None else None,
            ),
        )
        self.connection.commit()
        share = self.get_share_by_id(share_id)  # type: ignore[assignment]
        if share is not None:
            visibility_label = "public" if share.is_public else "private"
            creator_label = "with attribution" if share.show_creator else "anonymous"
            self.record_share_event(
                share_id=share.id,
                watchlist_id=share.watchlist_id,
                actor_user_id=created_by,
                event_type="created",
                detail=f"Created {visibility_label} share ({creator_label})",
            )
        return share  # type: ignore[return-value]

    def rotate_share_token(self, share_id: int, owner_user_id: int | None, next_share_token: str) -> WatchlistShare | None:
        """Replace a share token in place when the share belongs to the given owner."""

        if owner_user_id is None:
            cursor = self.connection.execute(
                """
                UPDATE watchlist_shares
                SET share_token = ?
                WHERE id IN (
                    SELECT ws.id
                    FROM watchlist_shares ws
                    INNER JOIN watchlists w ON w.id = ws.watchlist_id
                    WHERE ws.id = ? AND w.owner_user_id IS NULL
                )
                """,
                (next_share_token, share_id),
            )
        else:
            cursor = self.connection.execute(
                """
                UPDATE watchlist_shares
                SET share_token = ?
                WHERE id IN (
                    SELECT ws.id
                    FROM watchlist_shares ws
                    INNER JOIN watchlists w ON w.id = ws.watchlist_id
                    WHERE ws.id = ? AND w.owner_user_id = ?
                )
                """,
                (next_share_token, share_id, owner_user_id),
            )
        self.connection.commit()
        if cursor.rowcount == 0:
            return None
        share = self.get_share_by_id(share_id)
        if share is not None:
            self.record_share_event(
                share_id=share.id,
                watchlist_id=share.watchlist_id,
                actor_user_id=owner_user_id,
                event_type="rotated",
                detail="Rotated share link",
            )
        return share

    def get_share_by_id(self, share_id: int) -> WatchlistShare | None:
        """Return a share by id."""

        row = self.connection.execute(
            "SELECT id, watchlist_id, share_token, created_by, is_public, show_creator, expires_at, access_count, last_accessed_at, created_at FROM watchlist_shares WHERE id = ?",
            (share_id,),
        ).fetchone()
        if row is None:
            return None
        return self._share_from_row(row)

    def get_share_by_token(self, token: str) -> WatchlistShare | None:
        """Return a share by its token."""

        row = self.connection.execute(
            "SELECT id, watchlist_id, share_token, created_by, is_public, show_creator, expires_at, access_count, last_accessed_at, created_at FROM watchlist_shares WHERE share_token = ?",
            (token,),
        ).fetchone()
        if row is None:
            return None
        share = self._share_from_row(row)
        if self._is_share_expired(share):
            return None
        return share

    def list_public_watchlists(self) -> list[tuple[Watchlist, WatchlistShare]]:
        """Return all watchlists that have a public share link."""

        rows = self.connection.execute(
            """
            SELECT ws.id, ws.watchlist_id, ws.share_token, ws.created_by, ws.is_public, ws.show_creator, ws.expires_at, ws.access_count, ws.last_accessed_at, ws.created_at
            FROM watchlist_shares ws
            WHERE ws.is_public = 1
            ORDER BY ws.created_at DESC
            """
        ).fetchall()
        results: list[tuple[Watchlist, WatchlistShare]] = []
        for row in rows:
            share = self._share_from_row(row)
            if self._is_share_expired(share):
                continue
            watchlist = self.get_watchlist(share.watchlist_id)
            if watchlist is not None:
                results.append((watchlist, share))
        return results

    def list_shares_for_watchlist(self, watchlist_id: int) -> list[WatchlistShare]:
        """Return all share links for a watchlist."""

        rows = self.connection.execute(
            """
            SELECT id, watchlist_id, share_token, created_by, is_public, show_creator, expires_at, access_count, last_accessed_at, created_at
            FROM watchlist_shares
            WHERE watchlist_id = ?
            ORDER BY created_at DESC
            """,
            (watchlist_id,),
        ).fetchall()
        return [self._share_from_row(row) for row in rows]

    def list_share_access_history(
        self,
        share_id: int,
        *,
        days: int = 7,
    ) -> list[WatchlistShareAccessPoint]:
        """Return trailing daily access counts for one share."""

        rows = self.connection.execute(
            """
            SELECT access_date, access_count
            FROM watchlist_share_daily_access
            WHERE share_id = ?
            ORDER BY access_date DESC
            LIMIT ?
            """,
            (share_id, days),
        ).fetchall()
        return [
            WatchlistShareAccessPoint(
                access_date=datetime.fromisoformat(row["access_date"]).replace(tzinfo=timezone.utc),
                access_count=row["access_count"],
            )
            for row in rows
        ]

    def record_share_access(self, share_id: int) -> WatchlistShare | None:
        """Increment access counters for one share."""

        accessed_at = datetime.now(timezone.utc)
        cursor = self.connection.execute(
            """
            UPDATE watchlist_shares
            SET access_count = access_count + 1, last_accessed_at = ?
            WHERE id = ?
            """,
            (accessed_at.isoformat(), share_id),
        )
        access_date = accessed_at.date().isoformat()
        self._upsert_share_daily_access(share_id, access_date)
        self.connection.commit()
        if cursor.rowcount == 0:
            return None
        return self.get_share_by_id(share_id)

    def revoke_share(self, share_id: int, owner_user_id: int | None) -> bool:
        """Delete a share link only when it belongs to the given owner."""

        share = self.get_share_by_id(share_id)
        if owner_user_id is None:
            cursor = self.connection.execute(
                """
                DELETE FROM watchlist_shares
                WHERE id IN (
                    SELECT ws.id
                    FROM watchlist_shares ws
                    INNER JOIN watchlists w ON w.id = ws.watchlist_id
                    WHERE ws.id = ? AND w.owner_user_id IS NULL
                )
                """,
                (share_id,),
            )
        else:
            cursor = self.connection.execute(
                """
                DELETE FROM watchlist_shares
                WHERE id IN (
                    SELECT ws.id
                    FROM watchlist_shares ws
                    INNER JOIN watchlists w ON w.id = ws.watchlist_id
                    WHERE ws.id = ? AND w.owner_user_id = ?
                )
                """,
                (share_id, owner_user_id),
            )
        self.connection.commit()
        if cursor.rowcount > 0 and share is not None:
            self.record_share_event(
                share_id=None,
                watchlist_id=share.watchlist_id,
                actor_user_id=owner_user_id,
                event_type="revoked",
                detail="Revoked share link",
            )
        return cursor.rowcount > 0

    def update_share_visibility(self, share_id: int, owner_user_id: int | None, is_public: bool) -> WatchlistShare | None:
        """Update public visibility for a share when it belongs to the given owner."""

        if owner_user_id is None:
            cursor = self.connection.execute(
                """
                UPDATE watchlist_shares
                SET is_public = ?
                WHERE id IN (
                    SELECT ws.id
                    FROM watchlist_shares ws
                    INNER JOIN watchlists w ON w.id = ws.watchlist_id
                    WHERE ws.id = ? AND w.owner_user_id IS NULL
                )
                """,
                (int(is_public), share_id),
            )
        else:
            cursor = self.connection.execute(
                """
                UPDATE watchlist_shares
                SET is_public = ?
                WHERE id IN (
                    SELECT ws.id
                    FROM watchlist_shares ws
                    INNER JOIN watchlists w ON w.id = ws.watchlist_id
                    WHERE ws.id = ? AND w.owner_user_id = ?
                )
                """,
                (int(is_public), share_id, owner_user_id),
            )
        self.connection.commit()
        if cursor.rowcount == 0:
            return None
        share = self.get_share_by_id(share_id)
        if share is not None:
            self.record_share_event(
                share_id=share.id,
                watchlist_id=share.watchlist_id,
                actor_user_id=owner_user_id,
                event_type="visibility_updated",
                detail=f"Set share to {'public' if share.is_public else 'private'}",
            )
        return share

    def update_share_creator_visibility(
        self,
        share_id: int,
        owner_user_id: int | None,
        show_creator: bool,
    ) -> WatchlistShare | None:
        """Update whether a share exposes its creator attribution."""

        if owner_user_id is None:
            cursor = self.connection.execute(
                """
                UPDATE watchlist_shares
                SET show_creator = ?
                WHERE id IN (
                    SELECT ws.id
                    FROM watchlist_shares ws
                    INNER JOIN watchlists w ON w.id = ws.watchlist_id
                    WHERE ws.id = ? AND w.owner_user_id IS NULL
                )
                """,
                (int(show_creator), share_id),
            )
        else:
            cursor = self.connection.execute(
                """
                UPDATE watchlist_shares
                SET show_creator = ?
                WHERE id IN (
                    SELECT ws.id
                    FROM watchlist_shares ws
                    INNER JOIN watchlists w ON w.id = ws.watchlist_id
                    WHERE ws.id = ? AND w.owner_user_id = ?
                )
                """,
                (int(show_creator), share_id, owner_user_id),
            )
        self.connection.commit()
        if cursor.rowcount == 0:
            return None
        share = self.get_share_by_id(share_id)
        if share is not None:
            self.record_share_event(
                share_id=share.id,
                watchlist_id=share.watchlist_id,
                actor_user_id=owner_user_id,
                event_type="attribution_updated",
                detail=f"{'Enabled' if share.show_creator else 'Disabled'} creator attribution",
            )
        return share

    def update_share_expiration(
        self,
        share_id: int,
        owner_user_id: int | None,
        expires_at: datetime | None,
    ) -> WatchlistShare | None:
        """Update expiration for a share when it belongs to the given owner."""

        expires_value = expires_at.isoformat() if expires_at is not None else None
        if owner_user_id is None:
            cursor = self.connection.execute(
                """
                UPDATE watchlist_shares
                SET expires_at = ?
                WHERE id IN (
                    SELECT ws.id
                    FROM watchlist_shares ws
                    INNER JOIN watchlists w ON w.id = ws.watchlist_id
                    WHERE ws.id = ? AND w.owner_user_id IS NULL
                )
                """,
                (expires_value, share_id),
            )
        else:
            cursor = self.connection.execute(
                """
                UPDATE watchlist_shares
                SET expires_at = ?
                WHERE id IN (
                    SELECT ws.id
                    FROM watchlist_shares ws
                    INNER JOIN watchlists w ON w.id = ws.watchlist_id
                    WHERE ws.id = ? AND w.owner_user_id = ?
                )
                """,
                (expires_value, share_id, owner_user_id),
            )
        self.connection.commit()
        if cursor.rowcount == 0:
            return None
        share = self.get_share_by_id(share_id)
        if share is not None:
            detail = (
                f"Set share expiry to {expires_at.isoformat()}"
                if expires_at is not None
                else "Removed share expiry"
            )
            self.record_share_event(
                share_id=share.id,
                watchlist_id=share.watchlist_id,
                actor_user_id=owner_user_id,
                event_type="expiration_updated",
                detail=detail,
            )
        return share

    def record_share_event(
        self,
        share_id: int | None,
        watchlist_id: int,
        actor_user_id: int | None,
        event_type: str,
        detail: str,
    ) -> WatchlistShareEvent:
        """Persist and return a share audit event."""

        share_event_id = execute_insert_and_return_id(
            self.connection,
            """
            INSERT INTO watchlist_share_events (share_id, watchlist_id, actor_user_id, event_type, detail)
            VALUES (?, ?, ?, ?, ?)
            """,
            (share_id, watchlist_id, actor_user_id, event_type, detail),
        )
        self.connection.commit()
        row = self.connection.execute(
            """
            SELECT id, share_id, watchlist_id, actor_user_id, event_type, detail, created_at
            FROM watchlist_share_events
            WHERE id = ?
            """,
            (share_event_id,),
        ).fetchone()
        return self._share_event_from_row(row)

    def list_share_events_for_watchlist(
        self,
        watchlist_id: int,
        owner_user_id: int | None,
        limit: int = 10,
    ) -> list[WatchlistShareEvent]:
        """Return recent share audit events for a watchlist owned by the given user."""

        if owner_user_id is None:
            watchlist = self.get_watchlist_for_owner(watchlist_id, None)
        else:
            watchlist = self.get_watchlist_for_owner(watchlist_id, owner_user_id)
        if watchlist is None:
            return []
        rows = self.connection.execute(
            """
            SELECT id, share_id, watchlist_id, actor_user_id, event_type, detail, created_at
            FROM watchlist_share_events
            WHERE watchlist_id = ?
            ORDER BY created_at DESC, id DESC
            LIMIT ?
            """,
            (watchlist_id, limit),
        ).fetchall()
        return [self._share_event_from_row(row) for row in rows]

    @staticmethod
    def _share_from_row(row: RowMapping) -> WatchlistShare:
        return WatchlistShare(
            id=row["id"],
            watchlist_id=row["watchlist_id"],
            share_token=row["share_token"],
            created_by=row["created_by"],
            is_public=bool(row["is_public"]),
            show_creator=bool(row["show_creator"]),
            expires_at=datetime.fromisoformat(row["expires_at"]) if row["expires_at"] else None,
            access_count=row["access_count"],
            last_accessed_at=datetime.fromisoformat(row["last_accessed_at"]) if row["last_accessed_at"] else None,
            created_at=datetime.fromisoformat(row["created_at"]),
        )

    @staticmethod
    def _share_event_from_row(row: RowMapping) -> WatchlistShareEvent:
        return WatchlistShareEvent(
            id=row["id"],
            share_id=row["share_id"],
            watchlist_id=row["watchlist_id"],
            actor_user_id=row["actor_user_id"],
            event_type=row["event_type"],
            detail=row["detail"],
            created_at=datetime.fromisoformat(row["created_at"]),
        )

    @staticmethod
    def _is_share_expired(share: WatchlistShare) -> bool:
        return share.expires_at is not None and share.expires_at <= datetime.now(share.expires_at.tzinfo)

    def get_watchlist_trend_ids(self) -> dict[int, set[str]]:
        """Return a mapping of watchlist_id -> set of trend_ids."""

        rows = self.connection.execute(
            "SELECT watchlist_id, trend_id FROM watchlist_items"
        ).fetchall()
        result: dict[int, set[str]] = {}
        for row in rows:
            result.setdefault(row["watchlist_id"], set()).add(row["trend_id"])
        return result

    def get_watchlist_owner_map(self, watchlist_ids: set[int]) -> dict[int, int | None]:
        """Return owner ids for the requested watchlists."""

        if not watchlist_ids:
            return {}
        placeholders = sql_placeholders(self.connection, len(watchlist_ids))
        rows = self.connection.execute(
            f"SELECT id, owner_user_id FROM watchlists WHERE id IN ({placeholders})",
            tuple(watchlist_ids),
        ).fetchall()
        return {row["id"]: row["owner_user_id"] for row in rows}

    def _watchlist_from_row(self, row: RowMapping) -> Watchlist:
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
            owner_user_id=row["owner_user_id"],
            default_share_duration_days=row["default_share_duration_days"],
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

    @staticmethod
    def _resolve_default_share_expiry(watchlist: Watchlist | None) -> datetime | None:
        if watchlist is None or watchlist.default_share_duration_days is None:
            return None
        return datetime.now(timezone.utc) + timedelta(days=watchlist.default_share_duration_days)

    def _insert_watchlist_item_if_missing(self, watchlist_id: int, trend_id: str, trend_name: str) -> None:
        """Insert one watchlist item if it does not already exist."""

        self.connection.execute(
            self.connection.dialect.insert_or_ignore_statement(
                "watchlist_items",
                ("watchlist_id", "trend_id", "trend_name"),
            ),
            (watchlist_id, trend_id, trend_name),
        )

    def _upsert_share_daily_access(self, share_id: int, access_date: str) -> None:
        """Upsert the per-day share access row."""

        self.connection.execute(
            self.connection.dialect.incrementing_upsert_statement(
                "watchlist_share_daily_access",
                ("share_id", "access_date"),
                "access_count",
            ),
            (share_id, access_date),
        )


class TrendScoreRepository:
    """Persist and retrieve ranked trend scores."""

    PRIMARY_EVIDENCE_SOURCE_PRIORITY = {
        "hacker_news": 6,
        "reddit": 5,
        "github": 4,
        "polymarket": 4,
        "twitter": 4,
        "google_trends": 3,
        "wikipedia": 1,
    }

    def __init__(self, connection: DatabaseConnection) -> None:
        self.connection = connection

    def replace_scores(
        self,
        scores: list[TrendScoreResult],
        *,
        published_topics: set[str] | None = None,
    ) -> None:
        """Replace stored scores with the latest ranking run."""

        self.connection.execute("DELETE FROM trend_scores")
        published_topics = published_topics or {score.topic for score in scores}
        self.connection.executemany(
            """
            INSERT INTO trend_scores (
                topic, total_score, search_score, social_score, developer_score,
                knowledge_score, diversity_score, source_counts_json, evidence_json, latest_timestamp, display_name,
                is_published
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
                    score.display_name,
                    int(score.topic in published_topics),
                )
                for score in scores
            ],
        )
        self.connection.commit()

    def append_snapshot(
        self,
        scores: list[TrendScoreResult],
        captured_at: datetime,
        *,
        published_topics: set[str] | None = None,
    ) -> int:
        """Persist a timestamped ranked snapshot for historical views."""

        run_id = execute_insert_and_return_id(
            self.connection,
            "INSERT INTO trend_runs (captured_at) VALUES (?)",
            (captured_at.isoformat(),),
        )
        published_topics = published_topics or {score.topic for score in scores}
        self.connection.executemany(
            """
            INSERT INTO trend_score_snapshots (
                run_id, rank_position, topic, total_score, search_score, social_score, developer_score,
                knowledge_score, diversity_score, source_counts_json, evidence_json, latest_timestamp, display_name,
                is_published
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
                    score.display_name,
                    int(score.topic in published_topics),
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
                   knowledge_score, diversity_score, source_counts_json, evidence_json, latest_timestamp, display_name
            FROM trend_scores
            WHERE is_published = 1
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
                   knowledge_score, diversity_score, source_counts_json, evidence_json, latest_timestamp, display_name
            FROM trend_score_snapshots
            WHERE run_id = ? AND is_published = 1
            ORDER BY rank_position ASC
            LIMIT ?
            """,
            (run_row["id"], limit),
        ).fetchall()
        return datetime.fromisoformat(run_row["captured_at"]), [self._score_from_row(row) for row in rows]

    def list_latest_experimental_snapshot(self, limit: int) -> tuple[datetime | None, list[TrendScoreResult]]:
        """Return the latest stored experimental candidates from the newest snapshot."""

        run_row = self.connection.execute(
            "SELECT id, captured_at FROM trend_runs ORDER BY captured_at DESC, id DESC LIMIT 1"
        ).fetchone()
        if run_row is None:
            return None, []
        rows = self.connection.execute(
            """
            SELECT topic, total_score, search_score, social_score, developer_score,
                   knowledge_score, diversity_score, source_counts_json, evidence_json, latest_timestamp, display_name
            FROM trend_score_snapshots
            WHERE run_id = ? AND is_published = 0
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
                       knowledge_score, diversity_score, source_counts_json, evidence_json, latest_timestamp, display_name
                FROM trend_score_snapshots
                WHERE run_id = ? AND is_published = 1
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
            WHERE trend_score_snapshots.topic = ? AND trend_score_snapshots.is_published = 1
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
            WHERE trend_score_snapshots.topic = ? AND trend_score_snapshots.is_published = 1
            ORDER BY trend_runs.captured_at ASC, trend_runs.id ASC
            LIMIT 1
            """,
            (topic,),
        ).fetchone()
        if row is None:
            return None
        return datetime.fromisoformat(row["captured_at"])

    def get_topic_appearance_gaps(self, topic: str) -> list[int]:
        """Return missing-run gaps between consecutive topic appearances."""

        rows = self.connection.execute(
            """
            SELECT trend_runs.id AS run_id
            FROM trend_score_snapshots
            INNER JOIN trend_runs ON trend_runs.id = trend_score_snapshots.run_id
            WHERE trend_score_snapshots.topic = ? AND trend_score_snapshots.is_published = 1
            ORDER BY trend_runs.id ASC
            """,
            (topic,),
        ).fetchall()
        run_ids = [row["run_id"] for row in rows]
        if len(run_ids) < 2:
            return []
        return [max(0, run_ids[index] - run_ids[index - 1] - 1) for index in range(1, len(run_ids))]

    def get_topic_seasonality(self, topic: str) -> SeasonalityResult:
        """Return derived recurrence metadata for one topic."""

        from app.scoring.seasonality import classify_seasonality

        appearance_count = self.connection.execute(
            "SELECT COUNT(*) AS count FROM trend_score_snapshots WHERE topic = ? AND is_published = 1",
            (topic,),
        ).fetchone()["count"]
        total_runs = self.connection.execute(
            "SELECT COUNT(*) AS count FROM trend_runs",
        ).fetchone()["count"]
        return classify_seasonality(
            appearance_count=appearance_count,
            total_runs=total_runs,
            gaps=self.get_topic_appearance_gaps(topic),
        )

    def list_trend_explorer_records(self, limit: int, history_limit: int = 2) -> list[TrendExplorerRecord]:
        """Return explorer-ready records with movement fields derived from snapshots."""

        latest_captured_at, latest_scores = self.list_latest_snapshot(limit=limit)
        if latest_captured_at is None:
            return []

        from app.scoring.forecast import describe_forecast_direction, forecast_trend

        records: list[TrendExplorerRecord] = []
        for rank, score in enumerate(latest_scores, start=1):
            recent_history = self.get_topic_history(score.topic, limit_runs=history_limit)
            full_history = list(reversed(self.get_topic_history(score.topic, limit_runs=max(history_limit, 6))))
            momentum = self._build_momentum(score.total_score, recent_history)
            forecast = forecast_trend(full_history)
            seasonality = self.get_topic_seasonality(score.topic)
            records.append(
                TrendExplorerRecord(
                    id=self._slugify_topic(score.topic),
                    name=score.display_name or build_display_name(score.topic, score.evidence),
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
                    recent_history=recent_history,
                    audience_summary=self.get_topic_audience_summary(score.topic),
                    primary_evidence=self.get_primary_evidence(score.topic),
                    seasonality=seasonality if seasonality.tag is not None else None,
                    forecast_direction=describe_forecast_direction(forecast, score.total_score),
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

        from app.scoring.forecast import forecast_trend
        from app.scoring.opportunity import score_opportunities
        from app.scoring.predictor import predict_breakouts

        history_by_topic: dict[str, list[TrendHistoryPoint]] = {}
        first_seen_by_topic: dict[str, datetime | None] = {}
        momentum_by_topic: dict[str, TrendMomentum] = {}
        forecast_by_topic: dict[str, TrendForecast | None] = {}
        seasonality_by_topic: dict[str, SeasonalityResult | None] = {}
        status_by_topic: dict[str, str] = {}
        ranks_by_topic: dict[str, int] = {}

        for rank, score in enumerate(latest_scores, start=1):
            history = list(reversed(self.get_topic_history(score.topic, limit_runs=history_limit)))
            momentum = self._build_momentum(score.total_score, list(reversed(history)))
            history_by_topic[score.topic] = history
            first_seen_by_topic[score.topic] = self.get_first_seen_at(score.topic)
            momentum_by_topic[score.topic] = momentum
            forecast_by_topic[score.topic] = forecast_trend(history)
            seasonality = self.get_topic_seasonality(score.topic)
            seasonality_by_topic[score.topic] = seasonality if seasonality.tag is not None else None
            status_by_topic[score.topic] = self._build_trend_status(momentum)
            ranks_by_topic[score.topic] = rank

        opportunities = {
            item.trend_id: item
            for item in score_opportunities(
                scores=latest_scores,
                ranks=ranks_by_topic,
                momenta=momentum_by_topic,
                statuses=status_by_topic,
            )
        }
        predictions = {
            item.trend_id: item
            for item in predict_breakouts(
                current_scores=latest_scores,
                histories=history_by_topic,
                current_ranks=ranks_by_topic,
                first_seen=first_seen_by_topic,
                now=latest_captured_at,
                seasonality_by_topic=seasonality_by_topic,
            )
        }

        records: list[TrendDetailRecord] = []
        for rank, score in enumerate(latest_scores, start=1):
            history = history_by_topic[score.topic]
            momentum = momentum_by_topic[score.topic]
            slug = self._slugify_topic(score.topic)
            opportunity = opportunities.get(slug)
            prediction = predictions.get(slug)
            records.append(
                TrendDetailRecord(
                    id=slug,
                    name=score.display_name or build_display_name(score.topic, score.evidence),
                    category=self._build_category(score.topic, score.source_counts),
                    status=status_by_topic[score.topic],
                    volatility=self._build_volatility_label(momentum),
                    rank=rank,
                    previous_rank=momentum.previous_rank,
                    rank_change=momentum.rank_change,
                    first_seen_at=first_seen_by_topic[score.topic],
                    latest_signal_at=score.latest_timestamp,
                    score=score,
                    momentum=momentum,
                    breakout_prediction=BreakoutPredictionSummary(
                        confidence=prediction.confidence if prediction is not None else 0.0,
                        predicted_direction=(
                            prediction.predicted_direction if prediction is not None else "stable"
                        ),
                        signals=prediction.signals if prediction is not None else ["No strong momentum signals"],
                    ),
                    forecast=forecast_by_topic[score.topic],
                    opportunity=OpportunitySummary(
                        composite=opportunity.composite if opportunity is not None else 0.0,
                        content=opportunity.content if opportunity is not None else 0.0,
                        product=opportunity.product if opportunity is not None else 0.0,
                        investment=opportunity.investment if opportunity is not None else 0.0,
                        reasoning=opportunity.reasoning if opportunity is not None else ["Limited actionability signals"],
                    ),
                    source_count=len(score.source_counts),
                    signal_count=sum(score.source_counts.values()),
                    sources=sorted(score.source_counts),
                    history=history,
                    source_breakdown=self.get_topic_source_breakdown(score.topic),
                    source_contributions=self.get_topic_source_contributions(score.topic, score),
                    geo_summary=self.get_topic_geo_summary(score.topic),
                    audience_summary=self.get_topic_audience_summary(score.topic),
                    evidence_items=self.get_topic_evidence(score.topic, limit=evidence_limit),
                    primary_evidence=self.get_primary_evidence(score.topic),
                    related_trends=[],
                    seasonality=seasonality_by_topic[score.topic],
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

    def get_topic_source_contributions(
        self,
        topic: str,
        score: TrendScoreResult,
    ) -> list[TrendSourceContribution]:
        """Return estimated per-source score contribution for a topic."""

        rows = self.connection.execute(
            """
            SELECT source, signal_type, COUNT(*) AS signal_count, MAX(timestamp) AS latest_signal_at
            FROM signals
            WHERE topic = ?
            GROUP BY source, signal_type
            ORDER BY source ASC, signal_type ASC
            """,
            (topic,),
        ).fetchall()

        by_source: dict[str, dict[str, object]] = {}
        total_counts = {
            "social": 0,
            "developer": 0,
            "knowledge": 0,
            "search": 0,
        }
        for row in rows:
            signal_type = row["signal_type"]
            if signal_type not in total_counts:
                continue
            total_counts[signal_type] += row["signal_count"]
            source_entry = by_source.setdefault(
                row["source"],
                {
                    "counts": {"social": 0, "developer": 0, "knowledge": 0, "search": 0},
                    "signal_count": 0,
                    "latest_signal_at": datetime.fromisoformat(row["latest_signal_at"]),
                },
            )
            counts = source_entry["counts"]  # type: ignore[assignment]
            counts[signal_type] = row["signal_count"]  # type: ignore[index]
            source_entry["signal_count"] = int(source_entry["signal_count"]) + row["signal_count"]  # type: ignore[index]
            latest_signal_at = datetime.fromisoformat(row["latest_signal_at"])
            if latest_signal_at > source_entry["latest_signal_at"]:  # type: ignore[operator]
                source_entry["latest_signal_at"] = latest_signal_at  # type: ignore[index]

        source_total = max(len(score.source_counts), 1)
        contributions: list[TrendSourceContribution] = []
        for source, entry in by_source.items():
            counts = entry["counts"]  # type: ignore[assignment]
            social_score = self._component_source_share(score.social_score, counts["social"], total_counts["social"])  # type: ignore[index]
            developer_score = self._component_source_share(score.developer_score, counts["developer"], total_counts["developer"])  # type: ignore[index]
            knowledge_score = self._component_source_share(score.knowledge_score, counts["knowledge"], total_counts["knowledge"])  # type: ignore[index]
            search_score = self._component_source_share(score.search_score, counts["search"], total_counts["search"])  # type: ignore[index]
            diversity_score = round(score.diversity_score / source_total, 2)
            estimated_score = round(
                social_score + developer_score + knowledge_score + search_score + diversity_score,
                2,
            )
            score_share_percent = round((estimated_score / score.total_score) * 100, 1) if score.total_score > 0 else 0.0
            contributions.append(
                TrendSourceContribution(
                    source=source,
                    signal_count=entry["signal_count"],  # type: ignore[arg-type]
                    latest_signal_at=entry["latest_signal_at"],  # type: ignore[arg-type]
                    estimated_score=estimated_score,
                    score_share_percent=score_share_percent,
                    social_score=social_score,
                    developer_score=developer_score,
                    knowledge_score=knowledge_score,
                    search_score=search_score,
                    diversity_score=diversity_score,
                )
            )
        return sorted(
            contributions,
            key=lambda item: (-item.estimated_score, -item.signal_count, item.source),
        )

    def get_topic_evidence(self, topic: str, limit: int) -> list[TrendEvidenceItem]:
        """Return recent evidence items for a topic ordered newest first."""

        rows = self.connection.execute(
            """
            SELECT source, signal_type, timestamp, value, evidence, evidence_url,
                   language_code, audience_flags_json, market_flags_json,
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
                evidence_url=row["evidence_url"],
                language_code=row["language_code"],
                audience_flags=tuple(json.loads(row["audience_flags_json"])),
                market_flags=tuple(json.loads(row["market_flags_json"])),
                geo_flags=tuple(json.loads(row["geo_flags_json"])),
                geo_country_code=row["geo_country_code"],
                geo_region=row["geo_region"],
                geo_detection_mode=row["geo_detection_mode"],
                geo_confidence=row["geo_confidence"],
            )
            for row in rows
        ]

    def get_primary_evidence(self, topic: str) -> TrendPrimaryEvidence | None:
        """Return the best explanatory linked evidence item for a topic."""

        linked_items = [
            item
            for item in self.get_topic_evidence(topic, limit=12)
            if item.evidence_url
        ]
        if not linked_items:
            return None
        best = sorted(linked_items, key=self._primary_evidence_sort_key, reverse=True)[0]
        return TrendPrimaryEvidence(
            source=best.source,
            signal_type=best.signal_type,
            timestamp=best.timestamp,
            value=best.value,
            evidence=best.evidence,
            evidence_url=best.evidence_url or "",
        )

    def get_topic_geo_summary(self, topic: str, limit: int = 20) -> list[TrendGeoSummary]:
        """Return aggregated location coverage for a topic."""

        from app.topics.geo import GEO_CONFIDENCE_MINIMUM

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
              AND geo_confidence >= ?
            GROUP BY geo_country_code, geo_region
            ORDER BY signal_count DESC, average_confidence DESC, geo_label ASC
            LIMIT ?
            """,
            (topic, GEO_CONFIDENCE_MINIMUM, limit),
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

    def get_topic_audience_summary(self, topic: str, limit: int = 8) -> list[TrendAudienceSegment]:
        """Return aggregated audience, market, and language coverage for a trend."""

        rows = self.connection.execute(
            """
            SELECT language_code, audience_flags_json, market_flags_json
            FROM signals
            WHERE topic = ?
            """,
            (topic,),
        ).fetchall()
        counts: dict[tuple[str, str], int] = {}
        for row in rows:
            if row["language_code"]:
                label = str(row["language_code"]).upper()
                counts[("language", label)] = counts.get(("language", label), 0) + 1
            for flag in json.loads(row["audience_flags_json"]):
                counts[("audience", flag)] = counts.get(("audience", flag), 0) + 1
            for flag in json.loads(row["market_flags_json"]):
                counts[("market", flag)] = counts.get(("market", flag), 0) + 1
        segments = [
            TrendAudienceSegment(segment_type=segment_type, label=label, signal_count=signal_count)
            for (segment_type, label), signal_count in counts.items()
        ]
        segments.sort(key=lambda item: (-item.signal_count, item.segment_type, item.label))
        return segments[:limit]

    @staticmethod
    def _score_from_row(row: RowMapping) -> TrendScoreResult:
        """Build a score model from one database row."""

        evidence = json.loads(row["evidence_json"])
        display_name = build_display_name(
            row["topic"],
            ([row["display_name"]] if row["display_name"] else []) + evidence,
        )
        return TrendScoreResult(
            topic=row["topic"],
            total_score=row["total_score"],
            search_score=row["search_score"],
            social_score=row["social_score"],
            developer_score=row["developer_score"],
            knowledge_score=row["knowledge_score"],
            diversity_score=row["diversity_score"],
            source_counts=json.loads(row["source_counts_json"]),
            evidence=evidence,
            latest_timestamp=datetime.fromisoformat(row["latest_timestamp"]),
            display_name=display_name,
        )

    @staticmethod
    def _component_source_share(component_score: float, source_count: int, total_count: int) -> float:
        """Return the score share attributable to one source for a component."""

        if component_score <= 0 or source_count <= 0 or total_count <= 0:
            return 0.0
        return round(component_score * (source_count / total_count), 2)

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

    def _primary_evidence_sort_key(self, item: TrendEvidenceItem) -> tuple[float, float, float, int]:
        """Prefer stronger, newer linked evidence from more explanatory sources."""

        source_priority = float(self.PRIMARY_EVIDENCE_SOURCE_PRIORITY.get(item.source, 0))
        return (
            source_priority,
            item.value,
            item.timestamp.timestamp(),
            len(item.evidence),
        )

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
                breakout_prediction=record.breakout_prediction,
                forecast=record.forecast,
                opportunity=record.opportunity,
                source_count=record.source_count,
                signal_count=record.signal_count,
                sources=record.sources,
                history=record.history,
                source_breakdown=record.source_breakdown,
                source_contributions=record.source_contributions,
                geo_summary=record.geo_summary,
                audience_summary=record.audience_summary,
                evidence_items=record.evidence_items,
                primary_evidence=record.primary_evidence,
                related_trends=related_map.get(record.id, []),
                seasonality=record.seasonality,
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
