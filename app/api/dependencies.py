"""Shared FastAPI dependencies."""

from __future__ import annotations

import threading
from typing import Generator

from app.config import Settings, load_settings
from app.data.primary import connect_primary_database

_settings: Settings | None = None
_local = threading.local()


def get_settings() -> Settings:
    """Return cached application settings."""

    global _settings
    if _settings is None:
        _settings = load_settings()
    return _settings


def get_db() -> Generator[object, None, None]:
    """Yield a per-request database connection."""

    settings = get_settings()
    connection = connect_primary_database(settings)
    try:
        yield connection
    finally:
        connection.close()
