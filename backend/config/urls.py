from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path


def root(_request):
    """Friendly landing for the API host. The storefront UI runs separately
    (Next.js, default http://localhost:3000); this host only serves /api."""
    return JsonResponse(
        {
            "service": "The Looks Lab — BFF API",
            "health": "/api/health",
            "docs": "see backend/README.md",
            "storefront": "http://localhost:3000",
        }
    )


urlpatterns = [
    path("", root),
    path("admin/", admin.site.urls),
    path("api/", include("common.urls")),
    path("api/", include("catalog.urls")),
    path("api/", include("cart.urls")),
    path("api/", include("checkout.urls")),
    path("api/", include("orders.urls")),
    path("api/", include("delivery.urls")),
    path("api/", include("accounts.urls")),
    path("api/", include("customer_auth.urls")),
    path("api/", include("engagement.urls")),
    path("api/", include("analytics.urls")),
]
