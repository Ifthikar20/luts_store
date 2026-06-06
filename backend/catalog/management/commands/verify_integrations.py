"""
Live integration verifier.

Run AFTER setting real AWS S3 and/or Shopify credentials in the environment:

    python manage.py verify_integrations

It performs read-only connectivity checks and prints actionable, secret-redacted
diagnostics. It does NOT mutate anything in S3 or Shopify. Exit code is non-zero
if any *configured* integration fails a check (so it is CI/deploy friendly).

Checks:
  * Mode summary (MOCK_MODE, S3_DELIVERY_ENABLED).
  * S3 (when AWS keys + bucket set): client builds, bucket is reachable
    (head_bucket), each catalog product's server-derived object key exists
    (head_object), and a presigned URL can be minted (TTL shown).
  * Shopify (when Storefront token set): Storefront GraphQL reachable, Admin
    API reachable (shop.json), webhook secret present, and an orders/paid
    webhook is registered pointing at the expected address.
"""
from __future__ import annotations

import requests
from django.conf import settings
from django.core.management.base import BaseCommand

OK = "\033[32m✓\033[0m"
FAIL = "\033[31m✗\033[0m"
WARN = "\033[33m!\033[0m"
DIM = "\033[2m"
RST = "\033[0m"


def _redact(value: str) -> str:
    """Show only the last 4 chars of a secret."""
    if not value:
        return "(unset)"
    return f"…{value[-4:]}" if len(value) > 4 else "****"


