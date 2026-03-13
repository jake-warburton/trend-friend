"""SQLite database adapter and schema helpers."""

from __future__ import annotations

import sqlite3
from pathlib import Path
from typing import Any, Iterable, Sequence

from app.data.connection import DatabaseConnection, DatabaseCursor
from app.data.migrations import Migration, apply_migrations, load_sql_migration
from app.data.sql_dialect import SQLITE_DIALECT, SqlDialect

class SQLiteCursorAdapter(DatabaseCursor):
    """Wrap a sqlite cursor behind the shared cursor protocol."""

    def __init__(self, cursor: sqlite3.Cursor) -> None:
        self._cursor = cursor

    @property
    def lastrowid(self) -> int | None:
        return self._cursor.lastrowid

    @property
    def rowcount(self) -> int:
        return self._cursor.rowcount

    def fetchone(self) -> Any:
        return self._cursor.fetchone()

    def fetchall(self) -> list[Any]:
        return self._cursor.fetchall()


class SQLiteConnectionAdapter(DatabaseConnection):
    """Expose sqlite through the shared database connection boundary."""

    def __init__(self, connection: sqlite3.Connection) -> None:
        self._connection = connection

    @property
    def dialect(self) -> SqlDialect:
        return SQLITE_DIALECT

    def execute(self, sql: str, parameters: Sequence[Any] = ()) -> DatabaseCursor:
        return SQLiteCursorAdapter(self._connection.execute(sql, parameters))

    def executemany(
        self,
        sql: str,
        seq_of_parameters: Iterable[Sequence[Any]],
    ) -> DatabaseCursor:
        return SQLiteCursorAdapter(self._connection.executemany(sql, seq_of_parameters))

    def executescript(self, sql_script: str) -> DatabaseCursor:
        return SQLiteCursorAdapter(self._connection.executescript(sql_script))

    def commit(self) -> None:
        self._connection.commit()

    def close(self) -> None:
        self._connection.close()


def connect_database(database_path: Path) -> DatabaseConnection:
    """Return a SQLite-backed connection adapter with named row access."""

    database_path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(database_path)
    connection.row_factory = sqlite3.Row
    return SQLiteConnectionAdapter(connection)


def initialize_database(connection: DatabaseConnection) -> None:
    """Create the tables required by the MVP."""

    apply_migrations(connection, SQLITE_MIGRATIONS)


def apply_sqlite_legacy_backfill(connection: DatabaseConnection) -> None:
    """Backfill legacy SQLite databases to the current schema."""

    ensure_column(
        connection,
        table_name="watchlist_shares",
        column_name="show_creator",
        column_sql="INTEGER NOT NULL DEFAULT 0",
    )
    ensure_column(
        connection,
        table_name="watchlist_shares",
        column_name="expires_at",
        column_sql="TEXT NULL",
    )
    ensure_column(
        connection,
        table_name="watchlist_shares",
        column_name="access_count",
        column_sql="INTEGER NOT NULL DEFAULT 0",
    )
    ensure_column(
        connection,
        table_name="watchlist_shares",
        column_name="last_accessed_at",
        column_sql="TEXT NULL",
    )
    ensure_column(
        connection,
        table_name="watchlists",
        column_name="owner_user_id",
        column_sql="INTEGER NULL REFERENCES users(id) ON DELETE CASCADE",
    )
    ensure_column(
        connection,
        table_name="watchlists",
        column_name="default_share_duration_days",
        column_sql="INTEGER NULL",
    )
    migrate_watchlists_table(connection)
    ensure_column(
        connection,
        table_name="signals",
        column_name="evidence_url",
        column_sql="TEXT NULL",
    )
    ensure_column(
        connection,
        table_name="signals",
        column_name="language_code",
        column_sql="TEXT NULL",
    )
    ensure_column(
        connection,
        table_name="signals",
        column_name="audience_flags_json",
        column_sql="TEXT NOT NULL DEFAULT '[]'",
    )
    ensure_column(
        connection,
        table_name="signals",
        column_name="market_flags_json",
        column_sql="TEXT NOT NULL DEFAULT '[]'",
    )
    ensure_column(
        connection,
        table_name="signals",
        column_name="geo_flags_json",
        column_sql="TEXT NOT NULL DEFAULT '[]'",
    )
    ensure_column(
        connection,
        table_name="signals",
        column_name="geo_country_code",
        column_sql="TEXT NULL",
    )
    ensure_column(
        connection,
        table_name="signals",
        column_name="geo_region",
        column_sql="TEXT NULL",
    )
    ensure_column(
        connection,
        table_name="signals",
        column_name="geo_detection_mode",
        column_sql="TEXT NOT NULL DEFAULT 'unknown'",
    )
    ensure_column(
        connection,
        table_name="signals",
        column_name="geo_confidence",
        column_sql="REAL NOT NULL DEFAULT 0",
    )
    ensure_column(
        connection,
        table_name="source_ingestion_runs",
        column_name="raw_item_count",
        column_sql="INTEGER NOT NULL DEFAULT 0",
    )
    ensure_column(
        connection,
        table_name="source_ingestion_runs",
        column_name="kept_item_count",
        column_sql="INTEGER NOT NULL DEFAULT 0",
    )
    ensure_column(
        connection,
        table_name="source_ingestion_runs",
        column_name="duration_ms",
        column_sql="INTEGER NOT NULL DEFAULT 0",
    )
    ensure_column(
        connection,
        table_name="source_ingestion_runs",
        column_name="used_fallback",
        column_sql="INTEGER NOT NULL DEFAULT 0",
    )
    connection.commit()


