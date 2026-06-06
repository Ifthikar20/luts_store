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

from django.db import transaction

from .models import Order, Purchase


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

    # Import here to avoid a circular import at module load.
    from delivery.models import DownloadGrant

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
            email=email,
            product_handle=handle,
        )

    return order, True
