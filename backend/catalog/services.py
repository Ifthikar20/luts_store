"""
Catalog service layer.

This is the single seam between the views and the data source. Every function
branches on ``settings.MOCK_MODE``:

* MOCK_MODE on  -> read from ``catalog.mockdata`` (the in-repo fixture).
* MOCK_MODE off -> call the Shopify Storefront API and normalize the raw
  GraphQL response into the exact same camelCase ``Product``/collection shapes.

Because both paths return identical structures, the views never need to know
which mode is active.
"""
from __future__ import annotations

from typing import Any

from django.conf import settings

from . import mockdata


# ---------------------------------------------------------------------------
# Public service functions
# ---------------------------------------------------------------------------
def list_collections() -> list[dict[str, Any]]:
    """Return collections as ``[{handle,title,description,image,productCount}]``."""
    if settings.MOCK_MODE:
        result = []
        for coll in mockdata.all_collections():
            count = len(mockdata.products_in_collection(coll["handle"]))
            result.append(
                {
                    "handle": coll["handle"],
                    "title": coll["title"],
                    "description": coll["description"],
                    "image": coll["image"],
                    "productCount": count,
                }
            )
        return result
    return _live_list_collections()


def get_collection(handle: str) -> dict[str, Any] | None:
    """Return ``{handle,title,description,products:[Product]}`` or None."""
    if settings.MOCK_MODE:
        coll = mockdata.get_collection(handle)
        if not coll:
            return None
        return {
            "handle": coll["handle"],
            "title": coll["title"],
            "description": coll["description"],
            "products": mockdata.products_in_collection(handle),
        }
    return _live_get_collection(handle)


def list_products(
    *,
    collection: str | None = None,
    featured: bool | None = None,
    search: str | None = None,
) -> list[dict[str, Any]]:
    """Return a filtered list of Products."""
    if settings.MOCK_MODE:
        if collection:
            products = mockdata.products_in_collection(collection)
        else:
            products = mockdata.all_products()
        if featured:
            products = [p for p in products if p.get("featured")]
        if search:
            needle = search.lower().strip()
            products = [p for p in products if _matches_search(p, needle)]
        return products
    return _live_list_products(
        collection=collection, featured=featured, search=search
    )


def get_product(handle: str) -> dict[str, Any] | None:
    """Return a single Product or None."""
    if settings.MOCK_MODE:
        return mockdata.get_product(handle)
    return _live_get_product(handle)


def _matches_search(product: dict[str, Any], needle: str) -> bool:
    haystack = " ".join(
        [
            product.get("title", ""),
            product.get("description", ""),
            product.get("productType", ""),
            " ".join(product.get("tags", [])),
        ]
    ).lower()
    return needle in haystack


# ---------------------------------------------------------------------------
# Live (Shopify Storefront) path + normalization
# ---------------------------------------------------------------------------
def _live_list_collections() -> list[dict[str, Any]]:
    from shopify_client import storefront

    data = storefront.get_collections()
    edges = data.get("collections", {}).get("edges", [])
    result = []
    for edge in edges:
        node = edge["node"]
        image = node.get("image") or {}
        result.append(
            {
                "handle": node["handle"],
                "title": node["title"],
                "description": node.get("description", ""),
                "image": image.get("url"),
                # Storefront does not return a cheap total count; approximate.
                "productCount": len(
                    node.get("products", {}).get("edges", [])
                ),
            }
        )
    return result


def _live_get_collection(handle: str) -> dict[str, Any] | None:
    from shopify_client import storefront

    data = storefront.get_collection_by_handle(handle)
    node = data.get("collection")
    if not node:
        return None
    products = [
        _normalize_product(e["node"])
        for e in node.get("products", {}).get("edges", [])
    ]
    return {
        "handle": node["handle"],
        "title": node["title"],
        "description": node.get("description", ""),
        "products": products,
    }


def _live_list_products(
    *,
    collection: str | None,
    featured: bool | None,
    search: str | None,
) -> list[dict[str, Any]]:
    from shopify_client import storefront

    if collection:
        coll = _live_get_collection(collection)
        products = coll["products"] if coll else []
    else:
        query_parts = []
        if search:
            query_parts.append(search)
        data = storefront.get_products(
            query=" ".join(query_parts) if query_parts else None
        )
        products = [
            _normalize_product(e["node"])
            for e in data.get("products", {}).get("edges", [])
        ]
    if featured:
        products = [p for p in products if p.get("featured")]
    if search:
        needle = search.lower().strip()
        products = [p for p in products if _matches_search(p, needle)]
    return products


def _live_get_product(handle: str) -> dict[str, Any] | None:
    from shopify_client import storefront

    data = storefront.get_product_by_handle(handle)
    node = data.get("product")
    if not node:
        return None
    return _normalize_product(node)


def _parse_json_list(raw_value: str | None, default: list) -> list:
    import json

    if not raw_value:
        return default
    try:
        parsed = json.loads(raw_value)
        return parsed if isinstance(parsed, list) else default
    except (ValueError, TypeError):
        return default


def _normalize_product(node: dict[str, Any]) -> dict[str, Any]:
    """Map a raw Storefront product node into the public Product contract."""
    featured_image = node.get("featuredImage") or None
    images = [
        {"url": e["node"]["url"], "altText": e["node"].get("altText")}
        for e in node.get("images", {}).get("edges", [])
    ]
    price_range = node.get("priceRange", {})
    min_price = price_range.get("minVariantPrice", {})
    max_price = price_range.get("maxVariantPrice", {})
    variants = [
        {
            "id": e["node"]["id"],
            "title": e["node"]["title"],
            "price": e["node"]["price"],
            "availableForSale": e["node"]["availableForSale"],
        }
        for e in node.get("variants", {}).get("edges", [])
    ]
    collections = [
        {"handle": e["node"]["handle"], "title": e["node"]["title"]}
        for e in node.get("collections", {}).get("edges", [])
    ]
    lut_count_mf = node.get("lutCount") or {}
    formats_mf = node.get("formats") or {}
    apps_mf = node.get("compatibleApps") or {}
    featured_mf = node.get("featuredFlag") or {}
    try:
        lut_count = int(lut_count_mf.get("value")) if lut_count_mf.get("value") else 0
    except (ValueError, TypeError):
        lut_count = 0

    return {
        "id": node["id"],
        "handle": node["handle"],
        "title": node["title"],
        "description": node.get("description", ""),
        "descriptionHtml": node.get("descriptionHtml", ""),
        "featuredImage": (
            {
                "url": featured_image.get("url"),
                "altText": featured_image.get("altText"),
            }
            if featured_image
            else None
        ),
        "images": images,
        "priceRange": {
            "min": {
                "amount": min_price.get("amount"),
                "currencyCode": min_price.get("currencyCode"),
            },
            "max": {
                "amount": max_price.get("amount"),
                "currencyCode": max_price.get("currencyCode"),
            },
        },
        "variants": variants,
        "tags": node.get("tags", []),
        "productType": node.get("productType", ""),
        "vendor": node.get("vendor", ""),
        "collections": collections,
        "metafields": {
            "lutCount": lut_count,
            "formats": _parse_json_list(formats_mf.get("value"), [".cube"]),
            "compatibleApps": _parse_json_list(
                apps_mf.get("value"),
                ["Premiere Pro", "DaVinci Resolve", "Final Cut", "CapCut"],
            ),
        },
        "featured": str(featured_mf.get("value")).lower() == "true",
    }
