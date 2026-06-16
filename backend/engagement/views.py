"""
Engagement API: newsletter signup + contact form.

Base path: ``/api``

* POST /newsletter {email} -> ALWAYS a generic 200 (no enumeration). Validates
  the email, then ``get_or_create`` a subscriber. Throttled by the dedicated
  ``sensitive`` scope (5/min) on top of the anon throttle.
* POST /contact {name, email, message} -> validates required fields + email,
  stores a ``ContactMessage``, optionally notifies the support inbox
  (best-effort), and returns a generic 200. Throttled the same way.

Both endpoints are unauthenticated and CSRF-irrelevant (token-auth API, no
session cookie). The ``sensitive`` scope mirrors the pattern used by
``orders.views.SensitiveScopedThrottle`` / ``accounts.views.AuthScopedThrottle``.
"""
from __future__ import annotations

import logging

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.mail import send_mail
from django.core.validators import validate_email
from rest_framework.decorators import (
    api_view,
    authentication_classes,
    permission_classes,
    throttle_classes,
)
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle, SimpleRateThrottle

from common.drf import CsrfExemptSessionAuthentication

from .models import ContactMessage, NewsletterSubscriber, Review

logger = logging.getLogger(__name__)


class SensitiveScopedThrottle(SimpleRateThrottle):
    """Dedicated throttle pinned to the ``sensitive`` rate (5/min by default).

    Hard-codes the scope (unlike ``ScopedRateThrottle``, which is a no-op on
    function-based views) so these public, write-capable, mail-triggering
    endpoints are always rate-limited. Keyed per client IP to blunt spam /
    enumeration / mail-bombing.
    """

    scope = "sensitive"

    def get_cache_key(self, request, view):
        return self.cache_format % {
            "scope": self.scope,
            "ident": self.get_ident(request),
        }


def _is_valid_email(value: str) -> bool:
    try:
        validate_email(value)
    except ValidationError:
        return False
    return True


# Single generic success body for the newsletter endpoint -> no enumeration of
# whether an address was already subscribed.
_NEWSLETTER_GENERIC = {
    "status": "ok",
    "detail": "Thanks — you're on the list. Check your inbox to confirm.",
}


@api_view(["POST"])
@authentication_classes([])
@permission_classes([])
@throttle_classes([AnonRateThrottle, SensitiveScopedThrottle])
def newsletter_subscribe(request):
    """Subscribe an email to the newsletter.

    Invalid email -> 400. Otherwise ALWAYS the same generic 200, whether the
    address is new or already subscribed (no enumeration).
    """
    data = request.data if isinstance(request.data, dict) else {}
    email = (data.get("email") or "").strip().lower()

    if not email or not _is_valid_email(email):
        return Response({"detail": "A valid email address is required."}, status=400)

    # get_or_create keeps the response identical for new vs. existing addresses.
    NewsletterSubscriber.objects.get_or_create(email=email)
    return Response(_NEWSLETTER_GENERIC, status=200)


_CONTACT_GENERIC = {
    "status": "ok",
    "detail": "Thanks for reaching out — we'll get back to you shortly.",
}


@api_view(["POST"])
@authentication_classes([])
@permission_classes([])
@throttle_classes([AnonRateThrottle, SensitiveScopedThrottle])
def contact_submit(request):
    """Store a contact message and best-effort notify the support inbox.

    Missing fields / invalid email -> 400. Otherwise a generic 200.
    """
    data = request.data if isinstance(request.data, dict) else {}
    name = (data.get("name") or "").strip()
    email = (data.get("email") or "").strip()
    message = (data.get("message") or "").strip()

    if not name or not email or not message:
        return Response(
            {"detail": "Name, email and message are all required."}, status=400
        )
    if not _is_valid_email(email):
        return Response({"detail": "A valid email address is required."}, status=400)

    ContactMessage.objects.create(name=name, email=email, message=message)

    # Best-effort support notification. Wrapped so a mail-backend failure never
    # breaks the form submission (mirrors the post-purchase email pipeline).
    try:
        send_mail(
            subject=f"[The Looks Lab] New contact message from {name}",
            message=f"From: {name} <{email}>\n\n{message}",
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[settings.SUPPORT_EMAIL],
            fail_silently=False,
        )
    except Exception:  # noqa: BLE001 - never let mail break the caller
        logger.exception("Failed to send contact-message notification email")

    return Response(_CONTACT_GENERIC, status=200)


