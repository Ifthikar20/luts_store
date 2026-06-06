"""
Thin wrapper around the Shopify Admin REST API.

Only the order-read path is needed by this BFF (used to enrich/verify orders
received via webhook). The Admin token is server-side only and is NEVER
returned through any endpoint.

Like the Storefront client, this is only exercised when real credentials are
present.
"""
from __future__ import annotations

from typing import Any

import requests
from django.conf import settings

DEFAULT_TIMEOUT = 15


class ShopifyAdminError(RuntimeError):
    """Raised when the Admin API returns an error or is unreachable."""


def _base_url() -> str:
    domain = settings.SHOPIFY_STORE_DOMAIN
    version = settings.SHOPIFY_ADMIN_API_VERSION
    return f"https://{domain}/admin/api/{version}"


def _headers() -> dict[str, str]:
    return {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": settings.SHOPIFY_ADMIN_TOKEN,
    }


def get_order(order_id: str | int) -> dict[str, Any]:
    """Read a single order by its Shopify order id via the Admin REST API."""
    url = f"{_base_url()}/orders/{order_id}.json"
    try:
        resp = requests.get(url, headers=_headers(), timeout=DEFAULT_TIMEOUT)
    except requests.RequestException as exc:  # pragma: no cover - network
        raise ShopifyAdminError(f"Admin request failed: {exc}") from exc

    if resp.status_code != 200:  # pragma: no cover - network
        raise ShopifyAdminError(
            f"Admin returned HTTP {resp.status_code}: {resp.text[:500]}"
        )
    return resp.json().get("order", {})
