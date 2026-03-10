"""SQLite database helpers."""

from __future__ import annotations

import sqlite3
from pathlib import Path


def connect_database(database_path: Path) -> sqlite3.Connection:
    """Return a SQLite connection with row access by name."""

    database_path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(database_path)
    connection.row_factory = sqlite3.Row
    return connection


def initialize_database(connection: sqlite3.Connection) -> None:
    """Create the tables required by the MVP."""

    connection.executescript(
        """
        CREATE TABLE IF NOT EXISTS signals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            topic TEXT NOT NULL,
            source TEXT NOT NULL,
            signal_type TEXT NOT NULL,
            value REAL NOT NULL,
            timestamp TEXT NOT NULL,
            evidence TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS source_ingestion_runs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            source TEXT NOT NULL,
            fetched_at TEXT NOT NULL,
            success INTEGER NOT NULL,
            item_count INTEGER NOT NULL,
            duration_ms INTEGER NOT NULL DEFAULT 0,
            used_fallback INTEGER NOT NULL DEFAULT 0,
            error_message TEXT NULL
        );

        CREATE TABLE IF NOT EXISTS trend_scores (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            topic TEXT NOT NULL,
            total_score REAL NOT NULL,
            search_score REAL NOT NULL,
            social_score REAL NOT NULL,
            developer_score REAL NOT NULL,
            knowledge_score REAL NOT NULL,
            diversity_score REAL NOT NULL,
            source_counts_json TEXT NOT NULL,
            evidence_json TEXT NOT NULL,
            latest_timestamp TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS trend_runs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            captured_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS pipeline_runs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            captured_at TEXT NOT NULL,
            duration_ms INTEGER NOT NULL,
            source_count INTEGER NOT NULL,
            successful_source_count INTEGER NOT NULL,
            failed_source_count INTEGER NOT NULL,
            signal_count INTEGER NOT NULL,
            ranked_trend_count INTEGER NOT NULL,
            top_topic TEXT NULL,
            top_score REAL NULL
        );

        CREATE TABLE IF NOT EXISTS trend_score_snapshots (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            run_id INTEGER NOT NULL,
            rank_position INTEGER NOT NULL,
            topic TEXT NOT NULL,
            total_score REAL NOT NULL,
            search_score REAL NOT NULL,
            social_score REAL NOT NULL,
            developer_score REAL NOT NULL,
            knowledge_score REAL NOT NULL,
            diversity_score REAL NOT NULL,
            source_counts_json TEXT NOT NULL,
            evidence_json TEXT NOT NULL,
            latest_timestamp TEXT NOT NULL,
            FOREIGN KEY (run_id) REFERENCES trend_runs (id)
        );

        CREATE TABLE IF NOT EXISTS watchlists (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS watchlist_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            watchlist_id INTEGER NOT NULL,
            trend_id TEXT NOT NULL,
            trend_name TEXT NOT NULL,
            added_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE (watchlist_id, trend_id),
            FOREIGN KEY (watchlist_id) REFERENCES watchlists (id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS alert_rules (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            watchlist_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            rule_type TEXT NOT NULL,
            threshold REAL NOT NULL,
            enabled INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (watchlist_id) REFERENCES watchlists (id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            display_name TEXT NOT NULL,
            is_admin INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS api_keys (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            key_hash TEXT NOT NULL UNIQUE,
            key_prefix TEXT NOT NULL,
            name TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            last_used_at TEXT NULL,
            revoked INTEGER NOT NULL DEFAULT 0,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS alert_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            rule_id INTEGER NOT NULL,
            watchlist_id INTEGER NOT NULL,
            trend_id TEXT NOT NULL,
            trend_name TEXT NOT NULL,
            rule_type TEXT NOT NULL,
            threshold REAL NOT NULL,
            current_value REAL NOT NULL,
            message TEXT NOT NULL,
            triggered_at TEXT NOT NULL,
            read INTEGER NOT NULL DEFAULT 0,
            FOREIGN KEY (rule_id) REFERENCES alert_rules (id) ON DELETE CASCADE
        );
        """
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


def ensure_column(
    connection: sqlite3.Connection,
    table_name: str,
    column_name: str,
    column_sql: str,
) -> None:
    """Add a column to an existing table only when it is missing."""

    rows = connection.execute(f"PRAGMA table_info({table_name})").fetchall()
    if any(row["name"] == column_name for row in rows):
        return
    connection.execute(
        f"ALTER TABLE {table_name} ADD COLUMN {column_name} {column_sql}"
    )
