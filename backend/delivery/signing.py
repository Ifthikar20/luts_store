"""
Signed, time-limited download tokens.

Uses Django's ``django.core.signing`` (HMAC-backed, itsdangerous-style) so a
download URL is both tamper-proof and self-expiring:

* ``dumps`` signs an arbitrary JSON-serializable payload with ``SECRET_KEY``.
* ``loads`` with ``max_age`` rejects expired tokens (``SignatureExpired``) and
  tampered tokens (``BadSignature``).

A dedicated ``salt`` namespaces these tokens so they can't be confused with any
other signed value in the app. The token payload references a ``DownloadGrant``
by id plus the product handle.
"""
from __future__ import annotations

from typing import Any

from django.conf import settings
from django.core import signing

SALT = "delivery.download-token.v1"


class InvalidToken(Exception):
    """Raised when a token is tampered with or otherwise malformed."""


class ExpiredToken(Exception):
    """Raised when a token is valid but past its max age."""


def make_download_token(grant_id: int, product_handle: str) -> str:
    """Create a signed token referencing a download grant."""
    payload: dict[str, Any] = {
        "grantId": grant_id,
        "productHandle": product_handle,
    }
    return signing.dumps(payload, salt=SALT)


def read_download_token(token: str, max_age: int | None = None) -> dict[str, Any]:
    """Validate a token and return its payload.

    Raises ``ExpiredToken`` or ``InvalidToken`` on failure.
    """
    if max_age is None:
        max_age = settings.DOWNLOAD_TOKEN_MAX_AGE
    try:
        return signing.loads(token, salt=SALT, max_age=max_age)
    except signing.SignatureExpired as exc:
        raise ExpiredToken(str(exc)) from exc
    except signing.BadSignature as exc:
        raise InvalidToken(str(exc)) from exc
