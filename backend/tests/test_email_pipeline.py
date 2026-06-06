"""
Post-purchase email pipeline tests (Phase 4).

Covers:
* ``ingest_paid_order`` sends exactly one confirmation email and is idempotent
  (re-ingest does not send a second one).
* the email body contains the product titles and a resolvable signed download
  link.
* the resend endpoint is non-enumerating (identical response for known/unknown
  emails) yet only actually mails the known one, and is throttled.
* the ``simulate_order`` management command creates grants + sends one email.

Email is captured via Django's locmem backend (``mail.outbox``), wired up by the
autouse ``_locmem_email`` fixture in conftest.py.
"""
import base64
import hashlib
import hmac
import json
from io import StringIO

import pytest
from django.core import mail
from django.core.management import call_command
from rest_framework.test import APIClient

pytestmark = pytest.mark.django_db


def _sign(body: bytes, secret: str) -> str:
    return base64.b64encode(
        hmac.new(secret.encode(), body, hashlib.sha256).digest()
    ).decode()


@pytest.fixture
def client():
    return APIClient()


def _post_webhook(client, payload, secret="shh"):
    body = json.dumps(payload).encode()
    sig = _sign(body, secret)
    return client.post(
        "/api/webhooks/shopify/orders-paid",
        data=body,
        content_type="application/json",
        HTTP_X_SHOPIFY_HMAC_SHA256=sig,
    )


# ---------------------------------------------------------------------------
# Webhook ingest -> one email, idempotent
# ---------------------------------------------------------------------------
def test_ingest_sends_one_email_and_is_idempotent(
    client, settings, django_capture_on_commit_callbacks
):
    settings.SHOPIFY_WEBHOOK_SECRET = "shh"
    payload = {
        "id": 7001,
        "email": "buyer@example.com",
        "total_price": "39.00",
        "currency": "USD",
        "line_items": [
            {"title": "Midnight Noir", "handle": "midnight-noir", "quantity": 1}
        ],
    }

    with django_capture_on_commit_callbacks(execute=True):
        first = _post_webhook(client, payload)
    assert first.status_code == 200
    assert first.json()["created"] is True
    assert len(mail.outbox) == 1
    assert mail.outbox[0].to == ["buyer@example.com"]

    # Replay the SAME order id -> idempotent: no order created, no new email.
    with django_capture_on_commit_callbacks(execute=True):
        second = _post_webhook(client, payload)
    assert second.status_code == 200
    assert second.json()["created"] is False
    assert len(mail.outbox) == 1  # still exactly one


def test_email_body_has_titles_and_resolvable_download_link(
    client, settings, django_capture_on_commit_callbacks
):
    settings.SHOPIFY_WEBHOOK_SECRET = "shh"
    payload = {
        "id": 7002,
        "email": "buyer2@example.com",
        "total_price": "39.00",
        "currency": "USD",
        "line_items": [
            {"title": "Midnight Noir", "handle": "midnight-noir", "quantity": 1}
        ],
    }
    with django_capture_on_commit_callbacks(execute=True):
        _post_webhook(client, payload)

    assert len(mail.outbox) == 1
    msg = mail.outbox[0]
    text_body = msg.body
    html_body = next(
        content for content, mimetype in msg.alternatives if mimetype == "text/html"
    )

    # Catalog title for the handle resolves on the email.
    from delivery.services import _title_for_handle

    title = _title_for_handle("midnight-noir")
    assert title in text_body
    assert title in html_body

    # Pull the signed download path out of the email and resolve it against the
    # download endpoint -> proves the link is real (not a placeholder).
    import re

    match = re.search(r"/api/download/[\w:.\-]+", text_body)
    assert match, "no /api/download/<token> link found in email"
    download_path = match.group(0)
    resp = client.get(download_path)
    # Mock mode streams a .cube placeholder as an attachment (no longer JSON).
    assert resp.status_code == 200
    assert resp["Content-Disposition"].startswith("attachment;")
    assert b"LUT_3D_SIZE" in resp.content


# ---------------------------------------------------------------------------
# Resend endpoint: non-enumerating + actually mails only the known one
# ---------------------------------------------------------------------------
def _make_order(email):
    from orders.services import ingest_paid_order

    order, _ = ingest_paid_order(
        {
            "id": f"resend-{email}",
            "email": email,
            "total_price": "39.00",
            "currency": "USD",
            "line_items": [
                {"title": "Midnight Noir", "handle": "midnight-noir", "quantity": 1}
            ],
        }
    )
    return order


def test_resend_is_non_enumerating_and_mails_only_known(client):
    # Seed a known purchaser. (No on_commit capture here: we only care about the
    # resend endpoint's own outbox effect, and we clear the outbox first.)
    _make_order("known@example.com")
    mail.outbox.clear()

    known = client.post(
        "/api/orders/resend-downloads",
        data=json.dumps({"email": "known@example.com"}),
        content_type="application/json",
    )
    unknown = client.post(
        "/api/orders/resend-downloads",
        data=json.dumps({"email": "nobody@example.com"}),
        content_type="application/json",
    )

    # Identical generic response regardless of existence -> no enumeration.
    assert known.status_code == 200
    assert unknown.status_code == 200
    assert known.json() == unknown.json()
    assert "resent" in known.json()["detail"].lower()

    # But only the known email was actually mailed.
    assert len(mail.outbox) == 1
    assert mail.outbox[0].to == ["known@example.com"]


def test_resend_is_throttled(client, monkeypatch):
    # DRF binds THROTTLE_RATES at import time, so we patch the resend throttle's
    # rate directly (settings overrides don't propagate to it). This proves the
    # endpoint IS wired to the dedicated 'sensitive' scoped throttle.
    from orders.views import SensitiveScopedThrottle
    from rest_framework.throttling import SimpleRateThrottle

    monkeypatch.setitem(SensitiveScopedThrottle.THROTTLE_RATES, "sensitive", "3/min")
    SimpleRateThrottle.cache.clear()

    statuses = []
    for _ in range(5):
        resp = client.post(
            "/api/orders/resend-downloads",
            data=json.dumps({"email": "x@example.com"}),
            content_type="application/json",
        )
        statuses.append(resp.status_code)

    assert 429 in statuses  # throttle kicks in within the burst
    SimpleRateThrottle.cache.clear()


# ---------------------------------------------------------------------------
# simulate_order management command
# ---------------------------------------------------------------------------
def test_simulate_order_command_creates_grants_and_sends_email():
    out = StringIO()
    # The command runs outside an atomic block, so on_commit fires immediately.
    call_command(
        "simulate_order",
        "--email",
        "sim@example.com",
        "--handle",
        "midnight-noir",
        "--handle",
        "dji-aerial-vivid",
        stdout=out,
    )

    from delivery.models import DownloadGrant
    from orders.models import Order

    order = Order.objects.get(email="sim@example.com")
    assert order.purchases.count() == 2
    assert DownloadGrant.objects.filter(order=order).count() == 2
    assert len(mail.outbox) == 1
    assert mail.outbox[0].to == ["sim@example.com"]
