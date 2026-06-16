"""Post-purchase review-invitation email + the send_review_requests command."""
from datetime import timedelta

import pytest
from django.core import mail
from django.core.management import call_command
from django.utils import timezone

from delivery.models import DownloadGrant
from orders.models import Order

pytestmark = pytest.mark.django_db


def _old_order(email="buyer@example.com", days=5):
    order = Order.objects.create(
        shopify_order_id=f"rr-{email}", email=email, total=45, currency="USD"
    )
    DownloadGrant.objects.create(
        order=order, email=email, product_handle="midnight-noir"
    )
    # Backdate so it passes the age cutoff.
    Order.objects.filter(pk=order.pk).update(
        created_at=timezone.now() - timedelta(days=days)
    )
    return order


def test_command_sends_once_and_is_idempotent():
    order = _old_order()
    mail.outbox.clear()
    call_command("send_review_requests", "--days", "3")
    assert len(mail.outbox) == 1
    msg = mail.outbox[0]
    assert msg.to == ["buyer@example.com"]
    assert "review" in msg.subject.lower()
    order.refresh_from_db()
    assert order.review_request_sent_at is not None

    # Second run sends nothing (already invited).
    mail.outbox.clear()
    call_command("send_review_requests", "--days", "3")
    assert len(mail.outbox) == 0


def test_recent_and_refunded_orders_are_skipped():
    _old_order(days=1)  # too recent
    refunded = _old_order(email="ref@example.com", days=9)
    Order.objects.filter(pk=refunded.pk).update(refunded_at=timezone.now())
    mail.outbox.clear()
    call_command("send_review_requests", "--days", "3")
    assert len(mail.outbox) == 0
