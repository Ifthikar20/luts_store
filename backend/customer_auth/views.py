"""
Shopify Customer Accounts portal — OAuth 2.0 / OpenID Connect (PKCE) views.

Base path: ``/api/auth/shopify`` (plus ``/api/auth/session``).

This is a BFF (Backend-For-Frontend): the browser never sees the OAuth tokens.
After a successful login we establish a SERVER-SIDE Django session (httpOnly
cookie) via ``django.contrib.auth.login`` — NOT a localStorage token. The legacy
token-auth endpoints in ``accounts`` are untouched and stay for back-compat.

Endpoints (all JSON unless a redirect):
* GET  /api/auth/shopify/login?returnTo=/account
    REAL: build the Shopify authorize URL (PKCE S256), stash state/nonce/
          code_verifier/returnTo in the session, return {"mode":"shopify",
          "authorizeUrl": "..."}.
    MOCK: return {"mode":"mock"} (frontend shows a demo email form).
* GET  /api/auth/shopify/callback?code=&state=
    Verify state (constant-time), exchange the code for tokens, verify the
    id_token's nonce + exp, get_or_create the local user, attach grants by
    email, log the session in, then 302 to FRONTEND_URL + returnTo. Any error
    302s to FRONTEND_URL + "/account/login?error=...".
* POST /api/auth/shopify/mock-complete {email}
    MOCK ONLY (404 when real Shopify accounts are enabled). Simulates the OAuth
    result for local dev: get_or_create user, attach grants, log in.
* POST /api/auth/shopify/logout -> django logout(), {"ok":true}.
* GET  /api/auth/session -> {"authenticated":bool,"customer":{email}|null}.

CSRF NOTE: the two POST endpoints are intentionally ``csrf_exempt``.
``mock-complete`` only exists in local/demo mode and ``logout`` is not a
sensitive state-changing action on third-party data; both are also rate-limited
via the dedicated ``auth`` scope. The GET ``login``/``callback``/``session``
endpoints are safe (no unsafe side effects that a hostile site could trigger;
``callback`` is additionally protected by the OAuth ``state`` parameter).
"""
from __future__ import annotations

import logging
import secrets
from urllib.parse import urlencode

import requests
from django.conf import settings
from django.contrib.auth import login as django_login
from django.contrib.auth import logout as django_logout
from django.core.validators import validate_email
from django.core.exceptions import ValidationError
from django.shortcuts import redirect
from django.views.decorators.csrf import csrf_exempt
from rest_framework.decorators import (
    api_view,
    authentication_classes,
    permission_classes,
    throttle_classes,
)
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle, SimpleRateThrottle

from . import oauth, services

logger = logging.getLogger(__name__)

# Session keys for the values we must remember between /login and /callback.
SESSION_STATE = "shopify_oauth_state"
SESSION_NONCE = "shopify_oauth_nonce"
SESSION_VERIFIER = "shopify_oauth_code_verifier"
SESSION_RETURN_TO = "shopify_oauth_return_to"


class AuthScopedThrottle(SimpleRateThrottle):
    """Pin the ``auth`` rate (10/min default) to the customer-auth POSTs.

    Mirrors ``accounts.views.AuthScopedThrottle`` so the new portal endpoints
    are rate-limited the same way the legacy credential endpoints are. Keyed per
    client IP.
    """

    scope = "auth"

    def get_cache_key(self, request, view):
        return self.cache_format % {
            "scope": self.scope,
            "ident": self.get_ident(request),
        }


def _safe_return_to(value: str | None) -> str:
    """Only allow a relative, same-app path as the post-login destination.

    Prevents open-redirect: a returnTo of ``https://evil.example`` (or
    ``//evil``) is rejected and we fall back to ``/account``.
    """
    if not value or not value.startswith("/") or value.startswith("//"):
        return "/account"
    return value


# ---------------------------------------------------------------------------
# GET /api/auth/shopify/login
# ---------------------------------------------------------------------------
@api_view(["GET"])
@authentication_classes([])
@permission_classes([])
@throttle_classes([AnonRateThrottle])
def shopify_login(request):
    """Start the login flow.

    REAL mode (SHOPIFY_CUSTOMER_ACCOUNTS_ENABLED): build the authorize URL with
    PKCE + state + nonce and stash the verifiers in the session so the callback
    can complete the exchange. MOCK mode: return {"mode":"mock"} so the SPA shows
    the demo sign-in field instead of redirecting to Shopify.
    """
    return_to = _safe_return_to(request.GET.get("returnTo"))

    if not settings.SHOPIFY_CUSTOMER_ACCOUNTS_ENABLED:
        # No real credentials configured -> MOCK path. Remember returnTo so the
        # mock-complete step can hand it back to the SPA if it wants it.
        request.session[SESSION_RETURN_TO] = return_to
        return Response({"mode": "mock"})

    auth_req = oauth.build_authorize_url(
        shop_id=settings.SHOPIFY_CUSTOMER_ACCOUNT_SHOP_ID,
        client_id=settings.SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID,
        redirect_uri=settings.SHOPIFY_CUSTOMER_ACCOUNT_REDIRECT_URI,
    )
    # Persist the CSRF/PKCE material in the server-side session for the callback.
    request.session[SESSION_STATE] = auth_req.state
    request.session[SESSION_NONCE] = auth_req.nonce
    request.session[SESSION_VERIFIER] = auth_req.code_verifier
    request.session[SESSION_RETURN_TO] = return_to

    return Response({"mode": "shopify", "authorizeUrl": auth_req.authorize_url})


