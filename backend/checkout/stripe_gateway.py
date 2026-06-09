"""
Stripe Checkout gateway.

Self-contained payment integration that does not require a Shopify store. Three
responsibilities, all isolated here so the rest of the app stays Stripe-agnostic:

* ``create_checkout_session`` — turn a resolved cart into a Stripe hosted
  Checkout Session and return it (the caller hands ``session.url`` to the
  browser for a full-page redirect).
* ``construct_event`` — verify a Stripe webhook's signature against
  ``STRIPE_WEBHOOK_SECRET`` and return the parsed event.
* ``ingest_session`` — turn a paid ``checkout.session`` into an Order +
  DownloadGrants + confirmation email by feeding the SAME
  ``orders.services.ingest_paid_order`` pipeline the Shopify webhook uses
  (idempotent, keyed on the Stripe session id).

The Order's external id is ``stripe-<session_id>`` so the thank-you page can
resolve the order by session id even before the webhook fires (see
``orders.services`` fallback retrieval).
"""
from __future__ import annotations

from decimal import Decimal
from typing import Any

import stripe
from django.conf import settings

from cart import services as cart_services


class StripeError(Exception):
    """Raised when a Stripe operation cannot be completed."""


def _client() -> None:
    """Point the Stripe SDK at our secret key (read fresh each call so test
    overrides of the setting take effect)."""
    stripe.api_key = settings.STRIPE_SECRET_KEY


def order_id_for_session(session_id: str) -> str:
    """The canonical external Order id we store for a Stripe session."""
    return f"stripe-{session_id}"


def _line_items_from_cart(cart: dict[str, Any]) -> list[dict[str, Any]]:
    """Build Stripe ``line_items`` (price_data) from a resolved cart."""
    items: list[dict[str, Any]] = []
    for line in cart.get("lines", []):
        merch = line["merchandise"]
        price = merch["price"]
        # Stripe wants the smallest currency unit (cents) as an int.
        unit_amount = int((Decimal(str(price["amount"])) * 100).to_integral_value())
        items.append(
            {
                "price_data": {
                    "currency": str(price["currencyCode"]).lower(),
                    "product_data": {"name": merch["product"]["title"]},
                    "unit_amount": unit_amount,
                },
                "quantity": int(line["quantity"]),
            }
        )
    return items


def create_checkout_session(
    cart: dict[str, Any], cart_id: str, email: str | None
) -> Any:
    """Create a Stripe hosted Checkout Session for a cart. Returns the session.

    ``client_reference_id`` carries the cart id so the webhook can re-resolve the
    cart's lines server-side (no trust in client-supplied amounts).
    """
    line_items = _line_items_from_cart(cart)
    if not line_items:
        raise StripeError("Cannot check out an empty cart.")

    _client()
    # Stripe substitutes {CHECKOUT_SESSION_ID} into the success URL on redirect.
    success_url = (
        f"{settings.FRONTEND_URL}/thank-you"
        "?order=stripe-{CHECKOUT_SESSION_ID}"
    )
    cancel_url = f"{settings.FRONTEND_URL}/cart"
    try:
        return stripe.checkout.Session.create(
            mode="payment",
            line_items=line_items,
            customer_email=email or None,
            client_reference_id=cart_id,
            metadata={"cart_id": cart_id},
            success_url=success_url,
            cancel_url=cancel_url,
        )
    except Exception as exc:  # noqa: BLE001 - normalize SDK/network errors
        raise StripeError(f"Stripe session creation failed: {exc}") from exc


def construct_event(payload: bytes, sig_header: str | None) -> Any:
    """Verify a webhook signature and return the Stripe event. Raises StripeError."""
    if not sig_header:
        raise StripeError("Missing Stripe signature header.")
    try:
        return stripe.Webhook.construct_event(
            payload, sig_header, settings.STRIPE_WEBHOOK_SECRET
        )
    except Exception as exc:  # noqa: BLE001 - bad signature / malformed body
        raise StripeError(f"Invalid Stripe webhook: {exc}") from exc


def retrieve_session(session_id: str) -> Any:
    """Fetch a Checkout Session from Stripe (used by the thank-you fallback)."""
    _client()
    try:
        return stripe.checkout.Session.retrieve(session_id)
    except Exception as exc:  # noqa: BLE001
        raise StripeError(f"Could not retrieve session {session_id}: {exc}") from exc


def ingest_session(session: Any) -> tuple[Any, bool]:
    """Create Order/Purchases/DownloadGrants from a PAID checkout session.

    Resolves the cart by ``client_reference_id`` to build authoritative line
    items (handle/title/quantity), then feeds the shared ingest pipeline. The
    total comes from Stripe's ``amount_total`` (cents). Idempotent on the session
    id. Returns ``(order, created)``.
    """
    from orders import services as orders_services

    # ``session`` may be a stripe object or a plain dict (webhook event data).
    def g(key: str, default: Any = None) -> Any:
        if isinstance(session, dict):
            return session.get(key, default)
        return getattr(session, key, default)

    session_id = g("id")
    if not session_id:
        raise StripeError("Session has no id.")

    cart_id = g("client_reference_id") or (g("metadata") or {}).get("cart_id")
    if not cart_id:
        raise StripeError("Session has no cart reference.")

    customer_details = g("customer_details") or {}
    email = (
        (customer_details.get("email") if isinstance(customer_details, dict) else None)
        or g("customer_email")
        or ""
    )
    amount_total = g("amount_total")  # cents
    currency = str(g("currency") or "usd").upper()

    try:
        cart = cart_services.get_cart(str(cart_id))
    except cart_services.CartNotFound as exc:
        raise StripeError(f"Cart not found for session: {cart_id}") from exc

    line_items = [
        {
            "title": line["merchandise"]["product"]["title"],
            "handle": line["merchandise"]["product"]["handle"],
            "quantity": line["quantity"],
        }
        for line in cart.get("lines", [])
    ]

    total = (
        f"{Decimal(amount_total) / 100:.2f}"
        if amount_total is not None
        else cart["cost"]["total"]["amount"]
    )

    payload = {
        "id": order_id_for_session(str(session_id)),
        "email": email,
        "total_price": total,
        "currency": currency,
        "line_items": line_items,
    }
    return orders_services.ingest_paid_order(payload)
