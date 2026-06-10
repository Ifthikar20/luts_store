"""
Manually refund an order: revoke its download grants + send the notice email.

    python manage.py refund_order <order_id>

``<order_id>`` is the external order id shown on the thank-you page / in the
admin (e.g. ``stripe-cs_…`` or ``mock-checkout-…``). Idempotent — refunding an
already-refunded order is a no-op.

NOTE: this revokes ACCESS only. Returning the customer's money happens in the
payment provider (Stripe dashboard refund — which also fires charge.refunded
and would do this revocation automatically — or your manual process).
"""
from __future__ import annotations

from django.core.management.base import BaseCommand, CommandError

from orders.models import Order
from orders.services import refund_order


class Command(BaseCommand):
    help = "Revoke download grants for an order (mark refunded, notify buyer)."

    def add_arguments(self, parser):
        parser.add_argument("order_id", help="External order id (shopify_order_id)")

    def handle(self, *args, **options):
        order_id = options["order_id"]
        order = Order.objects.filter(shopify_order_id=order_id).first()
        if order is None:
            raise CommandError(f"No order found with id {order_id!r}")

        if refund_order(order):
            revoked = order.download_grants.filter(revoked_at__isnull=False).count()
            self.stdout.write(
                self.style.SUCCESS(
                    f"Refunded {order_id}: revoked {revoked} grant(s), "
                    f"notice queued to {order.email or '(no email)'}"
                )
            )
        else:
            self.stdout.write(f"{order_id} was already refunded — nothing to do.")
