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
        self._check_media_pipeline()
        self._check_google()
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

    # ----------------------------------------------------- Media / CDN pipeline
    def _check_media_pipeline(self):
        """Report CDN delivery + MediaConvert transcode configuration."""
        self.stdout.write(
            self.style.MIGRATE_HEADING("\n== Preview media (CDN + transcode) ==")
        )
        cdn = getattr(settings, "CDN_BASE_URL", "")
        if cdn:
            self.stdout.write(f"  {OK} CDN delivery on — preview assets via {cdn}")
            try:
                r = requests.head(cdn, timeout=10, allow_redirects=True)
                self.stdout.write(
                    f"  {OK} CDN reachable (HTTP {r.status_code})"
                    if r.status_code < 500
                    else f"  {WARN} CDN returned {r.status_code}"
                )
            except requests.RequestException as exc:
                self.stdout.write(f"  {WARN} CDN unreachable ({exc})")
        else:
            self.stdout.write(
                f"  {WARN} CDN_BASE_URL unset — preview assets served via "
                f"presigned /api/media redirects. {DIM}(set up CloudFront for "
                f"edge caching){RST}"
            )

        if settings.TRANSCODE_ENABLED:
            self.stdout.write(
                f"  {OK} MediaConvert on — preview clips transcode to adaptive HLS"
            )
            self.stdout.write(
                f"  role={_redact(settings.MEDIACONVERT_ROLE_ARN)} "
                f"queue={settings.MEDIACONVERT_QUEUE_ARN or '(account default)'}"
            )
            try:
                from delivery import transcode

                transcode.get_client()  # resolves the account endpoint
                self.stdout.write(f"  {OK} MediaConvert endpoint resolved")
            except Exception as exc:
                self.failures.append(
                    f"MediaConvert: cannot resolve endpoint/client ({exc})"
                )
        else:
            self.stdout.write(
                f"  {WARN} MEDIACONVERT_ROLE_ARN unset — uploaded clips stored "
                f"as-is (served progressively, no HLS). {DIM}(run aws/02-iam.sh "
                f"to create the role){RST}"
            )

    # --------------------------------------------------------------- Google
    def _check_google(self):
        """Confirm 'Sign in with Google' will redirect to Google (read-only).

        Enabled requires BOTH GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET. We also
        validate the redirect URI Google will see: it must be HTTPS on a real
        hostname — Google rejects plain http and raw IP addresses, the most
        common reason the button silently stays in demo mode in production.
        """
        from urllib.parse import urlparse

        self.stdout.write(self.style.MIGRATE_HEADING("\n== Sign-in with Google =="))
        if not settings.GOOGLE_OAUTH_ENABLED:
            self.stdout.write(
                f"  {WARN} Not configured — set GOOGLE_CLIENT_ID + "
                "GOOGLE_CLIENT_SECRET to enable. "
                f"{DIM}(button falls back to the demo email login){RST}"
            )
            return

        redirect_uri = settings.GOOGLE_REDIRECT_URI
        self.stdout.write(
            f"  client_id={_redact(settings.GOOGLE_CLIENT_ID)} "
            f"secret={_redact(settings.GOOGLE_CLIENT_SECRET)}"
        )
        self.stdout.write(f"  redirect_uri={redirect_uri}")

        parsed = urlparse(redirect_uri)
        host = parsed.hostname or ""
        is_ip = bool(host) and all(part.isdigit() for part in host.split("."))
        if parsed.scheme != "https":
            self.failures.append(
                "Google: GOOGLE_REDIRECT_URI must be https (Google rejects http) — "
                f"got {redirect_uri}. Deploy with a real domain (USE_IP=0)."
            )
        elif is_ip or host in ("localhost", "127.0.0.1"):
            self.failures.append(
                "Google: GOOGLE_REDIRECT_URI host must be a real domain — Google "
                f"does not allow IPs/localhost ({host}). Deploy with USE_IP=0."
            )
        else:
            self.stdout.write(
                f"  {OK} redirect URI looks valid — register it EXACTLY in the "
                "Google client's Authorized redirect URIs."
            )

        # Read-only reachability check of Google's OIDC discovery doc. Confirms
        # outbound connectivity to Google; does not use the secret.
        try:
            disc = requests.get(
                "https://accounts.google.com/.well-known/openid-configuration",
                timeout=10,
            )
            if disc.status_code == 200 and disc.json().get("authorization_endpoint"):
                self.stdout.write(f"  {OK} Google OIDC reachable")
            else:
                self.stdout.write(
                    f"  {WARN} Google OIDC discovery returned {disc.status_code}"
                )
        except requests.RequestException as exc:
            self.stdout.write(f"  {WARN} Google OIDC unreachable ({exc})")

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
