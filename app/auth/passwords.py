"""Password hashing using hashlib (no external dependencies).

Uses PBKDF2-HMAC-SHA256 with 600,000 iterations (OWASP recommendation).
Supports transparent verification of legacy SHA-256 hashes.
"""

from __future__ import annotations

import hashlib
import hmac
import os

_PBKDF2_ITERATIONS = 600_000
_PBKDF2_DKLEN = 64


def hash_password(password: str) -> str:
    """Hash a password with a random salt using PBKDF2-HMAC-SHA256."""

    salt = os.urandom(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode(),
        salt,
        _PBKDF2_ITERATIONS,
        dklen=_PBKDF2_DKLEN,
    )
    return f"pbkdf2:{salt.hex()}:{digest.hex()}"


def _is_legacy_sha256(password_hash: str) -> bool:
    """Return True if the hash is in the old SHA-256 salt:hexdigest format."""

    parts = password_hash.split(":", 1)
    if len(parts) != 2:
        return False
    # Old format is "salt_hex:sha256_hex" — SHA-256 digest is always 64 hex chars
    # and the hash does NOT start with a scheme prefix.
    _salt, digest = parts
    return not password_hash.startswith(("pbkdf2:", "scrypt:")) and len(digest) == 64


def _verify_legacy(password: str, password_hash: str) -> bool:
    """Verify against old SHA-256 salt:digest format."""

    salt, stored_digest = password_hash.split(":", 1)
    digest = hashlib.sha256(f"{salt}:{password}".encode()).hexdigest()
    return hmac.compare_digest(digest, stored_digest)


def _verify_pbkdf2(password: str, password_hash: str) -> bool:
    """Verify against pbkdf2:salt_hex:digest_hex format."""

    parts = password_hash.split(":")
    if len(parts) != 3 or parts[0] != "pbkdf2":
        return False
    salt = bytes.fromhex(parts[1])
    stored_digest = parts[2]
    digest = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode(),
        salt,
        _PBKDF2_ITERATIONS,
        dklen=_PBKDF2_DKLEN,
    )
    return hmac.compare_digest(digest.hex(), stored_digest)


def verify_password(password: str, password_hash: str) -> bool:
    """Verify a password against a stored hash (supports both legacy SHA-256 and PBKDF2)."""

    if _is_legacy_sha256(password_hash):
        return _verify_legacy(password, password_hash)
    return _verify_pbkdf2(password, password_hash)


def needs_rehash(password_hash: str) -> bool:
    """Return True if the hash uses the old SHA-256 format and should be upgraded."""

    return _is_legacy_sha256(password_hash)
