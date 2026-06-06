"""
Tests for the Shopify Customer Accounts portal (OAuth 2.0 / OIDC, PKCE, BFF).

Covered:
* /api/auth/shopify/login — REAL mode returns a well-formed authorize URL
  (response_type=code, scope, client_id, state, code_challenge + S256) and
  stashes state in the session; MOCK mode returns {"mode":"mock"}.
* /api/auth/shopify/callback — rejects a state mismatch (302 -> ?error=).
* /api/auth/shopify/mock-complete — creates a session, maps to a user, attaches
  grants by email; 404 when real accounts are enabled.
* /api/auth/session — reflects logged-in / logged-out.
* /api/me/downloads — works for a SESSION-authenticated user (not just Token).

The legacy token tests in test_accounts.py remain untouched and green.
"""
import pytest
from django.contrib.auth.models import User
from rest_framework.test import APIClient

pytestmark = pytest.mark.django_db


@pytest.fixture
def client():
    return APIClient()


# Settings that flip the portal into REAL (Shopify) mode for a given test.
REAL_SETTINGS = dict(
    SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID="test-client-id",
    SHOPIFY_CUSTOMER_ACCOUNT_SHOP_ID="123456789",
    SHOPIFY_CUSTOMER_ACCOUNTS_ENABLED=True,
)


# ---------------------------------------------------------------------------
# /api/auth/shopify/login
# ---------------------------------------------------------------------------
def test_login_mock_mode_returns_mock(client):
    # By default (no Shopify credentials) the portal is in MOCK mode.
    resp = client.get("/api/auth/shopify/login")
    assert resp.status_code == 200
    assert resp.json() == {"mode": "mock"}


def test_login_real_mode_returns_authorize_url_and_stores_state(client, settings):
    for key, value in REAL_SETTINGS.items():
        setattr(settings, key, value)

    resp = client.get("/api/auth/shopify/login?returnTo=/account")
    assert resp.status_code == 200
    body = resp.json()
    assert body["mode"] == "shopify"

    from urllib.parse import parse_qs, urlparse

    parsed = urlparse(body["authorizeUrl"])
    assert parsed.netloc == "shopify.com"
    assert parsed.path == "/authentication/123456789/oauth/authorize"
    qs = parse_qs(parsed.query)
    assert qs["response_type"] == ["code"]
    assert qs["client_id"] == ["test-client-id"]
    assert qs["scope"] == ["openid email customer-account-api:full"]
    assert qs["code_challenge_method"] == ["S256"]
    assert qs["code_challenge"][0]  # present + non-empty
    state = qs["state"][0]
    assert state

    # state is stored in the server-side session for the callback to verify.
    assert client.session["shopify_oauth_state"] == state
    assert client.session["shopify_oauth_code_verifier"]
    assert client.session["shopify_oauth_nonce"]


def test_login_rejects_open_redirect_return_to(client, settings):
    for key, value in REAL_SETTINGS.items():
        setattr(settings, key, value)
    client.get("/api/auth/shopify/login?returnTo=https://evil.example")
    # The unsafe absolute URL is dropped in favor of the safe default.
    assert client.session["shopify_oauth_return_to"] == "/account"


# ---------------------------------------------------------------------------
# /api/auth/shopify/callback
# ---------------------------------------------------------------------------
def test_callback_rejects_state_mismatch(client, settings):
    for key, value in REAL_SETTINGS.items():
        setattr(settings, key, value)

    # Seed a session state, then send back a different one.
    s = client.session
    s["shopify_oauth_state"] = "the-real-state"
    s.save()

    resp = client.get("/api/auth/shopify/callback?code=abc&state=WRONG")
    assert resp.status_code == 302
    assert "error=state_mismatch" in resp["Location"]
    # No user/session was established.
    assert "_auth_user_id" not in client.session


def test_callback_404_in_mock_mode(client):
    resp = client.get("/api/auth/shopify/callback?code=abc&state=x")
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# /api/auth/shopify/mock-complete
# ---------------------------------------------------------------------------
def test_mock_complete_creates_session_and_user(client):
    resp = client.post(
        "/api/auth/shopify/mock-complete",
        {"email": "Demo@Example.com"},
        format="json",
    )
    assert resp.status_code == 200
    assert resp.json() == {"customer": {"email": "demo@example.com"}}

    # A local user was created (email lower-cased) and the session is logged in.
    assert User.objects.filter(username="demo@example.com").exists()
    assert "_auth_user_id" in client.session


def test_mock_complete_attaches_grants_by_email(client):
    from delivery.models import DownloadGrant

    # A grant existed (e.g. from a guest purchase) BEFORE the user logged in.
    DownloadGrant.objects.create(
        email="buyer@example.com", product_handle="midnight-noir"
    )

    resp = client.post(
        "/api/auth/shopify/mock-complete",
        {"email": "buyer@example.com"},
        format="json",
    )
    assert resp.status_code == 200

    user = User.objects.get(username="buyer@example.com")
    grant = DownloadGrant.objects.get(product_handle="midnight-noir")
    assert grant.user_id == user.id


def test_mock_complete_requires_valid_email(client):
    resp = client.post(
        "/api/auth/shopify/mock-complete", {"email": "not-an-email"}, format="json"
    )
    assert resp.status_code == 400


def test_mock_complete_404_when_accounts_enabled(client, settings):
    for key, value in REAL_SETTINGS.items():
        setattr(settings, key, value)
    resp = client.post(
        "/api/auth/shopify/mock-complete",
        {"email": "demo@example.com"},
        format="json",
    )
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# /api/auth/session  +  logout
# ---------------------------------------------------------------------------
def test_session_reflects_logged_out_then_in_then_out(client):
    # Logged out.
    resp = client.get("/api/auth/session")
    assert resp.status_code == 200
    assert resp.json() == {"authenticated": False, "customer": None}

    # Log in via the mock path.
    client.post(
        "/api/auth/shopify/mock-complete",
        {"email": "demo@example.com"},
        format="json",
    )
    resp = client.get("/api/auth/session")
    assert resp.json() == {
        "authenticated": True,
        "customer": {"email": "demo@example.com"},
    }

    # Log out -> back to unauthenticated.
    out = client.post("/api/auth/shopify/logout")
    assert out.status_code == 200
    assert out.json() == {"ok": True}
    assert client.get("/api/auth/session").json()["authenticated"] is False


# ---------------------------------------------------------------------------
# /api/me/downloads via SESSION auth (no token)
# ---------------------------------------------------------------------------
def test_my_downloads_works_for_session_user(client):
    from delivery.models import DownloadGrant

    DownloadGrant.objects.create(
        email="lib@example.com", product_handle="dji-aerial-vivid"
    )
    # Log in with the session-based portal (NO Authorization: Token header).
    client.post(
        "/api/auth/shopify/mock-complete",
        {"email": "lib@example.com"},
        format="json",
    )

    resp = client.get("/api/me/downloads")
    assert resp.status_code == 200
    handles = {item["productHandle"] for item in resp.json()}
    assert "dji-aerial-vivid" in handles
