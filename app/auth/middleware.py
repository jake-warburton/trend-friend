"""FastAPI authentication dependencies."""

from __future__ import annotations

import os
from typing import Optional

import jwt
from fastapi import Depends, HTTPException, Request

from app.api.dependencies import get_db
from app.data.connection import DatabaseConnection
from app.auth.profile_repository import ProfileRepository
from app.auth.repository import UserRepository
from app.auth.tokens import hash_api_key, hash_session_token
from app.models import User, UserProfile

SESSION_COOKIE_NAME = "tf_session"


def auth_enabled() -> bool:
    """Check whether authentication is turned on via environment variable."""

    return os.getenv("SIGNAL_EYE_AUTH_ENABLED", "false").lower() == "true"


def _get_supabase_jwt_secret() -> str | None:
    return os.getenv("SUPABASE_JWT_SECRET")


def get_current_user(
    request: Request,
    db: DatabaseConnection = Depends(get_db),
) -> Optional[User]:
    """Extract and validate the current user from the request.

    Supports auth methods in priority order:
    1. Supabase JWT (Bearer token decoded with SUPABASE_JWT_SECRET)
    2. API key (Bearer token starting with tf_)
    3. Legacy session cookie (tf_session) — kept for backward compatibility

    When auth is disabled, returns None (all routes are public).
    """

    if not auth_enabled():
        return None

    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header[7:].strip()
        if token:
            # Try Supabase JWT first
            jwt_secret = _get_supabase_jwt_secret()
            if jwt_secret and not token.startswith("tf_"):
                profile = _authenticate_supabase_jwt(token, jwt_secret, db)
                if profile is not None:
                    # Return a User-compatible object for backward compatibility
                    return User(
                        id=0,
                        username=profile.username or profile.display_name or profile.id,
                        password_hash="",
                        display_name=profile.display_name,
                        is_admin=profile.is_admin,
                        created_at=profile.created_at,
                    )

            # Fall back to API key auth
            return _authenticate_api_key(token, db)

    # Legacy session cookie fallback
    session_token = request.cookies.get(SESSION_COOKIE_NAME)
    if session_token:
        return _authenticate_session(session_token, db)

    raise HTTPException(status_code=401, detail="Authentication required")


def get_current_profile(
    request: Request,
    db: DatabaseConnection = Depends(get_db),
) -> Optional[UserProfile]:
    """Extract the user profile from the request.

    Returns the full UserProfile for routes that need subscription info.
    Supports Supabase JWT, API key, and session cookie auth.
    Returns None when auth is disabled.
    """

    if not auth_enabled():
        return None

    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header[7:].strip()
        if token:
            # Try Supabase JWT first
            jwt_secret = _get_supabase_jwt_secret()
            if jwt_secret and not token.startswith("tf_"):
                profile = _authenticate_supabase_jwt(token, jwt_secret, db)
                if profile is not None:
                    return profile

            # Fall back to API key auth
            try:
                user = _authenticate_api_key(token, db)
                return _profile_from_user(user, db)
            except HTTPException:
                pass

    # Legacy session cookie fallback
    session_token = request.cookies.get(SESSION_COOKIE_NAME)
    if session_token:
        try:
            user = _authenticate_session(session_token, db)
            return _profile_from_user(user, db)
        except HTTPException:
            pass

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
            is_admin=False,
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


def _synthetic_admin_profile() -> UserProfile:
    """Return a synthetic admin/pro profile for when auth is disabled."""

    now = __import__("datetime").datetime.now(__import__("datetime").timezone.utc)
    return UserProfile(
        id="anonymous",
        display_name="Anonymous",
        username=None,
        is_admin=False,
        account_tier="free",
        stripe_customer_id=None,
        stripe_subscription_id=None,
        subscription_status="none",
        current_period_end=None,
        created_at=now,
        updated_at=now,
    )


def require_pro(profile: Optional[UserProfile] = Depends(get_current_profile)) -> UserProfile:
    """Dependency that requires an active Pro subscription.

    Admins (owners) bypass the subscription check.
    """

    if not auth_enabled():
        return _synthetic_admin_profile()
    if profile is None:
        raise HTTPException(status_code=401, detail="Authentication required")
    if profile.is_admin:
        return profile
    if profile.account_tier != "pro" or profile.subscription_status not in ("active", "trialing"):
        raise HTTPException(status_code=403, detail="Pro subscription required")
    return profile


def require_owner(profile: Optional[UserProfile] = Depends(get_current_profile)) -> UserProfile:
    """Dependency that requires admin (owner) privileges."""

    if not auth_enabled():
        return _synthetic_admin_profile()
    if profile is None:
        raise HTTPException(status_code=401, detail="Authentication required")
    if not profile.is_admin:
        raise HTTPException(status_code=403, detail="Owner privileges required")
    return profile


def _authenticate_supabase_jwt(
    token: str,
    jwt_secret: str,
    db: DatabaseConnection,
) -> UserProfile | None:
    """Validate a Supabase JWT and return the associated profile."""

    try:
        payload = jwt.decode(
            token,
            jwt_secret,
            algorithms=["HS256"],
            audience="authenticated",
        )
    except jwt.PyJWTError:
        return None

    user_id = payload.get("sub")
    if not user_id:
        return None

    repo = ProfileRepository(db)
    return repo.get_profile_by_id(user_id)


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
    """Validate a legacy session cookie and return its associated user."""

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


def _profile_from_user(user: User, db: DatabaseConnection) -> UserProfile:
    """Build a UserProfile for an API-key or session-authenticated User.

    If the user has a linked supabase_uid and a corresponding profile row,
    returns that profile. Otherwise constructs a minimal profile from the
    User object.
    """

    # Check if this legacy user has a linked Supabase profile
    supabase_uid = None
    try:
        row = db.execute(
            "SELECT supabase_uid FROM users WHERE id = ?",
            (user.id,),
        ).fetchone()
        supabase_uid = row["supabase_uid"] if row and row["supabase_uid"] else None
    except Exception:
        pass

    if supabase_uid:
        repo = ProfileRepository(db)
        profile = repo.get_profile_by_id(supabase_uid)
        if profile is not None:
            return profile

    # No linked profile — construct a minimal one from the User
    now = __import__("datetime").datetime.now(__import__("datetime").timezone.utc)
    return UserProfile(
        id=str(user.id),
        display_name=user.display_name,
        username=user.username,
        is_admin=user.is_admin,
        account_tier="free",
        stripe_customer_id=None,
        stripe_subscription_id=None,
        subscription_status="none",
        current_period_end=None,
        created_at=user.created_at,
        updated_at=now,
    )
