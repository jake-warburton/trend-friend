"""User and API key persistence."""

from __future__ import annotations

import sqlite3
from datetime import datetime

from app.models import ApiKey, User, UserSession


class UserRepository:
    """Persist and retrieve user accounts and API keys."""

    def __init__(self, connection: sqlite3.Connection) -> None:
        self.connection = connection

    def create_user(
        self,
        username: str,
        password_hash: str,
        display_name: str,
        is_admin: bool = False,
    ) -> User:
        """Create and return a new user."""

        cursor = self.connection.execute(
            """
            INSERT INTO users (username, password_hash, display_name, is_admin)
            VALUES (?, ?, ?, ?)
            """,
            (username, password_hash, display_name, int(is_admin)),
        )
        self.connection.commit()
        return self.get_user_by_id(int(cursor.lastrowid))  # type: ignore[return-value]

    def get_user_by_id(self, user_id: int) -> User | None:
        """Return a user by id."""

        row = self.connection.execute(
            "SELECT id, username, password_hash, display_name, is_admin, created_at FROM users WHERE id = ?",
            (user_id,),
        ).fetchone()
        if row is None:
            return None
        return self._user_from_row(row)

    def get_user_by_username(self, username: str) -> User | None:
        """Return a user by username."""

        row = self.connection.execute(
            "SELECT id, username, password_hash, display_name, is_admin, created_at FROM users WHERE username = ?",
            (username,),
        ).fetchone()
        if row is None:
            return None
        return self._user_from_row(row)

    def list_users(self) -> list[User]:
        """Return all users."""

        rows = self.connection.execute(
            "SELECT id, username, password_hash, display_name, is_admin, created_at FROM users ORDER BY created_at ASC"
        ).fetchall()
        return [self._user_from_row(row) for row in rows]

    def create_api_key(
        self,
        user_id: int,
        key_hash: str,
        key_prefix: str,
        name: str,
    ) -> ApiKey:
        """Create and return a new API key."""

        cursor = self.connection.execute(
            """
            INSERT INTO api_keys (user_id, key_hash, key_prefix, name)
            VALUES (?, ?, ?, ?)
            """,
            (user_id, key_hash, key_prefix, name),
        )
        self.connection.commit()
        return self.get_api_key_by_id(int(cursor.lastrowid))  # type: ignore[return-value]

    def get_api_key_by_id(self, key_id: int) -> ApiKey | None:
        """Return an API key by id."""

        row = self.connection.execute(
            """
            SELECT id, user_id, key_hash, key_prefix, name, created_at, last_used_at, revoked
            FROM api_keys WHERE id = ?
            """,
            (key_id,),
        ).fetchone()
        if row is None:
            return None
        return self._api_key_from_row(row)

    def get_api_key_by_hash(self, key_hash: str) -> ApiKey | None:
        """Return an active API key by its hash."""

        row = self.connection.execute(
            """
            SELECT id, user_id, key_hash, key_prefix, name, created_at, last_used_at, revoked
            FROM api_keys WHERE key_hash = ? AND revoked = 0
            """,
            (key_hash,),
        ).fetchone()
        if row is None:
            return None
        return self._api_key_from_row(row)

    def list_api_keys(self, user_id: int) -> list[ApiKey]:
        """Return all API keys for a user."""

        rows = self.connection.execute(
            """
            SELECT id, user_id, key_hash, key_prefix, name, created_at, last_used_at, revoked
            FROM api_keys WHERE user_id = ? ORDER BY created_at DESC
            """,
            (user_id,),
        ).fetchall()
        return [self._api_key_from_row(row) for row in rows]

    def touch_api_key(self, key_id: int) -> None:
        """Update the last_used_at timestamp for an API key."""

        self.connection.execute(
            "UPDATE api_keys SET last_used_at = CURRENT_TIMESTAMP WHERE id = ?",
            (key_id,),
        )
        self.connection.commit()

    def revoke_api_key(self, key_id: int) -> None:
        """Mark an API key as revoked."""

        self.connection.execute(
            "UPDATE api_keys SET revoked = 1 WHERE id = ?",
            (key_id,),
        )
        self.connection.commit()

    def create_session(self, user_id: int, token_hash: str) -> UserSession:
        """Create and return a new user session."""

        cursor = self.connection.execute(
            """
            INSERT INTO user_sessions (user_id, token_hash)
            VALUES (?, ?)
            """,
            (user_id, token_hash),
        )
        self.connection.commit()
        return self.get_session_by_id(int(cursor.lastrowid))  # type: ignore[return-value]

    def get_session_by_id(self, session_id: int) -> UserSession | None:
        """Return a session by id."""

        row = self.connection.execute(
            """
            SELECT id, user_id, token_hash, created_at, last_used_at, revoked
            FROM user_sessions WHERE id = ?
            """,
            (session_id,),
        ).fetchone()
        if row is None:
            return None
        return self._session_from_row(row)

    def get_session_by_hash(self, token_hash: str) -> UserSession | None:
        """Return an active session by token hash."""

        row = self.connection.execute(
            """
            SELECT id, user_id, token_hash, created_at, last_used_at, revoked
            FROM user_sessions
            WHERE token_hash = ? AND revoked = 0
            """,
            (token_hash,),
        ).fetchone()
        if row is None:
            return None
        return self._session_from_row(row)

    def touch_session(self, session_id: int) -> None:
        """Update the last_used_at timestamp for a session."""

        self.connection.execute(
            "UPDATE user_sessions SET last_used_at = CURRENT_TIMESTAMP WHERE id = ?",
            (session_id,),
        )
        self.connection.commit()

    def revoke_session_by_hash(self, token_hash: str) -> None:
        """Revoke a session by its token hash."""

        self.connection.execute(
            "UPDATE user_sessions SET revoked = 1 WHERE token_hash = ?",
            (token_hash,),
        )
        self.connection.commit()

    @staticmethod
    def _user_from_row(row: sqlite3.Row) -> User:
        return User(
            id=row["id"],
            username=row["username"],
            password_hash=row["password_hash"],
            display_name=row["display_name"],
            is_admin=bool(row["is_admin"]),
            created_at=datetime.fromisoformat(row["created_at"]),
        )

    @staticmethod
    def _api_key_from_row(row: sqlite3.Row) -> ApiKey:
        return ApiKey(
            id=row["id"],
            user_id=row["user_id"],
            key_hash=row["key_hash"],
            key_prefix=row["key_prefix"],
            name=row["name"],
            created_at=datetime.fromisoformat(row["created_at"]),
            last_used_at=datetime.fromisoformat(row["last_used_at"]) if row["last_used_at"] else None,
            revoked=bool(row["revoked"]),
        )

    @staticmethod
    def _session_from_row(row: sqlite3.Row) -> UserSession:
        return UserSession(
            id=row["id"],
            user_id=row["user_id"],
            token_hash=row["token_hash"],
            created_at=datetime.fromisoformat(row["created_at"]),
            last_used_at=datetime.fromisoformat(row["last_used_at"]) if row["last_used_at"] else None,
            revoked=bool(row["revoked"]),
        )
