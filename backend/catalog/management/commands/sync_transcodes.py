"""
Poll MediaConvert for in-flight preview transcodes and update their status.

Preview-video transcodes are asynchronous: ``Product.save()`` submits the job
and records ``transcode_status = "SUBMITTED"``. This command asks MediaConvert
for the current status of every product whose job is not yet terminal and writes
it back, so ``COMPLETE`` jobs start serving HLS on the storefront.

Run it on a schedule (cron / systemd timer), e.g. every few minutes:

    python manage.py sync_transcodes
"""
from __future__ import annotations

from django.core.management.base import BaseCommand

from catalog.models import Product
from delivery import transcode

TERMINAL = {"COMPLETE", "ERROR", "CANCELED"}


class Command(BaseCommand):
    help = "Refresh preview-video transcode statuses from MediaConvert."

    def handle(self, *args, **opts):
        if not transcode.transcode_enabled():
            self.stdout.write("MediaConvert not configured — nothing to do.")
            return

        pending = Product.objects.exclude(transcode_job_id="").exclude(
            transcode_status__in=TERMINAL
        )
        updated = 0
        for product in pending:
            try:
                status = transcode.job_status(product.transcode_job_id)
            except Exception as exc:
                self.stderr.write(f"{product.handle}: {exc}")
                continue
            if status != product.transcode_status:
                product.transcode_status = status
                product.save(update_fields=["transcode_status"])
                updated += 1
                self.stdout.write(f"{product.handle} → {status}")
        self.stdout.write(self.style.SUCCESS(f"Updated {updated} product(s)."))
