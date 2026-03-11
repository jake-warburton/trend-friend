"""Primary database entry points."""

from __future__ import annotations

from app.config import Settings
from app.data.connection import DatabaseConnection
from app.data.database import connect_database, initialize_database
from app.data.postgres import connect_postgres, initialize_postgres_database


def connect_primary_database(settings: Settings) -> DatabaseConnection:
    """Return the configured primary database connection.

    Postgres runtime remains opt-in until more repository paths are exercised
    end-to-end against Supabase.
    """

    if settings.database_url:
        if not settings.enable_postgres_runtime:
            connection = connect_postgres(settings.database_url)
            try:
                initialize_postgres_database(connection)
            finally:
                connection.close()
            raise NotImplementedError(
                "SIGNAL_EYE_DATABASE_URL is available, but Postgres runtime is still gated. "
                "Set SIGNAL_EYE_ENABLE_POSTGRES_RUNTIME=true after validating the current path."
            )
        connection = connect_postgres(settings.database_url)
        initialize_postgres_database(connection)
        return connection

    connection = connect_database(settings.database_path)
    initialize_database(connection)
    return connection
