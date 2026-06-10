"""Google/Apple sign-in (dev mock path) + checkout login gate.

Also covers the backend-owned Google OAuth code flow (/api/auth/google/login
+ /callback): the frontend is pure UI, Django runs the whole exchange and
establishes the httpOnly session.
"""
import base64
import json
import time

import pytest
from django.test import override_settings
from rest_framework.test import APIClient

pytestmark = pytest.mark.django_db


@pytest.fixture
def client():
    return APIClient()


def test_google_signin_creates_user_session_and_optin(client):
    resp = client.post(
        "/api/auth/google", data={"credential": "mock:Fan@Example.com"}, format="json"
    )
    assert resp.status_code == 200
    body = resp.json()
    # The browser is NEVER handed a bearer token — the session is the credential.
    assert "token" not in body
    assert body["user"]["email"] == "fan@example.com"

    from django.contrib.auth.models import User
    from engagement.models import NewsletterSubscriber

    assert User.objects.filter(email="fan@example.com").exists()
    # Signing in opts them into deals + the biweekly free LUT.
    assert NewsletterSubscriber.objects.filter(email="fan@example.com").exists()


def test_apple_signin_works(client):
    resp = client.post(
        "/api/auth/apple",
        data={"identityToken": "mock:appleuser@example.com"},
        format="json",
    )
    assert resp.status_code == 200
    assert resp.json()["user"]["email"] == "appleuser@example.com"


def test_signin_is_idempotent(client):
    for _ in range(2):
        client.post(
            "/api/auth/google", data={"credential": "mock:dup@example.com"}, format="json"
        )
    from django.contrib.auth.models import User

    assert User.objects.filter(email="dup@example.com").count() == 1


def test_signin_requires_credential(client):
    assert client.post("/api/auth/google", data={}, format="json").status_code == 400


def test_bad_token_rejected(client):
    # Not a mock token and no provider configured -> generic 401.
    resp = client.post(
        "/api/auth/google", data={"credential": "garbage"}, format="json"
    )
    assert resp.status_code == 401


def test_social_signin_establishes_session(client):
    """Sign-in is session-first: the cookie alone authenticates /auth/session."""
    client.post(
        "/api/auth/google", data={"credential": "mock:sess@example.com"}, format="json"
    )
    resp = client.get("/api/auth/session")
    assert resp.status_code == 200
    body = resp.json()
    assert body["authenticated"] is True
    assert body["customer"]["email"] == "sess@example.com"


def test_session_logout_alias_clears_any_signin(client):
    client.post(
        "/api/auth/google", data={"credential": "mock:bye@example.com"}, format="json"
    )
    resp = client.post("/api/auth/session/logout")
    assert resp.status_code == 200
    assert client.get("/api/auth/session").json()["authenticated"] is False


# ---------------------------------------------------------------------------
# Backend-owned Google OAuth (code flow + Django session)
# ---------------------------------------------------------------------------
GOOGLE_OAUTH_SETTINGS = dict(
    GOOGLE_OAUTH_ENABLED=True,
    GOOGLE_CLIENT_ID="google-client-id",
    GOOGLE_CLIENT_SECRET="google-secret",
    GOOGLE_REDIRECT_URI="http://localhost:8000/api/auth/google/callback",
)


def _unsigned_jwt(claims: dict) -> str:
    """A structurally valid JWT (header.payload.sig) for claim verification."""

    def seg(obj):
        raw = json.dumps(obj).encode()
        return base64.urlsafe_b64encode(raw).rstrip(b"=").decode()

    return f"{seg({'alg': 'RS256', 'typ': 'JWT'})}.{seg(claims)}.sig"


def test_google_login_mock_mode_when_unconfigured(client):
    resp = client.get("/api/auth/google/login")
    assert resp.status_code == 200
    assert resp.json() == {"mode": "mock"}
    # No real Google to call back from -> callback is hard 404.
    assert client.get("/api/auth/google/callback").status_code == 404


