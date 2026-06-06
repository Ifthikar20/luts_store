"""
Thin wrapper around the Shopify Storefront GraphQL API.

Only used when real credentials are configured (i.e. NOT in mock mode). The
service layer (``catalog/services.py`` and ``cart/services.py``) maps the raw
Storefront responses returned here into the camelCase contract the frontend
expects.

Network calls use ``requests`` with a short timeout. Errors raise
``ShopifyStorefrontError`` so callers can translate to an appropriate HTTP
response.
"""
from __future__ import annotations

from typing import Any

import requests
from django.conf import settings

from . import queries

DEFAULT_TIMEOUT = 15


class ShopifyStorefrontError(RuntimeError):
    """Raised when the Storefront API returns an error or is unreachable."""


def _endpoint() -> str:
    domain = settings.SHOPIFY_STORE_DOMAIN
    version = settings.SHOPIFY_STOREFRONT_API_VERSION
    return f"https://{domain}/api/{version}/graphql.json"


def _headers() -> dict[str, str]:
    return {
        "Content-Type": "application/json",
        "X-Shopify-Storefront-Access-Token": settings.SHOPIFY_STOREFRONT_TOKEN,
    }


def execute(query: str, variables: dict[str, Any] | None = None) -> dict[str, Any]:
    """Execute a GraphQL operation and return the ``data`` payload.

    Raises ``ShopifyStorefrontError`` on transport errors or GraphQL errors.
    """
    try:
        resp = requests.post(
            _endpoint(),
            json={"query": query, "variables": variables or {}},
            headers=_headers(),
            timeout=DEFAULT_TIMEOUT,
        )
    except requests.RequestException as exc:  # pragma: no cover - network
        raise ShopifyStorefrontError(f"Storefront request failed: {exc}") from exc

    if resp.status_code != 200:  # pragma: no cover - network
        raise ShopifyStorefrontError(
            f"Storefront returned HTTP {resp.status_code}: {resp.text[:500]}"
        )

    payload = resp.json()
    if payload.get("errors"):
        raise ShopifyStorefrontError(str(payload["errors"]))
    return payload.get("data", {})


# ---------------------------------------------------------------------------
# Catalog
# ---------------------------------------------------------------------------
def get_collections(first: int = 50) -> dict[str, Any]:
    return execute(queries.COLLECTIONS_QUERY, {"first": first})


def get_collection_by_handle(handle: str, first: int = 100) -> dict[str, Any]:
    return execute(
        queries.COLLECTION_BY_HANDLE_QUERY, {"handle": handle, "first": first}
    )


def get_products(first: int = 100, query: str | None = None) -> dict[str, Any]:
    return execute(queries.PRODUCTS_QUERY, {"first": first, "query": query})


def get_product_by_handle(handle: str) -> dict[str, Any]:
    return execute(queries.PRODUCT_BY_HANDLE_QUERY, {"handle": handle})


# ---------------------------------------------------------------------------
# Cart
# ---------------------------------------------------------------------------
def cart_create(lines: list[dict[str, Any]] | None = None) -> dict[str, Any]:
    return execute(queries.CART_CREATE_MUTATION, {"lines": lines or []})


def cart_get(cart_id: str) -> dict[str, Any]:
    return execute(queries.CART_QUERY, {"id": cart_id})


def cart_lines_add(cart_id: str, lines: list[dict[str, Any]]) -> dict[str, Any]:
    return execute(
        queries.CART_LINES_ADD_MUTATION, {"cartId": cart_id, "lines": lines}
    )


def cart_lines_update(cart_id: str, lines: list[dict[str, Any]]) -> dict[str, Any]:
    return execute(
        queries.CART_LINES_UPDATE_MUTATION, {"cartId": cart_id, "lines": lines}
    )


def cart_lines_remove(cart_id: str, line_ids: list[str]) -> dict[str, Any]:
    return execute(
        queries.CART_LINES_REMOVE_MUTATION, {"cartId": cart_id, "lineIds": line_ids}
    )
