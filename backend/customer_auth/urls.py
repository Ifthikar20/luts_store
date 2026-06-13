"""URL routes for the Shopify Customer Accounts portal (session-based BFF).

Mounted under ``/api/`` in config.urls. These paths sit alongside the legacy
token-auth routes in ``accounts`` (``/api/auth/login`` etc.) without colliding:
the OAuth flow lives under ``/api/auth/shopify/*`` and the session probe at
``/api/auth/session``.
"""
from django.urls import path

from . import views

urlpatterns = [
    path("auth/shopify/login", views.shopify_login, name="shopify-login"),
    path("auth/shopify/callback", views.shopify_callback, name="shopify-callback"),
    path(
        "auth/shopify/mock-complete",
        views.shopify_mock_complete,
        name="shopify-mock-complete",
    ),
    path("auth/shopify/logout", views.shopify_logout, name="shopify-logout"),
    path("auth/session", views.session_view, name="shopify-session"),
    # Account settings (session-authenticated): email + marketing-email opt-in.
    path("me/preferences", views.account_preferences, name="account-preferences"),
    # Provider-agnostic alias: clears the Django session no matter how the user
    # signed in (Google, Apple, email/password or Shopify).
    path("auth/session/logout", views.shopify_logout, name="session-logout"),
]
