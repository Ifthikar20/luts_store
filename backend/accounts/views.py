"""
Customer account API (token auth).

Base path: ``/api/auth``

* POST /register  {email, password} -> {token, user:{id, email}}
* POST /login     {email, password} -> {token, user:{id, email}}
* POST /logout    (auth) -> {status: "ok"}; deletes the caller's token
* GET  /me        (auth) -> {id, email}

SECURITY:
* register/login are rate-limited by a dedicated scoped throttle (``auth``,
  10/min) on top of the default anon throttle -> brute-force / enumeration
  resistance.
* Errors are generic on bad credentials / duplicate email -> no user
  enumeration. A weak-password error is surfaced (it reveals nothing about
  other accounts).
* Tokens are returned in the JSON body for this SPA. PRODUCTION NOTE: prefer
  httpOnly cookies or Shopify Customer Accounts so JS cannot read the token.
"""
from __future__ import annotations

from rest_framework.authtoken.models import Token
from rest_framework.decorators import (
    api_view,
    permission_classes,
    throttle_classes,
)
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle, SimpleRateThrottle

from . import services, social


class AuthScopedThrottle(SimpleRateThrottle):
    """Dedicated throttle pinned to the ``auth`` rate for credential endpoints.

    Unlike ``ScopedRateThrottle`` (which reads ``view.throttle_scope`` and is a
    no-op on function-based views without it), this hard-codes the ``auth``
    scope so register/login are always rate-limited (10/min by default) to blunt
    brute-force / enumeration attempts. Keyed per client IP.
    """

    scope = "auth"

    def get_cache_key(self, request, view):
        return self.cache_format % {
            "scope": self.scope,
            "ident": self.get_ident(request),
        }


def _bad_request(message: str) -> Response:
    return Response({"detail": message}, status=400)


@api_view(["POST"])
@permission_classes([])
@throttle_classes([AnonRateThrottle, AuthScopedThrottle])
def register(request):
    data = request.data if isinstance(request.data, dict) else {}
    email = data.get("email")
    password = data.get("password")
    if not email or not password:
        return _bad_request("Email and password are required.")
    try:
        user = services.register(email, password)
    except services.AuthError as exc:
        return _bad_request(str(exc))
    token, _ = Token.objects.get_or_create(user=user)
    return Response(
        {"token": token.key, "user": services.serialize_user(user)},
        status=201,
    )


@api_view(["POST"])
@permission_classes([])
@throttle_classes([AnonRateThrottle, AuthScopedThrottle])
def login(request):
    data = request.data if isinstance(request.data, dict) else {}
    email = data.get("email")
    password = data.get("password")
    if not email or not password:
        # Same generic 400 shape as bad creds -> no enumeration via field probing.
        return _bad_request("Invalid email or password.")
    try:
        user = services.login(email, password)
    except services.AuthError as exc:
        return _bad_request(str(exc))
    token, _ = Token.objects.get_or_create(user=user)
    return Response({"token": token.key, "user": services.serialize_user(user)})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def logout(request):
    # Delete the caller's token so it can no longer be used.
    Token.objects.filter(user=request.user).delete()
    return Response({"status": "ok"})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def me(request):
    return Response(services.serialize_user(request.user))


def _social(request, provider: str):
    """Sign in with Google/Apple. Body: ``{credential}`` (the provider token).

    Verifies the token, creates/links the account, opts the email into deals +
    the biweekly free LUT, and returns ``{token, user}`` while also logging the
    browser in via session.
    """
    from django.contrib.auth import login as session_login

    data = request.data if isinstance(request.data, dict) else {}
    token = data.get("credential") or data.get("token") or data.get("identityToken")
    if not token:
        return _bad_request("A sign-in `credential` is required.")
    try:
        user = social.social_login(provider, str(token))
    except social.SocialAuthError:
        return Response({"detail": "Sign-in failed."}, status=401)

    session_login(request, user)  # httpOnly session cookie
    drf_token, _ = Token.objects.get_or_create(user=user)
    return Response({"token": drf_token.key, "user": services.serialize_user(user)})


@api_view(["POST"])
@permission_classes([])
@throttle_classes([AnonRateThrottle, AuthScopedThrottle])
def social_google(request):
    return _social(request, "google")


@api_view(["POST"])
@permission_classes([])
@throttle_classes([AnonRateThrottle, AuthScopedThrottle])
def social_apple(request):
    return _social(request, "apple")
