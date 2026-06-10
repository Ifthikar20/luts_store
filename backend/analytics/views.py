"""
Analytics API.

* POST /api/events            — ingest a small batch of events (public, throttled)
* GET  /api/analytics/summary — 30-day funnel/product summary (staff only)

Ingestion is deliberately strict: allowlisted event names, hard field-length
caps, max batch size, and a dedicated throttle scope. Garbage is dropped
silently (a tracker must never break the storefront, and attackers learn
nothing from the response).
"""
from __future__ import annotations

from datetime import timedelta

from django.db.models import Count
from django.utils import timezone
from rest_framework.decorators import (
    api_view,
    authentication_classes,
    permission_classes,
    throttle_classes,
)
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework.throttling import SimpleRateThrottle

from .models import EVENT_NAMES, Event

MAX_BATCH = 20


class EventsScopedThrottle(SimpleRateThrottle):
    """Per-IP throttle for the ingest endpoint (``events`` scope)."""

    scope = "events"

    def get_cache_key(self, request, view):
        return self.cache_format % {
            "scope": self.scope,
            "ident": self.get_ident(request),
        }


def _clean(value, max_len: int) -> str:
    return str(value or "")[:max_len]


@api_view(["POST"])
@authentication_classes([])
@permission_classes([])
@throttle_classes([EventsScopedThrottle])
def ingest(request):
    """Accept ``{session, events:[{name, path?, handle?, referrer?}]}``.

    Always returns 202 with the number of stored events; invalid entries are
    dropped silently.
    """
    data = request.data if isinstance(request.data, dict) else {}
    session = _clean(data.get("session"), 64)
    raw_events = data.get("events")
    if not session or not isinstance(raw_events, list):
        return Response({"stored": 0}, status=202)

    rows = []
    for entry in raw_events[:MAX_BATCH]:
        if not isinstance(entry, dict):
            continue
        name = entry.get("name")
        if name not in EVENT_NAMES:
            continue
        rows.append(
            Event(
                session=session,
                name=name,
                path=_clean(entry.get("path"), 300),
                product_handle=_clean(entry.get("handle"), 255),
                referrer=_clean(entry.get("referrer"), 300),
            )
        )
    if rows:
        Event.objects.bulk_create(rows)
    return Response({"stored": len(rows)}, status=202)


@api_view(["GET"])
@permission_classes([IsAdminUser])
def summary(request):
    """30-day analytics summary for the store operator (staff only).

    Returns totals per event, unique sessions, the purchase funnel, and the
    top products by add-to-cart.
    """
    since = timezone.now() - timedelta(days=30)
    window = Event.objects.filter(created_at__gte=since)

    totals = {
        row["name"]: row["n"]
        for row in window.values("name").annotate(n=Count("id"))
    }
    funnel = {name: totals.get(name, 0) for name in EVENT_NAMES}

    top_products = list(
        window.filter(name="add_to_cart")
        .exclude(product_handle="")
        .values("product_handle")
        .annotate(n=Count("id"))
        .order_by("-n")[:10]
    )
    top_pages = list(
        window.filter(name="page_view")
        .exclude(path="")
        .values("path")
        .annotate(n=Count("id"))
        .order_by("-n")[:10]
    )

    return Response(
        {
            "since": since.isoformat(),
            "uniqueSessions": window.values("session").distinct().count(),
            "events": funnel,
            "topProducts": top_products,
            "topPages": top_pages,
        }
    )
