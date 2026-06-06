"""
Customer notification emails (The Looks Lab).

Cohesive with the delivery concern: order-confirmation emails reuse the same
grant serialization + signed-token machinery (``delivery/services.py`` and
``delivery/signing.py``) so the download links in an email are identical to the
links shown on the thank-you page and library — one source of truth.

Emails are rendered from Django templates in ``backend/templates/email/`` and
sent as a multipart (plain-text + HTML) message via whatever ``EMAIL_BACKEND``
is configured (console in dev, SMTP in prod, locmem in tests).

The signed download links in an email point at the API endpoint
(``GET /api/download/<token>``) so they resolve directly. A "your library"
link points at ``FRONTEND_URL`` so customers can re-download any time.
"""
from __future__ import annotations

from typing import Any

from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string


def _absolute_download_url(relative_url: str) -> str:
    """Resolve a relative ``/api/download/<token>`` path to an absolute URL.

    The signed-token endpoint lives on the API origin. We derive that origin
    from the same base the rest of the app uses; if the value is already
    absolute (real mode could return an S3 URL) we pass it through untouched.
    """
    if relative_url.startswith("http://") or relative_url.startswith("https://"):
        return relative_url
    base = getattr(settings, "API_BASE_URL", "").rstrip("/")
    if not base:
        # Fall back to the frontend origin's host on :8000 is brittle; instead
        # leave the path relative-absolute against an empty base so console/dev
        # output is still readable and tests can match the token. Real
        # deployments should set API_BASE_URL.
        return relative_url
    return f"{base}{relative_url}"


def _confirmation_context(order) -> dict[str, Any]:
    """Build the template context for an order from its grants/purchases."""
    from delivery.services import serialize_grant

    downloads = []
    for grant in order.download_grants.all():
        item = serialize_grant(grant)
        downloads.append(
            {
                "title": item["title"],
                "downloadUrl": _absolute_download_url(item["downloadUrl"]),
                "expiresAt": item["expiresAt"],
            }
        )

    lines = [
        {"title": p.title, "quantity": p.quantity}
        for p in order.purchases.all()
    ]

    total_display = f"{order.total:.2f} {order.currency}"
    library_url = f"{settings.FRONTEND_URL.rstrip('/')}/account"

    return {
        "order_id": order.shopify_order_id,
        "email": order.email,
        "lines": lines,
        "downloads": downloads,
        "total_display": total_display,
        "library_url": library_url,
        "support_email": settings.SUPPORT_EMAIL,
        "frontend_url": settings.FRONTEND_URL.rstrip("/"),
    }


def render_order_confirmation(order) -> tuple[str, str, str]:
    """Render (subject, text_body, html_body) for an order confirmation."""
    context = _confirmation_context(order)
    subject = "Your Looks are ready — The Looks Lab"
    text_body = render_to_string("email/order_confirmation.txt", context)
    html_body = render_to_string("email/order_confirmation.html", context)
    return subject, text_body, html_body


def send_order_confirmation(order) -> bool:
    """Render and send the order-confirmation email for ``order``.

    Returns ``True`` if a message was handed to the email backend. Does not
    enforce idempotency itself — callers (webhook ingest / resend) decide
    whether to send. Raises nothing on a successful send; mail-backend errors
    propagate so callers can decide how to handle them.
    """
    if not order.email:
        return False
    subject, text_body, html_body = render_order_confirmation(order)
    message = EmailMultiAlternatives(
        subject=subject,
        body=text_body,
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=[order.email],
    )
    message.attach_alternative(html_body, "text/html")
    message.send()
    return True
