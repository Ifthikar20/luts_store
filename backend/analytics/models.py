"""
First-party, privacy-light analytics events.

One row per event. Deliberately stores NO PII: no IP address, no user agent,
no account linkage — just an anonymous, client-generated session id (random
UUID in localStorage) so funnels can be stitched together. This keeps the
store independent of third-party trackers and cookie-consent banners for the
core funnel metrics.
"""
from __future__ import annotations

from django.db import models

# The only event names the API accepts (allowlist — see views).
EVENT_NAMES = (
    "page_view",
    "add_to_cart",
    "begin_checkout",
    "purchase",
)


class Event(models.Model):
    # Anonymous client session (random UUID hex from localStorage).
    session = models.CharField(max_length=64, db_index=True)
    name = models.CharField(max_length=32, db_index=True)
    # Page path for page_view (e.g. "/luts/midnight-noir"); the triggering page
    # for funnel events.
    path = models.CharField(max_length=300, blank=True)
    # Product handle when the event concerns a product (add_to_cart, etc).
    product_handle = models.CharField(max_length=255, blank=True)
    referrer = models.CharField(max_length=300, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        indexes = [models.Index(fields=["name", "created_at"])]

    def __str__(self) -> str:  # pragma: no cover - repr only
        return f"Event({self.name}, {self.path or self.product_handle})"
