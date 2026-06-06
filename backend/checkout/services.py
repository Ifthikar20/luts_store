"""
Checkout service layer.

Two responsibilities, both branching on ``settings.MOCK_MODE`` like the rest of
the app:

* ``begin_checkout`` — hand the shopper off to a checkout surface.
    - Real mode: return the Shopify hosted checkout URL for the cart (the cart
      already carries ``checkoutUrl`` from Storefront ``cartCreate``).
    - Mock mode: return a RELATIVE path (``/checkout?cart=<id>``) the frontend
      renders as a demo checkout page.

* ``complete_mock_checkout`` — MOCK_MODE ONLY. Simulates Shopify completing
  payment + firing the ``orders/paid`` webhook so the demo funnel works end to
  end (order + download grants + confirmation email). In PRODUCTION this is done
  by the real ``orders/paid`` webhook (see ``orders.views``); this code path
  must never run live.
"""
from __future__ import annotations

from typing import Any

from django.conf import settings

from cart import services as cart_services


class CheckoutError(Exception):
    """Raised when a checkout cannot be created (e.g. unknown/empty cart)."""


def begin_checkout(cart_id: str, email: str | None = None) -> dict[str, Any]:
    """Return ``{"mode": "shopify"|"mock", "checkoutUrl": str}`` for a cart.

    Raises ``CheckoutError`` if the cart does not resolve.
    """
    try:
        cart = cart_services.get_cart(cart_id)
    except cart_services.CartNotFound as exc:
        raise CheckoutError(f"Cart not found: {cart_id}") from exc

    if settings.MOCK_MODE:
        # Relative path -> the frontend renders a demo checkout page. The cart id
        # is echoed so the demo can call /api/checkout/complete next.
        return {"mode": "mock", "checkoutUrl": f"/checkout?cart={cart_id}"}

    # Real mode: hand off to Shopify's hosted checkout. The Storefront cart
    # already exposes a checkoutUrl; return it directly.
    return {"mode": "shopify", "checkoutUrl": cart.get("checkoutUrl")}


def complete_mock_checkout(cart_id: str, email: str) -> dict[str, Any]:
    """MOCK-ONLY: simulate Shopify completing payment for a cart.

    This stands in for Shopify's server-side order completion + the
    ``orders/paid`` webhook so the demo can go cart -> paid -> downloads with no
    real payment. It builds a webhook-shaped payload from the cart and feeds it
    through the SAME ``orders.services.ingest_paid_order`` pipeline the real
    webhook uses, so Order creation is idempotent, DownloadGrants are issued
    (attached to a user if one exists with this email), and exactly one
    confirmation email is sent.

    Returns ``{"orderId": <shopify_order_id>}``.

    Raises ``CheckoutError`` for an unknown/empty cart.
    """
    from django.db import transaction

    from orders import services as orders_services

    try:
        cart = cart_services.get_cart(cart_id)
    except cart_services.CartNotFound as exc:
        raise CheckoutError(f"Cart not found: {cart_id}") from exc

    lines = cart.get("lines", [])
    if not lines:
        raise CheckoutError("Cannot check out an empty cart.")

    # Deterministic synthetic order id keyed on the cart -> re-completing the
    # same cart is idempotent (ingest_paid_order dedupes on this id).
    shopify_order_id = f"mock-checkout-{cart_id}"

    line_items = [
        {
            "title": line["merchandise"]["product"]["title"],
            "handle": line["merchandise"]["product"]["handle"],
            "quantity": line["quantity"],
        }
        for line in lines
    ]
    payload = {
        "id": shopify_order_id,
        "email": email,
        "total_price": cart["cost"]["total"]["amount"],
        "currency": cart["cost"]["total"]["currencyCode"],
        "line_items": line_items,
    }

    # ingest_paid_order schedules the confirmation email via transaction
    # .on_commit. We aren't inside an outer atomic block here, so it fires after
    # this returns. (Tests wrap it in django_capture_on_commit_callbacks.)
    order, _created = orders_services.ingest_paid_order(payload)
    # Be explicit: the email is sent on commit of the ingest transaction.
    return {"orderId": order.shopify_order_id}
