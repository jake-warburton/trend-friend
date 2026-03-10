"""Password hashing using hashlib (no external dependencies)."""

from __future__ import annotations

import hashlib
import os


def hash_password(password: str) -> str:
    """Hash a password with a random salt using SHA-256."""

    salt = os.urandom(16).hex()
    digest = hashlib.sha256(f"{salt}:{password}".encode()).hexdigest()
    return f"{salt}:{digest}"


def verify_password(password: str, password_hash: str) -> bool:
    """Verify a password against a stored hash."""

    parts = password_hash.split(":", 1)
    if len(parts) != 2:
        return False
    salt, stored_digest = parts
    digest = hashlib.sha256(f"{salt}:{password}".encode()).hexdigest()
    return digest == stored_digest
