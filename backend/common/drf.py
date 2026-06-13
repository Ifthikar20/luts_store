"""Shared DRF helpers."""
from __future__ import annotations

from rest_framework.authentication import SessionAuthentication


class CsrfExemptSessionAuthentication(SessionAuthentication):
    """Session auth that populates ``request.user`` WITHOUT enforcing CSRF.

    CSRF for these cookie-authenticated POSTs is covered by the SameSite=Lax
    session cookie (a cross-site POST never carries the cookie — see settings),
    matching how the customer-auth logout endpoint is handled. We still need the
    real session user, which an empty authenticator list would not provide.
    """

    def enforce_csrf(self, request):  # noqa: D401 - intentional no-op
        return
