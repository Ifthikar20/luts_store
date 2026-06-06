"""
Mock-mode cart persistence.

In real mode the cart lives entirely in Shopify (we just proxy the cart id and
Storefront responses). In mock mode there is no Shopify, so we persist carts
here in the database. Lines are stored as JSON for simplicity -- the service
layer turns them into the public Cart shape.
"""
from __future__ import annotations

import uuid

from django.db import models


class MockCart(models.Model):
    """A persisted cart used only when ``settings.MOCK_MODE`` is True."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    # lines: list of {"id": <lineId>, "merchandiseId": <variantId>, "quantity": int}
    lines = models.JSONField(default=list)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:  # pragma: no cover - repr only
        return f"MockCart({self.id})"
