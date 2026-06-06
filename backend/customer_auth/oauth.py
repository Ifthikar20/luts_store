"""
Shopify Customer Account API — OAuth 2.0 / OpenID Connect (PKCE) client helpers.

This module contains ONLY the pure, side-effect-free building blocks for the
"new customer accounts" login flow that powers hosted login at
``account.<domain>`` (the same flow thelookslab.com uses):

* authorization-URL builder (``response_type=code``, PKCE ``S256``)
* token-endpoint URL + form body builder (PKCE ``code_verifier`` exchange)
* PKCE verifier/challenge + ``state`` / ``nonce`` generators
* a minimal ``id_token`` (JWT) decoder that verifies ``nonce`` + ``exp``

URL formats (Shopify "New Customer Accounts" / Customer Account API):
    Authorization:  https://shopify.com/authentication/<shop_id>/oauth/authorize
    Token:          https://shopify.com/authentication/<shop_id>/oauth/token
    Logout:         https://shopify.com/authentication/<shop_id>/logout
    JWKS:           https://shopify.com/authentication/<shop_id>/.well-known/openid-configuration
where ``<shop_id>`` is the NUMERIC shop id surfaced in the headless / customer
account channel settings. Ref: Shopify "Customer Account API — Get started"
and "Build a custom storefront / authenticate the customer" docs.

The scope used is exactly the one thelookslab.com requests:
    ``openid email customer-account-api:full``

SECURITY NOTES
* PKCE (S256) is mandatory for the public-client flow so an intercepted
  authorization code cannot be exchanged without the ``code_verifier``.
* ``state`` is a CSRF token bound to the browser session; the callback compares
  it in constant time.
* ``nonce`` is echoed in the ``id_token`` and verified to bind the token to this
  login attempt (replay protection).
* id_token SIGNATURE verification against Shopify's JWKS is the ideal final
  step. It is left as a clearly-marked TODO (``verify_id_token_signature``) so
  this runs without an extra crypto dependency / network fetch in dev; nonce +
  exp ARE verified here, which is the minimum the task requires. In production
  add JWKS-based RS256 verification (e.g. via PyJWT + PyJWKClient).
"""
from __future__ import annotations

import base64
import hashlib
import json
import secrets
import time
from dataclasses import dataclass
from urllib.parse import urlencode

# The exact scope thelookslab.com requests for the customer account portal.
DEFAULT_SCOPE = "openid email customer-account-api:full"


class OAuthError(Exception):
    """Raised for any recoverable OAuth/OIDC failure (bad state, token, etc.)."""


