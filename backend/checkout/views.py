"""
Checkout API views.

* POST /api/checkout          {cartId, email?} -> {mode, checkoutUrl}
* POST /api/checkout/complete {cartId, email}  -> {orderId}   (MOCK_MODE ONLY)

Both are throttled by the dedicated ``sensitive`` scope (they create
orders/grants and trigger email). The guest flow needs no auth: a shopper can
buy and download without an account.
"""
from __future__ import annotations

from django.conf import settings
from rest_framework.decorators import (
    api_view,
    authentication_classes,
    permission_classes,
    throttle_classes,
)
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle, SimpleRateThrottle

from . import services


class SensitiveScopedThrottle(SimpleRateThrottle):
    """Dedicated throttle pinned to the ``sensitive`` rate (5/min by default).

    Mirrors ``orders.views.SensitiveScopedThrottle`` / ``accounts`` throttles.
    Hard-coding the scope means it always applies on these function-based views.
    Keyed per client IP to blunt abuse of the order/email-creating endpoints.
    """

    scope = "sensitive"

    def get_cache_key(self, request, view):
        return self.cache_format % {
            "scope": self.scope,
            "ident": self.get_ident(request),
        }


@api_view(["POST"])
@throttle_classes([AnonRateThrottle, SensitiveScopedThrottle])
def checkout(request):
    """Begin checkout for a cart. Returns ``{mode, checkoutUrl}``."""
    data = request.data if isinstance(request.data, dict) else {}
    cart_id = data.get("cartId")
    email = data.get("email")
    if not cart_id:
        return Response({"detail": "`cartId` is required."}, status=400)

    try:
        result = services.begin_checkout(str(cart_id), email)
    except services.CheckoutError as exc:
        return Response({"detail": str(exc)}, status=404)
    return Response(result)


@api_view(["POST"])
@authentication_classes([])
@permission_classes([])
@throttle_classes([AnonRateThrottle, SensitiveScopedThrottle])
def checkout_complete(request):
    """MOCK_MODE ONLY: simulate Shopify completing payment for a cart.

    Returns 404 when NOT in mock mode (in production the ``orders/paid`` webhook
    completes the order, never this endpoint). Creates the Order + DownloadGrants
    + sends the confirmation email, then returns ``{orderId}``.
    """
    if not settings.MOCK_MODE:
        return Response({"detail": "Not found."}, status=404)

    data = request.data if isinstance(request.data, dict) else {}
    cart_id = data.get("cartId")
    email = data.get("email")
    if not cart_id:
        return Response({"detail": "`cartId` is required."}, status=400)
    if not email:
        return Response({"detail": "`email` is required."}, status=400)

    try:
        result = services.complete_mock_checkout(str(cart_id), str(email))
    except services.CheckoutError as exc:
        return Response({"detail": str(exc)}, status=400)
    return Response(result)
