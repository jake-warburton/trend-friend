"""Repository helpers for reading and writing signals and scores."""

from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from typing import Any, Mapping

from app.data.connection import DatabaseConnection
from app.data.sql_dialect import SQLITE_DIALECT
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
    SourceFamilySnapshot,
    SourceIngestionRun,
    TrendCurationOverride,
    TrendDetailRecord,
    TrendDuplicateCandidate,
    TrendEntity,
    DigestMover,
    TrendEvidenceItem,
    TrendForecast,
    TrendExplorerRecord,
    TrendGeoSummary,
    TrendHistoryPoint,
    TrendMetricSnapshot,
    TrendMomentum,
    TrendPrimaryEvidence,
    TrendSourceContribution,
    TrendSourceBreakdown,
    TrendScoreResult,
    TrendThesis,
    TrendThesisMatch,
    Watchlist,
    WatchlistShareAccessPoint,
    WatchlistItem,
    WatchlistShareEvent,
    WatchlistShare,
)
from app.theses.matching import ThesisMatchCandidate

RowMapping = Mapping[str, Any]
UPPERCASE_CATEGORY_TOKENS = frozenset({"ai", "api", "ml", "llm", "vr", "ar", "ev", "b2b", "b2c"})


def sql_placeholders(connection: DatabaseConnection, count: int) -> str:
    """Return a positional placeholder list for the current connection dialect.

    Centralizing this keeps repository logic independent from one concrete
    database engine.
    """

    return get_connection_dialect(connection).placeholders(count)


def get_connection_dialect(connection: DatabaseConnection):
    """Return the configured SQL dialect, defaulting to SQLite semantics."""

    return getattr(connection, "dialect", SQLITE_DIALECT)


def format_category_label(category: str) -> str:
    """Return a display label for a slug-like category value."""

    parts = []
    for part in category.split("-"):
        if part.lower() in UPPERCASE_CATEGORY_TOKENS:
            parts.append(part.upper())
        else:
            parts.append(part[:1].upper() + part[1:])
    return " ".join(parts)


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


