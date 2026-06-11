"""
Cart service layer.

Like the catalog service, every public function branches on
``settings.MOCK_MODE`` and returns the identical public ``Cart`` shape so the
views are agnostic.

* MOCK_MODE on  -> carts persisted in the ``MockCart`` model; prices/products
  resolved from ``catalog.mockdata``; checkoutUrl is a documented placeholder.
* MOCK_MODE off -> proxy Shopify Storefront cart mutations and normalize.
"""
from __future__ import annotations

import uuid
from decimal import Decimal
from typing import Any

from django.conf import settings

from catalog import source


class CartNotFound(Exception):
    """Raised when a cart id does not resolve to a cart."""


class InvalidMerchandise(Exception):
    """Raised when a merchandiseId does not resolve to a known variant."""


# ---------------------------------------------------------------------------
# Public service functions
# ---------------------------------------------------------------------------
def create_cart(lines: list[dict[str, Any]] | None = None) -> dict[str, Any]:
    if settings.MOCK_MODE:
        return _mock_create(lines or [])
    return _live_create(lines or [])


def get_cart(cart_id: str) -> dict[str, Any]:
    if settings.MOCK_MODE:
        return _mock_get(cart_id)
    return _live_get(cart_id)


def add_line(cart_id: str, merchandise_id: str, quantity: int) -> dict[str, Any]:
    if settings.MOCK_MODE:
        return _mock_add_line(cart_id, merchandise_id, quantity)
    return _live_add_line(cart_id, merchandise_id, quantity)


def update_line(cart_id: str, line_id: str, quantity: int) -> dict[str, Any]:
    if settings.MOCK_MODE:
        return _mock_update_line(cart_id, line_id, quantity)
    return _live_update_line(cart_id, line_id, quantity)


def remove_line(cart_id: str, line_id: str) -> dict[str, Any]:
    if settings.MOCK_MODE:
        return _mock_remove_line(cart_id, line_id)
    return _live_remove_line(cart_id, line_id)


# ---------------------------------------------------------------------------
# Mock implementation
# ---------------------------------------------------------------------------
def _checkout_url(cart_id: str) -> str:
    domain = settings.SHOPIFY_STORE_DOMAIN
    return f"https://{domain}/cart/c/{cart_id}"


def _get_mock_cart_or_404(cart_id: str):
    from .models import MockCart

    try:
        return MockCart.objects.get(pk=cart_id)
    except (MockCart.DoesNotExist, ValueError, TypeError) as exc:
        raise CartNotFound(cart_id) from exc


