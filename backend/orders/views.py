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
from rest_framework.throttling import AnonRateThrottle

from common.security import verify_shopify_webhook

from . import services


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
