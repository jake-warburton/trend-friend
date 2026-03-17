"""Authentication API routes."""

from __future__ import annotations

import os

from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.dependencies import get_db
from app.auth.middleware import SESSION_COOKIE_NAME, get_current_profile, require_admin, require_auth
from app.auth.passwords import hash_password, verify_password, _dummy_verify
from app.auth.repository import UserRepository
from app.auth.tokens import generate_api_key, generate_session_token, hash_session_token
from app.data.connection import DatabaseConnection
from app.models import User, UserProfile

router = APIRouter(tags=["auth"])


@router.post("/auth/register")
def register_user(body: dict, response: Response, db: DatabaseConnection = Depends(get_db)) -> dict:
    """Register a new user account."""

    username = body.get("username", "").strip()
    password = body.get("password", "")
    display_name = body.get("displayName", "").strip() or username

    if not username or not password:
        raise HTTPException(status_code=422, detail="username and password are required")
    if len(password) < 8:
        raise HTTPException(status_code=422, detail="Password must be at least 8 characters")

    repo = UserRepository(db)
    existing = repo.get_user_by_username(username)
    if existing is not None:
        raise HTTPException(status_code=409, detail="Username already taken")

    # First registered user is automatically an admin
    users = repo.list_users()
    is_admin = len(users) == 0

    user = repo.create_user(
        username=username,
        password_hash=hash_password(password),
        display_name=display_name,
        is_admin=is_admin,
    )

    token = generate_session_token()
    repo.create_session(user.id, hash_session_token(token))
    _set_session_cookie(response, token)
    return {
        "user": _user_response(user),
        "token": token,
    }


@router.post("/auth/login")
def login_user(body: dict, response: Response, db: DatabaseConnection = Depends(get_db)) -> dict:
    """Authenticate with username and password."""

    username = body.get("username", "").strip()
    password = body.get("password", "")

    if not username or not password:
        raise HTTPException(status_code=422, detail="username and password are required")

    repo = UserRepository(db)
    user = repo.get_user_by_username(username)
    if user is None:
        _dummy_verify(password)
        raise HTTPException(status_code=401, detail="Invalid credentials")

    is_valid, needs_rehash = verify_password(password, user.password_hash)
    if not is_valid:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if needs_rehash:
        repo.update_password_hash(user.id, hash_password(password))

    token = generate_session_token()
    repo.create_session(user.id, hash_session_token(token))
    _set_session_cookie(response, token)
    return {
        "user": _user_response(user),
        "token": token,
    }


@router.get("/auth/me")
def get_current_user_info(user: User = Depends(require_auth)) -> dict:
    """Return the current authenticated user."""

    return {"user": _user_response(user)}


@router.get("/auth/profile")
def get_profile(profile: UserProfile = Depends(get_current_profile)) -> dict:
    """Return the current user's profile with tier and admin info."""

    if profile is None:
        # Auth disabled — return synthetic admin profile
        return {
            "id": "anonymous",
            "displayName": "Anonymous",
            "username": None,
            "isAdmin": True,
            "accountTier": "pro",
            "subscriptionStatus": "active",
        }

    return {
        "id": profile.id,
        "displayName": profile.display_name,
        "username": profile.username,
        "isAdmin": profile.is_admin,
        "accountTier": profile.account_tier,
        "subscriptionStatus": profile.subscription_status,
    }


@router.post("/auth/logout")
def logout_user(
    request: Request,
    response: Response,
    db: DatabaseConnection = Depends(get_db),
) -> dict:
    """Revoke the current session cookie when present."""

    token = request.cookies.get(SESSION_COOKIE_NAME)
    if token:
        repo = UserRepository(db)
        repo.revoke_session_by_hash(hash_session_token(token))
    is_production = os.getenv("SIGNAL_EYE_ENVIRONMENT", "production") != "development"
    response.delete_cookie(
        SESSION_COOKIE_NAME,
        path="/",
        httponly=True,
        samesite="strict",
        secure=is_production,
    )
    return {"ok": True}


@router.post("/auth/api-keys")
def create_api_key(body: dict, user: User = Depends(require_auth), db: DatabaseConnection = Depends(get_db)) -> dict:
    """Create a new API key for the current user."""

    name = body.get("name", "").strip()
    if not name:
        raise HTTPException(status_code=422, detail="name is required")

    full_key, prefix, key_hash = generate_api_key()
    repo = UserRepository(db)
    api_key = repo.create_api_key(
        user_id=user.id,
        key_hash=key_hash,
        key_prefix=prefix,
        name=name,
    )

    return {
        "key": full_key,
        "id": api_key.id,
        "prefix": api_key.key_prefix,
        "name": api_key.name,
        "createdAt": api_key.created_at.isoformat(),
    }


@router.get("/auth/api-keys")
def list_api_keys(user: User = Depends(require_auth), db: DatabaseConnection = Depends(get_db)) -> dict:
    """List API keys for the current user."""

    repo = UserRepository(db)
    keys = repo.list_api_keys(user.id)
    return {
        "keys": [
            {
                "id": key.id,
                "prefix": key.key_prefix,
                "name": key.name,
                "createdAt": key.created_at.isoformat(),
                "lastUsedAt": key.last_used_at.isoformat() if key.last_used_at else None,
                "revoked": key.revoked,
            }
            for key in keys
        ],
    }


@router.post("/auth/api-keys/{key_id}/revoke")
def revoke_api_key(
    key_id: int,
    user: User = Depends(require_auth),
    db: DatabaseConnection = Depends(get_db),
) -> dict:
    """Revoke an API key."""

    repo = UserRepository(db)
    api_key = repo.get_api_key_by_id(key_id)
    if api_key is None or api_key.user_id != user.id:
        raise HTTPException(status_code=404, detail="API key not found")
    repo.revoke_api_key(key_id)
    return {"ok": True}


@router.get("/auth/users")
def list_users(user: User = Depends(require_admin), db: DatabaseConnection = Depends(get_db)) -> dict:
    """List all users (admin only)."""

    repo = UserRepository(db)
    users = repo.list_users()
    return {
        "users": [_user_response(u) for u in users],
    }


def _user_response(user: User) -> dict:
    return {
        "id": user.id,
        "username": user.username,
        "displayName": user.display_name,
        "isAdmin": user.is_admin,
        "createdAt": user.created_at.isoformat(),
    }


def _set_session_cookie(response: Response, token: str) -> None:
    is_production = os.getenv("SIGNAL_EYE_ENVIRONMENT", "production") != "development"
    response.set_cookie(
        SESSION_COOKIE_NAME,
        token,
        httponly=True,
        samesite="strict",
        secure=is_production,
        max_age=7 * 24 * 60 * 60,
        path="/",
    )
