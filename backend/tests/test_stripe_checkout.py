"""
Stripe Checkout payment tests.

Covers the self-contained Stripe flow end to end, with the Stripe SDK boundary
monkeypatched (no network):

* POST /api/checkout (Stripe enabled) -> {mode:"stripe", checkoutUrl} and the
  Session is built with the correct line items / cart reference.
* POST /api/checkout/complete -> 404 when Stripe is the processor (the webhook
  completes orders, never the demo endpoint).
* POST /api/webhooks/stripe (checkout.session.completed) -> Order + DownloadGrants
  + exactly one confirmation/receipt email; idempotent on replay.
* Bad signature -> 400; unrelated event types -> 200 no-op.
* Thank-you fallback: confirming a stripe-<session> id with no order yet
  retrieves the paid session and ingests it synchronously.
"""
import types

import pytest
from django.core import mail
from rest_framework.test import APIClient

import checkout.stripe_gateway as gw

pytestmark = pytest.mark.django_db


@pytest.fixture
def client():
    return APIClient()


@pytest.fixture
def stripe_enabled(settings):
    """Turn on the Stripe code paths for a test."""
    settings.STRIPE_ENABLED = True
    settings.STRIPE_SECRET_KEY = "sk_test_dummy"
    settings.STRIPE_WEBHOOK_SECRET = "whsec_dummy"
    settings.FRONTEND_URL = "https://shop.example.com"
    return settings


def _make_cart(client, handle="midnight-noir"):
    from catalog import mockdata

    product = mockdata.get_product(handle)
    variant_id = product["variants"][0]["id"]
    resp = client.post(
        "/api/cart",
        data={"lines": [{"merchandiseId": variant_id, "quantity": 1}]},
        format="json",
    )
    assert resp.status_code == 201
    return resp.json()["id"], variant_id


def _completed_event(
    cart_id, session_id="cs_test_123", email="guest@example.com", metadata=None
):
    return {
        "type": "checkout.session.completed",
        "data": {
            "object": {
                "id": session_id,
                "client_reference_id": cart_id,
                "customer_details": {"email": email},
                "customer_email": None,
                "amount_total": 3900,  # $39.00 in cents (midnight-noir)
                "currency": "usd",
                "payment_status": "paid",
                "metadata": metadata or {"cart_id": cart_id},
            }
        },
    }


# ---------------------------------------------------------------------------
# begin checkout -> Stripe Session
# ---------------------------------------------------------------------------
def test_checkout_creates_stripe_session(client, stripe_enabled, monkeypatch):
    cart_id, _ = _make_cart(client)
    captured = {}

    def fake_create(**kwargs):
        captured.update(kwargs)
        return types.SimpleNamespace(
            id="cs_test_123", url="https://checkout.stripe.com/c/pay/cs_test_123"
        )

    monkeypatch.setattr(gw.stripe.checkout.Session, "create", fake_create)

    resp = client.post("/api/checkout", data={"cartId": cart_id}, format="json")
    assert resp.status_code == 200
    body = resp.json()
    assert body["mode"] == "stripe"
    assert body["checkoutUrl"].startswith("https://checkout.stripe.com/")

    # The session carried the cart reference and a correctly-priced line item.
    assert captured["client_reference_id"] == cart_id
    assert captured["mode"] == "payment"
    assert captured["line_items"][0]["price_data"]["unit_amount"] == 3900
    assert captured["line_items"][0]["quantity"] == 1
    assert "stripe-{CHECKOUT_SESSION_ID}" in captured["success_url"]

    # And a paid-lines snapshot in metadata (what the webhook will grant from).
    import json

    snapshot = json.loads(captured["metadata"]["lines"])
    assert snapshot == [{"h": "midnight-noir", "t": "Midnight Noir", "q": 1}]


def test_complete_404_when_stripe_enabled(client, stripe_enabled):
    """The demo-complete endpoint is disabled once Stripe is the processor."""
    cart_id, _ = _make_cart(client)
    resp = client.post(
        "/api/checkout/complete",
        data={"cartId": cart_id, "email": "guest@example.com"},
        format="json",
    )
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# webhook -> order + grants + one receipt email
# ---------------------------------------------------------------------------
def test_webhook_creates_order_grants_and_one_email(
    client, stripe_enabled, monkeypatch, django_capture_on_commit_callbacks
):
    cart_id, _ = _make_cart(client)
    event = _completed_event(cart_id)
    monkeypatch.setattr(
        gw.stripe.Webhook, "construct_event", lambda payload, sig, secret: event
    )

    with django_capture_on_commit_callbacks(execute=True):
        resp = client.post(
            "/api/webhooks/stripe",
            data="{}",
            content_type="application/json",
            HTTP_STRIPE_SIGNATURE="t=1,v1=sig",
        )
    assert resp.status_code == 200

    from delivery.models import DownloadGrant
    from orders.models import Order

    order = Order.objects.get(shopify_order_id="stripe-cs_test_123")
    assert order.email == "guest@example.com"
    assert order.total == pytest.approx(39.00)
    assert order.purchases.count() == 1
    assert DownloadGrant.objects.filter(order=order).count() == 1

    assert len(mail.outbox) == 1
    assert mail.outbox[0].to == ["guest@example.com"]


