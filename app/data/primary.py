"""Primary database entry points.

This module is the boundary for selecting the runtime database backend.
Today it still initializes SQLite. The eventual Postgres cutover should
replace the implementation here first, then flow through the repository layer.
"""

from __future__ import annotations

import sqlite3

from app.config import Settings
from app.data.database import connect_database, initialize_database


def connect_primary_database(settings: Settings) -> sqlite3.Connection:
    """Return the configured primary database connection.

    Postgres is intentionally not partially supported. If a non-SQLite URL is
    configured, fail explicitly so deployment is not left in a misleading
    half-migrated state.
    """

    if settings.database_url:
        raise NotImplementedError(
            "TREND_FRIEND_DATABASE_URL is reserved for the Postgres migration and is not wired yet. "
            "Use TREND_FRIEND_DATABASE_PATH until the repository layer is migrated."
        )

    connection = connect_database(settings.database_path)
    initialize_database(connection)
    return connection
