"""Password hashing using hashlib.scrypt (no external dependencies).

Stored format: scrypt$<hex_salt>$<hex_digest>
Legacy format:  <hex_salt>:<sha256_hex_digest>
"""

from __future__ import annotations

import hashlib
import hmac
import os

# scrypt parameters
_SCRYPT_N = 16384
_SCRYPT_R = 8
_SCRYPT_P = 1
_SCRYPT_DKLEN = 64


def hash_password(password: str) -> str:
    """Hash a password with a random salt using scrypt."""

    salt = os.urandom(16)
    digest = hashlib.scrypt(
        password.encode(),
        salt=salt,
        n=_SCRYPT_N,
        r=_SCRYPT_R,
        p=_SCRYPT_P,
        dklen=_SCRYPT_DKLEN,
    )
    return f"scrypt${salt.hex()}${digest.hex()}"


def verify_password(password: str, password_hash: str) -> tuple[bool, bool]:
    """Verify a password against a stored hash.

    Returns a tuple of (is_valid, needs_rehash).
    needs_rehash is True when the password was verified against the legacy
    SHA-256 format and should be re-hashed with scrypt on next opportunity.
    """

    # New scrypt format: scrypt$<hex_salt>$<hex_digest>
    if password_hash.startswith("scrypt$"):
        parts = password_hash.split("$", 2)
        if len(parts) != 3:
            return False, False
        _, hex_salt, stored_hex = parts
        salt = bytes.fromhex(hex_salt)
        digest = hashlib.scrypt(
            password.encode(),
            salt=salt,
            n=_SCRYPT_N,
            r=_SCRYPT_R,
            p=_SCRYPT_P,
            dklen=_SCRYPT_DKLEN,
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
