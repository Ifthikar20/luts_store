"""
Exercise the full post-purchase pipeline WITHOUT Shopify.

Synthesizes a Shopify ``orders/paid``-shaped payload from the given product
handles and runs it through ``orders.services.ingest_paid_order`` exactly as the
webhook would: Order + Purchase rows are created, DownloadGrants are issued, and
the confirmation email is sent (printed to stdout under the dev console
backend).

Usage::

    python manage.py simulate_order --email buyer@example.com \
        --handle midnight-noir --handle dji-aerial-vivid

Each ``--handle`` becomes a line item. Titles/prices are pulled from the catalog
(mock fixture in MOCK_MODE) when available, falling back to a title-cased handle.
A unique synthetic order id is generated each run so re-running creates a fresh
order (and a fresh email); pass ``--order-id`` to control idempotency manually.
"""
from __future__ import annotations

import uuid
from decimal import Decimal

from django.core.management.base import BaseCommand, CommandError

from catalog import services as catalog_services
from orders import services as order_services


class Command(BaseCommand):
    help = "Simulate a paid Shopify order to exercise the email pipeline."

    def add_arguments(self, parser):
        parser.add_argument(
            "--email",
            required=True,
            help="Buyer email the confirmation is sent to.",
        )
        parser.add_argument(
            "--handle",
            dest="handles",
            action="append",
            required=True,
            help="Product handle to purchase (repeat for multiple).",
        )
        parser.add_argument(
            "--order-id",
            dest="order_id",
            default=None,
            help="Override the synthetic Shopify order id (default: random).",
        )
        parser.add_argument(
            "--currency",
            default="USD",
            help="Currency code for the synthesized order (default: USD).",
        )

    def handle(self, *args, **options):
        email = options["email"]
        handles = options["handles"]
        currency = options["currency"]
        order_id = options["order_id"] or f"sim-{uuid.uuid4().hex[:12]}"

        line_items = []
        total = Decimal("0")
        for handle in handles:
            product = catalog_services.get_product(handle)
            if product is not None:
                title = product.get("title") or handle
                amount = Decimal(
                    str(product["priceRange"]["min"]["amount"])
                )
            else:
                title = handle.replace("-", " ").title()
                amount = Decimal("0")
            total += amount
            line_items.append(
                {
                    "title": title,
                    "handle": handle,
                    "quantity": 1,
                    "price": f"{amount:.2f}",
                }
            )

        payload = {
            "id": order_id,
            "email": email,
            "currency": currency,
            "total_price": f"{total:.2f}",
            "line_items": line_items,
        }

        try:
            order, created = order_services.ingest_paid_order(payload)
        except ValueError as exc:
            raise CommandError(str(exc)) from exc

        # ``ingest_paid_order`` schedules the email via ``transaction.on_commit``.
        # Run explicitly so the command reliably prints the email regardless of
        # surrounding transaction state (e.g. invoked from a test inside an
        # atomic block where on_commit callbacks would not fire).
        #   * fresh order: force=False -> sends only if on_commit hasn't already
        #     (the sent flag guards against a double send in standalone runs).
        #   * replay (existing order): force=True -> re-send the confirmation.
        if created:
            order_services.send_confirmation_email(order.id, force=False)
        else:
            self.stdout.write(
                self.style.WARNING(
                    f"Order {order_id} already existed; re-sending confirmation."
                )
            )
            order_services.send_confirmation_email(order.id, force=True)

        grant_count = order.download_grants.count()
        self.stdout.write(
            self.style.SUCCESS(
                f"Ingested order {order.shopify_order_id} for {email}: "
                f"{order.purchases.count()} line(s), {grant_count} grant(s). "
                f"Confirmation email sent to the configured EMAIL_BACKEND above."
            )
        )
