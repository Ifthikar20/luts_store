"""
Secure, login-free download endpoint.

``GET /api/download/<token>`` validates a signed, time-limited token and serves
the purchased file. NO login is required: the signed token IS the credential
(guest flow via the email link / thank-you page).

Why this is tamper-proof / not manipulable:
* The token is HMAC-signed (``django.core.signing``) and carries the grant id +
  product handle + expiry. ANY edit -> ``BadSignature`` -> 403. Expiry -> 403.
* The S3 object key is derived SERVER-SIDE from the validated handle
  (``catalog.services.file_key_for_handle``) — never from a client/token path.
  So you cannot edit the token to fetch a product you didn't buy (changing the
  handle breaks the signature) and there is no path traversal / IDOR.
* Real mode: 302-redirect to a short-lived, AWS-SigV4-signed presigned S3 URL
  (``DOWNLOAD_URL_TTL``, default 60s) against a PRIVATE bucket.
* Mock mode: stream a small generated ``.cube`` placeholder as an attachment so
  the demo download button actually downloads a file.

The endpoint is CSRF-exempt (a GET hit directly by the browser via a link) and
rate-limited via a dedicated ``download`` scope (60/min) to deter scraping.
"""
from __future__ import annotations

from datetime import timedelta

from django.conf import settings
from django.http import HttpResponse
from django.shortcuts import redirect
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from rest_framework.decorators import (
    api_view,
    permission_classes,
    throttle_classes,
)
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import SimpleRateThrottle

from catalog import services as catalog_services

from . import services
from .models import DownloadGrant
from .signing import ExpiredToken, InvalidToken, read_download_token


class DownloadScopedThrottle(SimpleRateThrottle):
    """Dedicated throttle pinned to the ``download`` rate (60/min by default).

    Mirrors the other scoped throttles in the app (``AuthScopedThrottle`` /
    ``SensitiveScopedThrottle``). Hard-coding the scope means it always applies
    on this function-based view. Keyed per client IP to deter scraping /
    enumeration of signed download links.
    """

    scope = "download"

    def get_cache_key(self, request, view):
        return self.cache_format % {
            "scope": self.scope,
            "ident": self.get_ident(request),
        }


@csrf_exempt
@api_view(["GET"])
@permission_classes([])
@throttle_classes([DownloadScopedThrottle])
def download(request, token: str):
    # 1. Validate the signed token. Tampered -> InvalidToken; expired ->
    #    ExpiredToken. Both resolve to 403 (don't leak which).
    try:
        payload = read_download_token(token)
    except (ExpiredToken, InvalidToken):
        return Response({"detail": "Invalid or expired download token."}, status=403)

    grant_id = payload.get("grantId")
    product_handle = payload.get("productHandle")

    # 2. Confirm the referenced grant still exists AND that it is the grant the
    #    token was issued for (handle must match the grant's product) — defense
    #    in depth on top of the signature.
    grant = DownloadGrant.objects.filter(pk=grant_id).first()
    if grant is None or grant.product_handle != product_handle:
        return Response({"detail": "Download grant not found."}, status=404)

    # 3. Derive the S3 object key SERVER-SIDE from the validated handle. Never
    #    from anything in the token/request -> no traversal, no IDOR.
    key = catalog_services.file_key_for_handle(product_handle)

    if settings.S3_DELIVERY_ENABLED:
        # Real mode: mint a short-lived presigned URL and 302 to it. The bucket
        # is private; only this SigV4-signed URL grants (brief) access.
        from .storage import presigned_download_url

        filename = f"{product_handle}.zip"
        url = presigned_download_url(key, filename, settings.DOWNLOAD_URL_TTL)
        return redirect(url)

    # Mock mode: stream a generated .cube placeholder as an attachment so the
    # demo actually downloads a file (NOT JSON).
    body = services.placeholder_cube(product_handle)
    response = HttpResponse(body, content_type="application/octet-stream")
    response["Content-Disposition"] = (
        f'attachment; filename="{product_handle}.cube"'
    )
    return response


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def my_downloads(request):
    """The authenticated user's purchased download library.

    Returns ``[{productHandle, title, grantedAt, downloadUrl, expiresAt}]``.
    Each ``downloadUrl`` is a signed, expiring link to the existing
    ``GET /api/download/<token>`` endpoint.
    """
    return Response(services.downloads_for_user(request.user))
