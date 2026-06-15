"""
Payment-bypass regression tests.

The login-free DEMO checkout mints download grants WITHOUT payment. It must be
active ONLY in the pure in-app demo (no Stripe, no live Shopify). Once a real
payment provider is configured, every demo grant-creating path must be closed —
otherwise a shopper could download paid content for free by skipping checkout.
"""
import pytest
from rest_framework.test import APIClient

from delivery.models import DownloadGrant

pytestmark = pytest.mark.django_db


def _cart_with_item(client) -> str:
    product = client.get("/api/products/midnight-noir").json()
    variant_id = product["variants"][0]["id"]
    cart_id = client.post("/api/cart", {"lines": []}, format="json").json()["id"]
    client.post(
        f"/api/cart/{cart_id}/lines",
        {"merchandiseId": variant_id, "quantity": 1},
        format="json",
    )
    return cart_id


def test_demo_confirm_mints_grants_only_in_pure_demo():
    """Sanity: with no payment provider, the demo confirm still works."""
    client = APIClient()
    cart_id = _cart_with_item(client)
    resp = client.get(f"/api/orders/{cart_id}")
    assert resp.status_code == 200
    assert resp.json()["downloads"]


def test_confirm_does_not_mint_free_grants_when_stripe_enabled(settings):
    # A real deployment: Stripe payments + the in-repo catalog (MOCK_MODE stays
    # True with no Shopify token). The demo confirm path MUST be closed.
    settings.STRIPE_ENABLED = True
    client = APIClient()
    cart_id = _cart_with_item(client)

    before = DownloadGrant.objects.count()
    resp = client.get(f"/api/orders/{cart_id}")
    # No free confirmation, and crucially NO grants created.
    assert resp.status_code == 404
    assert DownloadGrant.objects.count() == before


def test_checkout_complete_blocked_when_stripe_enabled(settings):
    settings.STRIPE_ENABLED = True
    client = APIClient()
    cart_id = _cart_with_item(client)

    resp = client.post(
        "/api/checkout/complete",
        {"cartId": cart_id, "email": "attacker@example.com"},
        format="json",
    )
    assert resp.status_code == 404
    assert DownloadGrant.objects.count() == 0


def test_download_requires_a_real_grant():
    """A forged/standalone token can't download without a matching grant."""
    from delivery.signing import make_download_token

    # Token referencing a non-existent grant id -> 404 (no file served).
    token = make_download_token(999999, "midnight-noir")
    resp = APIClient().get(f"/api/download/{token}")
    assert resp.status_code == 404
