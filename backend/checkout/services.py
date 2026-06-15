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


def demo_checkout_enabled() -> bool:
    """Whether the login-free DEMO checkout may mint payment-free grants.

    True ONLY in the pure in-app demo — no real payment provider configured
    (no Stripe AND no live Shopify storefront, i.e. ``MOCK_MODE``). The instant
    Stripe (or Shopify) is wired up, every demo grant-creating path is disabled
    so downloads can only come from a payment-verified order. Read live from
    settings so it can never drift from the deployment's real configuration.
    """
    return settings.MOCK_MODE and not settings.STRIPE_ENABLED


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

    # Stripe takes priority when configured (self-contained, no Shopify needed):
    # create a hosted Checkout Session and hand back its absolute URL.
    if settings.STRIPE_ENABLED:
        from . import stripe_gateway

        try:
            session = stripe_gateway.create_checkout_session(cart, cart_id, email)
        except stripe_gateway.StripeError as exc:
            raise CheckoutError(str(exc)) from exc
        return {"mode": "stripe", "checkoutUrl": session.url}

    if demo_checkout_enabled():
        # Relative path -> the frontend renders a demo checkout page. ONLY the
        # opaque cart id goes in the URL — never the email. PII must not leak via
        # URLs (browser history, referer headers, server/access logs, shared
        # links). The checkout page prefills the email from the signed-in
        # session instead (guests simply type it).
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

    # Defense in depth: never mint payment-free grants once a real payment
    # provider is configured (the view also gates this, but guard the service
    # too so no caller can bypass it).
    if not demo_checkout_enabled():
        raise CheckoutError("Demo checkout is disabled.")

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