# ---------------------------------------------------------------------------
# Product reviews — authenticated + verified-purchase gated
# ---------------------------------------------------------------------------
class AuthScopedThrottle(SimpleRateThrottle):
    """Pin review writes to the ``auth`` rate (10/min) to deter spam."""

    scope = "auth"

    def get_cache_key(self, request, view):
        return self.cache_format % {
            "scope": self.scope,
            "ident": self.get_ident(request),
        }


def _has_purchased(user, handle: str) -> bool:
    """True iff ``user`` holds a non-revoked download grant for ``handle``."""
    from delivery.models import DownloadGrant

    return DownloadGrant.objects.filter(
        user=user, product_handle=handle, revoked_at__isnull=True
    ).exists()


def _display_name(user, supplied: str) -> str:
    """A friendly first-name label, never the full email (privacy)."""
    name = (supplied or "").strip()
    if name:
        return name[:120]
    if user.first_name:
        return user.first_name
    local = (user.email or "").split("@", 1)[0]
    return local.split(".")[0].capitalize() or "Customer"


_SORTS = {
    "recent": "-created_at",
    "highest": "-rating",
    "lowest": "rating",
    "helpful": "-helpful_count",
}


@api_view(["GET"])
@permission_classes([])
@throttle_classes([AnonRateThrottle])
def list_reviews(request, handle: str):
    """Public: PUBLISHED reviews for one product + aggregate rating.

    ``?sort=recent|highest|lowest|helpful`` (default recent). Per-viewer flags
    (youVoted/yours) are included for the signed-in user so the UI can render
    vote/delete affordances.
    """
    user = request.user
    sort = _SORTS.get(request.GET.get("sort", "recent"), "-created_at")
    qs = Review.objects.filter(
        product_handle=handle, status=Review.PUBLISHED
    ).order_by(sort, "-created_at")
    reviews = [r.to_public(user=user) for r in qs]
    count = len(reviews)
    average = round(sum(r["rating"] for r in reviews) / count, 1) if count else 0.0
    can_review = bool(
        user and user.is_authenticated and _has_purchased(user, handle)
    )
    return Response(
        {
            "average": average,
            "count": count,
            "reviews": reviews,
            "canReview": can_review,
        }
    )


def _require_login(request):
    user = request.user
    if not (user and user.is_authenticated):
        return None, Response({"detail": "Sign in first."}, status=401)
    return user, None


@api_view(["POST"])
@authentication_classes([CsrfExemptSessionAuthentication])
@permission_classes([])
@throttle_classes([AnonRateThrottle, AuthScopedThrottle])
def vote_helpful(request, pk: int):
    """Toggle the signed-in user's 'helpful' vote on a review."""
    from .models import ReviewVote

    user, err = _require_login(request)
    if err:
        return err
    review = Review.objects.filter(pk=pk, status=Review.PUBLISHED).first()
    if review is None:
        return Response({"detail": "Not found."}, status=404)

    vote = ReviewVote.objects.filter(review=review, user=user).first()
    if vote:
        vote.delete()
        voted = False
    else:
        ReviewVote.objects.create(review=review, user=user)
        voted = True
    review.helpful_count = review.votes.count()
    review.save(update_fields=["helpful_count"])
    return Response({"youVoted": voted, "helpfulCount": review.helpful_count})


# Auto-hide a review once this many distinct users report it (pending admin review).
_REPORT_HIDE_THRESHOLD = 4


