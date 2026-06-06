from django.urls import path

from . import views

urlpatterns = [
    # /checkout/complete must be declared before /checkout? no — distinct paths.
    path("checkout", views.checkout, name="checkout"),
    path("checkout/complete", views.checkout_complete, name="checkout-complete"),
]
