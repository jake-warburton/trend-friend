"""Database migration helpers."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Callable

from app.data.connection import DatabaseConnection
from app.data.sql_dialect import SQLITE_DIALECT


@dataclass(frozen=True)
class Migration:
    """One database migration step."""

    version: str
    apply: Callable[[DatabaseConnection], None]


def ensure_migration_table(connection: DatabaseConnection) -> None:
    """Create the schema migration tracking table."""

    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS schema_migrations (
            version TEXT PRIMARY KEY,
            applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
        """
    )
    connection.commit()


def list_applied_migration_versions(connection: DatabaseConnection) -> set[str]:
    """Return the set of migration versions already applied."""

    rows = connection.execute("SELECT version FROM schema_migrations").fetchall()
    return {row["version"] for row in rows}


def apply_migrations(connection: DatabaseConnection, migrations: list[Migration]) -> None:
    """Apply each missing migration exactly once."""

    ensure_migration_table(connection)
    applied_versions = list_applied_migration_versions(connection)
    for migration in migrations:
        if migration.version in applied_versions:
            continue
        migration.apply(connection)
        dialect = getattr(connection, "dialect", SQLITE_DIALECT)
        connection.execute(
            f"INSERT INTO schema_migrations (version) VALUES ({dialect.placeholders(1)})",
            (migration.version,),
        )
        connection.commit()
        applied_versions.add(migration.version)


def load_sql_migration(relative_path: str) -> Callable[[DatabaseConnection], None]:
    """Return a migration function that executes one SQL script."""

    migration_path = Path(__file__).resolve().parent / relative_path

    def apply_sql(connection: DatabaseConnection) -> None:
        connection.executescript(migration_path.read_text(encoding="utf-8"))

    return apply_sql
