from django.urls import path

from . import views

urlpatterns = [
    path(
        "webhooks/shopify/orders-paid",
        views.orders_paid_webhook,
        name="orders-paid-webhook",
    ),
    # Thank-you confirmation. POST /api/orders/confirm {token} is matched first;
    # GET /api/orders/<idOrToken> is the generic lookup.
    path("orders/confirm", views.order_confirm, name="order-confirm"),
    # Resend download links (non-enumerating, throttled). Must be declared
    # BEFORE the generic <id_or_token> catch-all so it isn't swallowed.
    path(
        "orders/resend-downloads",
        views.resend_downloads,
        name="orders-resend-downloads",
    ),
    path("orders/<str:id_or_token>", views.order_confirm, name="order-detail"),
]