class SourceFamilySnapshotRepository:
    """Persist and retrieve family-level source impact history."""

    def __init__(self, connection: DatabaseConnection) -> None:
        self.connection = connection

    def append_snapshots(self, snapshots: list[SourceFamilySnapshot]) -> None:
        """Persist family analytics for one scoring run."""

        if not snapshots:
            return
        self.connection.executemany(
            """
            INSERT INTO source_family_snapshots (
                family,
                captured_at,
                source_count,
                healthy_source_count,
                signal_count,
                trend_count,
                corroborated_trend_count,
                top_ranked_trend_count,
                average_score,
                average_yield_rate_percent,
                success_rate_percent
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [
                (
                    snapshot.family,
                    snapshot.captured_at.isoformat(),
                    snapshot.source_count,
                    snapshot.healthy_source_count,
                    snapshot.signal_count,
                    snapshot.trend_count,
                    snapshot.corroborated_trend_count,
                    snapshot.top_ranked_trend_count,
                    snapshot.average_score,
                    snapshot.average_yield_rate_percent,
                    snapshot.success_rate_percent,
                )
                for snapshot in snapshots
            ],
        )
        self.connection.commit()

    def list_recent_snapshots(self, limit_per_family: int) -> dict[str, list[SourceFamilySnapshot]]:
        """Return recent family analytics ordered newest first for each family."""

        rows = self.connection.execute(
            """
            SELECT family, captured_at, source_count, healthy_source_count, signal_count,
                   trend_count, corroborated_trend_count, top_ranked_trend_count,
                   average_score, average_yield_rate_percent, success_rate_percent
            FROM source_family_snapshots
            ORDER BY captured_at DESC, id DESC
            """
        ).fetchall()
        grouped: dict[str, list[SourceFamilySnapshot]] = {}
        for row in rows:
            family = row["family"]
            snapshots = grouped.setdefault(family, [])
            if len(snapshots) >= limit_per_family:
                continue
            snapshots.append(
                SourceFamilySnapshot(
                    family=family,
                    captured_at=datetime.fromisoformat(row["captured_at"]),
                    source_count=row["source_count"],
                    healthy_source_count=row["healthy_source_count"],
                    signal_count=row["signal_count"],
                    trend_count=row["trend_count"],
                    corroborated_trend_count=row["corroborated_trend_count"],
                    top_ranked_trend_count=row["top_ranked_trend_count"],
                    average_score=row["average_score"],
                    average_yield_rate_percent=row["average_yield_rate_percent"],
                    success_rate_percent=row["success_rate_percent"],
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
                SELECT ar.id, ar.watchlist_id, ar.thesis_id, ar.name, ar.rule_type, ar.threshold, ar.enabled, ar.created_at
                FROM alert_rules ar
                INNER JOIN watchlists w ON w.id = ar.watchlist_id
                WHERE w.owner_user_id IS NULL
                ORDER BY ar.created_at DESC, ar.id DESC
                """
            ).fetchall()
        else:
            rows = self.connection.execute(
                """
                SELECT ar.id, ar.watchlist_id, ar.thesis_id, ar.name, ar.rule_type, ar.threshold, ar.enabled, ar.created_at
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
                thesis_id=row["thesis_id"],
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
            SELECT id, watchlist_id, thesis_id, name, rule_type, threshold, enabled, created_at
            FROM alert_rules
            ORDER BY created_at DESC, id DESC
            """
        ).fetchall()
        return [
            AlertRule(
                id=row["id"],
                watchlist_id=row["watchlist_id"],
                thesis_id=row["thesis_id"],
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
        thesis_id: int | None = None,
    ) -> AlertRule:
        """Create and return an alert rule."""

        alert_rule_id = execute_insert_and_return_id(
            self.connection,
            """
            INSERT INTO alert_rules (watchlist_id, thesis_id, name, rule_type, threshold, enabled)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (watchlist_id, thesis_id, name, rule_type, threshold, int(enabled)),
        )
        self.connection.commit()
        row = self.connection.execute(
            """
            SELECT id, watchlist_id, thesis_id, name, rule_type, threshold, enabled, created_at
            FROM alert_rules
            WHERE id = ?
            """,
            (alert_rule_id,),
        ).fetchone()
        return AlertRule(
            id=row["id"],
            watchlist_id=row["watchlist_id"],
            thesis_id=row["thesis_id"],
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

    def list_trend_theses(self, owner_user_id: int | None = None) -> list[TrendThesis]:
        """Return saved theses for the given owner."""

        if owner_user_id is None:
            rows = self.connection.execute(
                """
                SELECT tt.id, tt.watchlist_id, tt.name, tt.lens, tt.keyword_query, tt.source, tt.category,
                       tt.stage, tt.confidence, tt.meta_trend, tt.audience, tt.market, tt.language,
                       tt.geo_country, tt.minimum_score, tt.hide_recurring, tt.notify_on_match,
                       tt.created_at, tt.updated_at
                FROM trend_theses tt
                INNER JOIN watchlists w ON w.id = tt.watchlist_id
                WHERE w.owner_user_id IS NULL
                ORDER BY tt.updated_at DESC, tt.id DESC
                """
            ).fetchall()
        else:
            rows = self.connection.execute(
                """
                SELECT tt.id, tt.watchlist_id, tt.name, tt.lens, tt.keyword_query, tt.source, tt.category,
                       tt.stage, tt.confidence, tt.meta_trend, tt.audience, tt.market, tt.language,
                       tt.geo_country, tt.minimum_score, tt.hide_recurring, tt.notify_on_match,
                       tt.created_at, tt.updated_at
                FROM trend_theses tt
                INNER JOIN watchlists w ON w.id = tt.watchlist_id
                WHERE w.owner_user_id = ?
                ORDER BY tt.updated_at DESC, tt.id DESC
                """,
                (owner_user_id,),
            ).fetchall()
        return [self._trend_thesis_from_row(row) for row in rows]

    def list_trend_theses_for_watchlists(self, watchlist_ids: list[int]) -> dict[int, list[TrendThesis]]:
        """Return theses grouped by watchlist id."""

        if not watchlist_ids:
            return {}
        placeholders = sql_placeholders(self.connection, len(watchlist_ids))
        rows = self.connection.execute(
            f"""
            SELECT id, watchlist_id, name, lens, keyword_query, source, category, stage, confidence,
                   meta_trend, audience, market, language, geo_country, minimum_score, hide_recurring,
                   notify_on_match, created_at, updated_at
            FROM trend_theses
            WHERE watchlist_id IN ({placeholders})
            ORDER BY updated_at DESC, id DESC
            """,
            tuple(watchlist_ids),
        ).fetchall()
        grouped: dict[int, list[TrendThesis]] = {}
        for row in rows:
            thesis = self._trend_thesis_from_row(row)
            grouped.setdefault(thesis.watchlist_id, []).append(thesis)
        return grouped

    def create_trend_thesis(
        self,
        *,
        watchlist_id: int,
        name: str,
        lens: str,
        keyword_query: str | None = None,
        source: str | None = None,
        category: str | None = None,
        stage: str | None = None,
        confidence: str | None = None,
        meta_trend: str | None = None,
        audience: str | None = None,
        market: str | None = None,
        language: str | None = None,
        geo_country: str | None = None,
        minimum_score: float = 0.0,
        hide_recurring: bool = False,
        notify_on_match: bool = False,
    ) -> TrendThesis:
        """Create one saved thesis and optionally attach a thesis-match alert."""

        thesis_id = execute_insert_and_return_id(
            self.connection,
            """
            INSERT INTO trend_theses (
                watchlist_id, name, lens, keyword_query, source, category, stage, confidence, meta_trend,
                audience, market, language, geo_country, minimum_score, hide_recurring, notify_on_match
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                watchlist_id,
                name,
                lens,
                keyword_query,
                source,
                category,
                stage,
                confidence,
                meta_trend,
                audience,
                market,
                language,
                geo_country,
                minimum_score,
                int(hide_recurring),
                int(notify_on_match),
            ),
        )
        if notify_on_match:
            self.create_alert_rule(
                watchlist_id=watchlist_id,
                name=name,
                rule_type="thesis_match",
                threshold=0.0,
                thesis_id=thesis_id,
            )
        self.connection.commit()
        row = self.connection.execute(
            """
            SELECT id, watchlist_id, name, lens, keyword_query, source, category, stage, confidence,
                   meta_trend, audience, market, language, geo_country, minimum_score, hide_recurring,
                   notify_on_match, created_at, updated_at
            FROM trend_theses
            WHERE id = ?
            """,
            (thesis_id,),
        ).fetchone()
        return self._trend_thesis_from_row(row)

    def delete_trend_thesis(self, thesis_id: int, owner_user_id: int | None = None) -> bool:
        """Delete one thesis owned by the given user."""

        if owner_user_id is None:
            cursor = self.connection.execute(
                """
                DELETE FROM trend_theses
                WHERE id IN (
                    SELECT tt.id
                    FROM trend_theses tt
                    INNER JOIN watchlists w ON w.id = tt.watchlist_id
                    WHERE tt.id = ? AND w.owner_user_id IS NULL
                )
                """,
                (thesis_id,),
            )
        else:
            cursor = self.connection.execute(
                """
                DELETE FROM trend_theses
                WHERE id IN (
                    SELECT tt.id
                    FROM trend_theses tt
                    INNER JOIN watchlists w ON w.id = tt.watchlist_id
                    WHERE tt.id = ? AND w.owner_user_id = ?
                )
                """,
                (thesis_id, owner_user_id),
            )
        self.connection.commit()
        return cursor.rowcount > 0

    def list_trend_thesis_matches(self, owner_user_id: int | None = None) -> list[TrendThesisMatch]:
        """Return persisted thesis matches scoped to one owner."""

        if owner_user_id is None:
            rows = self.connection.execute(
                """
                SELECT tm.thesis_id, tm.trend_id, tm.trend_name, tm.active, tm.first_matched_at, tm.last_matched_at,
                       tm.lens_score, tm.total_score
                FROM trend_thesis_matches tm
                INNER JOIN trend_theses tt ON tt.id = tm.thesis_id
                INNER JOIN watchlists w ON w.id = tt.watchlist_id
                WHERE w.owner_user_id IS NULL
                ORDER BY tm.active DESC, tm.last_matched_at DESC, tm.lens_score DESC, tm.trend_name ASC
                """
            ).fetchall()
        else:
            rows = self.connection.execute(
                """
                SELECT tm.thesis_id, tm.trend_id, tm.trend_name, tm.active, tm.first_matched_at, tm.last_matched_at,
                       tm.lens_score, tm.total_score
                FROM trend_thesis_matches tm
                INNER JOIN trend_theses tt ON tt.id = tm.thesis_id
                INNER JOIN watchlists w ON w.id = tt.watchlist_id
                WHERE w.owner_user_id = ?
                ORDER BY tm.active DESC, tm.last_matched_at DESC, tm.lens_score DESC, tm.trend_name ASC
                """,
                (owner_user_id,),
            ).fetchall()
        return [self._trend_thesis_match_from_row(row) for row in rows]

    def replace_trend_thesis_matches(
        self,
        theses: list[TrendThesis],
        matches_by_thesis_id: dict[int, list[ThesisMatchCandidate]],
        *,
        matched_at: datetime,
    ) -> dict[int, list[TrendThesisMatch]]:
        """Upsert current thesis matches, deactivate stale ones, and return newly activated matches."""

        new_matches: dict[int, list[TrendThesisMatch]] = {}
        for thesis in theses:
            current_match_ids = {match.trend_id for match in matches_by_thesis_id.get(thesis.id, [])}
            existing_rows = self.connection.execute(
                """
                SELECT thesis_id, trend_id, trend_name, active, first_matched_at, last_matched_at, lens_score, total_score
                FROM trend_thesis_matches
                WHERE thesis_id = ?
                """,
                (thesis.id,),
            ).fetchall()
            existing_by_trend_id = {str(row["trend_id"]): row for row in existing_rows}

            for match in matches_by_thesis_id.get(thesis.id, []):
                existing_row = existing_by_trend_id.get(match.trend_id)
                if existing_row is None:
                    self.connection.execute(
                        """
                        INSERT INTO trend_thesis_matches (
                            thesis_id, trend_id, trend_name, active, first_matched_at, last_matched_at,
                            lens_score, total_score
                        )
                        VALUES (?, ?, ?, 1, ?, ?, ?, ?)
                        """,
                        (
                            thesis.id,
                            match.trend_id,
                            match.trend_name,
                            matched_at.isoformat(),
                            matched_at.isoformat(),
                            match.lens_score,
                            match.total_score,
                        ),
                    )
                    new_matches.setdefault(thesis.id, []).append(
                        TrendThesisMatch(
                            thesis_id=thesis.id,
                            trend_id=match.trend_id,
                            trend_name=match.trend_name,
                            active=True,
                            first_matched_at=matched_at,
                            last_matched_at=matched_at,
                            lens_score=match.lens_score,
                            total_score=match.total_score,
                        )
                    )
                    continue

                self.connection.execute(
                    """
                    UPDATE trend_thesis_matches
                    SET trend_name = ?, active = 1, last_matched_at = ?, lens_score = ?, total_score = ?
                    WHERE thesis_id = ? AND trend_id = ?
                    """,
                    (
                        match.trend_name,
                        matched_at.isoformat(),
                        match.lens_score,
                        match.total_score,
                        thesis.id,
                        match.trend_id,
                    ),
                )
                if not bool(existing_row["active"]):
                    new_matches.setdefault(thesis.id, []).append(
                        TrendThesisMatch(
                            thesis_id=thesis.id,
                            trend_id=match.trend_id,
                            trend_name=match.trend_name,
                            active=True,
                            first_matched_at=datetime.fromisoformat(existing_row["first_matched_at"]),
                            last_matched_at=matched_at,
                            lens_score=match.lens_score,
                            total_score=match.total_score,
                        )
                    )

            if current_match_ids:
                placeholders = sql_placeholders(self.connection, len(current_match_ids))
                self.connection.execute(
                    f"""
                    UPDATE trend_thesis_matches
                    SET active = 0
                    WHERE thesis_id = ? AND trend_id NOT IN ({placeholders})
                    """,
                    [thesis.id, *current_match_ids],
                )
            else:
                self.connection.execute(
                    """
                    UPDATE trend_thesis_matches
                    SET active = 0
                    WHERE thesis_id = ?
                    """,
                    (thesis.id,),
                )
        self.connection.commit()
        return new_matches

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

    @staticmethod
    def _trend_thesis_from_row(row: RowMapping) -> TrendThesis:
        return TrendThesis(
            id=row["id"],
            watchlist_id=row["watchlist_id"],
            name=row["name"],
            lens=row["lens"],
            keyword_query=row["keyword_query"],
            source=row["source"],
            category=row["category"],
            stage=row["stage"],
            confidence=row["confidence"],
            meta_trend=row["meta_trend"],
            audience=row["audience"],
            market=row["market"],
            language=row["language"],
            geo_country=row["geo_country"],
            minimum_score=float(row["minimum_score"] or 0.0),
            hide_recurring=bool(row["hide_recurring"]),
            notify_on_match=bool(row["notify_on_match"]),
            created_at=datetime.fromisoformat(row["created_at"]),
            updated_at=datetime.fromisoformat(row["updated_at"]),
        )

    @staticmethod
    def _trend_thesis_match_from_row(row: RowMapping) -> TrendThesisMatch:
        return TrendThesisMatch(
            thesis_id=row["thesis_id"],
            trend_id=row["trend_id"],
            trend_name=row["trend_name"],
            active=bool(row["active"]),
            first_matched_at=datetime.fromisoformat(row["first_matched_at"]),
            last_matched_at=datetime.fromisoformat(row["last_matched_at"]),
            lens_score=round(float(row["lens_score"] or 0.0), 1),
            total_score=round(float(row["total_score"] or 0.0), 1),
        )

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
            get_connection_dialect(self.connection).insert_or_ignore_statement(
                "watchlist_items",
                ("watchlist_id", "trend_id", "trend_name"),
            ),
            (watchlist_id, trend_id, trend_name),
        )

    def _upsert_share_daily_access(self, share_id: int, access_date: str) -> None:
        """Upsert the per-day share access row."""

        self.connection.execute(
            get_connection_dialect(self.connection).incrementing_upsert_statement(
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
    MARKET_FOOTPRINT_CONFIG = {
        "google_trends": {
            "metric_key": "search_traffic",
            "label": "Google search traffic",
            "unit": "searches",
            "period": "current run",
            "aggregation": "max",
            "confidence": 0.88,
            "is_estimated": False,
            "priority": 1,
        },
        "wikipedia": {
            "metric_key": "page_views",
            "label": "Wikipedia views",
            "unit": "views",
            "period": "daily",
            "aggregation": "max",
            "confidence": 0.92,
            "is_estimated": False,
            "priority": 2,
        },
        "github": {
            "metric_key": "stars_forks",
            "label": "GitHub stars + forks",
            "unit": "stars/forks",
            "period": "current snapshot",
            "aggregation": "max",
            "confidence": 0.76,
            "is_estimated": False,
            "priority": 3,
        },
        "hacker_news": {
            "metric_key": "engagement",
            "label": "Hacker News engagement",
            "unit": "points/comments",
            "period": "captured stories",
            "aggregation": "sum",
            "confidence": 0.7,
            "is_estimated": False,
            "priority": 4,
        },
        "twitter": {
            "metric_key": "engagement",
            "label": "X engagement",
            "unit": "engagement",
            "period": "captured posts",
            "aggregation": "sum",
            "confidence": 0.68,
            "is_estimated": False,
            "priority": 5,
        },
        "reddit": {
            "metric_key": "engagement",
            "label": "Reddit engagement",
            "unit": "engagement",
            "period": "captured posts",
            "aggregation": "sum",
            "confidence": 0.46,
            "is_estimated": True,
            "priority": 6,
        },
        "polymarket": {
            "metric_key": "activity",
            "label": "Prediction market activity",
            "unit": "activity",
            "period": "current markets",
            "aggregation": "max",
            "confidence": 0.52,
            "is_estimated": True,
            "priority": 7,
        },
        "producthunt": {
            "metric_key": "launch_score",
            "label": "Product Hunt launch score",
            "unit": "score",
            "period": "featured launches",
            "aggregation": "max",
            "confidence": 0.4,
            "is_estimated": True,
            "priority": 8,
        },
        "google_search": {
            "metric_key": "monthly_searches",
            "label": "Monthly Google searches",
            "unit": "searches",
            "period": "monthly",
            "aggregation": "max",
            "confidence": 0.9,
            "is_estimated": False,
            "priority": 1,
        },
        "youtube": {
            "metric_key": "video_views",
            "label": "YouTube views",
            "unit": "views",
            "period": "search footprint",
            "aggregation": "max",
            "confidence": 0.9,
            "is_estimated": False,
            "priority": 2,
        },
        "tiktok": {
            "metric_key": "video_views",
            "label": "TikTok views",
            "unit": "views",
            "period": "search footprint",
            "aggregation": "max",
            "confidence": 0.9,
            "is_estimated": False,
            "priority": 3,
        },
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
                knowledge_score, advertising_score, diversity_score, source_counts_json, evidence_json, latest_timestamp, display_name,
                is_published
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [
                (
                    score.topic,
                    score.total_score,
                    score.search_score,
                    score.social_score,
                    score.developer_score,
                    score.knowledge_score,
                    score.advertising_score,
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
        self._upsert_trend_entities(scores, published_topics=published_topics)
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
                knowledge_score, advertising_score, diversity_score, source_counts_json, evidence_json, latest_timestamp, display_name,
                is_published
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
                    score.advertising_score,
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
        self._upsert_trend_entities(scores, published_topics=published_topics)
        published_scores = [score for score in scores if score.topic in published_topics]
        self.refresh_trend_metric_snapshots(published_scores, captured_at=captured_at)
        self.connection.commit()
        return run_id

    def list_scores(self, limit: int) -> list[TrendScoreResult]:
        """Return ranked scores from persistent storage."""

        rows = self.connection.execute(
            """
            SELECT topic, total_score, search_score, social_score, developer_score,
                   knowledge_score, advertising_score, diversity_score, source_counts_json, evidence_json, latest_timestamp, display_name
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

    def get_trend_entity(self, topic: str) -> TrendEntity | None:
        """Return persisted canonical metadata for one topic when available."""

        row = self.connection.execute(
            """
            SELECT topic_key, canonical_name, category, meta_trend, stage, confidence, summary, why_now_json,
                   first_seen_at, last_seen_at
            FROM trend_entities
            WHERE topic_key = ?
            """,
            (topic,),
        ).fetchone()
        if row is None:
            return None
        entity = self._trend_entity_from_row(row)
        hydrated = TrendEntity(
            topic_key=entity.topic_key,
            canonical_name=entity.canonical_name,
            category=entity.category,
            meta_trend=entity.meta_trend,
            stage=entity.stage,
            confidence=entity.confidence,
            summary=entity.summary,
            why_now=entity.why_now,
            aliases=self.list_trend_aliases(self._slugify_topic(topic)),
            first_seen_at=entity.first_seen_at,
            last_seen_at=entity.last_seen_at,
        )
        override = self.get_trend_curation_override(self._slugify_topic(topic))
        return self._apply_curation_override(hydrated, override)

    def list_trend_aliases(self, trend_id: str) -> list[str]:
        """Return persisted aliases for one trend id."""

        rows = self.connection.execute(
            """
            SELECT alias
            FROM trend_aliases
            WHERE topic_key = ?
            ORDER BY alias ASC
            """,
            (trend_id,),
        ).fetchall()
        return [row["alias"] for row in rows]

    def get_trend_curation_override(self, topic_key: str) -> TrendCurationOverride | None:
        """Return one persisted manual curation override when present."""

        row = self.connection.execute(
            """
            SELECT topic_key, suppress, canonical_topic_key, preferred_name, preferred_meta_trend,
                   preferred_stage, preferred_summary
            FROM trend_curation_overrides
            WHERE topic_key = ?
            """,
            (topic_key,),
        ).fetchone()
        if row is None:
            return None
        return self._curation_override_from_row(row)

    def upsert_trend_curation_override(
        self,
        topic_key: str,
        *,
        suppress: bool = False,
        canonical_topic_key: str | None = None,
        preferred_name: str | None = None,
        preferred_meta_trend: str | None = None,
        preferred_stage: str | None = None,
        preferred_summary: str | None = None,
    ) -> None:
        """Persist a manual curation override for one trend."""

        self.connection.execute(
            """
            INSERT INTO trend_curation_overrides (
                topic_key, suppress, canonical_topic_key, preferred_name, preferred_meta_trend,
                preferred_stage, preferred_summary
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(topic_key)
            DO UPDATE SET
                suppress = excluded.suppress,
                canonical_topic_key = excluded.canonical_topic_key,
                preferred_name = excluded.preferred_name,
                preferred_meta_trend = excluded.preferred_meta_trend,
                preferred_stage = excluded.preferred_stage,
                preferred_summary = excluded.preferred_summary,
                updated_at = CURRENT_TIMESTAMP
            """,
            (
                topic_key,
                int(suppress),
                canonical_topic_key,
                preferred_name,
                preferred_meta_trend,
                preferred_stage,
                preferred_summary,
            ),
        )
        self.connection.commit()

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
                   knowledge_score, advertising_score, diversity_score, source_counts_json, evidence_json, latest_timestamp, display_name
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
                   knowledge_score, advertising_score, diversity_score, source_counts_json, evidence_json, latest_timestamp, display_name
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
                       knowledge_score, advertising_score, diversity_score, source_counts_json, evidence_json, latest_timestamp, display_name
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

    def batch_get_topic_histories(
        self, topics: list[str], limit_runs: int,
    ) -> dict[str, list[TrendHistoryPoint]]:
        """Return recent history for multiple topics in a single query."""

        if not topics:
            return {}
        # Fetch the N most recent runs first
        run_rows = self.connection.execute(
            "SELECT id, captured_at FROM trend_runs ORDER BY captured_at DESC, id DESC LIMIT ?",
            (limit_runs,),
        ).fetchall()
        if not run_rows:
            return {topic: [] for topic in topics}
        run_ids = [row["id"] for row in run_rows]
        run_captured_at = {row["id"]: row["captured_at"] for row in run_rows}
        placeholders_topics = ",".join("?" for _ in topics)
        placeholders_runs = ",".join("?" for _ in run_ids)
        rows = self.connection.execute(
            f"""
            SELECT topic, run_id, rank_position, total_score
            FROM trend_score_snapshots
            WHERE topic IN ({placeholders_topics})
              AND run_id IN ({placeholders_runs})
              AND is_published = 1
            ORDER BY run_id DESC
            """,
            topics + run_ids,
        ).fetchall()
        result: dict[str, list[TrendHistoryPoint]] = {topic: [] for topic in topics}
        for row in rows:
            captured_at_str = run_captured_at.get(row["run_id"])
            if captured_at_str is None:
                continue
            result[row["topic"]].append(
                TrendHistoryPoint(
                    captured_at=datetime.fromisoformat(captured_at_str),
                    rank=row["rank_position"],
                    score_total=row["total_score"],
                )
            )
        return result

    def batch_get_first_seen(self, topics: list[str]) -> dict[str, datetime | None]:
        """Return first seen timestamps for multiple topics in a single query."""

        if not topics:
            return {}
        placeholders = ",".join("?" for _ in topics)
        rows = self.connection.execute(
            f"""
            SELECT s.topic, MIN(r.captured_at) AS first_captured_at
            FROM trend_score_snapshots s
            INNER JOIN trend_runs r ON r.id = s.run_id
            WHERE s.topic IN ({placeholders}) AND s.is_published = 1
            GROUP BY s.topic
            """,
            topics,
        ).fetchall()
        result: dict[str, datetime | None] = {topic: None for topic in topics}
        for row in rows:
            result[row["topic"]] = datetime.fromisoformat(row["first_captured_at"])
        return result

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
        latest_scores = self._filter_suppressed_scores(latest_scores)

        from app.scoring.forecast import describe_forecast_direction, forecast_trend

        # Batch-fetch histories and first-seen dates (2 queries instead of N×3)
        topics = [score.topic for score in latest_scores]
        forecast_limit = max(history_limit, 6)
        histories = self.batch_get_topic_histories(topics, limit_runs=forecast_limit)
        first_seen_dates = self.batch_get_first_seen(topics)

        records: list[TrendExplorerRecord] = []
        for rank, score in enumerate(latest_scores, start=1):
            full_history = histories.get(score.topic, [])
            recent_history = full_history[:history_limit]
            ordered_history = list(reversed(full_history))
            momentum = self._build_momentum(score.total_score, recent_history)
            forecast = forecast_trend(ordered_history)
            seasonality = self.get_topic_seasonality(score.topic)
            entity = self._get_or_create_trend_entity(score, recent_history)
            records.append(
                TrendExplorerRecord(
                    id=self._slugify_topic(score.topic),
                    name=entity.canonical_name,
                    category=entity.category,
                    meta_trend=entity.meta_trend,
                    stage=entity.stage,
                    confidence=entity.confidence,
                    summary=entity.summary,
                    status=self._build_trend_status(momentum),
                    volatility=self._build_volatility_label(momentum),
                    rank=rank,
                    previous_rank=momentum.previous_rank,
                    rank_change=momentum.rank_change,
                    first_seen_at=first_seen_dates.get(score.topic),
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
        latest_scores = self._filter_suppressed_scores(latest_scores)

        from app.scoring.forecast import forecast_trend
        from app.scoring.opportunity import score_opportunities
        from app.scoring.predictor import predict_breakouts

        # Batch-fetch histories and first-seen dates (2 queries instead of N×3)
        topics = [score.topic for score in latest_scores]
        all_histories = self.batch_get_topic_histories(topics, limit_runs=history_limit)
        first_seen_by_topic = self.batch_get_first_seen(topics)

        history_by_topic: dict[str, list[TrendHistoryPoint]] = {}
        momentum_by_topic: dict[str, TrendMomentum] = {}
        forecast_by_topic: dict[str, TrendForecast | None] = {}
        seasonality_by_topic: dict[str, SeasonalityResult | None] = {}
        status_by_topic: dict[str, str] = {}
        ranks_by_topic: dict[str, int] = {}

        for rank, score in enumerate(latest_scores, start=1):
            raw_history = all_histories.get(score.topic, [])
            history = list(reversed(raw_history))
            momentum = self._build_momentum(score.total_score, raw_history)
            history_by_topic[score.topic] = history
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
            entity = self._get_or_create_trend_entity(score, list(reversed(history)))
            records.append(
                TrendDetailRecord(
                    id=slug,
                    name=entity.canonical_name,
                    category=entity.category,
                    meta_trend=entity.meta_trend,
                    stage=entity.stage,
                    confidence=entity.confidence,
                    summary=entity.summary,
                    why_now=entity.why_now,
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
                        discovery=opportunity.discovery if opportunity is not None else 0.0,
                        seo=opportunity.seo if opportunity is not None else 0.0,
                        content=opportunity.content if opportunity is not None else 0.0,
                        product=opportunity.product if opportunity is not None else 0.0,
                        investment=opportunity.investment if opportunity is not None else 0.0,
                        reasoning=opportunity.reasoning if opportunity is not None else ["Limited actionability signals"],
                    ),
                    source_count=len(score.source_counts),
                    signal_count=sum(score.source_counts.values()),
                    sources=sorted(score.source_counts),
                    aliases=entity.aliases,
                    history=history,
                    source_breakdown=self.get_topic_source_breakdown(score.topic),
                    source_contributions=self.get_topic_source_contributions(score.topic, score),
                    market_footprint=self.get_topic_market_footprint(score.topic),
                    geo_summary=self.get_topic_geo_summary(score.topic),
                    audience_summary=self.get_topic_audience_summary(score.topic),
                    evidence_items=self.get_topic_evidence(score.topic, limit=evidence_limit),
                    primary_evidence=self.get_primary_evidence(score.topic),
                    duplicate_candidates=[],
                    related_trends=[],
                    seasonality=seasonality_by_topic[score.topic],
                )
            )
        return self._attach_related_trends(records)

    def refresh_trend_metric_snapshots(
        self,
        scores: list[TrendScoreResult],
        *,
        captured_at: datetime,
    ) -> None:
        """Replace persisted market-footprint snapshots for the current score set."""

        topics = [score.topic for score in scores]
        if not topics:
            return
        self.connection.executemany(
            "DELETE FROM trend_metric_snapshots WHERE topic_key = ?",
            [(topic,) for topic in topics],
        )
        rows: list[tuple[object, ...]] = []
        for score in scores:
            for snapshot in self._build_topic_market_footprint(score.topic, captured_at):
                rows.append(
                    (
                        score.topic,
                        snapshot.source,
                        snapshot.metric_key,
                        snapshot.label,
                        snapshot.value_numeric,
                        snapshot.value_display,
                        snapshot.unit,
                        snapshot.period,
                        snapshot.captured_at.isoformat(),
                        snapshot.confidence,
                        snapshot.provenance_url,
                        int(snapshot.is_estimated),
                    )
                )
        if rows:
            self.connection.executemany(
                """
                INSERT INTO trend_metric_snapshots (
                    topic_key, source, metric_key, label, value_numeric, value_display,
                    unit, period, captured_at, confidence, provenance_url, is_estimated
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(topic_key, source, metric_key)
                DO UPDATE SET
                    label = excluded.label,
                    value_numeric = excluded.value_numeric,
                    value_display = excluded.value_display,
                    unit = excluded.unit,
                    period = excluded.period,
                    captured_at = excluded.captured_at,
                    confidence = excluded.confidence,
                    provenance_url = excluded.provenance_url,
                    is_estimated = excluded.is_estimated
                """,
                rows,
            )

    def get_topic_market_footprint(self, topic: str) -> list[TrendMetricSnapshot]:
        """Return persisted market-footprint metrics for one topic."""

        rows = self.connection.execute(
            """
            SELECT source, metric_key, label, value_numeric, value_display, unit, period,
                   captured_at, confidence, provenance_url, is_estimated
            FROM trend_metric_snapshots
            WHERE topic_key = ?
            ORDER BY value_numeric DESC, source ASC
            """,
            (topic,),
        ).fetchall()
        metrics = [
            TrendMetricSnapshot(
                source=row["source"],
                metric_key=row["metric_key"],
                label=row["label"],
                value_numeric=float(row["value_numeric"] or 0.0),
                value_display=row["value_display"] or "0",
                unit=row["unit"] or "",
                period=row["period"] or "",
                captured_at=self._coerce_datetime_value(row["captured_at"]),
                confidence=round(float(row["confidence"] or 0.0), 2),
                provenance_url=row["provenance_url"],
                is_estimated=bool(row["is_estimated"]),
            )
            for row in rows
        ]
        return sorted(
            metrics,
            key=lambda item: (
                self.MARKET_FOOTPRINT_CONFIG.get(item.source, {}).get("priority", 999),
                -item.value_numeric,
                item.source,
            ),
        )

    def upsert_topic_market_footprint(
        self,
        topic: str,
        snapshots: list[TrendMetricSnapshot],
    ) -> None:
        """Upsert additional market-footprint snapshots for one topic."""

        if not snapshots:
            return
        self.connection.executemany(
            """
            INSERT INTO trend_metric_snapshots (
                topic_key, source, metric_key, label, value_numeric, value_display,
                unit, period, captured_at, confidence, provenance_url, is_estimated
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(topic_key, source, metric_key)
            DO UPDATE SET
                label = excluded.label,
                value_numeric = excluded.value_numeric,
                value_display = excluded.value_display,
                unit = excluded.unit,
                period = excluded.period,
                captured_at = excluded.captured_at,
                confidence = excluded.confidence,
                provenance_url = excluded.provenance_url,
                is_estimated = excluded.is_estimated
            """,
            [
                (
                    topic,
                    snapshot.source,
                    snapshot.metric_key,
                    snapshot.label,
                    snapshot.value_numeric,
                    snapshot.value_display,
                    snapshot.unit,
                    snapshot.period,
                    snapshot.captured_at.isoformat(),
                    snapshot.confidence,
                    snapshot.provenance_url,
                    int(snapshot.is_estimated),
                )
                for snapshot in snapshots
            ],
        )

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
            "advertising": 0,
        }
        for row in rows:
            signal_type = row["signal_type"]
            if signal_type not in total_counts:
                continue
            total_counts[signal_type] += row["signal_count"]
            source_entry = by_source.setdefault(
                row["source"],
                {
                    "counts": {"social": 0, "developer": 0, "knowledge": 0, "search": 0, "advertising": 0},
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
            advertising_score = self._component_source_share(score.advertising_score, counts["advertising"], total_counts["advertising"])  # type: ignore[index]
            diversity_score = round(score.diversity_score / source_total, 2)
            estimated_score = round(
                social_score + developer_score + knowledge_score + search_score + advertising_score + diversity_score,
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
                    advertising_score=advertising_score,
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

    def _upsert_trend_entities(
        self,
        scores: list[TrendScoreResult],
        *,
        published_topics: set[str],
    ) -> None:
        """Persist canonical metadata for currently published trends."""

        published_scores = [score for score in scores if score.topic in published_topics]
        overrides = self._list_trend_curation_overrides()
        duplicate_rows, duplicate_penalties = self._build_duplicate_candidates(published_scores, overrides)
        rows = [
            self._build_trend_entity_row(
                score,
                self.get_topic_history(score.topic, limit_runs=6),
                duplicate_penalty=duplicate_penalties.get(self._slugify_topic(score.topic), 0.0),
                override=overrides.get(self._slugify_topic(score.topic)),
            )
            for score in scores
            if score.topic in published_topics
        ]
        if not rows:
            return

        self.connection.executemany(
            """
            INSERT INTO trend_entities (
                topic_key, canonical_name, category, meta_trend, stage, confidence, summary, why_now_json,
                first_seen_at, last_seen_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(topic_key)
            DO UPDATE SET
                canonical_name = excluded.canonical_name,
                category = excluded.category,
                meta_trend = excluded.meta_trend,
                stage = excluded.stage,
                confidence = excluded.confidence,
                summary = excluded.summary,
                why_now_json = excluded.why_now_json,
                first_seen_at = COALESCE(trend_entities.first_seen_at, excluded.first_seen_at),
                last_seen_at = excluded.last_seen_at,
                updated_at = CURRENT_TIMESTAMP
            """,
            rows,
        )
        self._replace_trend_aliases(scores, published_topics=published_topics)
        self._replace_duplicate_candidates(published_scores, duplicate_rows)

    def _get_or_create_trend_entity(
        self,
        score: TrendScoreResult,
        history: list[TrendHistoryPoint],
    ) -> TrendEntity:
        """Return canonical trend metadata, creating a fallback row when needed."""

        entity = self.get_trend_entity(score.topic)
        if entity is not None:
            return entity

        row = self._build_trend_entity_row(
            score,
            history,
            override=self.get_trend_curation_override(self._slugify_topic(score.topic)),
        )
        self.connection.execute(
            """
            INSERT INTO trend_entities (
                topic_key, canonical_name, category, meta_trend, stage, confidence, summary, why_now_json,
                first_seen_at, last_seen_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(topic_key)
            DO UPDATE SET
                canonical_name = excluded.canonical_name,
                category = excluded.category,
                meta_trend = excluded.meta_trend,
                stage = excluded.stage,
                confidence = excluded.confidence,
                summary = excluded.summary,
                why_now_json = excluded.why_now_json,
                first_seen_at = COALESCE(trend_entities.first_seen_at, excluded.first_seen_at),
                last_seen_at = excluded.last_seen_at,
                updated_at = CURRENT_TIMESTAMP
            """,
            row,
        )
        self.connection.commit()
        return self.get_trend_entity(score.topic) or self._trend_entity_from_tuple(row)

    def _replace_trend_aliases(
        self,
        scores: list[TrendScoreResult],
        *,
        published_topics: set[str],
    ) -> None:
        """Replace persisted aliases for the current published trend set."""

        published_scores = [score for score in scores if score.topic in published_topics]
        if not published_scores:
            return

        self.connection.executemany(
            "DELETE FROM trend_aliases WHERE topic_key = ?",
            [(self._slugify_topic(score.topic),) for score in published_scores],
        )
        alias_rows = [
            (self._slugify_topic(score.topic), alias)
            for score in published_scores
            for alias in self._build_trend_aliases(score)
        ]
        if alias_rows:
            self.connection.executemany(
                """
                INSERT INTO trend_aliases (topic_key, alias)
                VALUES (?, ?)
                ON CONFLICT(topic_key, alias) DO NOTHING
                """,
                alias_rows,
            )

    def _build_trend_entity_row(
        self,
        score: TrendScoreResult,
        history: list[TrendHistoryPoint],
        *,
        duplicate_penalty: float = 0.0,
        override: TrendCurationOverride | None = None,
    ) -> tuple[object, ...]:
        """Build one persisted trend-entity row from the current trend state."""

        ordered_history = sorted(history, key=lambda point: point.captured_at, reverse=True)
        momentum = self._build_momentum(score.total_score, ordered_history)
        category = self._build_category(score.topic, score.source_counts)
        first_seen_at = self.get_first_seen_at(score.topic)
        canonical_name = override.preferred_name if override and override.preferred_name else (
            score.display_name or build_display_name(score.topic, score.evidence)
        )
        meta_trend = override.preferred_meta_trend if override and override.preferred_meta_trend else self._build_meta_trend(category)
        stage = override.preferred_stage if override and override.preferred_stage else self._build_trend_stage(
            momentum,
            len(ordered_history),
            score.total_score,
        )
        summary = override.preferred_summary if override and override.preferred_summary else self._build_trend_summary(
            score,
            category,
            momentum,
            len(ordered_history),
        )
        return (
            score.topic,
            canonical_name,
            category,
            meta_trend,
            stage,
            self._build_trend_confidence(score, ordered_history, duplicate_penalty=duplicate_penalty),
            summary,
            json.dumps(self._build_why_now(
                score,
                momentum,
                len(ordered_history),
                evidence_titles=self._get_evidence_titles_for_why_now(score.topic),
            )),
            first_seen_at.isoformat() if first_seen_at is not None else None,
            score.latest_timestamp.isoformat(),
        )

    @staticmethod
    def _trend_entity_from_row(row: RowMapping) -> TrendEntity:
        """Build a trend entity from a stored row."""

        return TrendEntity(
            topic_key=row["topic_key"],
            canonical_name=row["canonical_name"],
            category=row["category"],
            meta_trend=row["meta_trend"],
            stage=row["stage"],
            confidence=round(float(row["confidence"] or 0.0), 3),
            summary=row["summary"] or "",
            why_now=list(json.loads(row["why_now_json"] or "[]")),
            aliases=[],
            first_seen_at=datetime.fromisoformat(row["first_seen_at"]) if row["first_seen_at"] else None,
            last_seen_at=datetime.fromisoformat(row["last_seen_at"]),
        )

    @staticmethod
    def _trend_entity_from_tuple(row: tuple[object, ...]) -> TrendEntity:
        """Build a trend entity from an upsert tuple."""

        first_seen_at = row[8]
        return TrendEntity(
            topic_key=str(row[0]),
            canonical_name=str(row[1]),
            category=str(row[2]),
            meta_trend=str(row[3]),
            stage=str(row[4]),
            confidence=round(float(row[5]), 3),
            summary=str(row[6]),
            why_now=list(json.loads(str(row[7]))),
            aliases=[],
            first_seen_at=datetime.fromisoformat(str(first_seen_at)) if first_seen_at else None,
            last_seen_at=datetime.fromisoformat(str(row[9])),
        )

    @staticmethod
    def _coerce_datetime_value(value: object) -> datetime:
        """Return a datetime from either a native adapter value or an ISO string."""

        if isinstance(value, datetime):
            return value
        return datetime.fromisoformat(str(value))

    @staticmethod
    def _curation_override_from_row(row: RowMapping) -> TrendCurationOverride:
        """Build a curation override model from one database row."""

        return TrendCurationOverride(
            topic_key=row["topic_key"],
            suppress=bool(row["suppress"]),
            canonical_topic_key=row["canonical_topic_key"],
            preferred_name=row["preferred_name"],
            preferred_meta_trend=row["preferred_meta_trend"],
            preferred_stage=row["preferred_stage"],
            preferred_summary=row["preferred_summary"],
        )

    def _list_trend_curation_overrides(self) -> dict[str, TrendCurationOverride]:
        """Return all persisted curation overrides keyed by topic id."""

        rows = self.connection.execute(
            """
            SELECT topic_key, suppress, canonical_topic_key, preferred_name, preferred_meta_trend,
                   preferred_stage, preferred_summary
            FROM trend_curation_overrides
            """
        ).fetchall()
        return {
            row["topic_key"]: self._curation_override_from_row(row)
            for row in rows
        }

    @staticmethod
    def _apply_curation_override(
        entity: TrendEntity,
        override: TrendCurationOverride | None,
    ) -> TrendEntity:
        """Apply manual curation fields on top of a persisted entity."""

        if override is None:
            return entity
        return TrendEntity(
            topic_key=entity.topic_key,
            canonical_name=override.preferred_name or entity.canonical_name,
            category=entity.category,
            meta_trend=override.preferred_meta_trend or entity.meta_trend,
            stage=override.preferred_stage or entity.stage,
            confidence=entity.confidence,
            summary=override.preferred_summary or entity.summary,
            why_now=entity.why_now,
            aliases=entity.aliases,
            first_seen_at=entity.first_seen_at,
            last_seen_at=entity.last_seen_at,
        )

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
            advertising_score=row["advertising_score"],
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
    def _build_meta_trend(category: str) -> str:
        """Map explorer categories into broader trend database buckets."""

        meta_trend_map = {
            "ai-machine-learning": "AI and automation",
            "developer-tools": "Developer workflows",
            "consumer-products": "Consumer behavior",
            "fintech-crypto": "Financial technology",
            "health-biotech": "Health and biotech",
            "climate-energy": "Climate and energy",
            "enterprise-software": "Business software",
        }
        return meta_trend_map.get(category, category.replace("-", " ").title())

    @staticmethod
    def _build_trend_stage(momentum: TrendMomentum, history_length: int, total_score: float) -> str:
        """Return a coarse lifecycle stage for a trend."""

        if momentum.previous_rank is None or history_length <= 2:
            return "nascent"
        if (momentum.rank_change or 0) < 0 or (momentum.percent_delta or 0) < 0:
            return "cooling"
        if (momentum.rank_change or 0) >= 3 or (momentum.percent_delta or 0) >= 25:
            return "breakout"
        if history_length >= 5 and total_score >= 30:
            return "validated"
        if (momentum.rank_change or 0) > 0 or (momentum.percent_delta or 0) > 0:
            return "rising"
        return "steady"

    @staticmethod
    def _build_trend_confidence(
        score: TrendScoreResult,
        history: list[TrendHistoryPoint],
        *,
        duplicate_penalty: float = 0.0,
    ) -> float:
        """Estimate how trustworthy a trend is from breadth and continuity."""

        source_factor = min(len(score.source_counts) / 4.0, 1.0)
        signal_factor = min(sum(score.source_counts.values()) / 6.0, 1.0)
        history_factor = min(len(history) / 5.0, 1.0)
        evidence_factor = min(len(score.evidence) / 5.0, 1.0)
        confidence = (
            source_factor * 0.35
            + signal_factor * 0.2
            + history_factor * 0.3
            + evidence_factor * 0.15
        )
        return round(max(0.0, min(1.0, confidence - duplicate_penalty)), 3)

    @staticmethod
    def _build_trend_summary(
        score: TrendScoreResult,
        category: str,
        momentum: TrendMomentum,
        history_length: int,
    ) -> str:
        """Return a compact reusable database summary for a trend."""

        category_label = format_category_label(category)
        source_count = len(score.source_counts)
        signal_count = sum(score.source_counts.values())
        stage = TrendScoreRepository._build_trend_stage(momentum, history_length, score.total_score)
        category_descriptor = "trend" if category == "general-tech" else f"{category_label} trend"
        display_name = build_display_name(score.topic, score.evidence)

        # Build a richer summary with dominant signal context
        dominant = max(
            (
                ("social buzz", score.social_score),
                ("developer activity", score.developer_score),
                ("knowledge coverage", score.knowledge_score),
                ("search interest", score.search_score),
            ),
            key=lambda item: item[1],
        )
        top_source = max(score.source_counts, key=score.source_counts.get) if score.source_counts else None
        top_source_label = (top_source or "").replace("_", " ").title()

        parts = [f"{display_name} is a {stage} {category_descriptor}"]
        if dominant[1] > 0:
            parts.append(f"driven by {dominant[0]}")
        parts.append(f"with {signal_count} signals across {source_count} sources")
        if top_source_label:
            parts.append(f"(strongest on {top_source_label})")

        return " ".join(parts) + "."

    @staticmethod
    def _build_why_now(
        score: TrendScoreResult,
        momentum: TrendMomentum,
        history_length: int,
        evidence_titles: list[tuple[str, str]] | None = None,
    ) -> list[str]:
        """Return concise rationale bullets explaining why the trend currently matters."""

        reasons: list[str] = []
        dominant_component = max(
            (
                ("social", score.social_score),
                ("developer", score.developer_score),
                ("knowledge", score.knowledge_score),
                ("search", score.search_score),
                ("advertising", score.advertising_score),
            ),
            key=lambda item: item[1],
        )
        if dominant_component[1] > 0:
            reasons.append(
                f"{dominant_component[0].title()} signals are leading the move ({dominant_component[1]:.1f} score)."
            )
        if len(score.source_counts) >= 2:
            reasons.append(f"Cross-source confirmation is present across {len(score.source_counts)} sources.")
        if (momentum.rank_change or 0) > 0:
            reasons.append(f"The trend improved by {momentum.rank_change} ranking positions since the previous run.")
        elif (momentum.percent_delta or 0) > 0:
            reasons.append(f"Total score is up {momentum.percent_delta:.1f}% versus the previous run.")
        if history_length <= 2:
            reasons.append("The trend is still early in its lifecycle, so competition may still be thin.")

        # Signal type diversity context
        active_types = [t for t, v in [
            ("social", score.social_score),
            ("developer", score.developer_score),
            ("knowledge", score.knowledge_score),
            ("search", score.search_score),
            ("advertising", score.advertising_score),
        ] if v > 0]
        if len(active_types) >= 3:
            reasons.append(f"Broad signal coverage: active in {', '.join(active_types)} channels.")

        # Source diversity context
        source_families = set()
        for source in score.source_counts:
            from app.sources.catalog import source_family_for_source
            source_families.add(source_family_for_source(source))
        if len(source_families) >= 3:
            reasons.append(f"Corroborated across {len(source_families)} independent source families.")

        if evidence_titles:
            seen_sources: set[str] = set()
            for source, title in evidence_titles:
                if source == "wikipedia" or source in seen_sources:
                    continue
                label = source.replace("_", " ").title()
                reasons.append(f"Discussed on {label}: \u201c{title}\u201d")
                seen_sources.add(source)
                if len(seen_sources) >= 2:
                    break
        return reasons[:5] or ["The trend is active, but the current run has limited explanatory evidence."]

    def _get_evidence_titles_for_why_now(self, topic: str) -> list[tuple[str, str]]:
        """Return (source, title) pairs from recent evidence for why-now headlines."""

        items = self.get_topic_evidence(topic, limit=20)
        result: list[tuple[str, str]] = []
        for item in items:
            title = item.evidence.strip()
            if title and len(title) >= 10 and item.source != "wikipedia":
                result.append((item.source, title))
        return result

    @staticmethod
    def _build_trend_aliases(score: TrendScoreResult) -> list[str]:
        """Return simple persisted aliases for a trend."""

        canonical_name = score.display_name or build_display_name(score.topic, score.evidence)
        candidates = {
            canonical_name,
            score.topic,
            canonical_name.lower(),
            score.topic.replace("-", " "),
        }
        for token in canonical_name.split():
            if len(token) >= 2 and token.upper() == token:
                candidates.add(token)
        normalized = sorted({candidate.strip() for candidate in candidates if candidate and candidate.strip()})
        return normalized[:6]

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

    def _build_topic_market_footprint(
        self,
        topic: str,
        captured_at: datetime,
    ) -> list[TrendMetricSnapshot]:
        """Build market-footprint metrics from current source signals for one topic."""

        rows = self.connection.execute(
            """
            SELECT source, value, timestamp, evidence_url
            FROM signals
            WHERE topic = ?
            ORDER BY timestamp DESC, id DESC
            """,
            (topic,),
        ).fetchall()
        grouped: dict[str, list[RowMapping]] = {}
        for row in rows:
            if row["source"] not in self.MARKET_FOOTPRINT_CONFIG:
                continue
            grouped.setdefault(row["source"], []).append(row)

        metrics: list[TrendMetricSnapshot] = []
        for source, source_rows in grouped.items():
            config = self.MARKET_FOOTPRINT_CONFIG[source]
            values = [float(row["value"] or 0.0) for row in source_rows]
            if not values:
                continue
            aggregation = str(config["aggregation"])
            value_numeric = max(values) if aggregation == "max" else sum(values)
            if value_numeric <= 0:
                continue
            provenance_url = next((row["evidence_url"] for row in source_rows if row["evidence_url"]), None)
            metrics.append(
                TrendMetricSnapshot(
                    source=source,
                    metric_key=str(config["metric_key"]),
                    label=str(config["label"]),
                    value_numeric=round(value_numeric, 2),
                    value_display=self._format_metric_value(value_numeric, str(config["unit"])),
                    unit=str(config["unit"]),
                    period=str(config["period"]),
                    captured_at=captured_at,
                    confidence=float(config["confidence"]),
                    provenance_url=provenance_url,
                    is_estimated=bool(config["is_estimated"]),
                )
            )
        return sorted(
            metrics,
            key=lambda item: (
                self.MARKET_FOOTPRINT_CONFIG.get(item.source, {}).get("priority", 999),
                -item.value_numeric,
                item.source,
            ),
        )[:6]

    @staticmethod
    def _format_metric_value(value: float, unit: str) -> str:
        """Render a compact, human-readable value for market-footprint cards."""

        compact = TrendScoreRepository._format_compact_number(value)
        if unit == "searches":
            return compact
        if unit == "views":
            return compact
        return compact

    @staticmethod
    def _format_compact_number(value: float) -> str:
        """Format large values using compact suffixes."""

        absolute = abs(value)
        if absolute >= 1_000_000_000:
            return f"{value / 1_000_000_000:.1f}B"
        if absolute >= 1_000_000:
            return f"{value / 1_000_000:.1f}M"
        if absolute >= 1_000:
            return f"{value / 1_000:.1f}K"
        if value.is_integer():
            return str(int(value))
        return f"{value:.1f}"

    def _filter_suppressed_scores(self, scores: list[TrendScoreResult]) -> list[TrendScoreResult]:
        """Drop trends that have been manually suppressed from ranked read paths."""

        overrides = self._list_trend_curation_overrides()
        filtered: list[TrendScoreResult] = []
        for score in scores:
            override = overrides.get(self._slugify_topic(score.topic))
            if override is not None and override.suppress:
                continue
            filtered.append(score)
        return filtered

    def _replace_duplicate_candidates(
        self,
        scores: list[TrendScoreResult],
        duplicate_rows: list[tuple[str, str, float, str]],
    ) -> None:
        """Replace persisted duplicate candidates for the current published trend set."""

        if not scores:
            return
        self.connection.executemany(
            "DELETE FROM trend_duplicate_candidates WHERE topic_key = ?",
            [(self._slugify_topic(score.topic),) for score in scores],
        )
        if duplicate_rows:
            self.connection.executemany(
                """
                INSERT INTO trend_duplicate_candidates (topic_key, duplicate_topic_key, similarity, reason)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(topic_key, duplicate_topic_key)
                DO UPDATE SET similarity = excluded.similarity, reason = excluded.reason
                """,
                duplicate_rows,
            )

    def _load_persisted_duplicate_candidates(
        self,
        records: list[TrendDetailRecord],
    ) -> dict[str, list[TrendDuplicateCandidate]]:
        """Load duplicate candidate rows for the current detail record set."""

        by_id = {record.id: record for record in records}
        duplicate_map: dict[str, list[TrendDuplicateCandidate]] = {record.id: [] for record in records}
        for record in records:
            rows = self.connection.execute(
                """
                SELECT duplicate_topic_key, similarity, reason
                FROM trend_duplicate_candidates
                WHERE topic_key = ?
                ORDER BY similarity DESC, duplicate_topic_key ASC
                LIMIT 3
                """,
                (record.id,),
            ).fetchall()
            duplicate_map[record.id] = [
                TrendDuplicateCandidate(
                    id=by_id[row["duplicate_topic_key"]].id,
                    name=by_id[row["duplicate_topic_key"]].name,
                    similarity=round(float(row["similarity"] or 0.0), 2),
                    reason=row["reason"] or "",
                )
                for row in rows
                if row["duplicate_topic_key"] in by_id
            ]
        return duplicate_map

    def _build_duplicate_candidates(
        self,
        scores: list[TrendScoreResult],
        overrides: dict[str, TrendCurationOverride],
    ) -> tuple[list[tuple[str, str, float, str]], dict[str, float]]:
        """Infer near-duplicate trends and compute confidence penalties."""

        rows: list[tuple[str, str, float, str]] = []
        penalties: dict[str, float] = {}
        for index, current in enumerate(scores):
            current_id = self._slugify_topic(current.topic)
            current_override = overrides.get(current_id)
            if current_override is not None and current_override.suppress:
                continue
            for candidate in scores[index + 1 :]:
                candidate_id = self._slugify_topic(candidate.topic)
                candidate_override = overrides.get(candidate_id)
                if candidate_override is not None and candidate_override.suppress:
                    continue
                similarity, reason = self._measure_duplicate_similarity(
                    current,
                    candidate,
                    current_override=current_override,
                    candidate_override=candidate_override,
                )
                if similarity < 0.55:
                    continue
                rounded_similarity = round(similarity, 2)
                rows.append((current_id, candidate_id, rounded_similarity, reason))
                rows.append((candidate_id, current_id, rounded_similarity, reason))
                duplicate_id = self._choose_duplicate_penalty_target(
                    current,
                    candidate,
                    current_override=current_override,
                    candidate_override=candidate_override,
                )
                penalties[duplicate_id] = max(
                    penalties.get(duplicate_id, 0.0),
                    round(min(0.3, rounded_similarity * 0.25), 3),
                )
        return rows, penalties

    def _measure_duplicate_similarity(
        self,
        current: TrendScoreResult,
        candidate: TrendScoreResult,
        *,
        current_override: TrendCurationOverride | None,
        candidate_override: TrendCurationOverride | None,
    ) -> tuple[float, str]:
        """Return a duplicate similarity score and the dominant explanation."""

        current_id = self._slugify_topic(current.topic)
        candidate_id = self._slugify_topic(candidate.topic)
        if current_override is not None and current_override.canonical_topic_key == candidate_id:
            return 1.0, "Curated into the same canonical trend group."
        if candidate_override is not None and candidate_override.canonical_topic_key == current_id:
            return 1.0, "Curated into the same canonical trend group."

        current_tokens = self._comparison_tokens(current.topic, current.evidence, current.display_name)
        candidate_tokens = self._comparison_tokens(candidate.topic, candidate.evidence, candidate.display_name)
        current_aliases = self._comparison_aliases(current)
        candidate_aliases = self._comparison_aliases(candidate)
        current_sources = set(current.source_counts)
        candidate_sources = set(candidate.source_counts)

        token_overlap = self._jaccard_similarity(current_tokens, candidate_tokens)
        alias_overlap = self._jaccard_similarity(current_aliases, candidate_aliases)
        source_overlap = self._jaccard_similarity(current_sources, candidate_sources)
        similarity = token_overlap * 0.65 + alias_overlap * 0.25 + source_overlap * 0.10

        if alias_overlap >= token_overlap and alias_overlap >= 0.5:
            reason = "Tracked aliases strongly overlap."
        elif token_overlap >= 0.5:
            reason = "Core topic naming overlaps across the same concept."
        else:
            reason = "Signals and source mix suggest the same underlying topic."
        return similarity, reason

    def _choose_duplicate_penalty_target(
        self,
        current: TrendScoreResult,
        candidate: TrendScoreResult,
        *,
        current_override: TrendCurationOverride | None,
        candidate_override: TrendCurationOverride | None,
    ) -> str:
        """Choose which topic should absorb the duplicate confidence penalty."""

        current_id = self._slugify_topic(current.topic)
        candidate_id = self._slugify_topic(candidate.topic)
        if current_override is not None and current_override.canonical_topic_key == candidate_id:
            return current_id
        if candidate_override is not None and candidate_override.canonical_topic_key == current_id:
            return candidate_id
        if current.total_score == candidate.total_score:
            return max(current_id, candidate_id)
        return current_id if current.total_score < candidate.total_score else candidate_id

    def _comparison_tokens(
        self,
        topic: str,
        evidence: list[str],
        display_name: str | None,
    ) -> set[str]:
        """Build normalized comparison tokens that tolerate small plural variants."""

        values = [topic]
        if display_name:
            values.append(display_name)
        values.extend(evidence[:2])
        tokens: set[str] = set()
        for value in values:
            for token in self._topic_tokens(value):
                tokens.add(self._normalize_comparison_token(token))
        return tokens

    def _comparison_aliases(self, score: TrendScoreResult) -> set[str]:
        """Build a normalized alias set for duplicate matching."""

        return {
            self._normalize_alias(alias)
            for alias in self._build_trend_aliases(score)
            if self._normalize_alias(alias)
        }

    @staticmethod
    def _normalize_alias(value: str) -> str:
        """Normalize alias casing and punctuation for duplicate matching."""

        return " ".join(
            "".join(character.lower() if character.isalnum() else " " for character in value).split()
        )

    @staticmethod
    def _normalize_comparison_token(token: str) -> str:
        """Reduce trivial singular/plural variations during duplicate matching."""

        if len(token) > 4 and token.endswith("s"):
            return token[:-1]
        return token

    @staticmethod
    def _jaccard_similarity(left: set[str], right: set[str]) -> float:
        """Return the Jaccard similarity between two token sets."""

        if not left or not right:
            return 0.0
        union = left.union(right)
        if not union:
            return 0.0
        return len(left.intersection(right)) / len(union)

    def _replace_trend_relationships(
        self,
        records: list[TrendDetailRecord],
        relationship_rows: list[tuple[str, str, float]],
    ) -> None:
        """Replace persisted related-trend relationships for the current record set."""

        self.connection.executemany(
            "DELETE FROM trend_relationships WHERE topic_key = ?",
            [(record.id,) for record in records],
        )
        if relationship_rows:
            self.connection.executemany(
                """
                INSERT INTO trend_relationships (topic_key, related_topic_key, strength)
                VALUES (?, ?, ?)
                ON CONFLICT(topic_key, related_topic_key)
                DO UPDATE SET strength = excluded.strength
                """,
                relationship_rows,
            )

    def _load_persisted_related_trends(self, records: list[TrendDetailRecord]) -> dict[str, list[RelatedTrend]]:
        """Load related trends from persisted relationship rows for the current record set."""

        by_id = {record.id: record for record in records}
        related_map: dict[str, list[RelatedTrend]] = {record.id: [] for record in records}
        for record in records:
            rows = self.connection.execute(
                """
                SELECT related_topic_key, strength
                FROM trend_relationships
                WHERE topic_key = ?
                ORDER BY strength DESC, related_topic_key ASC
                LIMIT 4
                """,
                (record.id,),
            ).fetchall()
            related_map[record.id] = [
                RelatedTrend(
                    id=by_id[row["related_topic_key"]].id,
                    name=by_id[row["related_topic_key"]].name,
                    status=by_id[row["related_topic_key"]].status,
                    rank=by_id[row["related_topic_key"]].rank,
                    score_total=by_id[row["related_topic_key"]].score.total_score,
                    relationship_strength=row["strength"],
                )
                for row in rows
                if row["related_topic_key"] in by_id
            ]
        return related_map

    def _attach_related_trends(self, records: list[TrendDetailRecord]) -> list[TrendDetailRecord]:
        """Attach compact related-trend recommendations to each detail record."""

        if not records:
            return []

        relationship_rows: list[tuple[str, str, float]] = []
        for current in records:
            candidates: list[tuple[float, TrendDetailRecord]] = []
            current_tokens = self._topic_tokens(current.name)
            current_sources = set(current.sources)
            for candidate in records:
                if candidate.id == current.id:
                    continue
                score = 0.0
                if current_sources.intersection(candidate.sources):
                    score += 0.4
                if current.status == candidate.status:
                    score += 0.2
                if current_tokens.intersection(self._topic_tokens(candidate.name)):
                    score += 0.4
                if score > 0:
                    candidates.append((score, candidate))

            candidates.sort(key=lambda item: (-item[0], item[1].rank, -item[1].score.total_score, item[1].name))
            relationship_rows.extend(
                (current.id, item.id, round(strength, 2))
                for strength, item in candidates[:4]
            )

        self._replace_trend_relationships(records, relationship_rows)
        duplicate_map = self._load_persisted_duplicate_candidates(records)
        related_map = self._load_persisted_related_trends(records)

        return [
            TrendDetailRecord(
                id=record.id,
                name=record.name,
                category=record.category,
                meta_trend=record.meta_trend,
                stage=record.stage,
                confidence=record.confidence,
                summary=record.summary,
                why_now=record.why_now,
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
                aliases=record.aliases,
                history=record.history,
                source_breakdown=record.source_breakdown,
                source_contributions=record.source_contributions,
                market_footprint=record.market_footprint,
                geo_summary=record.geo_summary,
                audience_summary=record.audience_summary,
                evidence_items=record.evidence_items,
                primary_evidence=record.primary_evidence,
                duplicate_candidates=duplicate_map.get(record.id, []),
                related_trends=related_map.get(record.id, []),
                seasonality=record.seasonality,
                wikipedia_extract=record.wikipedia_extract,
                wikipedia_description=record.wikipedia_description,
                wikipedia_thumbnail_url=record.wikipedia_thumbnail_url,
                wikipedia_page_url=record.wikipedia_page_url,
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
