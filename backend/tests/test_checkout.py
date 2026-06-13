"""
Checkout flow tests (GOAL 2).

Covers:
* POST /api/checkout (mock) -> {mode: "mock", checkoutUrl: "/checkout?cart=<id>"}
* POST /api/checkout/complete -> creates Order + DownloadGrants + sends exactly
  one confirmation email, returns {orderId}
* complete is idempotent (re-completing the same cart does not duplicate)
* complete returns 404 when NOT in mock mode (simulated real mode)
* a guest (no auth) can retrieve the confirmation + downloads by orderId

Email is captured via the autouse locmem backend (mail.outbox).
"""
import pytest
from django.core import mail
from rest_framework.test import APIClient

pytestmark = pytest.mark.django_db


@pytest.fixture
def client(django_user_model):
    # Buying requires a signed-in account; authenticate the test client.
    user = django_user_model.objects.create_user(
        username="buyer@example.com", email="buyer@example.com", password="pw12345!"
    )
    c = APIClient()
    c.force_authenticate(user=user)
    return c


@pytest.fixture
def anon_client():
    return APIClient()


def _make_cart(client, handle="midnight-noir"):
    """Create a cart with one line and return (cart_id, variant_id)."""
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


# ---------------------------------------------------------------------------
# begin checkout (mock)
# ---------------------------------------------------------------------------
def test_mock_checkout_returns_relative_url(client):
    cart_id, _ = _make_cart(client)
    resp = client.post("/api/checkout", data={"cartId": cart_id}, format="json")
    assert resp.status_code == 200
    body = resp.json()
    assert body["mode"] == "mock"
    # Relative path (frontend renders a demo checkout page). Only the opaque
    # cart id is in the URL — the email (PII) is NEVER exposed there.
    assert body["checkoutUrl"] == f"/checkout?cart={cart_id}"
    assert "@" not in body["checkoutUrl"]
    assert "email" not in body["checkoutUrl"]


def test_checkout_unknown_cart_404(client):
    resp = client.post(
        "/api/checkout",
        data={"cartId": "00000000-0000-0000-0000-000000000000"},
        format="json",
    )
    assert resp.status_code == 404


def test_checkout_requires_cart_id(client):
    resp = client.post("/api/checkout", data={}, format="json")
    assert resp.status_code == 400


def test_guest_checkout_requires_email(anon_client):
    """Guests can buy WITHOUT an account, but must give a receipt email."""
    resp = anon_client.post(
        "/api/checkout", data={"cartId": "x"}, format="json"
    )
    assert resp.status_code == 400
    assert resp.json()["code"] == "email_required"


def test_guest_checkout_rejects_bad_email(anon_client):
    resp = anon_client.post(
        "/api/checkout",
        data={"cartId": "x", "email": "not-an-email"},
        format="json",
    )
    assert resp.status_code == 400
    assert resp.json()["code"] == "email_invalid"


def test_guest_checkout_with_email_succeeds(anon_client):
    cart_id, _ = _make_cart(anon_client)
    resp = anon_client.post(
        "/api/checkout",
        data={"cartId": cart_id, "email": "Guest@Example.com"},
        format="json",
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["mode"] == "mock"
    # Even when an email is supplied, it is NOT placed in the URL (no PII leak).
    assert body["checkoutUrl"] == f"/checkout?cart={cart_id}"
    assert "@" not in body["checkoutUrl"]


# ---------------------------------------------------------------------------
# complete checkout (mock) -> order + grants + one email
# ---------------------------------------------------------------------------
def test_complete_creates_order_grants_and_one_email(
    client, django_capture_on_commit_callbacks
):
    cart_id, _ = _make_cart(client)
    with django_capture_on_commit_callbacks(execute=True):
        resp = client.post(
            "/api/checkout/complete",
            data={"cartId": cart_id, "email": "guest@example.com"},
            format="json",
        )
    assert resp.status_code == 200
    order_id = resp.json()["orderId"]
    assert order_id == f"mock-checkout-{cart_id}"

    from delivery.models import DownloadGrant
    from orders.models import Order

    order = Order.objects.get(shopify_order_id=order_id)
    assert order.email == "guest@example.com"
    assert order.purchases.count() == 1
    assert DownloadGrant.objects.filter(order=order).count() == 1

    # Exactly one confirmation email to the guest.
    assert len(mail.outbox) == 1
    assert mail.outbox[0].to == ["guest@example.com"]


def test_complete_is_idempotent(client, django_capture_on_commit_callbacks):
    cart_id, _ = _make_cart(client)
    with django_capture_on_commit_callbacks(execute=True):
        first = client.post(
            "/api/checkout/complete",
            data={"cartId": cart_id, "email": "guest@example.com"},
            format="json",
        )
    with django_capture_on_commit_callbacks(execute=True):
        second = client.post(
            "/api/checkout/complete",
            data={"cartId": cart_id, "email": "guest@example.com"},
            format="json",
        )

    assert first.json()["orderId"] == second.json()["orderId"]

    from delivery.models import DownloadGrant
    from orders.models import Order

    assert Order.objects.filter(shopify_order_id=f"mock-checkout-{cart_id}").count() == 1
    assert DownloadGrant.objects.filter(product_handle="midnight-noir").count() == 1
    # Still exactly one email (idempotent re-completion sends no second email).
    assert len(mail.outbox) == 1


def test_complete_requires_email(client):
    cart_id, _ = _make_cart(client)
    resp = client.post(
        "/api/checkout/complete", data={"cartId": cart_id}, format="json"
    )
    assert resp.status_code == 400


def test_complete_404_when_not_mock(client, settings, monkeypatch):
    """In real mode the orders/paid webhook completes orders, not this endpoint."""
    cart_id, _ = _make_cart(client)
    # Simulate real mode for the view's MOCK_MODE check.
    monkeypatch.setattr(settings, "MOCK_MODE", False)
    resp = client.post(
        "/api/checkout/complete",
        data={"cartId": cart_id, "email": "guest@example.com"},
        format="json",
    )
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# guest can retrieve confirmation + downloads (login-free)
# ---------------------------------------------------------------------------
def test_guest_retrieves_confirmation_and_downloads(
    client, django_capture_on_commit_callbacks
):
    cart_id, _ = _make_cart(client)
    with django_capture_on_commit_callbacks(execute=True):
        complete = client.post(
            "/api/checkout/complete",
            data={"cartId": cart_id, "email": "guest@example.com"},
            format="json",
        )
    order_id = complete.json()["orderId"]

    # No auth header -> guest. Retrieve confirmation by orderId.
    guest = APIClient()
    resp = guest.get(f"/api/orders/{order_id}")
    assert resp.status_code == 200
    body = resp.json()
    assert body["orderId"] == order_id
    assert body["email"] == "guest@example.com"
    assert len(body["downloads"]) == 1
    download_url = body["downloads"][0]["downloadUrl"]
    assert download_url.startswith("/api/download/")

    # And the download link itself resolves login-free (streams a .cube).
    dl = guest.get(download_url)
    assert dl.status_code == 200
    assert dl["Content-Disposition"].startswith("attachment;")
