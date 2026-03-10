"""Session token and API key generation."""

from __future__ import annotations

import hashlib
import secrets


def generate_session_token() -> str:
    """Generate a cryptographically random session token."""

    return secrets.token_urlsafe(32)


def generate_api_key() -> tuple[str, str, str]:
    """Generate an API key.

    Returns (full_key, key_prefix, key_hash).
    The full key is shown once to the user; only the hash is stored.
    """

    raw = secrets.token_urlsafe(32)
    prefix = raw[:8]
    full_key = f"tf_{raw}"
    key_hash = hashlib.sha256(full_key.encode()).hexdigest()
    return full_key, prefix, key_hash


def hash_api_key(key: str) -> str:
    """Hash an API key for lookup."""

    return hashlib.sha256(key.encode()).hexdigest()
