"""Google/Apple sign-in (dev mock path) + checkout login gate."""
import pytest
from rest_framework.test import APIClient

pytestmark = pytest.mark.django_db


@pytest.fixture
def client():
    return APIClient()


def test_google_signin_creates_user_token_and_optin(client):
    resp = client.post(
        "/api/auth/google", data={"credential": "mock:Fan@Example.com"}, format="json"
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["token"]
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
