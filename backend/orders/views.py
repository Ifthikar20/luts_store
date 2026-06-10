"""
Shopify webhook receiver for ``orders/paid``.

Security:
* CSRF-exempt (Shopify is not a browser and cannot supply a CSRF token), but
  protected by mandatory HMAC-SHA256 verification of the raw request body
  against ``SHOPIFY_WEBHOOK_SECRET`` using a constant-time comparison.
* Invalid/missing signature -> 401. We must verify against the EXACT raw bytes,
  so we read ``request.body`` (not parsed data) before any decoding.

Idempotency is handled in the service layer (dedupe by Shopify order id).
"""
from __future__ import annotations

import json

from django.conf import settings
from django.views.decorators.csrf import csrf_exempt
from rest_framework.decorators import (
    api_view,
    authentication_classes,
    permission_classes,
    throttle_classes,
)
from rest_framework.response import Response
from rest_framework.throttling import (
    AnonRateThrottle,
    SimpleRateThrottle,
    UserRateThrottle,
)

from common.security import verify_shopify_webhook

from . import services


class SensitiveScopedThrottle(SimpleRateThrottle):
    """Dedicated throttle pinned to the ``sensitive`` rate (5/min by default).

    Mirrors ``accounts.views.AuthScopedThrottle`` but for email-triggering
    endpoints (resend downloads). Hard-coding the scope means it always applies
    on function-based views (unlike ``ScopedRateThrottle``). Keyed per client
    IP to blunt enumeration / mail-bombing attempts.
    """

    scope = "sensitive"

    def get_cache_key(self, request, view):
        return self.cache_format % {
            "scope": self.scope,
            "ident": self.get_ident(request),
        }


@csrf_exempt
@api_view(["POST"])
@authentication_classes([])
@permission_classes([])
@throttle_classes([AnonRateThrottle])
def orders_paid_webhook(request):
    raw_body = request.body  # exact bytes Shopify signed
    received_hmac = request.META.get("HTTP_X_SHOPIFY_HMAC_SHA256")

    if not verify_shopify_webhook(
        raw_body, received_hmac, settings.SHOPIFY_WEBHOOK_SECRET
    ):
        return Response({"detail": "Invalid HMAC signature."}, status=401)

    try:
        payload = json.loads(raw_body.decode("utf-8"))
    except (ValueError, UnicodeDecodeError):
        return Response({"detail": "Invalid JSON body."}, status=400)

    try:
        order, created = services.ingest_paid_order(payload)
    except ValueError as exc:
        return Response({"detail": str(exc)}, status=400)

    # Always 200 so Shopify does not retry a successfully-processed webhook.
    return Response(
        {
            "status": "ok",
            "orderId": order.shopify_order_id,
            "created": created,
        },
        status=200,
    )


@api_view(["GET", "POST"])
@throttle_classes([AnonRateThrottle, UserRateThrottle])
def order_confirm(request, id_or_token: str | None = None):
    """Thank-you confirmation lookup.

    * ``GET  /api/orders/<idOrToken>`` -> confirmation for that id.
    * ``POST /api/orders/confirm {token}`` -> confirmation for the body token.

    Returns ``{orderId, email, lines:[{title,quantity}], total, downloads:[...]}``.

    In MOCK_MODE the id may be a cart id (the placeholder checkout URL ends with
    the cart id); a confirmation is synthesized from that cart so the full
    purchase funnel is demoable without a real Shopify order. See
    ``orders.services.confirm_order``.
    """
    if request.method == "POST":
        data = request.data if isinstance(request.data, dict) else {}
        id_or_token = data.get("token") or data.get("order") or id_or_token

    if not id_or_token:
        return Response({"detail": "Missing order id or token."}, status=400)

    try:
        confirmation = services.confirm_order(str(id_or_token))
    except services.OrderNotFound:
        return Response({"detail": "Order not found."}, status=404)

    return Response(confirmation)


# Single generic response for the resend endpoint -> no user enumeration.
_RESEND_GENERIC = {
    "status": "ok",
    "detail": "If that email has purchases, we've resent your download links.",
}


@api_view(["POST"])
@authentication_classes([])
@permission_classes([])
@throttle_classes([AnonRateThrottle, SensitiveScopedThrottle])
def claim_free_lut(request):
    """Claim this week's free LUT by email (no payment). Returns ``{orderId}``.

    Idempotent per email; creates the DownloadGrant + sends the confirmation
    email via the shared pipeline. Throttled (``sensitive``) since it creates
    an order and sends mail.
    """
    data = request.data if isinstance(request.data, dict) else {}
    email = data.get("email")
    if not email:
        return Response({"detail": "`email` is required."}, status=400)
    try:
        order = services.claim_free_lut(str(email))
    except services.FreeLutUnavailable as exc:
        return Response({"detail": str(exc)}, status=404)
    except ValueError as exc:
        return Response({"detail": str(exc)}, status=400)
    return Response({"orderId": order.shopify_order_id}, status=200)


@api_view(["POST"])
@authentication_classes([])
@permission_classes([])
@throttle_classes([AnonRateThrottle, SensitiveScopedThrottle])
def resend_downloads(request):
    """Re-send download links to a purchaser's email.

    NON-ENUMERATING: ALWAYS returns the same generic 200 regardless of whether
    the email has any orders. If it does, the most recent order's confirmation
    email is re-sent (best-effort). Throttled by a dedicated ``sensitive`` scope
    (5/min) to blunt enumeration / mail-bombing.
    """
    data = request.data if isinstance(request.data, dict) else {}
    email = data.get("email") or ""
    # Best-effort; the return value never changes the response (no enumeration).
    services.resend_downloads(str(email))
    return Response(_RESEND_GENERIC, status=200)
