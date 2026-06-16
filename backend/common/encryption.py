"""
Application-level field encryption (encrypt at rest, decrypt on read).

Sensitive free-text (e.g. review titles/bodies) is stored ENCRYPTED in the
database and only decrypted in the application. Even with direct DB/backup
access the plaintext is unreadable without the key. Uses Fernet (AES-128-CBC +
HMAC, authenticated) from the ``cryptography`` package (already a dependency via
``pyjwt[crypto]``).

Key: ``settings.FIELD_ENCRYPTION_KEY`` (a urlsafe-base64 32-byte Fernet key) when
set; otherwise a key DERIVED deterministically from ``SECRET_KEY`` so it works
out of the box. NOTE: rotating SECRET_KEY (without a dedicated FIELD_ENCRYPTION_KEY)
would make existing ciphertext undecryptable — set FIELD_ENCRYPTION_KEY in
production to decouple the two.
"""
from __future__ import annotations

import base64
import hashlib
from functools import lru_cache

from cryptography.fernet import Fernet, InvalidToken
from django.conf import settings

# Marks our ciphertext so a column can hold both legacy plaintext (pre-encryption
# rows) and new ciphertext without ambiguity.
_PREFIX = "enc:v1:"


@lru_cache(maxsize=1)
def _fernet() -> Fernet:
    key = getattr(settings, "FIELD_ENCRYPTION_KEY", "") or ""
    if key:
        raw = key.encode()
    else:
        # Derive a valid 32-byte urlsafe-base64 Fernet key from SECRET_KEY.
        digest = hashlib.sha256(settings.SECRET_KEY.encode()).digest()
        raw = base64.urlsafe_b64encode(digest)
    return Fernet(raw)


def encrypt(text: str | None) -> str | None:
    """Return prefixed ciphertext for ``text`` (None/"" pass through)."""
    if text is None or text == "":
        return text
    token = _fernet().encrypt(text.encode("utf-8")).decode("ascii")
    return _PREFIX + token


def decrypt(value: str | None) -> str | None:
    """Return plaintext. Legacy (unprefixed) values are returned unchanged."""
    if value is None or value == "" or not value.startswith(_PREFIX):
        return value
    try:
        token = value[len(_PREFIX) :].encode("ascii")
        return _fernet().decrypt(token).decode("utf-8")
    except (InvalidToken, ValueError):
        # Don't crash a page on an undecryptable value (e.g. key rotated).
        return ""