def test_webhook_is_idempotent(
    client, stripe_enabled, monkeypatch, django_capture_on_commit_callbacks
):
    cart_id, _ = _make_cart(client)
    event = _completed_event(cart_id)
    monkeypatch.setattr(
        gw.stripe.Webhook, "construct_event", lambda payload, sig, secret: event
    )

    for _ in range(2):
        with django_capture_on_commit_callbacks(execute=True):
            client.post(
                "/api/webhooks/stripe",
                data="{}",
                content_type="application/json",
                HTTP_STRIPE_SIGNATURE="t=1,v1=sig",
            )

    from orders.models import Order

    assert Order.objects.filter(shopify_order_id="stripe-cs_test_123").count() == 1
    # Idempotent replay sends no second email.
    assert len(mail.outbox) == 1


def test_webhook_grants_from_snapshot_not_mutated_cart(
    client, stripe_enabled, monkeypatch, django_capture_on_commit_callbacks
):
    """Items added to the cart AFTER the Stripe redirect must not get grants.

    The webhook grants from the metadata snapshot taken at session creation,
    not from the live cart (which the shopper could mutate in another tab while
    on Stripe's payment page).
    """
    from catalog import mockdata

    cart_id, _ = _make_cart(client)  # paid for: midnight-noir only

    # Shopper mutates the cart while on Stripe's card page.
    extra = mockdata.get_product("golden-hour-drama")["variants"][0]["id"]
    resp = client.post(
        f"/api/cart/{cart_id}/lines",
        data={"merchandiseId": extra, "quantity": 1},
        format="json",
    )
    assert resp.status_code == 200

    event = _completed_event(
        cart_id,
        metadata={
            "cart_id": cart_id,
            "lines": '[{"h":"midnight-noir","t":"Midnight Noir","q":1}]',
        },
    )
    monkeypatch.setattr(
        gw.stripe.Webhook, "construct_event", lambda payload, sig, secret: event
    )
    with django_capture_on_commit_callbacks(execute=True):
        client.post(
            "/api/webhooks/stripe",
            data="{}",
            content_type="application/json",
            HTTP_STRIPE_SIGNATURE="t=1,v1=sig",
        )

    from delivery.models import DownloadGrant

    handles = list(
        DownloadGrant.objects.values_list("product_handle", flat=True)
    )
    assert handles == ["midnight-noir"]  # no grant for the unpaid extra item


def test_webhook_bad_signature_400(client, stripe_enabled, monkeypatch):
    def boom(payload, sig, secret):
        raise ValueError("bad sig")

    monkeypatch.setattr(gw.stripe.Webhook, "construct_event", boom)
    resp = client.post(
        "/api/webhooks/stripe",
        data="{}",
        content_type="application/json",
        HTTP_STRIPE_SIGNATURE="t=1,v1=bad",
    )
    assert resp.status_code == 400


def test_webhook_ignores_other_events(client, stripe_enabled, monkeypatch):
    event = {"type": "payment_intent.created", "data": {"object": {}}}
    monkeypatch.setattr(
        gw.stripe.Webhook, "construct_event", lambda payload, sig, secret: event
    )
    resp = client.post(
        "/api/webhooks/stripe",
        data="{}",
        content_type="application/json",
        HTTP_STRIPE_SIGNATURE="t=1,v1=sig",
    )
    assert resp.status_code == 200
    from orders.models import Order

    assert Order.objects.count() == 0


def test_webhook_404_when_stripe_disabled(client):
    resp = client.post(
        "/api/webhooks/stripe",
        data="{}",
        content_type="application/json",
        HTTP_STRIPE_SIGNATURE="t=1,v1=sig",
    )
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# thank-you fallback: retrieve + ingest a paid session if the webhook lags
# ---------------------------------------------------------------------------
def test_confirm_fallback_retrieves_paid_session(
    client, stripe_enabled, monkeypatch, django_capture_on_commit_callbacks
):
    cart_id, _ = _make_cart(client)
    session = {
        "id": "cs_test_999",
        "client_reference_id": cart_id,
        "customer_details": {"email": "guest@example.com"},
        "amount_total": 3900,
        "currency": "usd",
        "payment_status": "paid",
    }
    monkeypatch.setattr(
        gw.stripe.checkout.Session, "retrieve", lambda sid: session
    )

    with django_capture_on_commit_callbacks(execute=True):
        resp = client.get("/api/orders/stripe-cs_test_999")
    assert resp.status_code == 200
    body = resp.json()
    assert body["orderId"] == "stripe-cs_test_999"
    assert body["email"] == "guest@example.com"
    assert len(body["downloads"]) == 1

    from orders.models import Order

    assert Order.objects.filter(shopify_order_id="stripe-cs_test_999").count() == 1