# ---------------------------------------------------------------------------
# GET /api/auth/shopify/callback
# ---------------------------------------------------------------------------
def _login_error_redirect(reason: str):
    """302 back to the SPA login page with a generic ?error= code."""
    qs = urlencode({"error": reason})
    return redirect(f"{settings.FRONTEND_URL}/account/login?{qs}")


@api_view(["GET"])
@authentication_classes([])
@permission_classes([])
@throttle_classes([AnonRateThrottle])
def shopify_callback(request):
    """Finish the OAuth code flow and establish a Django session.

    Disabled (404) in MOCK mode — there is no real Shopify to call back from.
    """
    if not settings.SHOPIFY_CUSTOMER_ACCOUNTS_ENABLED:
        return Response({"detail": "Not found."}, status=404)

    # 1. Validate the OAuth state against the session (constant-time) to defeat
    #    CSRF / mixed-up authorization responses.
    returned_state = request.GET.get("state", "")
    session_state = request.session.get(SESSION_STATE, "")
    if not session_state or not secrets.compare_digest(
        str(returned_state), str(session_state)
    ):
        return _login_error_redirect("state_mismatch")

    code = request.GET.get("code")
    if not code:
        return _login_error_redirect("missing_code")

    code_verifier = request.session.get(SESSION_VERIFIER, "")
    expected_nonce = request.session.get(SESSION_NONCE, "")
    return_to = _safe_return_to(request.session.get(SESSION_RETURN_TO))

    # 2. Exchange the authorization code for tokens (PKCE proves possession of
    #    the original challenge). client_secret is optional (confidential client).
    token_body = oauth.build_token_request(
        code=code,
        client_id=settings.SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID,
        redirect_uri=settings.SHOPIFY_CUSTOMER_ACCOUNT_REDIRECT_URI,
        code_verifier=code_verifier,
        client_secret=settings.SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_SECRET or None,
    )
    try:
        resp = requests.post(
            oauth.token_endpoint(settings.SHOPIFY_CUSTOMER_ACCOUNT_SHOP_ID),
            data=token_body,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            timeout=10,
        )
    except requests.RequestException:
        logger.exception("Shopify token exchange request failed")
        return _login_error_redirect("token_exchange_failed")

    if resp.status_code != 200:
        logger.warning("Shopify token endpoint returned %s", resp.status_code)
        return _login_error_redirect("token_exchange_failed")

    try:
        tokens = resp.json()
    except ValueError:
        return _login_error_redirect("token_exchange_failed")

    id_token = tokens.get("id_token")
    if not id_token:
        return _login_error_redirect("missing_id_token")

    # 3. Verify the id_token's nonce + exp (signature verification against the
    #    Shopify JWKS is a documented production TODO; see oauth.py).
    try:
        claims = oauth.decode_jwt_unverified(id_token)
        oauth.verify_id_token_claims(claims, expected_nonce=expected_nonce)
        email = oauth.email_from_claims(claims)
    except oauth.OAuthError:
        logger.warning("id_token verification failed", exc_info=True)
        return _login_error_redirect("invalid_id_token")

    # 4. Resolve the local user, attach any pre-existing grants by email, and
    #    establish the server-side session.
    user = services.get_or_create_customer(email)
    # Clear the one-time OAuth material now that it has been used.
    for key in (SESSION_STATE, SESSION_NONCE, SESSION_VERIFIER, SESSION_RETURN_TO):
        request.session.pop(key, None)
    django_login(request, user)

    return redirect(f"{settings.FRONTEND_URL}{return_to}")


# ---------------------------------------------------------------------------
# POST /api/auth/shopify/mock-complete  (MOCK ONLY)
# ---------------------------------------------------------------------------
@csrf_exempt
@api_view(["POST"])
@authentication_classes([])
@permission_classes([])
@throttle_classes([AnonRateThrottle, AuthScopedThrottle])
def shopify_mock_complete(request):
    """Simulate the Shopify OAuth result for LOCAL DEMO only.

    This stands in for the entire real flow (authorize -> callback -> token ->
    id_token) so the portal works with NO Shopify credentials. It is HARD 404'd
    whenever real customer accounts are enabled, so it can never be reached in a
    configured/production deployment.
    """
    if settings.SHOPIFY_CUSTOMER_ACCOUNTS_ENABLED:
        return Response({"detail": "Not found."}, status=404)

    data = request.data if isinstance(request.data, dict) else {}
    email = (data.get("email") or "").strip().lower()
    try:
        validate_email(email)
    except ValidationError:
        return Response({"detail": "A valid email is required."}, status=400)

    user = services.get_or_create_customer(email)
    django_login(request, user)
    return Response({"customer": services.serialize_customer(user)})


# ---------------------------------------------------------------------------
# POST /api/auth/shopify/logout
# ---------------------------------------------------------------------------
@csrf_exempt
@api_view(["POST"])
@authentication_classes([])
@permission_classes([])
@throttle_classes([AnonRateThrottle, AuthScopedThrottle])
def shopify_logout(request):
    """Clear the Django session (server-side logout)."""
    django_logout(request)
    return Response({"ok": True})


# ---------------------------------------------------------------------------
# GET /api/auth/session
# ---------------------------------------------------------------------------
@api_view(["GET"])
@permission_classes([])
@throttle_classes([AnonRateThrottle])
def session_view(request):
    """Reflect the current session: who (if anyone) is logged in."""
    user = request.user
    if user is not None and user.is_authenticated:
        return Response(
            {"authenticated": True, "customer": services.serialize_customer(user)}
        )
    return Response({"authenticated": False, "customer": None})
