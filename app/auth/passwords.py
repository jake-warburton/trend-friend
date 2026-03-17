"""Password hashing using PBKDF2-HMAC-SHA256 (stdlib, no external dependencies).

Stored format: pbkdf2$<iterations>$<hex_salt>$<hex_digest>
Legacy format:  <hex_salt>:<sha256_hex_digest>
"""

from __future__ import annotations

import hashlib
import hmac
import os

_PBKDF2_ITERATIONS = 600_000
_PBKDF2_DKLEN = 64


def hash_password(password: str) -> str:
    """Hash a password with a random salt using PBKDF2."""

    salt = os.urandom(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode(),
        salt,
        _PBKDF2_ITERATIONS,
        dklen=_PBKDF2_DKLEN,
    )
    return f"pbkdf2${_PBKDF2_ITERATIONS}${salt.hex()}${digest.hex()}"


def verify_password(password: str, password_hash: str) -> tuple[bool, bool]:
    """Verify a password against a stored hash.

    Returns a tuple of (is_valid, needs_rehash).
    needs_rehash is True when the password was verified against the legacy
    SHA-256 format and should be re-hashed with PBKDF2 on next opportunity.
    """

    # New PBKDF2 format: pbkdf2$<iterations>$<hex_salt>$<hex_digest>
    if password_hash.startswith("pbkdf2$"):
        parts = password_hash.split("$", 3)
        if len(parts) != 4:
            return False, False
        _, iterations_str, hex_salt, stored_hex = parts
        salt = bytes.fromhex(hex_salt)
        digest = hashlib.pbkdf2_hmac(
            "sha256",
            password.encode(),
            salt,
            int(iterations_str),
            dklen=_PBKDF2_DKLEN,
        )
        return hmac.compare_digest(digest.hex(), stored_hex), False

    # Legacy SHA-256 format: <hex_salt>:<sha256_hex_digest>
    parts = password_hash.split(":", 1)
    if len(parts) != 2:
        return False, False
    salt, stored_digest = parts
    digest = hashlib.sha256(f"{salt}:{password}".encode()).hexdigest()
    is_valid = hmac.compare_digest(digest, stored_digest)
    return is_valid, is_valid  # needs_rehash only if password is valid
