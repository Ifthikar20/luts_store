"""
Refund system tests.

* refund_order revokes grants, marks the order, sends one notice email, and is
  idempotent.
* Revoked grants: download endpoint -> 403, library and confirmation hide them.
* Stripe ``charge.refunded`` webhook resolves payment intent -> session -> order
  and runs the refund pipeline.
* The refund_order management command works by external order id.
"""
import pytest
from django.core import mail
from rest_framework.test import APIClient

import checkout.stripe_gateway as gw

pytestmark = pytest.mark.django_db


@pytest.fixture
def client():
    return APIClient()


def _paid_order(client, django_capture_on_commit_callbacks, email="buyer@example.com"):
    """Create a completed (mock) checkout; returns (order, download_url)."""
    from catalog import mockdata
    from orders.models import Order

    product = mockdata.get_product("midnight-noir")
    variant_id = product["variants"][0]["id"]
    cart = client.post(
        "/api/cart",
        data={"lines": [{"merchandiseId": variant_id, "quantity": 1}]},
        format="json",
    ).json()
    with django_capture_on_commit_callbacks(execute=True):
        done = client.post(
            "/api/checkout/complete",
            data={"cartId": cart["id"], "email": email},
            format="json",
        )
    order = Order.objects.get(shopify_order_id=done.json()["orderId"])
    conf = client.get(f"/api/orders/{order.shopify_order_id}").json()
    return order, conf["downloads"][0]["downloadUrl"]


def test_refund_revokes_grants_and_download_403(
    client, django_capture_on_commit_callbacks
):
    from orders.services import refund_order

    order, download_url = _paid_order(client, django_capture_on_commit_callbacks)
    assert client.get(download_url).status_code == 200  # works before refund

    mail.outbox.clear()
    with django_capture_on_commit_callbacks(execute=True):
        assert refund_order(order) is True

    order.refresh_from_db()
    assert order.refunded_at is not None
    assert order.download_grants.filter(revoked_at__isnull=True).count() == 0

    # The still-valid signed token now hits a revoked grant -> 403.
    assert client.get(download_url).status_code == 403

    # One refund-notice email to the buyer.
    assert len(mail.outbox) == 1
    assert mail.outbox[0].to == ["buyer@example.com"]
    assert "refund" in mail.outbox[0].subject.lower()


def test_refund_is_idempotent(client, django_capture_on_commit_callbacks):
    from orders.services import refund_order

    order, _ = _paid_order(client, django_capture_on_commit_callbacks)
    mail.outbox.clear()
    with django_capture_on_commit_callbacks(execute=True):
        assert refund_order(order) is True
    with django_capture_on_commit_callbacks(execute=True):
        assert refund_order(order) is False
    assert len(mail.outbox) == 1


def test_refund_hides_downloads_from_confirmation_and_library(
    client, django_capture_on_commit_callbacks
):
    from django.contrib.auth.models import User

    from orders.services import refund_order

    # Buyer has an account so grants land in their library too.
    user = User.objects.create_user("buyer", "buyer@example.com", "pw12345!")
    order, _ = _paid_order(client, django_capture_on_commit_callbacks)
    with django_capture_on_commit_callbacks(execute=True):
        refund_order(order)

    conf = client.get(f"/api/orders/{order.shopify_order_id}").json()
    assert conf["downloads"] == []

    auth = APIClient()
    auth.force_authenticate(user=user)
    library = auth.get("/api/me/downloads").json()
    assert library == [] or all(
        item["productHandle"] != "midnight-noir" for item in library
    )


def test_stripe_charge_refunded_webhook(
    client, django_capture_on_commit_callbacks, monkeypatch, settings
):
    settings.STRIPE_ENABLED = True
    settings.STRIPE_SECRET_KEY = "sk_test_dummy"
    settings.STRIPE_WEBHOOK_SECRET = "whsec_dummy"

    # A paid Stripe order (ingested directly via the shared pipeline).
    from catalog import mockdata
    from orders import services as orders_services
    from orders.models import Order

    variant = mockdata.get_product("midnight-noir")
    with django_capture_on_commit_callbacks(execute=True):
        orders_services.ingest_paid_order(
            {
                "id": "stripe-cs_refund_1",
                "email": "buyer@example.com",
                "total_price": "39.00",
                "currency": "USD",
                "line_items": [
                    {"title": variant["title"], "handle": "midnight-noir", "quantity": 1}
                ],
            }
        )

    event = {
        "type": "charge.refunded",
        "data": {"object": {"id": "ch_1", "payment_intent": "pi_123"}},
    }
    monkeypatch.setattr(
        gw.stripe.Webhook, "construct_event", lambda payload, sig, secret: event
    )
    monkeypatch.setattr(
        gw.stripe.checkout.Session,
        "list",
        lambda **kw: {"data": [{"id": "cs_refund_1"}]},
    )

    with django_capture_on_commit_callbacks(execute=True):
        resp = client.post(
            "/api/webhooks/stripe",
            data="{}",
            content_type="application/json",
            HTTP_STRIPE_SIGNATURE="t=1,v1=sig",
        )
    assert resp.status_code == 200

    order = Order.objects.get(shopify_order_id="stripe-cs_refund_1")
    assert order.refunded_at is not None
    assert order.download_grants.filter(revoked_at__isnull=True).count() == 0


def test_refund_management_command(client, django_capture_on_commit_callbacks):
    from django.core.management import call_command

    order, download_url = _paid_order(client, django_capture_on_commit_callbacks)
    with django_capture_on_commit_callbacks(execute=True):
        call_command("refund_order", order.shopify_order_id)

    order.refresh_from_db()
    assert order.refunded_at is not None
    assert client.get(download_url).status_code == 403
