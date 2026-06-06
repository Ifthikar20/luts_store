"""
Tests for Phase 2: customer accounts, download library, order confirmation.

Run in mock mode (no Storefront token in the test env). The autouse throttle
relaxation in conftest.py keeps the heavier auth flows from being rate-limited;
a dedicated test re-enables the ``auth`` rate to prove throttling is wired up.
"""
import pytest
from django.conf import settings
from rest_framework.test import APIClient
from rest_framework.throttling import SimpleRateThrottle

pytestmark = pytest.mark.django_db


@pytest.fixture
def client():
    return APIClient()


def _register(client, email="buyer@example.com", password="Sup3rSecret!pw"):
    return client.post(
        "/api/auth/register",
        {"email": email, "password": password},
        format="json",
    )


# ---------------------------------------------------------------------------
# Register / login / me / logout
# ---------------------------------------------------------------------------
def test_register_returns_token_and_user(client):
    resp = _register(client)
    assert resp.status_code == 201
    body = resp.json()
    assert body["token"]
    assert body["user"]["email"] == "buyer@example.com"
    assert isinstance(body["user"]["id"], int)


def test_register_weak_password_rejected(client):
    resp = client.post(
        "/api/auth/register",
        {"email": "weak@example.com", "password": "123"},
        format="json",
    )
    assert resp.status_code == 400


def test_register_duplicate_is_generic(client):
    _register(client)
    # Second registration with the same email must NOT reveal that the email
    # already exists -- generic 400, same shape as any other failure.
    resp = _register(client)
    assert resp.status_code == 400
    assert "detail" in resp.json()


def test_login_success(client):
    _register(client)
    resp = client.post(
        "/api/auth/login",
        {"email": "buyer@example.com", "password": "Sup3rSecret!pw"},
        format="json",
    )
    assert resp.status_code == 200
    assert resp.json()["token"]


def test_login_wrong_password_generic_error(client):
    _register(client)
    resp = client.post(
        "/api/auth/login",
        {"email": "buyer@example.com", "password": "wrong-password-xyz"},
        format="json",
    )
    assert resp.status_code == 400
    # Generic message -> no user enumeration / "password incorrect" leak.
    assert resp.json() == {"detail": "Invalid email or password."}


def test_login_unknown_user_same_generic_error(client):
    resp = client.post(
        "/api/auth/login",
        {"email": "nobody@example.com", "password": "whatever-123!"},
        format="json",
    )
    assert resp.status_code == 400
    assert resp.json() == {"detail": "Invalid email or password."}


def test_me_requires_auth(client):
    assert client.get("/api/auth/me").status_code in (401, 403)


def test_me_and_logout(client):
    token = _register(client).json()["token"]
    client.credentials(HTTP_AUTHORIZATION=f"Token {token}")

    me = client.get("/api/auth/me")
    assert me.status_code == 200
    assert me.json()["email"] == "buyer@example.com"

    out = client.post("/api/auth/logout")
    assert out.status_code == 200

    # Token is now revoked.
    assert client.get("/api/auth/me").status_code in (401, 403)


def test_auth_throttle_enforced(client):
    # The dedicated ``auth`` scope is hard-coded to 10/min on the credential
    # endpoints (see AuthScopedThrottle). DRF captures THROTTLE_RATES as a class
    # attribute at import, so the conftest rate-relaxation does not loosen the
    # ``auth`` scope -- meaning we can prove throttling end to end here. Fire
    # past the limit from one client IP and expect a 429.
    SimpleRateThrottle.cache.clear()

    statuses = []
    for i in range(13):
        resp = client.post(
            "/api/auth/login",
            {"email": f"x{i}@example.com", "password": "whatever-123!"},
            format="json",
        )
        statuses.append(resp.status_code)
    assert 429 in statuses, statuses


# ---------------------------------------------------------------------------
# Download library
# ---------------------------------------------------------------------------
def test_my_downloads_requires_auth(client):
    assert client.get("/api/me/downloads").status_code in (401, 403)


def test_my_downloads_returns_seeded_grants(client):
    # In MOCK_MODE a new registration seeds 2 sample grants for the user.
    assert settings.MOCK_MODE is True
    token = _register(client).json()["token"]
    client.credentials(HTTP_AUTHORIZATION=f"Token {token}")

    resp = client.get("/api/me/downloads")
    assert resp.status_code == 200
    items = resp.json()
    assert len(items) == 2
    for item in items:
        assert {
            "productHandle",
            "title",
            "grantedAt",
            "downloadUrl",
            "expiresAt",
        } <= set(item)
        assert item["downloadUrl"].startswith("/api/download/")

    # The signed download link actually resolves.
    dl = client.get(items[0]["downloadUrl"])
    assert dl.status_code == 200


