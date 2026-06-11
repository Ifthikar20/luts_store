"""
Account service layer.

Customer accounts are backed by Django's built-in ``User`` model. We use the
email as the username (lower-cased) so an email uniquely identifies an account,
while also storing it in the ``email`` field for clarity.

SECURITY:
* Passwords are hashed by Django (PBKDF2 by default) via ``set_password`` /
  ``create_user`` -- never stored in plaintext.
* We never reveal whether an email already exists. ``register`` and ``login``
  raise the SAME generic ``AuthError`` so an attacker cannot enumerate accounts.
"""
from __future__ import annotations

from typing import Any

from django.conf import settings
from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction


class AuthError(Exception):
    """Generic, non-enumerating auth failure (bad creds / duplicate / weak pw).

    The optional ``code`` distinguishes a *weak password* (safe to surface; it
    reveals nothing about other accounts) from a generic credential failure.
    """

    def __init__(self, message: str, code: str = "invalid") -> None:
        super().__init__(message)
        self.code = code


def _normalize_email(email: str | None) -> str:
    return (email or "").strip().lower()


def serialize_user(user: User) -> dict[str, Any]:
    """Public, camelCase representation of a customer account."""
    return {"id": user.id, "email": user.email}


@transaction.atomic
def register(email: str, password: str) -> User:
    """Create a new customer account.

    Raises ``AuthError`` (generic) so callers cannot tell "email taken" apart
    from other failures, except a weak-password error which is safe to surface.
    """
    email = _normalize_email(email)
    if not email or not password:
        raise AuthError("Unable to create account.")

    # Validate the password against Django's configured validators BEFORE we do
    # anything that could leak existence of the account.
    try:
        validate_password(password)
    except ValidationError as exc:
        raise AuthError(" ".join(exc.messages), code="weak_password") from exc

    # Use the email as username. A duplicate raises IntegrityError, which we
    # collapse into the SAME generic error to avoid user enumeration.
    try:
        user = User.objects.create_user(
            username=email, email=email, password=password
        )
    except IntegrityError as exc:
        raise AuthError("Unable to create account.") from exc

    # MOCK-ONLY convenience: seed a couple of sample download grants so the
    # "My Downloads" library page demonstrably shows content right after signup.
    # Strictly gated behind MOCK_MODE -- never runs against a real backend.
    if settings.MOCK_MODE:
        _seed_mock_downloads(user)

    return user


def login(email: str, password: str) -> User:
    """Authenticate an existing customer. Generic ``AuthError`` on any failure."""
    email = _normalize_email(email)
    # ``authenticate`` runs the password hasher even on a missing user (Django
    # mitigates timing), and returns None on any failure.
    user = authenticate(username=email, password=password)
    if user is None:
        raise AuthError("Invalid email or password.")
    return user


def _seed_mock_downloads(user: User) -> None:
    """Seed sample DownloadGrants for a new user (MOCK_MODE ONLY).

    Picks two real mock-catalog handles so the generated download tokens resolve
    against actual products on the library/thank-you pages.
    """
    from catalog import source
    from delivery.models import DownloadGrant

    sample_handles = ["midnight-noir", "dji-aerial-vivid"]
    data = source.active()
    for handle in sample_handles:
        product = data.get_product(handle)
        if product is None:  # pragma: no cover - defensive
            continue
        DownloadGrant.objects.create(
            user=user,
            email=user.email,
            product_handle=handle,
        )
