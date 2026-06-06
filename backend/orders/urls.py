from django.urls import path

from . import views

urlpatterns = [
    path(
        "webhooks/shopify/orders-paid",
        views.orders_paid_webhook,
        name="orders-paid-webhook",
    ),
]
