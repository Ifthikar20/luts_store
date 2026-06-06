"""
Secure download endpoint.

``GET /api/download/<token>`` validates a signed, time-limited token.

* Mock mode: returns JSON ``{url, expiresAt}`` (no real file storage exists).
* Real mode: would mint a short-lived signed S3 URL and 302-redirect to it.

The endpoint is CSRF-exempt (it is a GET hit directly by the browser via a
link), but is still protected: the token itself is an unforgeable HMAC-signed,
expiring credential, and it is rate-limited via DRF throttling.
"""
from __future__ import annotations

from datetime import timedelta

from django.conf import settings
from django.shortcuts import redirect
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from rest_framework.decorators import api_view, throttle_classes
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle

from .models import DownloadGrant
from .signing import ExpiredToken, InvalidToken, read_download_token


@csrf_exempt
@api_view(["GET"])
@throttle_classes([AnonRateThrottle])
def download(request, token: str):
    try:
        payload = read_download_token(token)
    except ExpiredToken:
        return Response({"detail": "Download link has expired."}, status=410)
    except InvalidToken:
        return Response({"detail": "Invalid download token."}, status=401)

    grant_id = payload.get("grantId")
    product_handle = payload.get("productHandle")

    # Confirm the referenced grant still exists (defense in depth).
    if not DownloadGrant.objects.filter(pk=grant_id).exists():
        return Response({"detail": "Download grant not found."}, status=404)

    expires_at = (
        timezone.now() + timedelta(seconds=settings.DOWNLOAD_TOKEN_MAX_AGE)
    ).isoformat()

    if settings.MOCK_MODE:
        url = f"{settings.DOWNLOAD_S3_BASE_URL}/mock/{product_handle}.zip"
        return Response({"url": url, "expiresAt": expires_at})

    # Real mode: in production this would call e.g. boto3
    # ``generate_presigned_url`` and redirect to the short-lived S3 URL.
    signed_url = f"{settings.DOWNLOAD_S3_BASE_URL}/{product_handle}.zip"
    return redirect(signed_url)