@override_settings(**GOOGLE_OAUTH_SETTINGS)
def test_google_login_returns_authorize_url_and_stashes_state(client):
    resp = client.get("/api/auth/google/login?returnTo=/cart")
    assert resp.status_code == 200
    body = resp.json()
    assert body["mode"] == "google"
    url = body["authorizeUrl"]
    assert url.startswith("https://accounts.google.com/o/oauth2/v2/auth?")
    assert "code_challenge_method=S256" in url
    assert client.session["google_oauth_state"] in url
    assert client.session["google_oauth_return_to"] == "/cart"


@override_settings(**GOOGLE_OAUTH_SETTINGS)
def test_google_login_rejects_external_return_to(client):
    client.get("/api/auth/google/login?returnTo=https://evil.example")
    assert client.session["google_oauth_return_to"] == "/account"


@override_settings(**GOOGLE_OAUTH_SETTINGS)
def test_google_callback_state_mismatch_redirects_to_login_error(client):
    client.get("/api/auth/google/login")
    resp = client.get("/api/auth/google/callback?code=abc&state=WRONG")
    assert resp.status_code == 302
    assert "/account/login?error=state_mismatch" in resp["Location"]


@override_settings(**GOOGLE_OAUTH_SETTINGS)
def test_google_callback_completes_login_and_sets_session(client, monkeypatch):
    client.get("/api/auth/google/login?returnTo=/cart")
    state = client.session["google_oauth_state"]
    nonce = client.session["google_oauth_nonce"]

    id_token = _unsigned_jwt(
        {
            "iss": "https://accounts.google.com",
            "aud": "google-client-id",
            "nonce": nonce,
            "exp": int(time.time()) + 600,
            "email": "Buyer@Gmail.com",
            "email_verified": True,
        }
    )

    class FakeResponse:
        status_code = 200

        def json(self):
            return {"id_token": id_token}

    def fake_post(url, data=None, headers=None, timeout=None):
        assert url == "https://oauth2.googleapis.com/token"
        assert data["code"] == "auth-code"
        assert data["client_secret"] == "google-secret"
        assert data["code_verifier"]
        return FakeResponse()

    monkeypatch.setattr("accounts.views.requests.post", fake_post)

    resp = client.get(f"/api/auth/google/callback?code=auth-code&state={state}")
    assert resp.status_code == 302
    assert resp["Location"].endswith("/cart")

    # The browser comes back with a live Django session.
    session = client.get("/api/auth/session").json()
    assert session["authenticated"] is True
    assert session["customer"]["email"] == "buyer@gmail.com"

    # One-time OAuth material is cleared after use.
    assert "google_oauth_state" not in client.session


@override_settings(**GOOGLE_OAUTH_SETTINGS)
def test_google_callback_rejects_bad_nonce(client, monkeypatch):
    client.get("/api/auth/google/login")
    state = client.session["google_oauth_state"]

    id_token = _unsigned_jwt(
        {
            "iss": "https://accounts.google.com",
            "aud": "google-client-id",
            "nonce": "not-the-nonce",
            "exp": int(time.time()) + 600,
            "email": "x@example.com",
            "email_verified": True,
        }
    )

    class FakeResponse:
        status_code = 200

        def json(self):
            return {"id_token": id_token}

    monkeypatch.setattr(
        "accounts.views.requests.post", lambda *a, **k: FakeResponse()
    )

    resp = client.get(f"/api/auth/google/callback?code=auth-code&state={state}")
    assert resp.status_code == 302
    assert "error=invalid_id_token" in resp["Location"]
    assert client.get("/api/auth/session").json()["authenticated"] is False


def test_signed_in_user_can_checkout(client):
    from catalog import mockdata

    variant = mockdata.get_product("midnight-noir")["variants"][0]["id"]
    cart = client.post(
        "/api/cart",
        data={"lines": [{"merchandiseId": variant, "quantity": 1}]},
        format="json",
    ).json()
    # Sign in, then checkout succeeds (session cookie carries through).
    client.post(
        "/api/auth/google", data={"credential": "mock:buyer@example.com"}, format="json"
    )
    resp = client.post("/api/checkout", data={"cartId": cart["id"]}, format="json")
    assert resp.status_code == 200
    assert resp.json()["mode"] in ("mock", "stripe", "shopify")
