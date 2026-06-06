"""
Delivery service helpers.

Centralizes turning a :class:`DownloadGrant` into the public, camelCase
"download item" shape the frontend consumes. The ``downloadUrl`` always points
at the existing signed-token endpoint (``GET /api/download/<token>``) so the
signing/expiry mechanism stays the single source of truth.
"""
from __future__ import annotations

from datetime import timedelta
from typing import Any

from django.conf import settings
from django.contrib.auth.models import User

from catalog import services as catalog_services

from .models import DownloadGrant
from .signing import make_download_token


def _title_for_handle(product_handle: str) -> str:
    """Best-effort human title for a product handle (falls back to the handle)."""
    product = catalog_services.get_product(product_handle)
    if product and product.get("title"):
        return str(product["title"])
    # Fall back to a title-cased version of the handle.
    return product_handle.replace("-", " ").title()


def serialize_grant(grant: DownloadGrant) -> dict[str, Any]:
    """Public ``DownloadItem`` shape for one grant.

    ``downloadUrl`` is a relative API path so the caller can resolve it against
    whatever API origin it is configured with. ``expiresAt`` mirrors the signed
    token's ``max_age`` (``DOWNLOAD_TOKEN_MAX_AGE``).
    """
    token = make_download_token(grant.id, grant.product_handle)
    expires_at = (
        grant.created_at + timedelta(seconds=settings.DOWNLOAD_TOKEN_MAX_AGE)
    ).isoformat()
    return {
        "productHandle": grant.product_handle,
        "title": _title_for_handle(grant.product_handle),
        "grantedAt": grant.created_at.isoformat(),
        "downloadUrl": f"/api/download/{token}",
        "expiresAt": expires_at,
    }


def downloads_for_user(user: User) -> list[dict[str, Any]]:
    """All download items for a user, newest first, de-duplicated by handle."""
    grants = DownloadGrant.objects.filter(user=user).order_by("-created_at")
    seen: set[str] = set()
    items: list[dict[str, Any]] = []
    for grant in grants:
        if grant.product_handle in seen:
            continue
        seen.add(grant.product_handle)
        items.append(serialize_grant(grant))
    return items
