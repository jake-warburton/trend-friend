"""SQL dialect helpers for portable repository statements."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class SqlDialect:
    """Describe the SQL syntax details repositories need to vary by engine."""

    placeholder_token: str = "?"
    insert_or_ignore_keyword: str = "INSERT OR IGNORE"
    supports_returning: bool = False

    def placeholders(self, count: int) -> str:
        """Return a comma-separated placeholder list."""

        return ",".join(self.placeholder_token for _ in range(count))

    def insert_or_ignore_statement(self, table: str, columns: tuple[str, ...]) -> str:
        """Return one insert-if-missing statement for the configured dialect."""

        column_list = ", ".join(columns)
        return (
            f"{self.insert_or_ignore_keyword} INTO {table} ({column_list}) "
            f"VALUES ({self.placeholders(len(columns))})"
        )

    def incrementing_upsert_statement(
        self,
        table: str,
        key_columns: tuple[str, ...],
        counter_column: str,
    ) -> str:
        """Return a statement that inserts a counter row or increments it."""

        column_list = ", ".join((*key_columns, counter_column))
        conflict_target = ", ".join(key_columns)
        return (
            f"INSERT INTO {table} ({column_list}) "
            f"VALUES ({self.placeholders(len(key_columns))}, 1) "
            f"ON CONFLICT({conflict_target}) "
            f"DO UPDATE SET {counter_column} = {counter_column} + 1"
        )


SQLITE_DIALECT = SqlDialect()


@dataclass(frozen=True)
class PostgresDialect(SqlDialect):
    """Postgres-specific SQL syntax helpers."""

    placeholder_token: str = "%s"
    insert_or_ignore_keyword: str = "INSERT"
    supports_returning: bool = True

    def insert_or_ignore_statement(self, table: str, columns: tuple[str, ...]) -> str:
        column_list = ", ".join(columns)
        return (
            f"INSERT INTO {table} ({column_list}) "
            f"VALUES ({self.placeholders(len(columns))}) "
            "ON CONFLICT DO NOTHING"
        )


POSTGRES_DIALECT = PostgresDialect()
