"""Helpers for portable write operations."""

from __future__ import annotations

from typing import Any, Sequence

from app.data.connection import DatabaseConnection


def execute_insert_and_return_id(
    connection: DatabaseConnection,
    sql: str,
    parameters: Sequence[Any] = (),
) -> int:
    """Execute one insert and return the inserted row id across SQL dialects."""

    if connection.dialect.supports_returning:
        cursor = connection.execute(_append_returning_id(sql), parameters)
        row = cursor.fetchone()
        if row is None:
            raise RuntimeError("Database driver did not return inserted row")
        inserted_id = row["id"] if isinstance(row, dict) else row[0]
        return int(inserted_id)

    cursor = connection.execute(sql, parameters)
    if cursor.lastrowid is None:
        raise RuntimeError("Database driver did not return lastrowid")
    return int(cursor.lastrowid)


def _append_returning_id(sql: str) -> str:
    """Append `RETURNING id` to one insert statement when needed."""

    stripped_sql = sql.rstrip()
    suffix = ";" if stripped_sql.endswith(";") else ""
    if suffix:
        stripped_sql = stripped_sql[:-1].rstrip()
    return f"{stripped_sql} RETURNING id{suffix}"
