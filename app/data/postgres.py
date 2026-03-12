"""Postgres database adapter and migration helpers."""

from __future__ import annotations

from typing import Any, Iterable, Sequence

from app.data.connection import DatabaseConnection, DatabaseCursor
from app.data.migrations import Migration, apply_migrations, load_sql_migration
from app.data.sql_dialect import POSTGRES_DIALECT, SqlDialect

POSTGRES_MIGRATIONS = [
    Migration("0001_initial_schema", load_sql_migration("postgres_migrations/0001_initial_schema.sql")),
    Migration("0003_score_display_names", load_sql_migration("postgres_migrations/0003_score_display_names.sql")),
]


class PostgresCursorAdapter(DatabaseCursor):
    """Wrap a psycopg cursor behind the shared cursor protocol."""

    def __init__(self, cursor: Any) -> None:
        self._cursor = cursor

    @property
    def lastrowid(self) -> int | None:
        return None

    @property
    def rowcount(self) -> int:
        return self._cursor.rowcount

    def fetchone(self) -> Any:
        return self._cursor.fetchone()

    def fetchall(self) -> list[Any]:
        return self._cursor.fetchall()


class PostgresConnectionAdapter(DatabaseConnection):
    """Expose psycopg through the shared database connection boundary."""

    def __init__(self, connection: Any) -> None:
        self._connection = connection

    @property
    def dialect(self) -> SqlDialect:
        return POSTGRES_DIALECT

    def execute(self, sql: str, parameters: Sequence[Any] = ()) -> DatabaseCursor:
        return PostgresCursorAdapter(self._connection.execute(_normalize_qmark_sql(sql), parameters))

    def executemany(
        self,
        sql: str,
        seq_of_parameters: Iterable[Sequence[Any]],
    ) -> DatabaseCursor:
        cursor = self._connection.cursor()
        cursor.executemany(_normalize_qmark_sql(sql), seq_of_parameters)
        return PostgresCursorAdapter(cursor)

    def executescript(self, sql_script: str) -> DatabaseCursor:
        return PostgresCursorAdapter(self._connection.execute(sql_script))

    def commit(self) -> None:
        self._connection.commit()

    def close(self) -> None:
        self._connection.close()


def connect_postgres(database_url: str) -> DatabaseConnection:
    """Return a Postgres-backed connection adapter."""

    try:
        import psycopg
        from psycopg.rows import dict_row
    except ImportError as exc:
        raise RuntimeError(
            "psycopg is required for SIGNAL_EYE_DATABASE_URL. Install requirements.txt first."
        ) from exc

    connection = psycopg.connect(database_url, row_factory=dict_row)
    return PostgresConnectionAdapter(connection)


def initialize_postgres_database(connection: DatabaseConnection) -> None:
    """Apply the Postgres migration set."""

    apply_migrations(connection, POSTGRES_MIGRATIONS)


def _normalize_qmark_sql(sql: str) -> str:
    """Convert SQLite-style qmark placeholders to psycopg `%s` placeholders.

    The repository layer still emits SQLite-shaped statements. This adapter keeps
    those read and write queries runnable on Postgres until the SQL is rewritten
    more deliberately.
    """

    normalized_sql: list[str] = []
    index = 0
    in_single_quote = False
    in_double_quote = False
    in_line_comment = False
    in_block_comment = False

    while index < len(sql):
        character = sql[index]
        next_character = sql[index + 1] if index + 1 < len(sql) else None

        if in_line_comment:
            normalized_sql.append(character)
            if character == "\n":
                in_line_comment = False
            index += 1
            continue
        if in_block_comment:
            normalized_sql.append(character)
            if character == "*" and next_character == "/":
                normalized_sql.append("/")
                in_block_comment = False
                index += 2
                continue
            index += 1
            continue
        if in_single_quote:
            normalized_sql.append(character)
            if character == "'":
                if next_character == "'":
                    normalized_sql.append("'")
                    index += 2
                    continue
                else:
                    in_single_quote = False
            index += 1
            continue
        if in_double_quote:
            normalized_sql.append(character)
            if character == '"':
                in_double_quote = False
            index += 1
            continue

        if character == "-" and next_character == "-":
            normalized_sql.append("--")
            in_line_comment = True
            index += 2
            continue
        if character == "/" and next_character == "*":
            normalized_sql.append("/*")
            in_block_comment = True
            index += 2
            continue
        if character == "'":
            normalized_sql.append(character)
            in_single_quote = True
            index += 1
            continue
        if character == '"':
            normalized_sql.append(character)
            in_double_quote = True
            index += 1
            continue
        if character == "?":
            normalized_sql.append("%s")
            index += 1
            continue

        normalized_sql.append(character)
        index += 1

    return "".join(normalized_sql)
