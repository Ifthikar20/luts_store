"""Order + Purchase records created from verified Shopify ``orders/paid`` webhooks."""
from __future__ import annotations

from django.db import models


class Order(models.Model):
    """A paid order. ``shopify_order_id`` is unique to make ingestion idempotent."""

    shopify_order_id = models.CharField(max_length=64, unique=True, db_index=True)
    email = models.EmailField(blank=True)
    total = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    currency = models.CharField(max_length=8, default="USD")
    raw_json = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)
    # Set after the order-confirmation email is sent successfully. Used to make
    # email delivery idempotent: we never send a second confirmation for the
    # same order (webhook retries / re-ingest are safe no-ops).
    confirmation_email_sent_at = models.DateTimeField(null=True, blank=True)

    def __str__(self) -> str:  # pragma: no cover - repr only
        return f"Order({self.shopify_order_id}, {self.email})"


class Purchase(models.Model):
    """A single purchased line item belonging to an Order."""

    order = models.ForeignKey(
        Order, related_name="purchases", on_delete=models.CASCADE
    )
    product_handle = models.CharField(max_length=255)
    title = models.CharField(max_length=255)
    quantity = models.PositiveIntegerField(default=1)

    def __str__(self) -> str:  # pragma: no cover - repr only
        return f"Purchase({self.product_handle} x{self.quantity})"
