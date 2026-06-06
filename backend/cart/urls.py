from django.urls import path

from . import views

urlpatterns = [
    path("cart", views.cart_create, name="cart-create"),
    path("cart/<str:cart_id>", views.cart_detail, name="cart-detail"),
    path("cart/<str:cart_id>/lines", views.cart_lines, name="cart-lines"),
]
