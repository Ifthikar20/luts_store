"""Account settings: GET/POST /api/me/preferences (session-authenticated)."""
import pytest
from rest_framework.test import APIClient

from engagement.models import NewsletterSubscriber

pytestmark = pytest.mark.django_db


@pytest.fixture
def client():
    return APIClient()


def _login(client, email="buyer@example.com"):
    client.post("/api/auth/shopify/mock-complete", {"email": email}, format="json")


def test_requires_login(client):
    assert client.get("/api/me/preferences").status_code == 401


def test_get_reflects_marketing_state(client):
    _login(client)
    body = client.get("/api/me/preferences").json()
    assert body["email"] == "buyer@example.com"
    assert body["marketingEmails"] is False
    assert "memberSince" in body

    NewsletterSubscriber.objects.create(email="buyer@example.com")
    assert client.get("/api/me/preferences").json()["marketingEmails"] is True


def test_post_opts_in_and_out(client):
    _login(client)
    on = client.post(
        "/api/me/preferences", {"marketingEmails": True}, format="json"
    )
    assert on.status_code == 200
    assert on.json()["marketingEmails"] is True
    assert NewsletterSubscriber.objects.filter(email="buyer@example.com").exists()

    off = client.post(
        "/api/me/preferences", {"marketingEmails": False}, format="json"
    )
    assert off.json()["marketingEmails"] is False
    assert not NewsletterSubscriber.objects.filter(email="buyer@example.com").exists()
