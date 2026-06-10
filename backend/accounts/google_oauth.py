"""
Google sign-in — server-side OAuth 2.0 / OpenID Connect (authorization code).

This powers the BACKEND-OWNED Google login flow: the browser is sent to
Google's hosted sign-in screen, Google redirects back to
``/api/auth/google/callback`` on THIS API, and the backend exchanges the code,
verifies the id_token claims and establishes a Django session. The frontend
never touches Google credentials or tokens — it only navigates to
``/api/auth/google/login``.

Pure helpers only (no Django imports beyond none): URL/body builders and claim
verification. The PKCE / state / nonce primitives are shared with the Shopify
flow in ``customer_auth.oauth``.

SECURITY NOTES
* ``state`` (session-bound, constant-time compared) defeats login CSRF.
* ``nonce`` is echoed in the id_token and verified (replay protection).
* PKCE S256 is sent even though this is a confidential client (Google permits
  and recommends it).
* The id_token is received DIRECTLY from Google's token endpoint over TLS, so
  per OIDC core 3.1.3.7 the TLS server validation stands in for signature
  verification; iss / aud / nonce / exp / email_verified are all checked here.
"""
from __future__ import annotations

from urllib.parse import urlencode

from customer_auth.oauth import (
    AuthRequest,
    OAuthError,
    code_challenge_for,
    decode_jwt_unverified,
    generate_code_verifier,
    generate_nonce,
    generate_state,
    verify_id_token_claims,
)

GOOGLE_AUTHORIZE_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token"
GOOGLE_ISSUERS = ("https://accounts.google.com", "accounts.google.com")

# Only identity — we never ask for profile/contacts/etc.
GOOGLE_SCOPE = "openid email"


def build_authorize_url(
    *,
    client_id: str,
    redirect_uri: str,
    state: str | None = None,
    nonce: str | None = None,
    code_verifier: str | None = None,
) -> AuthRequest:
    """Build the Google authorization URL (code flow, PKCE S256).

    Returns the URL plus the generated ``state`` / ``nonce`` / ``code_verifier``
    so the caller can stash them in the session for the callback to verify.
    """
    state = state or generate_state()
    nonce = nonce or generate_nonce()
    code_verifier = code_verifier or generate_code_verifier()

    params = {
        "client_id": client_id,
        "response_type": "code",
        "redirect_uri": redirect_uri,
        "scope": GOOGLE_SCOPE,
        "state": state,
        "nonce": nonce,
        "code_challenge": code_challenge_for(code_verifier),
        "code_challenge_method": "S256",
        # Always show the account chooser so shared machines don't silently
        # reuse the previous Google account.
        "prompt": "select_account",
    }
    return AuthRequest(
        authorize_url=f"{GOOGLE_AUTHORIZE_ENDPOINT}?{urlencode(params)}",
        state=state,
        nonce=nonce,
        code_verifier=code_verifier,
    )


def build_token_request(
    *,
    code: str,
    client_id: str,
    client_secret: str,
    redirect_uri: str,
    code_verifier: str,
) -> dict[str, str]:
    """Form body for the authorization-code -> token exchange with Google."""
    return {
        "grant_type": "authorization_code",
        "code": code,
        "client_id": client_id,
        "client_secret": client_secret,
        "redirect_uri": redirect_uri,
        "code_verifier": code_verifier,
    }


def email_from_id_token(
    id_token: str,
    *,
    client_id: str,
    expected_nonce: str,
) -> str:
    """Verify the Google id_token claims and return the verified email.

    Checks iss, aud, nonce (constant-time), exp and email_verified. Raises
    ``OAuthError`` on any failure.
    """
    claims = decode_jwt_unverified(id_token)
    if claims.get("iss") not in GOOGLE_ISSUERS:
        raise OAuthError("Google id_token issuer mismatch.")
    if claims.get("aud") != client_id:
        raise OAuthError("Google id_token audience mismatch.")
    verify_id_token_claims(claims, expected_nonce=expected_nonce)
    if str(claims.get("email_verified")).lower() != "true":
        raise OAuthError("Unverified Google email.")
    email = claims.get("email")
    if not email:
        raise OAuthError("Google id_token is missing the email claim.")
    return str(email).strip().lower()