class Command(BaseCommand):
    help = "Verify live S3 and Shopify integrations (read-only)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--limit",
            type=int,
            default=0,
            help="Check only the first N product files in S3 (0 = all).",
        )

    def handle(self, *args, **opts):
        self.failures: list[str] = []

        self.stdout.write(self.style.MIGRATE_HEADING("\n== Mode =="))
        self.stdout.write(
            f"  MOCK_MODE            : {settings.MOCK_MODE}  "
            f"{DIM}(off when SHOPIFY_STOREFRONT_TOKEN is set){RST}"
        )
        self.stdout.write(
            f"  S3_DELIVERY_ENABLED : {settings.S3_DELIVERY_ENABLED}  "
            f"{DIM}(on when AWS keys + bucket set){RST}"
        )

        self._check_s3(opts["limit"])
        self._check_shopify()

        self.stdout.write(self.style.MIGRATE_HEADING("\n== Result =="))
        if self.failures:
            for f in self.failures:
                self.stdout.write(f"  {FAIL} {f}")
            self.stderr.write(
                self.style.ERROR(
                    f"\n{len(self.failures)} check(s) failed.\n"
                )
            )
            raise SystemExit(1)
        self.stdout.write(self.style.SUCCESS("  All configured checks passed.\n"))

    # ------------------------------------------------------------------ S3
    def _check_s3(self, limit: int):
        self.stdout.write(self.style.MIGRATE_HEADING("\n== S3 digital delivery =="))
        if not settings.S3_DELIVERY_ENABLED:
            self.stdout.write(
                f"  {WARN} Not configured — set AWS_ACCESS_KEY_ID, "
                "AWS_SECRET_ACCESS_KEY, AWS_S3_BUCKET to enable. "
                f"{DIM}(mock mode streams a placeholder .cube){RST}"
            )
            return

        self.stdout.write(
            f"  bucket={settings.AWS_S3_BUCKET} region={settings.AWS_S3_REGION} "
            f"key={_redact(settings.AWS_ACCESS_KEY_ID)} "
            f"endpoint={settings.AWS_S3_ENDPOINT_URL or '(default AWS)'} "
            f"ttl={settings.DOWNLOAD_URL_TTL}s"
        )

        try:
            from botocore.exceptions import ClientError, BotoCoreError
            from delivery.storage import get_s3_client, presigned_download_url
        except Exception as exc:  # pragma: no cover - import guard
            self.failures.append(f"S3: cannot import boto3/storage ({exc})")
            return

        client = get_s3_client()

        # 1) bucket reachable
        try:
            client.head_bucket(Bucket=settings.AWS_S3_BUCKET)
            self.stdout.write(f"  {OK} bucket reachable (head_bucket)")
        except (ClientError, BotoCoreError) as exc:
            self.failures.append(
                f"S3: head_bucket failed — check bucket name/region/IAM ({exc})"
            )
            return

        # 2) every product's server-derived object key exists
        from catalog.mockdata import PRODUCTS, file_key_for_handle

        handles = [p["handle"] for p in PRODUCTS]
        if limit:
            handles = handles[:limit]
        missing = 0
        for handle in handles:
            key = file_key_for_handle(handle)
            try:
                client.head_object(Bucket=settings.AWS_S3_BUCKET, Key=key)
            except (ClientError, BotoCoreError):
                missing += 1
                self.stdout.write(f"  {FAIL} missing object: {key}")
        if missing:
            self.failures.append(
                f"S3: {missing}/{len(handles)} product files missing — "
                "upload your .zip files at the keys above."
            )
        else:
            self.stdout.write(
                f"  {OK} all {len(handles)} product objects present"
            )

        # 3) presign works
        try:
            url = presigned_download_url(
                file_key_for_handle(handles[0]), "sample.cube"
            )
            self.stdout.write(
                f"  {OK} presigned URL minted "
                f"{DIM}({url.split('?')[0]}?…SigV4, expires {settings.DOWNLOAD_URL_TTL}s){RST}"
            )
        except Exception as exc:
            self.failures.append(f"S3: presign failed ({exc})")

    # -------------------------------------------------------------- Shopify
    def _check_shopify(self):
        self.stdout.write(self.style.MIGRATE_HEADING("\n== Shopify =="))
        if settings.MOCK_MODE:
            self.stdout.write(
                f"  {WARN} MOCK_MODE on — set SHOPIFY_STOREFRONT_TOKEN to go live. "
                f"{DIM}(catalog/cart served from mock fixtures){RST}"
            )
            return

        domain = settings.SHOPIFY_STORE_DOMAIN
        self.stdout.write(
            f"  domain={domain} "
            f"storefront={_redact(settings.SHOPIFY_STOREFRONT_TOKEN)} "
            f"admin={_redact(settings.SHOPIFY_ADMIN_TOKEN)} "
            f"webhook_secret={_redact(settings.SHOPIFY_WEBHOOK_SECRET)}"
        )

        # 1) Storefront GraphQL
        try:
            sf = requests.post(
                f"https://{domain}/api/{settings.SHOPIFY_STOREFRONT_API_VERSION}/graphql.json",
                json={"query": "{ shop { name } }"},
                headers={
                    "X-Shopify-Storefront-Access-Token": settings.SHOPIFY_STOREFRONT_TOKEN,
                    "Content-Type": "application/json",
                },
                timeout=10,
            )
            name = sf.json().get("data", {}).get("shop", {}).get("name")
            if sf.status_code == 200 and name:
                self.stdout.write(f"  {OK} Storefront API ok (shop: {name})")
            else:
                self.failures.append(
                    f"Shopify: Storefront API returned {sf.status_code} "
                    f"{DIM}{sf.text[:120]}{RST}"
                )
        except requests.RequestException as exc:
            self.failures.append(f"Shopify: Storefront API unreachable ({exc})")

        # 2) Admin API (shop.json)
        if not settings.SHOPIFY_ADMIN_TOKEN.strip():
            self.stdout.write(
                f"  {WARN} Admin token unset — order reads/fulfillment limited."
            )
        else:
            try:
                ad = requests.get(
                    f"https://{domain}/admin/api/{settings.SHOPIFY_ADMIN_API_VERSION}/shop.json",
                    headers={"X-Shopify-Access-Token": settings.SHOPIFY_ADMIN_TOKEN},
                    timeout=10,
                )
                if ad.status_code == 200:
                    self.stdout.write(f"  {OK} Admin API ok")
                    self._check_webhook(domain, ad)
                else:
                    self.failures.append(
                        f"Shopify: Admin API returned {ad.status_code} — "
                        "check token/scopes."
                    )
            except requests.RequestException as exc:
                self.failures.append(f"Shopify: Admin API unreachable ({exc})")

        # 3) webhook secret presence (HMAC verification depends on it)
        if not settings.SHOPIFY_WEBHOOK_SECRET.strip():
            self.failures.append(
                "Shopify: SHOPIFY_WEBHOOK_SECRET unset — orders/paid webhooks "
                "will fail HMAC verification (no fulfillment/email)."
            )

    def _check_webhook(self, domain: str, _admin_resp):
        """Confirm an orders/paid webhook points at our endpoint."""
        try:
            wh = requests.get(
                f"https://{domain}/admin/api/{settings.SHOPIFY_ADMIN_API_VERSION}/webhooks.json",
                headers={"X-Shopify-Access-Token": settings.SHOPIFY_ADMIN_TOKEN},
                timeout=10,
            )
            hooks = wh.json().get("webhooks", []) if wh.status_code == 200 else []
        except requests.RequestException:
            hooks = []
        expected = f"{settings.API_BASE_URL}/api/webhooks/shopify/orders-paid"
        paid = [h for h in hooks if h.get("topic") == "orders/paid"]
        if not paid:
            self.failures.append(
                f"Shopify: no orders/paid webhook registered (expected → {expected})"
            )
        elif not any(h.get("address") == expected for h in paid):
            addrs = ", ".join(h.get("address", "?") for h in paid)
            self.stdout.write(
                f"  {WARN} orders/paid webhook(s) exist but address mismatch: "
                f"{addrs} (expected {expected})"
            )
        else:
            self.stdout.write(f"  {OK} orders/paid webhook → {expected}")
