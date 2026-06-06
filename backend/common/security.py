"""
Security helpers shared across the backend.

The central piece here is constant-time verification of Shopify webhook
HMAC signatures. Shopify signs each webhook body with the shared webhook
secret using HMAC-SHA256, base64-encodes the digest, and sends it in the
``X-Shopify-Hmac-Sha256`` header. We recompute the digest server-side and
compare it using ``hmac.compare_digest`` to avoid timing attacks.
"""
from __future__ import annotations

import base64
import hashlib
import hmac


def compute_shopify_hmac(body: bytes, secret: str) -> str:
    """Compute the base64-encoded HMAC-SHA256 digest of ``body``.

    Args:
        body: The raw request body bytes (must be the exact bytes received).
        secret: The Shopify webhook shared secret.

    Returns:
        The base64-encoded digest as a ``str``.
    """
    if isinstance(secret, str):
        secret_bytes = secret.encode("utf-8")
    else:  # pragma: no cover - defensive
        secret_bytes = secret
    digest = hmac.new(secret_bytes, body, hashlib.sha256).digest()
    return base64.b64encode(digest).decode("utf-8")


def verify_shopify_webhook(body: bytes, received_hmac: str | None, secret: str) -> bool:
    """Verify a Shopify webhook HMAC signature in constant time.

    Args:
        body: The raw request body bytes.
        received_hmac: The value of the ``X-Shopify-Hmac-Sha256`` header.
        secret: The Shopify webhook shared secret.

    Returns:
        ``True`` if the signature is valid, ``False`` otherwise. Returns
        ``False`` (never raises) for missing header or missing secret so the
        caller can respond with 401.
    """
    if not received_hmac or not secret:
        return False
    expected = compute_shopify_hmac(body, secret)
    # Constant-time comparison to prevent timing attacks.
    return hmac.compare_digest(expected, received_hmac)
