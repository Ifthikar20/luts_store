"""
Engagement endpoint tests (Phase 5): newsletter signup + contact form.

Covers:
* newsletter: valid email stores a subscriber and returns a generic 200;
  invalid email -> 400; a duplicate subscribe still returns the SAME generic
  200 (no enumeration) and does not create a second row; the endpoint is
  throttled by the dedicated ``sensitive`` scope.
* contact: a valid submission stores a ``ContactMessage`` (and best-effort
  notifies the support inbox); missing fields -> 400; invalid email -> 400.

Email is captured via Django's locmem backend (``mail.outbox``), wired up by the
autouse ``_locmem_email`` fixture in conftest.py.
"""
import json

import pytest
from django.core import mail
from rest_framework.test import APIClient

from engagement.models import ContactMessage, NewsletterSubscriber

pytestmark = pytest.mark.django_db


@pytest.fixture
def client():
    return APIClient()


def _post(client, path, payload):
    return client.post(
        path, data=json.dumps(payload), content_type="application/json"
    )


# ---------------------------------------------------------------------------
# Newsletter
# ---------------------------------------------------------------------------
def test_newsletter_valid_stores_subscriber(client):
    resp = _post(client, "/api/newsletter", {"email": "fan@example.com"})
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"
    assert NewsletterSubscriber.objects.filter(email="fan@example.com").exists()


def test_newsletter_invalid_email_400(client):
    resp = _post(client, "/api/newsletter", {"email": "not-an-email"})
    assert resp.status_code == 400
    assert NewsletterSubscriber.objects.count() == 0

    missing = _post(client, "/api/newsletter", {})
    assert missing.status_code == 400


def test_newsletter_duplicate_is_generic_200_and_no_dup_row(client):
    first = _post(client, "/api/newsletter", {"email": "dup@example.com"})
    second = _post(client, "/api/newsletter", {"email": "dup@example.com"})

    # Identical generic response whether new or already subscribed -> no enumeration.
    assert first.status_code == 200
    assert second.status_code == 200
    assert first.json() == second.json()
    # Exactly one row; normalized to lowercase.
    assert NewsletterSubscriber.objects.filter(email="dup@example.com").count() == 1


def test_newsletter_is_throttled(client, monkeypatch):
    # DRF binds THROTTLE_RATES at import time, so patch the throttle's rate
    # directly to prove the endpoint IS wired to the 'sensitive' scoped throttle.
    from engagement.views import SensitiveScopedThrottle
    from rest_framework.throttling import SimpleRateThrottle

    monkeypatch.setitem(SensitiveScopedThrottle.THROTTLE_RATES, "sensitive", "3/min")
    SimpleRateThrottle.cache.clear()

    statuses = []
    for i in range(5):
        resp = _post(client, "/api/newsletter", {"email": f"burst{i}@example.com"})
        statuses.append(resp.status_code)

    assert 429 in statuses  # throttle kicks in within the burst
    SimpleRateThrottle.cache.clear()


# ---------------------------------------------------------------------------
# Contact
# ---------------------------------------------------------------------------
def test_contact_valid_stores_message_and_notifies_support(client, settings):
    settings.SUPPORT_EMAIL = "support@thelookslab.com"
    resp = _post(
        client,
        "/api/contact",
        {
            "name": "Ada Editor",
            "email": "ada@example.com",
            "message": "Love the Midnight Noir pack — any plans for a log set?",
        },
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"

    msg = ContactMessage.objects.get(email="ada@example.com")
    assert msg.name == "Ada Editor"
    assert "Midnight Noir" in msg.message

    # Best-effort support notification was sent.
    assert len(mail.outbox) == 1
    assert mail.outbox[0].to == ["support@thelookslab.com"]


def test_contact_missing_fields_400(client):
    # Missing message.
    r1 = _post(
        client, "/api/contact", {"name": "X", "email": "x@example.com"}
    )
    assert r1.status_code == 400
    # Missing name.
    r2 = _post(
        client, "/api/contact", {"email": "x@example.com", "message": "hi"}
    )
    assert r2.status_code == 400
    # Invalid email.
    r3 = _post(
        client,
        "/api/contact",
        {"name": "X", "email": "nope", "message": "hi"},
    )
    assert r3.status_code == 400

    assert ContactMessage.objects.count() == 0