@api_view(["POST"])
@authentication_classes([CsrfExemptSessionAuthentication])
@permission_classes([])
@throttle_classes([AnonRateThrottle, AuthScopedThrottle])
def report_review(request, pk: int):
    """Report a review for abuse (one per user). Generic success either way."""
    from .models import ReviewReport

    user, err = _require_login(request)
    if err:
        return err
    review = Review.objects.filter(pk=pk).first()
    if review is None:
        return Response({"detail": "Not found."}, status=404)

    data = request.data if isinstance(request.data, dict) else {}
    _report, created = ReviewReport.objects.get_or_create(
        review=review,
        user=user,
        defaults={"reason": (data.get("reason") or "").strip()[:300]},
    )
    if created:
        review.report_count = review.reports.count()
        # Auto-hide pending moderation once enough distinct users flag it.
        if review.report_count >= _REPORT_HIDE_THRESHOLD:
            review.status = Review.HIDDEN
            review.save(update_fields=["report_count", "status"])
        else:
            review.save(update_fields=["report_count"])
    return Response({"status": "ok", "detail": "Thanks — we'll take a look."})


@api_view(["POST"])
@authentication_classes([CsrfExemptSessionAuthentication])
@permission_classes([])
@throttle_classes([AnonRateThrottle, AuthScopedThrottle])
def delete_review(request, pk: int):
    """Delete the signed-in user's OWN review (only the author can)."""
    user, err = _require_login(request)
    if err:
        return err
    review = Review.objects.filter(pk=pk).first()
    if review is None:
        return Response({"detail": "Not found."}, status=404)
    if review.user_id != user.id:
        return Response({"detail": "You can only delete your own review."}, status=403)
    review.delete()
    return Response({"status": "ok"})


@api_view(["POST"])
@authentication_classes([CsrfExemptSessionAuthentication])
@permission_classes([])
@throttle_classes([AnonRateThrottle, AuthScopedThrottle])
def create_review(request, handle: str):
    """Create/update the signed-in buyer's review for ``handle``.

    Gated: must be logged in (401) AND own a non-revoked grant for the product
    (403). One review per (product, user) — re-posting updates it. This is what
    makes reviews authentic: a non-buyer literally cannot create one.
    """
    user = request.user
    if not (user and user.is_authenticated):
        return Response({"detail": "Sign in to leave a review."}, status=401)
    if not _has_purchased(user, handle):
        return Response(
            {"detail": "Only verified buyers can review this product."}, status=403
        )

    data = request.data if isinstance(request.data, dict) else {}
    # Bot check (no-op unless reCAPTCHA is configured).
    from common import recaptcha

    token = data.get("recaptchaToken") or data.get("recaptcha_token")
    if not recaptcha.verify(token, action="review", remote_ip=recaptcha.client_ip(request)):
        return Response(
            {"detail": "Could not verify you're human. Please try again."}, status=400
        )
    try:
        rating = int(data.get("rating"))
    except (TypeError, ValueError):
        return Response({"detail": "A rating (1–5) is required."}, status=400)
    if not 1 <= rating <= 5:
        return Response({"detail": "Rating must be between 1 and 5."}, status=400)

    # Content filtering: strip any markup (anti-injection) and mask profanity
    # BEFORE persisting. The cleaned text is what gets encrypted + stored.
    from common.moderation import clean_review_text

    body = clean_review_text(data.get("body"))[:5000]
    if not body:
        return Response({"detail": "Please write a short review."}, status=400)
    title = clean_review_text(data.get("title"))[:140]

    review, _created = Review.objects.update_or_create(
        product_handle=handle,
        user=user,
        defaults={
            "rating": rating,
            "title": title,
            "body": body,
            "author_name": _display_name(user, data.get("name", "")),
            "verified": True,
        },
    )
    return Response({"review": review.to_public()}, status=201)
