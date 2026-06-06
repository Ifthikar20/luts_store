"""Download grants: the right of a buyer to download a purchased product."""
from __future__ import annotations

from django.db import models


class DownloadGrant(models.Model):
    """Grants download access to one product for one order/email.

    Signed, expiring download tokens reference a grant by its primary key.
    Both ``order`` and ``email`` are kept so grants can be looked up either way.
    """

    order = models.ForeignKey(
        "orders.Order",
        related_name="download_grants",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
    )
    email = models.EmailField(blank=True)
    product_handle = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:  # pragma: no cover - repr only
        return f"DownloadGrant({self.product_handle}, {self.email})"
