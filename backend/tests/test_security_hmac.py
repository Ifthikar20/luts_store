"""Tests for Shopify webhook HMAC verification (common/security.py)."""
import base64
import hashlib
import hmac

from common.security import compute_shopify_hmac, verify_shopify_webhook

SECRET = "test-webhook-secret"
BODY = b'{"id": 12345, "email": "buyer@example.com"}'


def _valid_hmac(body: bytes, secret: str) -> str:
    digest = hmac.new(secret.encode(), body, hashlib.sha256).digest()
    return base64.b64encode(digest).decode()


def test_compute_matches_reference():
    assert compute_shopify_hmac(BODY, SECRET) == _valid_hmac(BODY, SECRET)


def test_verify_valid_signature():
    good = _valid_hmac(BODY, SECRET)
    assert verify_shopify_webhook(BODY, good, SECRET) is True


def test_verify_invalid_signature():
    assert verify_shopify_webhook(BODY, "not-the-right-hmac", SECRET) is False


def test_verify_tampered_body():
    good = _valid_hmac(BODY, SECRET)
    tampered = BODY + b" "
    assert verify_shopify_webhook(tampered, good, SECRET) is False


def test_verify_missing_header_or_secret():
    good = _valid_hmac(BODY, SECRET)
    assert verify_shopify_webhook(BODY, None, SECRET) is False
    assert verify_shopify_webhook(BODY, good, "") is False
