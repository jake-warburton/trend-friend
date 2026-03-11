"""Verify Supabase/Postgres connectivity and schema initialization."""

from __future__ import annotations

from _bootstrap import bootstrap_project_root

bootstrap_project_root()

from app.config import load_settings
from app.data.postgres import connect_postgres, initialize_postgres_database


def main() -> None:
    """Connect to Supabase, apply migrations, and print a short status summary."""

    settings = load_settings()
    if not settings.database_url:
        raise RuntimeError("SIGNAL_EYE_DATABASE_URL is not set")

    connection = connect_postgres(settings.database_url)
    try:
        initialize_postgres_database(connection)
        migration_rows = connection.execute(
            "SELECT version FROM schema_migrations ORDER BY version ASC"
        ).fetchall()
        table_row = connection.execute(
            """
            SELECT COUNT(*) AS count
            FROM information_schema.tables
            WHERE table_schema = 'public'
              AND table_name = 'trend_scores'
            """
        ).fetchone()
    finally:
        connection.close()

    print("supabase:ok")
    print("migrations:", ",".join(row["version"] for row in migration_rows))
    print("trend_scores_table:", "present" if table_row["count"] else "missing")


if __name__ == "__main__":
    main()
