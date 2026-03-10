"""Shared FastAPI dependencies."""

from __future__ import annotations

import sqlite3
import threading
from typing import Generator

from app.config import Settings, load_settings
from app.data.database import connect_database, initialize_database

_settings: Settings | None = None
_local = threading.local()


def get_settings() -> Settings:
    """Return cached application settings."""

    global _settings
    if _settings is None:
        _settings = load_settings()
    return _settings


def get_db() -> Generator[sqlite3.Connection, None, None]:
    """Yield a per-request SQLite connection."""

    settings = get_settings()
    connection = connect_database(settings.database_path)
    initialize_database(connection)
    try:
        yield connection
    finally:
        connection.close()