def _normalize_lines(raw_lines: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Validate + normalize incoming line inputs into stored line dicts."""
    normalized: list[dict[str, Any]] = []
    for line in raw_lines:
        merchandise_id = line.get("merchandiseId")
        quantity = int(line.get("quantity", 1))
        if quantity <= 0:
            continue
        if source.active().find_variant(merchandise_id) is None:
            raise InvalidMerchandise(merchandise_id)
        normalized.append(
            {
                "id": f"gid://shopify/CartLine/{uuid.uuid4()}",
                "merchandiseId": merchandise_id,
                "quantity": quantity,
            }
        )
    return normalized


def _merge_lines(existing: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Collapse duplicate merchandise ids by summing quantity."""
    by_merch: dict[str, dict[str, Any]] = {}
    for line in existing:
        key = line["merchandiseId"]
        if key in by_merch:
            by_merch[key]["quantity"] += line["quantity"]
        else:
            by_merch[key] = dict(line)
    return list(by_merch.values())


def _mock_create(raw_lines: list[dict[str, Any]]) -> dict[str, Any]:
    from .models import MockCart

    lines = _merge_lines(_normalize_lines(raw_lines))
    cart = MockCart.objects.create(lines=lines)
    return _mock_serialize(cart)


def _mock_get(cart_id: str) -> dict[str, Any]:
    return _mock_serialize(_get_mock_cart_or_404(cart_id))


def _mock_add_line(cart_id: str, merchandise_id: str, quantity: int) -> dict[str, Any]:
    cart = _get_mock_cart_or_404(cart_id)
    new_lines = _normalize_lines(
        [{"merchandiseId": merchandise_id, "quantity": quantity}]
    )
    cart.lines = _merge_lines(list(cart.lines) + new_lines)
    cart.save(update_fields=["lines", "updated_at"])
    return _mock_serialize(cart)


def _mock_update_line(cart_id: str, line_id: str, quantity: int) -> dict[str, Any]:
    cart = _get_mock_cart_or_404(cart_id)
    lines = list(cart.lines)
    if quantity <= 0:
        lines = [ln for ln in lines if ln["id"] != line_id]
    else:
        for ln in lines:
            if ln["id"] == line_id:
                ln["quantity"] = int(quantity)
    cart.lines = lines
    cart.save(update_fields=["lines", "updated_at"])
    return _mock_serialize(cart)


def _mock_remove_line(cart_id: str, line_id: str) -> dict[str, Any]:
    cart = _get_mock_cart_or_404(cart_id)
    cart.lines = [ln for ln in cart.lines if ln["id"] != line_id]
    cart.save(update_fields=["lines", "updated_at"])
    return _mock_serialize(cart)


def _mock_serialize(cart) -> dict[str, Any]:
    cart_id = str(cart.id)
    lines_out: list[dict[str, Any]] = []
    subtotal = Decimal("0")
    total_qty = 0
    data = source.active()
    currency = data.CURRENCY

    for stored in cart.lines:
        resolved = data.find_variant(stored["merchandiseId"])
        if resolved is None:
            continue  # skip stale lines defensively
        product = resolved["product"]
        variant = resolved["variant"]
        qty = int(stored["quantity"])
        total_qty += qty
        price_amount = Decimal(variant["price"]["amount"])
        currency = variant["price"]["currencyCode"]
        subtotal += price_amount * qty
        lines_out.append(
            {
                "id": stored["id"],
                "quantity": qty,
                "merchandise": {
                    "id": variant["id"],
                    "title": variant["title"],
                    "product": {
                        "handle": product["handle"],
                        "title": product["title"],
                        "featuredImage": product["featuredImage"],
                    },
                    "price": variant["price"],
                },
            }
        )

    subtotal_str = f"{subtotal:.2f}"
    return {
        "id": cart_id,
        "checkoutUrl": _checkout_url(cart_id),
        "totalQuantity": total_qty,
        "cost": {
            "subtotal": {"amount": subtotal_str, "currencyCode": currency},
            # Digital goods: no shipping; total == subtotal in mock mode.
            "total": {"amount": subtotal_str, "currencyCode": currency},
        },
        "lines": lines_out,
    }


# ---------------------------------------------------------------------------
# Live (Shopify Storefront) implementation + normalization
# ---------------------------------------------------------------------------
def _live_create(raw_lines: list[dict[str, Any]]) -> dict[str, Any]:
    from shopify_client import storefront

    lines = [
        {"merchandiseId": ln["merchandiseId"], "quantity": int(ln.get("quantity", 1))}
        for ln in raw_lines
    ]
    data = storefront.cart_create(lines)
    return _normalize_cart(data["cartCreate"]["cart"])


def _live_get(cart_id: str) -> dict[str, Any]:
    from shopify_client import storefront

    data = storefront.cart_get(cart_id)
    cart = data.get("cart")
    if not cart:
        raise CartNotFound(cart_id)
    return _normalize_cart(cart)


def _live_add_line(cart_id: str, merchandise_id: str, quantity: int) -> dict[str, Any]:
    from shopify_client import storefront

    data = storefront.cart_lines_add(
        cart_id, [{"merchandiseId": merchandise_id, "quantity": int(quantity)}]
    )
    return _normalize_cart(data["cartLinesAdd"]["cart"])


def _live_update_line(cart_id: str, line_id: str, quantity: int) -> dict[str, Any]:
    from shopify_client import storefront

    data = storefront.cart_lines_update(
        cart_id, [{"id": line_id, "quantity": int(quantity)}]
    )
    return _normalize_cart(data["cartLinesUpdate"]["cart"])


def _live_remove_line(cart_id: str, line_id: str) -> dict[str, Any]:
    from shopify_client import storefront

    data = storefront.cart_lines_remove(cart_id, [line_id])
    return _normalize_cart(data["cartLinesRemove"]["cart"])


def _normalize_cart(cart: dict[str, Any]) -> dict[str, Any]:
    """Map a raw Storefront Cart into the public Cart contract."""
    cost = cart.get("cost", {})
    subtotal = cost.get("subtotalAmount", {})
    total = cost.get("totalAmount", {})
    lines_out = []
    for edge in cart.get("lines", {}).get("edges", []):
        node = edge["node"]
        merch = node.get("merchandise", {}) or {}
        product = merch.get("product", {}) or {}
        lines_out.append(
            {
                "id": node["id"],
                "quantity": node["quantity"],
                "merchandise": {
                    "id": merch.get("id"),
                    "title": merch.get("title"),
                    "product": {
                        "handle": product.get("handle"),
                        "title": product.get("title"),
                        "featuredImage": product.get("featuredImage"),
                    },
                    "price": merch.get("price"),
                },
            }
        )
    return {
        "id": cart["id"],
        "checkoutUrl": cart.get("checkoutUrl"),
        "totalQuantity": cart.get("totalQuantity", 0),
        "cost": {
            "subtotal": {
                "amount": subtotal.get("amount"),
                "currencyCode": subtotal.get("currencyCode"),
            },
            "total": {
                "amount": total.get("amount"),
                "currencyCode": total.get("currencyCode"),
            },
        },
        "lines": lines_out,
    }
