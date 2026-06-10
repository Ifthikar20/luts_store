"""
Social sign-in: Google and Apple.

Verifies a provider identity token, then maps it to a Django ``User`` (created
on first sign-in) and opts the email into our list so they get the best deals +
the biweekly free LUT.

Verification:
* Configured (client id set) -> verify the token for real (Google tokeninfo;
  Apple JWKS/RS256).
* Not configured -> DEV/TEST ONLY: accept a ``mock:<email>`` token so local and
  CI sign-in works without external credentials. Mirrors the Stripe/Shopify
  mock pattern; never trusts ``mock:`` tokens once a real client id is set.
"""
from __future__ import annotations

import logging

import requests
from django.conf import settings
from django.contrib.auth.models import User
from django.db import transaction

logger = logging.getLogger(__name__)


class SocialAuthError(Exception):
    """Generic social-login failure (never reveals provider internals)."""


def _dev_email(token: str) -> str:
    if token and token.startswith("mock:"):
        email = token[len("mock:") :].strip().lower()
        if "@" in email:
            return email
    raise SocialAuthError("Sign-in is not configured.")


def _email_from_google(token: str) -> str:
    if not settings.GOOGLE_CLIENT_ID:
        return _dev_email(token)
    try:
        resp = requests.get(
            "https://oauth2.googleapis.com/tokeninfo",
            params={"id_token": token},
            timeout=10,
        )
    except requests.RequestException as exc:  # pragma: no cover - network
        raise SocialAuthError("Could not verify Google sign-in.") from exc
    if resp.status_code != 200:
        raise SocialAuthError("Invalid Google token.")
    data = resp.json()
    if data.get("aud") != settings.GOOGLE_CLIENT_ID:
        raise SocialAuthError("Google token audience mismatch.")
    if str(data.get("email_verified")).lower() != "true":
        raise SocialAuthError("Unverified Google email.")
    email = data.get("email")
    if not email:
        raise SocialAuthError("Google token missing email.")
    return str(email)


def _email_from_apple(token: str) -> str:
    if not settings.APPLE_CLIENT_ID:
        return _dev_email(token)
    try:  # pragma: no cover - real path needs Apple creds + network
        import jwt
        from jwt import PyJWKClient

        signing_key = PyJWKClient(
            "https://appleid.apple.com/auth/keys"
        ).get_signing_key_from_jwt(token)
        data = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            audience=settings.APPLE_CLIENT_ID,
            issuer="https://appleid.apple.com",
        )
    except Exception as exc:  # noqa: BLE001
        raise SocialAuthError("Invalid Apple token.") from exc
    email = data.get("email")
    if not email:
        raise SocialAuthError("Apple token missing email.")
    return str(email)


@transaction.atomic
def social_login(provider: str, token: str) -> User:
    """Verify a provider token, return the (created-or-existing) ``User``."""
    if provider == "google":
        email = _email_from_google(token)
    elif provider == "apple":
        email = _email_from_apple(token)
    else:
        raise SocialAuthError("Unknown sign-in provider.")
    return user_from_email(email)


@transaction.atomic
def user_from_email(email: str) -> User:
    """Resolve a VERIFIED provider email to the local ``User`` (created on
    first sign-in), with the newsletter opt-in and mock-library seeding that
    every social sign-in gets. Callers must have verified the email already.
    """
    email = email.strip().lower()
    user, created = User.objects.get_or_create(
        username=email, defaults={"email": email}
    )
    if not user.email:
        user.email = email
        user.save(update_fields=["email"])

    # Opt-in: best deals + the biweekly free LUT, sent to their email.
    try:
        from engagement.models import NewsletterSubscriber

        NewsletterSubscriber.objects.get_or_create(email=email)
    except Exception:  # noqa: BLE001 - opt-in must never block sign-in
        logger.exception("newsletter opt-in failed for %s", email)

    # MOCK-ONLY: seed sample downloads so a new account's library isn't empty.
    if created and settings.MOCK_MODE:
        from accounts.services import _seed_mock_downloads

        _seed_mock_downloads(user)

    return user
