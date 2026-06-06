"""
Service layer for the Shopify Customer Accounts portal (session-based BFF).

This is the bridge between the OAuth result (a verified customer email) and the
local Django world: it ``get_or_create``s a local ``User`` keyed by email and
attaches any pre-existing ``DownloadGrant`` rows (issued by the orders webhook,
keyed by email) so a purchase made BEFORE the customer ever logged in shows up
in their library the moment they sign in.

NOTE: login here is OPTIONAL — it only powers the account/library portal. Guest
checkout and the login-free signed-token downloads are completely unaffected.
"""
from __future__ import annotations

from typing import Any

from django.contrib.auth.models import User


def _normalize_email(email: str | None) -> str:
    return (email or "").strip().lower()


def serialize_customer(user: User) -> dict[str, Any]:
    """Public customer shape returned by the session/callback endpoints."""
    return {"email": user.email}


def attach_grants_by_email(user: User) -> int:
    """Attach any orphan ``DownloadGrant`` rows (by email) to ``user``.

    Mirrors the email-matching logic the orders webhook uses (orders.services)
    but in the other direction: when a user logs in, pull in grants that were
    created for their email before they had an account. Returns the count
    attached. Idempotent: grants already linked to a user are skipped.
    """
    from delivery.models import DownloadGrant

    email = _normalize_email(user.email)
    if not email:
        return 0
    return (
        DownloadGrant.objects.filter(email__iexact=email, user__isnull=True)
        .update(user=user)
    )


def get_or_create_customer(email: str) -> User:
    """Resolve the local ``User`` for a verified customer email.

    Uses the email as the username (lower-cased), matching accounts.services so
    the two auth paths converge on the SAME user row for a given email. Creates
    an unusable-password account (login is via Shopify OAuth, never a local
    password) and attaches any grants previously keyed to this email.
    """
    email = _normalize_email(email)
    if not email:
        raise ValueError("A customer email is required.")

    user = User.objects.filter(username=email).first()
    if user is None:
        # Try matching on the email field too (defensive; username==email is the
        # convention but a legacy row could differ).
        user = User.objects.filter(email__iexact=email).first()
    if user is None:
        user = User.objects.create_user(username=email, email=email)
        # OAuth-only account: no usable local password.
        user.set_unusable_password()
        user.save(update_fields=["password"])

    attach_grants_by_email(user)
    return user
