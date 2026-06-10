from django.urls import path

from . import views

urlpatterns = [
    path("auth/register", views.register, name="auth-register"),
    path("auth/login", views.login, name="auth-login"),
    path("auth/logout", views.logout, name="auth-logout"),
    path("auth/me", views.me, name="auth-me"),
    # Social sign-in (POST a verified provider credential).
    path("auth/google", views.social_google, name="auth-google"),
    path("auth/apple", views.social_apple, name="auth-apple"),
    # Backend-owned Google OAuth (code flow + Django session). The frontend
    # only navigates here; Django does the whole exchange.
    path("auth/google/login", views.google_login, name="auth-google-login"),
    path("auth/google/callback", views.google_callback, name="auth-google-callback"),
]
