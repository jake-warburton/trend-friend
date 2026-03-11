"""FastAPI authentication dependencies."""

from __future__ import annotations

import os
from typing import Optional

from fastapi import Depends, HTTPException, Request

from app.api.dependencies import get_db
from app.data.connection import DatabaseConnection
from app.auth.repository import UserRepository
from app.auth.tokens import hash_api_key, hash_session_token
from app.models import User

SESSION_COOKIE_NAME = "tf_session"


def auth_enabled() -> bool:
    """Check whether authentication is turned on via environment variable."""

    return os.getenv("SIGNAL_EYE_AUTH_ENABLED", "false").lower() == "true"


def get_current_user(
    request: Request,
    db: DatabaseConnection = Depends(get_db),
) -> Optional[User]:
    """Extract and validate the current user from the request.

    Supports two auth methods:
    - Bearer token (API key): Authorization: Bearer tf_...
    - Session token via cookie (future extension)

    When auth is disabled, returns None (all routes are public).
    """

    if not auth_enabled():
        return None

    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header[7:].strip()
        if token:
            return _authenticate_api_key(token, db)

    session_token = request.cookies.get(SESSION_COOKIE_NAME)
    if session_token:
        return _authenticate_session(session_token, db)

    raise HTTPException(status_code=401, detail="Authentication required")


def require_auth(user: Optional[User] = Depends(get_current_user)) -> User:
    """Dependency that requires authentication when auth is enabled."""

    if not auth_enabled():
        # When auth is disabled, return a synthetic admin user
        return User(
            id=0,
            username="anonymous",
            password_hash="",
            display_name="Anonymous",
            is_admin=True,
            created_at=__import__("datetime").datetime.now(__import__("datetime").timezone.utc),
        )
    if user is None:
        raise HTTPException(status_code=401, detail="Authentication required")
    return user


def require_admin(user: User = Depends(require_auth)) -> User:
    """Dependency that requires admin privileges."""

    if not user.is_admin:
        raise HTTPException(status_code=403, detail="Admin privileges required")
    return user


def _authenticate_api_key(token: str, db: DatabaseConnection) -> User:
    """Validate an API key and return its associated user."""

    key_hash = hash_api_key(token)
    user_repo = UserRepository(db)
    api_key = user_repo.get_api_key_by_hash(key_hash)
    if api_key is None:
        raise HTTPException(status_code=401, detail="Invalid API key")

    user = user_repo.get_user_by_id(api_key.user_id)
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")

    user_repo.touch_api_key(api_key.id)
    return user


def _authenticate_session(token: str, db: DatabaseConnection) -> User:
    """Validate a session cookie and return its associated user."""

    token_hash = hash_session_token(token)
    user_repo = UserRepository(db)
    session = user_repo.get_session_by_hash(token_hash)
    if session is None:
        raise HTTPException(status_code=401, detail="Invalid session")

    user = user_repo.get_user_by_id(session.user_id)
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")

    user_repo.touch_session(session.id)
    return user
