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


# Sort keys accepted by ``list_products``. ``featured`` is the default and
# preserves the natural catalog order with featured products floated to the top.
VALID_SORTS = ("featured", "price-asc", "price-desc", "title-asc", "newest")


def list_products(
    *,
    collection: str | None = None,
    featured: bool | None = None,
    search: str | None = None,
    sort: str | None = None,
    min_price: float | None = None,
    max_price: float | None = None,
    tags: list[str] | None = None,
) -> list[dict[str, Any]]:
    """Return a filtered + sorted list of Products.

    All discovery params compose: collection scope, featured flag, text search,
    price range, and tag (any-match) filtering, followed by a final sort.
    """
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
        products = _apply_filters(products, min_price, max_price, tags)
        return _apply_sort(products, sort)
    return _live_list_products(
        collection=collection,
        featured=featured,
        search=search,
        sort=sort,
        min_price=min_price,
        max_price=max_price,
        tags=tags,
    )


def get_product(handle: str) -> dict[str, Any] | None:
    """Return a single Product or None."""
    if settings.MOCK_MODE:
        return mockdata.get_product(handle)
    return _live_get_product(handle)


def facets(collection: str | None = None) -> dict[str, Any]:
    """Return filter facets (price range, tags, product types) for the UI.

    Scoped to ``collection`` when provided. Counts reflect how many products
    in the scope carry each tag / product type.
    """
    if settings.MOCK_MODE:
        if collection:
            products = mockdata.products_in_collection(collection)
        else:
            products = mockdata.all_products()
        return _compute_facets(products)
    return _live_facets(collection)


def _min_price_amount(product: dict[str, Any]) -> float:
    """Best-effort float of priceRange.min.amount (0.0 if missing/garbled)."""
    try:
        return float(product["priceRange"]["min"]["amount"])
    except (KeyError, TypeError, ValueError):
        return 0.0


def _apply_filters(
    products: list[dict[str, Any]],
    min_price: float | None,
    max_price: float | None,
    tags: list[str] | None,
) -> list[dict[str, Any]]:
    if min_price is not None:
        products = [p for p in products if _min_price_amount(p) >= min_price]
    if max_price is not None:
        products = [p for p in products if _min_price_amount(p) <= max_price]
    if tags:
        wanted = {t.lower() for t in tags}
        products = [
            p
            for p in products
            if wanted & {t.lower() for t in p.get("tags", [])}
        ]
    return products


def _apply_sort(
    products: list[dict[str, Any]], sort: str | None
) -> list[dict[str, Any]]:
    """Sort products by the requested key. Unknown keys fall back to featured."""
    if sort == "price-asc":
        return sorted(products, key=_min_price_amount)
    if sort == "price-desc":
        return sorted(products, key=_min_price_amount, reverse=True)
    if sort == "title-asc":
        return sorted(products, key=lambda p: p.get("title", "").lower())
    if sort == "newest":
        # No real timestamps in the contract; the numeric product id encodes
        # insertion order well enough for the mock catalog (higher == newer).
        return sorted(products, key=_product_sort_id, reverse=True)
    # "featured" (default): keep catalog order, float featured products up.
    return sorted(products, key=lambda p: 0 if p.get("featured") else 1)


def _product_sort_id(product: dict[str, Any]) -> int:
    """Extract the trailing numeric id from a Shopify gid for newest ordering."""
    raw = str(product.get("id", "")).rsplit("/", 1)[-1]
    try:
        return int(raw)
    except ValueError:
        return 0


def _compute_facets(products: list[dict[str, Any]]) -> dict[str, Any]:
    prices = [_min_price_amount(p) for p in products]
    tag_counts: dict[str, int] = {}
    type_counts: dict[str, int] = {}
    for p in products:
        for tag in p.get("tags", []):
            tag_counts[tag] = tag_counts.get(tag, 0) + 1
        ptype = p.get("productType")
        if ptype:
            type_counts[ptype] = type_counts.get(ptype, 0) + 1

    def _sorted(counts: dict[str, int]) -> list[dict[str, Any]]:
        # Highest count first, then alphabetical for stable, predictable output.
        return [
            {"value": value, "count": count}
            for value, count in sorted(
                counts.items(), key=lambda kv: (-kv[1], kv[0].lower())
            )
        ]

    return {
        "priceRange": {
            "min": min(prices) if prices else 0.0,
            "max": max(prices) if prices else 0.0,
        },
        "tags": _sorted(tag_counts),
        "productTypes": _sorted(type_counts),
    }


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


# Map our public sort keys to Shopify Storefront ``ProductSortKeys`` plus a
# reverse flag. ``featured`` -> RELEVANCE keeps Shopify's own ordering; the
# others map directly. Used only on the live path.
_SHOPIFY_SORT_KEYS: dict[str, tuple[str, bool]] = {
    "featured": ("RELEVANCE", False),
    "price-asc": ("PRICE", False),
    "price-desc": ("PRICE", True),
    "title-asc": ("TITLE", False),
    "newest": ("CREATED_AT", True),
}


def _build_shopify_query(
    search: str | None,
    min_price: float | None,
    max_price: float | None,
    tags: list[str] | None,
) -> str | None:
    """Compose a Shopify Storefront search query string from discovery params.

    See https://shopify.dev/docs/api/usage/search-syntax. Price uses the
    ``variants.price`` field; tags use OR semantics for any-match.
    """
    parts: list[str] = []
    if search:
        parts.append(search.strip())
    if min_price is not None:
        parts.append(f"variants.price:>={min_price}")
    if max_price is not None:
        parts.append(f"variants.price:<={max_price}")
    if tags:
        ors = " OR ".join(f"tag:'{t}'" for t in tags)
        parts.append(f"({ors})")
    return " AND ".join(parts) if parts else None


def _live_list_products(
    *,
    collection: str | None,
    featured: bool | None,
    search: str | None,
    sort: str | None = None,
    min_price: float | None = None,
    max_price: float | None = None,
    tags: list[str] | None = None,
) -> list[dict[str, Any]]:
    from shopify_client import storefront

    sort_key, reverse = _SHOPIFY_SORT_KEYS.get(
        sort or "featured", _SHOPIFY_SORT_KEYS["featured"]
    )

    if collection:
        # Collection products are fetched whole, then filtered/sorted locally
        # (the collection query does not expose the same sort/query args).
        coll = _live_get_collection(collection)
        products = coll["products"] if coll else []
        if search:
            needle = search.lower().strip()
            products = [p for p in products if _matches_search(p, needle)]
        products = _apply_filters(products, min_price, max_price, tags)
    else:
        query = _build_shopify_query(search, min_price, max_price, tags)
        data = storefront.get_products(
            query=query, sort_key=sort_key, reverse=reverse
        )
        products = [
            _normalize_product(e["node"])
            for e in data.get("products", {}).get("edges", [])
        ]

    if featured:
        products = [p for p in products if p.get("featured")]
    # Apply our canonical ordering so the result is deterministic regardless of
    # whether the (untested) Shopify-side sort took effect.
    return _apply_sort(products, sort)


def _live_facets(collection: str | None) -> dict[str, Any]:
    # Best-effort: fetch the in-scope products and compute facets in-process,
    # mirroring the mock path. Untested against a live store.
    products = _live_list_products(
        collection=collection,
        featured=None,
        search=None,
    )
    return _compute_facets(products)


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
