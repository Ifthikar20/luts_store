"""
Customer account API.

Base path: ``/api/auth``

AUTH IS OWNED BY DJANGO: every successful sign-in (email/password, Google,
Apple) establishes a server-side Django SESSION (httpOnly cookie) via
``django.contrib.auth.login``. The browser-facing social endpoints return NO
bearer token — the cookie is the only credential the SPA ever has. The
register/login endpoints still return a DRF token for LEGACY non-browser API
clients only.

* POST /register        {email, password} -> {token, user:{id, email}} + session
* POST /login           {email, password} -> {token, user:{id, email}} + session
* POST /logout          (auth) -> {status: "ok"}; deletes token + session
* GET  /me              (auth) -> {id, email}
* POST /google, /apple  {credential} -> {user:{id, email}} + session (no token)
* GET  /google/login    ?returnTo=/cart -> {mode:"google", authorizeUrl} | {mode:"mock"}
* GET  /google/callback ?code=&state=   -> 302 to FRONTEND_URL + returnTo (session set)

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

import logging
import secrets
from urllib.parse import urlencode

import requests
from django.conf import settings
from django.contrib.auth import login as session_login
from django.shortcuts import redirect
from rest_framework.authtoken.models import Token
from rest_framework.decorators import (
    api_view,
    authentication_classes,
    permission_classes,
    throttle_classes,
)
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle, SimpleRateThrottle

from . import google_oauth, services, social

logger = logging.getLogger(__name__)

# Session keys for the values remembered between /google/login and /callback.
GOOGLE_SESSION_STATE = "google_oauth_state"
GOOGLE_SESSION_NONCE = "google_oauth_nonce"
GOOGLE_SESSION_VERIFIER = "google_oauth_code_verifier"
GOOGLE_SESSION_RETURN_TO = "google_oauth_return_to"


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
    session_login(request, user)  # httpOnly session cookie — Django owns auth
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
    session_login(request, user)  # httpOnly session cookie — Django owns auth
    token, _ = Token.objects.get_or_create(user=user)
    return Response({"token": token.key, "user": services.serialize_user(user)})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def logout(request):
    from django.contrib.auth import logout as session_logout

    # Delete the caller's token AND clear the Django session so a sign-out is
    # total no matter which credential authenticated this request.
    Token.objects.filter(user=request.user).delete()
    session_logout(request)
    return Response({"status": "ok"})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def me(request):
    return Response(services.serialize_user(request.user))


def _social(request, provider: str):
    """Sign in with Google/Apple. Body: ``{credential}`` (the provider token).

    Verifies the token, creates/links the account, opts the email into deals +
    the biweekly free LUT, and logs the browser in via the httpOnly Django
    session. Returns ``{user}`` only — the browser is NEVER handed a bearer
    token (nothing for XSS to exfiltrate; the session cookie is the credential).
    """
    data = request.data if isinstance(request.data, dict) else {}
    token = data.get("credential") or data.get("token") or data.get("identityToken")
    if not token:
        return _bad_request("A sign-in `credential` is required.")
    try:
        user = social.social_login(provider, str(token))
    except social.SocialAuthError:
        return Response({"detail": "Sign-in failed."}, status=401)

    session_login(request, user)  # httpOnly session cookie
    return Response({"user": services.serialize_user(user)})


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


# ---------------------------------------------------------------------------
# Backend-owned Google OAuth (authorization-code flow + Django session).
#
# The frontend is pure UI here: it calls GET /auth/google/login, navigates the
# browser to the returned Google sign-in URL, and the user lands back on the
# storefront already logged in (httpOnly session cookie). Mirrors the Shopify
# Customer Accounts BFF in ``customer_auth``.
# ---------------------------------------------------------------------------
def _safe_return_to(value: str | None) -> str:
    """Only allow a relative, same-app path as the post-login destination.

    Prevents open-redirect: a returnTo of ``https://evil.example`` (or
    ``//evil``) is rejected and we fall back to ``/account``.
    """
    if not value or not value.startswith("/") or value.startswith("//"):
        return "/account"
    return value


def _google_error_redirect(reason: str):
    """302 back to the SPA login page with a generic ?error= code."""
    qs = urlencode({"error": reason})
    return redirect(f"{settings.FRONTEND_URL}/account/login?{qs}")


@api_view(["GET"])
@authentication_classes([])
@permission_classes([])
@throttle_classes([AnonRateThrottle])
def google_login(request):
    """Start Google sign-in.

    REAL mode (GOOGLE_OAUTH_ENABLED): build the Google authorize URL (code flow,
    PKCE S256), stash state/nonce/verifier/returnTo in the session, and return
    ``{"mode":"google","authorizeUrl":...}`` for the SPA to navigate to. MOCK
    mode: ``{"mode":"mock"}`` so the SPA shows the demo email form instead.
    """
    return_to = _safe_return_to(request.GET.get("returnTo"))

    if not settings.GOOGLE_OAUTH_ENABLED:
        request.session[GOOGLE_SESSION_RETURN_TO] = return_to
        return Response({"mode": "mock"})

    auth_req = google_oauth.build_authorize_url(
        client_id=settings.GOOGLE_CLIENT_ID,
        redirect_uri=settings.GOOGLE_REDIRECT_URI,
    )
    request.session[GOOGLE_SESSION_STATE] = auth_req.state
    request.session[GOOGLE_SESSION_NONCE] = auth_req.nonce
    request.session[GOOGLE_SESSION_VERIFIER] = auth_req.code_verifier
    request.session[GOOGLE_SESSION_RETURN_TO] = return_to

    return Response({"mode": "google", "authorizeUrl": auth_req.authorize_url})


@api_view(["GET"])
@authentication_classes([])
@permission_classes([])
@throttle_classes([AnonRateThrottle])
def google_callback(request):
    """Finish the Google code flow and establish a Django session.

    Disabled (404) in MOCK mode — there is no real Google to call back from.
    Any failure 302s to FRONTEND_URL + /account/login?error=<code> so the user
    always lands back on the UI.
    """
    if not settings.GOOGLE_OAUTH_ENABLED:
        return Response({"detail": "Not found."}, status=404)

    # 1. Validate the OAuth state against the session (constant-time).
    returned_state = request.GET.get("state", "")
    session_state = request.session.get(GOOGLE_SESSION_STATE, "")
    if not session_state or not secrets.compare_digest(
        str(returned_state), str(session_state)
    ):
        return _google_error_redirect("state_mismatch")

    code = request.GET.get("code")
    if not code:
        return _google_error_redirect("missing_code")

    code_verifier = request.session.get(GOOGLE_SESSION_VERIFIER, "")
    expected_nonce = request.session.get(GOOGLE_SESSION_NONCE, "")
    return_to = _safe_return_to(request.session.get(GOOGLE_SESSION_RETURN_TO))

    # 2. Exchange the authorization code for tokens, server-to-server.
    token_body = google_oauth.build_token_request(
        code=code,
        client_id=settings.GOOGLE_CLIENT_ID,
        client_secret=settings.GOOGLE_CLIENT_SECRET,
        redirect_uri=settings.GOOGLE_REDIRECT_URI,
        code_verifier=code_verifier,
    )
    try:
        resp = requests.post(
            google_oauth.GOOGLE_TOKEN_ENDPOINT,
            data=token_body,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            timeout=10,
        )
    except requests.RequestException:
        logger.exception("Google token exchange request failed")
        return _google_error_redirect("token_exchange_failed")

    if resp.status_code != 200:
        logger.warning("Google token endpoint returned %s", resp.status_code)
        return _google_error_redirect("token_exchange_failed")

    try:
        tokens = resp.json()
    except ValueError:
        return _google_error_redirect("token_exchange_failed")

    id_token = tokens.get("id_token")
    if not id_token:
        return _google_error_redirect("missing_id_token")

    # 3. Verify iss/aud/nonce/exp/email_verified and extract the email.
    try:
        email = google_oauth.email_from_id_token(
            id_token,
            client_id=settings.GOOGLE_CLIENT_ID,
            expected_nonce=expected_nonce,
        )
    except google_oauth.OAuthError:
        logger.warning("Google id_token verification failed", exc_info=True)
        return _google_error_redirect("invalid_id_token")

    # 4. Resolve the local user (newsletter opt-in etc.) and log the session in.
    user = social.user_from_email(email)
    for key in (
        GOOGLE_SESSION_STATE,
        GOOGLE_SESSION_NONCE,
        GOOGLE_SESSION_VERIFIER,
        GOOGLE_SESSION_RETURN_TO,
    ):
        request.session.pop(key, None)
    session_login(request, user)

    return redirect(f"{settings.FRONTEND_URL}{return_to}")