# ---------------------------------------------------------------------------
# Base64url helpers (no padding) — used for PKCE and JWT segments.
# ---------------------------------------------------------------------------
def _b64url_encode(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")


def _b64url_decode(segment: str) -> bytes:
    padding = "=" * (-len(segment) % 4)
    return base64.urlsafe_b64decode(segment + padding)


# ---------------------------------------------------------------------------
# Random tokens (state / nonce) and PKCE verifier/challenge.
# ---------------------------------------------------------------------------
def generate_state() -> str:
    """A high-entropy, URL-safe CSRF ``state`` value."""
    return secrets.token_urlsafe(32)


def generate_nonce() -> str:
    """A high-entropy, URL-safe OIDC ``nonce`` value."""
    return secrets.token_urlsafe(32)


def generate_code_verifier() -> str:
    """A PKCE ``code_verifier`` (43-128 chars, URL-safe per RFC 7636)."""
    return secrets.token_urlsafe(64)


def code_challenge_for(verifier: str) -> str:
    """The PKCE S256 ``code_challenge`` = base64url(sha256(verifier))."""
    digest = hashlib.sha256(verifier.encode("ascii")).digest()
    return _b64url_encode(digest)


# ---------------------------------------------------------------------------
# Authorization + token endpoint URL builders.
# ---------------------------------------------------------------------------
def authorization_base(shop_id: str) -> str:
    return f"https://shopify.com/authentication/{shop_id}/oauth/authorize"


def token_endpoint(shop_id: str) -> str:
    return f"https://shopify.com/authentication/{shop_id}/oauth/token"


def logout_endpoint(shop_id: str) -> str:
    return f"https://shopify.com/authentication/{shop_id}/logout"


@dataclass
class AuthRequest:
    """The values that must be persisted in the session for the callback."""

    authorize_url: str
    state: str
    nonce: str
    code_verifier: str


def build_authorize_url(
    *,
    shop_id: str,
    client_id: str,
    redirect_uri: str,
    scope: str = DEFAULT_SCOPE,
    state: str | None = None,
    nonce: str | None = None,
    code_verifier: str | None = None,
) -> AuthRequest:
    """Build the Shopify Customer Account authorization URL (PKCE, code flow).

    Returns the URL plus the freshly generated ``state`` / ``nonce`` /
    ``code_verifier`` so the caller can stash them in the session for the
    callback to verify.
    """
    state = state or generate_state()
    nonce = nonce or generate_nonce()
    code_verifier = code_verifier or generate_code_verifier()

    params = {
        "client_id": client_id,
        "response_type": "code",
        "redirect_uri": redirect_uri,
        "scope": scope,
        "state": state,
        "nonce": nonce,
        "code_challenge": code_challenge_for(code_verifier),
        "code_challenge_method": "S256",
    }
    url = f"{authorization_base(shop_id)}?{urlencode(params)}"
    return AuthRequest(
        authorize_url=url,
        state=state,
        nonce=nonce,
        code_verifier=code_verifier,
    )


def build_token_request(
    *,
    code: str,
    client_id: str,
    redirect_uri: str,
    code_verifier: str,
    client_secret: str | None = None,
) -> dict[str, str]:
    """Form body for the authorization-code -> token exchange.

    Public client (PKCE): no secret. Confidential client: include the optional
    ``client_secret`` env. ``code_verifier`` proves possession of the original
    PKCE challenge.
    """
    body = {
        "grant_type": "authorization_code",
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "code": code,
        "code_verifier": code_verifier,
    }
    if client_secret:
        body["client_secret"] = client_secret
    return body


# ---------------------------------------------------------------------------
# id_token (JWT) decode + claim verification.
# ---------------------------------------------------------------------------
def decode_jwt_unverified(token: str) -> dict:
    """Decode a JWT payload WITHOUT signature verification.

    NOTE: signature verification (against Shopify's JWKS) is the production
    final step — see ``verify_id_token_signature``. Here we only base64url-decode
    the claims segment; callers MUST still verify nonce + exp via
    ``verify_id_token_claims``.
    """
    try:
        _header, payload, _sig = token.split(".")
    except ValueError as exc:
        raise OAuthError("Malformed id_token.") from exc
    try:
        return json.loads(_b64url_decode(payload))
    except (ValueError, json.JSONDecodeError) as exc:
        raise OAuthError("Unreadable id_token payload.") from exc


def verify_id_token_claims(
    claims: dict,
    *,
    expected_nonce: str,
    leeway: int = 60,
) -> dict:
    """Verify the minimum OIDC claims: ``nonce`` match and ``exp`` not passed.

    Returns the claims on success; raises ``OAuthError`` otherwise. ``leeway``
    seconds of clock skew are tolerated on ``exp``.
    """
    token_nonce = claims.get("nonce")
    if not token_nonce or not secrets.compare_digest(
        str(token_nonce), str(expected_nonce)
    ):
        raise OAuthError("id_token nonce mismatch.")

    exp = claims.get("exp")
    if exp is not None:
        try:
            if int(exp) + leeway < int(time.time()):
                raise OAuthError("id_token has expired.")
        except (TypeError, ValueError) as exc:
            raise OAuthError("id_token exp is invalid.") from exc

    return claims


def email_from_claims(claims: dict) -> str:
    """Extract the customer email from the id_token claims."""
    email = claims.get("email")
    if not email:
        raise OAuthError("id_token is missing the email claim.")
    return str(email).strip().lower()


# TODO(production): verify the id_token signature against Shopify's JWKS.
# Fetch the JWKS from the shop's OpenID configuration
# (https://shopify.com/authentication/<shop_id>/.well-known/openid-configuration
# -> jwks_uri), select the key by the token header's ``kid``, and verify the
# RS256 signature (e.g. PyJWT's ``jwt.decode(..., algorithms=["RS256"])`` with a
# ``PyJWKClient``). Out of scope here to avoid a new crypto dependency / network
# call in local dev; nonce + exp verification above is the documented minimum.
def verify_id_token_signature(token: str, *, shop_id: str) -> None:  # pragma: no cover
    raise NotImplementedError(
        "JWKS signature verification is a production TODO; see module docstring."
    )
