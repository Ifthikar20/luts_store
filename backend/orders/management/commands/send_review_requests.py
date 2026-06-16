"""
Email buyers a "leave a review" invitation a few days after purchase.

Idempotent (one invite per order via ``Order.review_request_sent_at``) and
best-effort (a mail failure for one order never blocks the rest). Run on a
schedule (cron / systemd timer), e.g. daily:

    python manage.py send_review_requests           # default: orders >= 3 days old
    python manage.py send_review_requests --days 5
    python manage.py send_review_requests --dry-run
"""
from __future__ import annotations

from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from delivery.emails import send_review_request
from orders.models import Order


class Command(BaseCommand):
    help = "Send post-purchase review-invitation emails (idempotent)."

    def add_arguments(self, parser):
        parser.add_argument("--days", type=int, default=3, help="Min order age in days.")
        parser.add_argument("--limit", type=int, default=500, help="Max emails per run.")
        parser.add_argument("--dry-run", action="store_true", help="Don't send/mark.")

    def handle(self, *args, **opts):
        cutoff = timezone.now() - timedelta(days=opts["days"])
        qs = (
            Order.objects.filter(
                review_request_sent_at__isnull=True,
                refunded_at__isnull=True,
                created_at__lte=cutoff,
            )
            .exclude(email="")
            .order_by("created_at")[: opts["limit"]]
        )

        sent = 0
        for order in qs:
            if opts["dry_run"]:
                self.stdout.write(f"would email {order.email} (order {order.shopify_order_id})")
                continue
            try:
                if send_review_request(order):
                    Order.objects.filter(pk=order.pk).update(
                        review_request_sent_at=timezone.now()
                    )
                    sent += 1
            except Exception as exc:  # noqa: BLE001 - one failure mustn't stop the batch
                self.stderr.write(f"{order.shopify_order_id}: {exc}")

        self.stdout.write(self.style.SUCCESS(f"Sent {sent} review invitation(s)."))