def test_downloads_attached_to_user_by_email_on_order(client, settings):
    """A paid-order webhook attaches grants to a pre-existing user by email."""
    import base64
    import hashlib
    import hmac
    import json

    settings.SHOPIFY_WEBHOOK_SECRET = "shh"

    token = _register(
        client, email="ordered@example.com", password="Sup3rSecret!pw"
    ).json()["token"]

    payload = {
        "id": 7777,
        "email": "ORDERED@example.com",  # different case -> matched case-insensitively
        "total_price": "29.00",
        "currency": "USD",
        "line_items": [
            {"title": "DJI Aerial Vivid", "handle": "dji-aerial-vivid", "quantity": 1}
        ],
    }
    body = json.dumps(payload).encode()
    sig = base64.b64encode(
        hmac.new(b"shh", body, hashlib.sha256).digest()
    ).decode()

    resp = client.post(
        "/api/webhooks/shopify/orders-paid",
        data=body,
        content_type="application/json",
        HTTP_X_SHOPIFY_HMAC_SHA256=sig,
    )
    assert resp.status_code == 200

    from delivery.models import DownloadGrant

    grant = DownloadGrant.objects.get(
        product_handle="dji-aerial-vivid", order__isnull=False
    )
    assert grant.user is not None
    assert grant.user.email == "ordered@example.com"

    # And it shows up in the library (seeded 2 + this 1 = 3).
    client.credentials(HTTP_AUTHORIZATION=f"Token {token}")
    items = client.get("/api/me/downloads").json()
    handles = {i["productHandle"] for i in items}
    assert "dji-aerial-vivid" in handles


# ---------------------------------------------------------------------------
# Order confirmation (mock mode)
# ---------------------------------------------------------------------------
def test_order_confirm_from_mock_cart(client):
    assert settings.MOCK_MODE is True

    # Build a cart with a real variant.
    product = client.get("/api/products/midnight-noir").json()
    variant_id = product["variants"][0]["id"]
    cart = client.post("/api/cart", {"lines": []}, format="json").json()
    cart_id = cart["id"]
    client.post(
        f"/api/cart/{cart_id}/lines",
        {"merchandiseId": variant_id, "quantity": 1},
        format="json",
    )

    # The placeholder checkoutUrl ends with the cart id; confirm against it.
    resp = client.get(f"/api/orders/{cart_id}")
    assert resp.status_code == 200
    body = resp.json()
    assert body["orderId"] == f"mock-cart-{cart_id}"
    assert len(body["lines"]) == 1
    assert body["lines"][0]["title"] == "Midnight Noir"
    assert body["total"]["currencyCode"] == "USD"
    assert len(body["downloads"]) == 1
    assert body["downloads"][0]["downloadUrl"].startswith("/api/download/")

    # POST /confirm {token} returns the same confirmation.
    posted = client.post(
        "/api/orders/confirm", {"token": cart_id}, format="json"
    )
    assert posted.status_code == 200
    assert posted.json()["orderId"] == f"mock-cart-{cart_id}"


def test_order_confirm_unknown_returns_404(client):
    resp = client.get("/api/orders/00000000-0000-0000-0000-000000000000")
    assert resp.status_code == 404


def test_order_confirm_from_real_order(client, settings):
    import base64
    import hashlib
    import hmac
    import json

    settings.SHOPIFY_WEBHOOK_SECRET = "shh"
    payload = {
        "id": 4242,
        "email": "buyer@example.com",
        "total_price": "39.00",
        "currency": "USD",
        "line_items": [
            {"title": "Midnight Noir", "handle": "midnight-noir", "quantity": 2}
        ],
    }
    body = json.dumps(payload).encode()
    sig = base64.b64encode(
        hmac.new(b"shh", body, hashlib.sha256).digest()
    ).decode()
    client.post(
        "/api/webhooks/shopify/orders-paid",
        data=body,
        content_type="application/json",
        HTTP_X_SHOPIFY_HMAC_SHA256=sig,
    )

    resp = client.get("/api/orders/4242")
    assert resp.status_code == 200
    body = resp.json()
    assert body["orderId"] == "4242"
    assert body["email"] == "buyer@example.com"
    assert body["lines"][0]["quantity"] == 2
    assert len(body["downloads"]) == 1