SQLITE_MIGRATIONS = [
    Migration("0001_initial_schema", load_sql_migration("sqlite_migrations/0001_initial_schema.sql")),
    Migration("0002_sqlite_legacy_backfill", apply_sqlite_legacy_backfill),
    Migration("0003_score_display_names", load_sql_migration("sqlite_migrations/0003_score_display_names.sql")),
    Migration("0004_pipeline_quality_metrics", load_sql_migration("sqlite_migrations/0004_pipeline_quality_metrics.sql")),
    Migration("0005_source_topic_metrics", load_sql_migration("sqlite_migrations/0005_source_topic_metrics.sql")),
    Migration("0006_experimental_trend_tiers", load_sql_migration("sqlite_migrations/0006_experimental_trend_tiers.sql")),
    Migration("0007_trend_entities", load_sql_migration("sqlite_migrations/0007_trend_entities.sql")),
    Migration("0008_trend_entity_enrichment", load_sql_migration("sqlite_migrations/0008_trend_entity_enrichment.sql")),
    Migration("0009_trend_relationships", load_sql_migration("sqlite_migrations/0009_trend_relationships.sql")),
    Migration("0010_trend_curation", load_sql_migration("sqlite_migrations/0010_trend_curation.sql")),
    Migration("0011_trend_theses", load_sql_migration("sqlite_migrations/0011_trend_theses.sql")),
]


def ensure_column(
    connection: DatabaseConnection,
    table_name: str,
    column_name: str,
    column_sql: str,
) -> None:
    """Add a column to an existing table only when it is missing."""

    rows = connection.execute(f"PRAGMA table_info({table_name})").fetchall()
    if any(row["name"] == column_name for row in rows):
        return
    connection.execute(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {column_sql}")


def migrate_watchlists_table(connection: DatabaseConnection) -> None:
    """Rebuild the watchlists table when it still uses the legacy global-unique name schema."""

    index_rows = connection.execute("PRAGMA index_list(watchlists)").fetchall()
    has_legacy_name_unique = any(row["unique"] and row["origin"] == "u" for row in index_rows)
    if not has_legacy_name_unique:
        return

    column_rows = connection.execute("PRAGMA table_info(watchlists)").fetchall()
    has_owner_column = any(row["name"] == "owner_user_id" for row in column_rows)
    owner_select = "owner_user_id" if has_owner_column else "NULL"
    has_default_duration_column = any(row["name"] == "default_share_duration_days" for row in column_rows)
    default_duration_select = "default_share_duration_days" if has_default_duration_column else "NULL"

    connection.execute("PRAGMA foreign_keys = OFF")
    connection.execute("ALTER TABLE watchlists RENAME TO watchlists_legacy")
    connection.execute(
        """
        CREATE TABLE watchlists (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            owner_user_id INTEGER NULL,
            default_share_duration_days INTEGER NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (owner_user_id) REFERENCES users (id) ON DELETE CASCADE
        )
        """
    )
    connection.execute(
        f"""
        INSERT INTO watchlists (id, name, owner_user_id, default_share_duration_days, created_at, updated_at)
        SELECT id, name, {owner_select}, {default_duration_select}, created_at, updated_at
        FROM watchlists_legacy
        """
    )
    connection.execute("DROP TABLE watchlists_legacy")
    connection.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_watchlists_owner_name ON watchlists (owner_user_id, name)"
    )
    connection.execute("PRAGMA foreign_keys = ON")
    connection.commit()
