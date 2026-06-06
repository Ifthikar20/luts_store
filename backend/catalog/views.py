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


@api_view(["GET"])
def products(request):
    collection = request.query_params.get("collection")
    featured_raw = request.query_params.get("featured")
    featured = featured_raw is not None and featured_raw.lower() in ("1", "true", "yes")
    search = request.query_params.get("search")
    result = services.list_products(
        collection=collection or None,
        featured=featured or None,
        search=search or None,
    )
    return Response({"products": result})


@api_view(["GET"])
def product_detail(request, handle: str):
    data = services.get_product(handle)
    if data is None:
        return Response({"detail": "Product not found."}, status=404)
    return Response(data)
