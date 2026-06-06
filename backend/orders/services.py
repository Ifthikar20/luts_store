"""
Order ingestion service.

Turns a verified Shopify ``orders/paid`` webhook payload into ``Order`` +
``Purchase`` rows and issues ``DownloadGrant`` rows for each purchased line.

Idempotency: keyed on ``shopify_order_id``. If an order already exists we
return it unchanged so webhook retries are safe.
"""
from __future__ import annotations

from decimal import Decimal, InvalidOperation
from typing import Any

from django.conf import settings
from django.db import transaction

from .models import Order, Purchase


class OrderNotFound(Exception):
    """Raised when an order/confirmation token cannot be resolved."""


def _to_decimal(value: Any) -> Decimal:
    try:
        return Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        return Decimal("0")


def _extract_handle(line_item: dict[str, Any]) -> str:
    """Best-effort product handle from a Shopify line item.

    Shopify line items do not always carry the handle directly; we fall back to
    a slugified title so downstream download grants always have an identifier.
    """
    handle = line_item.get("handle") or line_item.get("product_handle")
    if handle:
        return str(handle)
    title = (line_item.get("title") or "").strip().lower()
    return "-".join(title.split())


@transaction.atomic
def ingest_paid_order(payload: dict[str, Any]) -> tuple[Order, bool]:
    """Create Order/Purchases/DownloadGrants from a webhook payload.

    Returns ``(order, created)``. When ``created`` is False the order already
    existed (idempotent no-op).
    """
    shopify_order_id = str(payload.get("id") or payload.get("order_id") or "")
    if not shopify_order_id:
        raise ValueError("Webhook payload missing order id.")

    existing = Order.objects.filter(shopify_order_id=shopify_order_id).first()
    if existing is not None:
        return existing, False

    email = payload.get("email") or payload.get("contact_email") or ""
    currency = payload.get("currency") or "USD"
    total = _to_decimal(
        payload.get("total_price") or payload.get("current_total_price") or 0
    )

    order = Order.objects.create(
        shopify_order_id=shopify_order_id,
        email=email,
        total=total,
        currency=currency,
        raw_json=payload,
    )

    # Imports here to avoid circular imports at module load.
    from django.contrib.auth.models import User

    from delivery.models import DownloadGrant

    # If a customer account already exists for this order's email, attach the
    # grants to that user too so they appear in their download library
    # immediately. Grants stay keyed by email as well, so a purchase made
    # before signup can still be matched to a user later.
    user = None
    if email:
        user = User.objects.filter(email__iexact=email).first()

    for item in payload.get("line_items", []) or []:
        handle = _extract_handle(item)
        title = item.get("title", "")
        quantity = int(item.get("quantity", 1) or 1)
        Purchase.objects.create(
            order=order,
            product_handle=handle,
            title=title,
            quantity=quantity,
        )
        DownloadGrant.objects.create(
            order=order,
            user=user,
            email=email,
            product_handle=handle,
        )

    return order, True


# ---------------------------------------------------------------------------
# Order confirmation (thank-you page)
# ---------------------------------------------------------------------------
def _confirmation_downloads(grants) -> list[dict[str, Any]]:
    """Serialize grants into the confirmation ``downloads`` shape."""
    from delivery.services import serialize_grant

    out: list[dict[str, Any]] = []
    for grant in grants:
        item = serialize_grant(grant)
        out.append(
            {
                "title": item["title"],
                "downloadUrl": item["downloadUrl"],
                "expiresAt": item["expiresAt"],
            }
        )
    return out


def _confirm_from_order(order: Order) -> dict[str, Any]:
    lines = [
        {"title": p.title, "quantity": p.quantity}
        for p in order.purchases.all()
    ]
    downloads = _confirmation_downloads(order.download_grants.all())
    return {
        "orderId": order.shopify_order_id,
        "email": order.email,
        "lines": lines,
        "total": {
            "amount": f"{order.total:.2f}",
            "currencyCode": order.currency,
        },
        "downloads": downloads,
    }


def _confirm_from_mock_cart(cart_id: str) -> dict[str, Any]:
    """MOCK_MODE ONLY: synthesize a confirmation from a cart id.

    The placeholder ``checkoutUrl`` produced in mock mode ends with the cart id,
    so the thank-you page can pass that id here to demo the full funnel without a
    real Shopify order/webhook. We resolve the cart's lines, then create (or
    reuse) ephemeral DownloadGrants so the returned download links are valid
    against the existing signed-token endpoint.
    """
    from cart import services as cart_services
    from delivery.models import DownloadGrant

    try:
        cart = cart_services.get_cart(cart_id)
    except cart_services.CartNotFound as exc:
        raise OrderNotFound(cart_id) from exc

    lines = [
        {
            "title": line["merchandise"]["product"]["title"],
            "quantity": line["quantity"],
        }
        for line in cart.get("lines", [])
    ]

    # Use a deterministic synthetic order id so re-visiting the thank-you page
    # for the same cart is idempotent (does not duplicate grants).
    synthetic_id = f"mock-cart-{cart_id}"
    grants = []
    for line in cart.get("lines", []):
        handle = line["merchandise"]["product"]["handle"]
        grant = (
            DownloadGrant.objects.filter(
                email="", product_handle=handle, order=None, user=None
            ).first()
            or DownloadGrant.objects.create(email="", product_handle=handle)
        )
        grants.append(grant)

    return {
        "orderId": synthetic_id,
        "email": cart.get("email", ""),
        "lines": lines,
        "total": cart["cost"]["total"],
        "downloads": _confirmation_downloads(grants),
    }


def confirm_order(id_or_token: str) -> dict[str, Any]:
    """Resolve a thank-you confirmation by order id (or, in mock mode, cart id).

    Lookup order:
    1. A real ``Order`` by its ``shopify_order_id``.
    2. In MOCK_MODE, a cart id (the placeholder checkout URL ends with it) ->
       synthesize a confirmation so the funnel is demoable end to end.

    Raises ``OrderNotFound`` when nothing matches.
    """
    if not id_or_token:
        raise OrderNotFound("")

    order = Order.objects.filter(shopify_order_id=str(id_or_token)).first()
    if order is not None:
        return _confirm_from_order(order)

    if settings.MOCK_MODE:
        return _confirm_from_mock_cart(str(id_or_token))

    raise OrderNotFound(str(id_or_token))
