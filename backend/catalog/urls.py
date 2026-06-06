from django.urls import path

from . import views

urlpatterns = [
    path("collections", views.collections, name="collections"),
    path("collections/<str:handle>", views.collection_detail, name="collection-detail"),
    path("products", views.products, name="products"),
    path("facets", views.facets, name="facets"),
    path("products/<str:handle>", views.product_detail, name="product-detail"),
]
