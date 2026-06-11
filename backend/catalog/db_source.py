"""
Database-backed catalog source.

Exposes the SAME function surface as ``catalog.mockdata`` (all_products,
get_product, products_in_collection, all_collections, get_collection,
file_key_for_handle, find_variant, CURRENCY) but reads from the ``Product`` /
``Collection`` models. ``catalog.source`` swaps this in whenever published
products exist, so the service layer and cart never know the difference.
"""
from __future__ import annotations

from typing import Any

from .models import Collection, Product

CURRENCY = "USD"


def _published():
    return (
        Product.objects.filter(published=True)
        .prefetch_related("collections", "extra_images", "included_luts")
    )


def all_products() -> list[dict[str, Any]]:
    return [p.to_contract() for p in _published()]


def all_collections() -> list[dict[str, Any]]:
    return [
        {
            "handle": c.handle,
            "title": c.title,
            "description": c.description,
            "image": c.image,
        }
        for c in Collection.objects.all()
    ]


def get_product(handle: str) -> dict[str, Any] | None:
    product = _published().filter(handle=handle).first()
    return product.to_contract() if product else None


def get_collection(handle: str) -> dict[str, Any] | None:
    coll = Collection.objects.filter(handle=handle).first()
    if not coll:
        return None
    return {
        "handle": coll.handle,
        "title": coll.title,
        "description": coll.description,
        "image": coll.image,
    }


def products_in_collection(handle: str) -> list[dict[str, Any]]:
    return [
        p.to_contract()
        for p in _published().filter(collections__handle=handle).distinct()
    ]


def file_key_for_handle(handle: str) -> str:
    """Resolve a handle to its private S3 object key, server-side only."""
    from django.conf import settings

    product = Product.objects.filter(handle=handle).first()
    if product:
        return product.resolved_file_key()
    prefix = getattr(settings, "S3_KEY_PREFIX", "luts").strip("/")
    return f"{prefix}/{handle}.zip"


def _pk_from_variant_gid(variant_id: str) -> int | None:
    raw = str(variant_id).rsplit("/", 1)[-1]
    try:
        return int(raw)
    except ValueError:
        return None


def find_variant(variant_id: str) -> dict[str, Any] | None:
    """Return ``{"product": <contract>, "variant": <variant>}`` for a variant id."""
    pk = _pk_from_variant_gid(variant_id)
    if pk is None:
        return None
    product = _published().filter(pk=pk).first()
    if not product:
        return None
    contract = product.to_contract()
    variant = next(
        (v for v in contract["variants"] if v["id"] == variant_id), None
    )
    if variant is None:
        return None
    return {"product": contract, "variant": variant}
