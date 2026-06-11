"""A small sales dashboard for the admin (revenue, orders, top LUTs)."""
from __future__ import annotations

from datetime import timedelta
from decimal import Decimal

from django.contrib import admin
from django.contrib.admin.views.decorators import staff_member_required
from django.db.models import Count, Sum
from django.shortcuts import render
from django.utils import timezone

from .models import Order, Purchase


@staff_member_required
def dashboard(request):
    orders = Order.objects.all()
    live = orders.filter(refunded_at__isnull=True)

    now = timezone.now()
    last_30 = live.filter(created_at__gte=now - timedelta(days=30))

    revenue = live.aggregate(s=Sum("total"))["s"] or Decimal("0")
    revenue_30 = last_30.aggregate(s=Sum("total"))["s"] or Decimal("0")

    top_products = list(
        Purchase.objects.values("product_handle", "title")
        .annotate(units=Sum("quantity"), orders=Count("order", distinct=True))
        .order_by("-units")[:10]
    )

    context = {
        **admin.site.each_context(request),
        "title": "Sales dashboard",
        "total_revenue": revenue,
        "revenue_30": revenue_30,
        "order_count": orders.count(),
        "live_count": live.count(),
        "refunded_count": orders.filter(refunded_at__isnull=False).count(),
        "orders_30": last_30.count(),
        "email_pending": live.filter(confirmation_email_sent_at__isnull=True).count(),
        "top_products": top_products,
        "recent_orders": orders.order_by("-created_at")[:10],
    }
    return render(request, "admin/dashboard.html", context)
