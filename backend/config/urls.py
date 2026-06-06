from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include("common.urls")),
    path("api/", include("catalog.urls")),
    path("api/", include("cart.urls")),
    path("api/", include("orders.urls")),
    path("api/", include("delivery.urls")),
    path("api/", include("accounts.urls")),
    path("api/", include("engagement.urls")),
]
