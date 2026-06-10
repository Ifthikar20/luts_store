"""
Catalog API views.

The data is already in the camelCase contract shape coming out of the service
layer (mock fixtures or normalized Storefront responses), so these views are
thin: they parse query params, call the service, and return JSON.
"""
from __future__ import annotations

from rest_framework.decorators import api_view
from rest_framework.response import Response

from . import services


@api_view(["GET"])
def collections(request):
    return Response(services.list_collections())


@api_view(["GET"])
def collection_detail(request, handle: str):
    data = services.get_collection(handle)
    if data is None:
        return Response({"detail": "Collection not found."}, status=404)
    return Response(data)


def _parse_float(raw: str | None) -> float | None:
    if raw is None or raw.strip() == "":
        return None
    try:
        return float(raw)
    except (TypeError, ValueError):
        return None


@api_view(["GET"])
def products(request):
    collection = request.query_params.get("collection")
    featured_raw = request.query_params.get("featured")
    featured = featured_raw is not None and featured_raw.lower() in ("1", "true", "yes")
    search = request.query_params.get("search")

    sort = request.query_params.get("sort")
    if sort not in services.VALID_SORTS:
        sort = None  # unknown -> service default (featured)

    min_price = _parse_float(request.query_params.get("minPrice"))
    max_price = _parse_float(request.query_params.get("maxPrice"))

    tags_raw = request.query_params.get("tags")
    tags = (
        [t.strip() for t in tags_raw.split(",") if t.strip()]
        if tags_raw
        else None
    )

    result = services.list_products(
        collection=collection or None,
        featured=featured or None,
        search=search or None,
        sort=sort,
        min_price=min_price,
        max_price=max_price,
        tags=tags,
    )
    return Response({"products": result})


@api_view(["GET"])
def facets(request):
    collection = request.query_params.get("collection")
    return Response(services.facets(collection=collection or None))


@api_view(["GET"])
def product_detail(request, handle: str):
    data = services.get_product(handle)
    if data is None:
        return Response({"detail": "Product not found."}, status=404)
    return Response(data)


@api_view(["GET"])
def free_lut(request):
    """The current weekly free LUT (or ``{detail}`` 404 if none is published)."""
    data = services.free_lut()
    if data is None:
        return Response({"detail": "No free LUT this week."}, status=404)
    return Response(data)
