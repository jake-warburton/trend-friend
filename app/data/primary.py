"""Primary database entry points."""

from __future__ import annotations

from app.config import Settings
from app.data.connection import DatabaseConnection
from app.data.database import connect_database, initialize_database


def connect_primary_database(settings: Settings) -> DatabaseConnection:
    """Return the configured primary database connection.

    Postgres is intentionally not partially supported. If a non-SQLite URL is
    configured, fail explicitly so deployment is not left in a misleading
    half-migrated state.
    """

    if settings.database_url:
        raise NotImplementedError(
            "SIGNAL_EYE_DATABASE_URL is reserved for the Postgres migration and is not wired yet. "
            "Use SIGNAL_EYE_DATABASE_PATH until the repository layer is migrated."
        )

    connection = connect_database(settings.database_path)
    initialize_database(connection)
    return connection
