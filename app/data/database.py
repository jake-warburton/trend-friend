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
        """
    )
    connection.commit()
