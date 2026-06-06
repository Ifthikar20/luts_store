"""
Cart API views.

A single DRF view handles ``/cart/<id>/lines`` for POST/PATCH/DELETE since each
verb maps cleanly to an add/update/remove service call.
"""
from __future__ import annotations

from rest_framework.decorators import api_view
from rest_framework.response import Response

from . import services


def _bad_request(message: str) -> Response:
    return Response({"detail": message}, status=400)


@api_view(["POST"])
def cart_create(request):
    lines = request.data.get("lines", []) if isinstance(request.data, dict) else []
    if not isinstance(lines, list):
        return _bad_request("`lines` must be a list.")
    try:
        cart = services.create_cart(lines)
    except services.InvalidMerchandise as exc:
        return _bad_request(f"Unknown merchandiseId: {exc}")
    return Response(cart, status=201)


@api_view(["GET"])
def cart_detail(request, cart_id: str):
    try:
        cart = services.get_cart(cart_id)
    except services.CartNotFound:
        return Response({"detail": "Cart not found."}, status=404)
    return Response(cart)


@api_view(["POST", "PATCH", "DELETE"])
def cart_lines(request, cart_id: str):
    data = request.data if isinstance(request.data, dict) else {}
    try:
        if request.method == "POST":
            merchandise_id = data.get("merchandiseId")
            quantity = data.get("quantity", 1)
            if not merchandise_id:
                return _bad_request("`merchandiseId` is required.")
            cart = services.add_line(cart_id, merchandise_id, int(quantity))
        elif request.method == "PATCH":
            line_id = data.get("lineId")
            if not line_id or "quantity" not in data:
                return _bad_request("`lineId` and `quantity` are required.")
            cart = services.update_line(cart_id, line_id, int(data["quantity"]))
        else:  # DELETE
            line_id = data.get("lineId")
            if not line_id:
                return _bad_request("`lineId` is required.")
            cart = services.remove_line(cart_id, line_id)
    except services.CartNotFound:
        return Response({"detail": "Cart not found."}, status=404)
    except services.InvalidMerchandise as exc:
        return _bad_request(f"Unknown merchandiseId: {exc}")
    except (ValueError, TypeError):
        return _bad_request("Invalid quantity.")
    return Response(cart)
