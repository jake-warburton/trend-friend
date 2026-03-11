"""Database connection protocols shared outside the data layer."""

from __future__ import annotations

from typing import Any, Iterable, Protocol, Sequence

from app.data.sql_dialect import SqlDialect


class DatabaseCursor(Protocol):
    """Minimal cursor interface used by repositories."""

    lastrowid: int | None
    rowcount: int

    def fetchone(self) -> Any:
        """Return one row."""

    def fetchall(self) -> list[Any]:
        """Return all rows."""


class DatabaseConnection(Protocol):
    """Minimal connection interface exposed outside the SQLite implementation."""

    @property
    def dialect(self) -> SqlDialect:
        """Return the SQL dialect for this connection."""

    def execute(self, sql: str, parameters: Sequence[Any] = ()) -> DatabaseCursor:
        """Execute one statement."""

    def executemany(
        self,
        sql: str,
        seq_of_parameters: Iterable[Sequence[Any]],
    ) -> DatabaseCursor:
        """Execute one statement against multiple parameter sets."""

    def executescript(self, sql_script: str) -> DatabaseCursor:
        """Execute a SQL script."""

    def commit(self) -> None:
        """Commit the current transaction."""

    def close(self) -> None:
        """Close the connection."""
