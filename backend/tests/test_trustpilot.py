"""Trustpilot AFS: confirmation email is BCC'd to Trustpilot only when configured."""
import pytest
from django.core import mail

from delivery.emails import send_order_confirmation
from orders.models import Order

pytestmark = pytest.mark.django_db


def _order():
    return Order.objects.create(
        shopify_order_id="tp-1", email="buyer@example.com", total=45, currency="USD"
    )


def test_no_bcc_when_unconfigured(settings):
    settings.TRUSTPILOT_AFS_BCC = ""
    mail.outbox.clear()
    assert send_order_confirmation(_order()) is True
    assert mail.outbox[0].bcc == []


def test_bcc_added_when_configured(settings):
    settings.TRUSTPILOT_AFS_BCC = "abc123+luts@invite.trustpilot.com"
    mail.outbox.clear()
    assert send_order_confirmation(_order()) is True
    msg = mail.outbox[0]
    assert msg.to == ["buyer@example.com"]
    assert msg.bcc == ["abc123+luts@invite.trustpilot.com"]
