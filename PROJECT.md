# Project overview & status — Luts.store

A storefront for selling video color-grading **LUTs** (`.cube`/`.zip` digital
downloads): browse → cart → pay → instant download links + email receipt, with
an optional account/library for re-downloads.

**This file is the orientation page:** what the project is, how it's wired,
what state it's in, and exactly what's left to do.

## The 60-second tour

| Layer | Tech | Role |
| --- | --- | --- |
| `frontend/` | Next.js (App Router), Tailwind, Framer Motion | Apple-style storefront UI. Holds **no secrets**; all data via the BFF. |
| `backend/` | Django + DRF (~50 endpoints, 12 apps) | The BFF: catalog, cart, checkout, orders, signed download delivery, auth, email. Owns all secrets + the DB. |
| Payments | **Stripe Checkout** (hosted) — or Shopify hosted checkout | Card data never touches our servers (PCI SAQ-A). |
| Files | Private S3/R2, presigned 60-second URLs | Signed, expiring grant tokens per purchase. |

**The money path:** cart → `POST /api/checkout` → Stripe hosted card page →
Stripe webhook (signature-verified) → `ingest_paid_order()` → Order +
DownloadGrants + receipt email → thank-you page with signed download links.

**Dual-mode everywhere:** with no keys configured, every subsystem runs a
realistic demo (fixture catalog, fake checkout, generated `.cube`, console
email). Adding a key to `backend/.env` switches that subsystem live — no code
changes. That's why the repo works out-of-the-box AND is production-ready.

## Doc map

| Read… | For… |
| --- | --- |
| `README.md` | Local dev quick-start |
| `ARCHITECTURE.md` + `docs/architecture.svg` | System design & request flows |
| `GOING_LIVE.md` | Flipping each subsystem live (Stripe/S3/SMTP/Shopify) |
| `SECURITY.md` | Threat model, defenses, residual risks |
| `DEPLOYMENT.md` | Full env-var reference & hardening |
| `deploy.sh` | One-shot Docker deploy (`./deploy.sh`) |
| `docs/user-navigation.svg` | Page/flow map of the storefront |

## Current state

**Done & tested (103 backend tests, frontend builds clean):**
- Full storefront UI (home, collections, product, search+filters, cart,
  checkout, thank-you, account/library, policies, contact/help)
- Cart & catalog APIs (mock + live-Shopify code paths)
- **Stripe Checkout payments** end-to-end (sessions, signed webhook,
  paid-lines snapshot, thank-you fallback)
- Orders: idempotent ingestion, receipt email (once per order), resend
- Secure delivery: HMAC grant tokens, presigned S3, throttling, anti-traversal
- Accounts: token auth + optional Shopify OAuth session; download library
- Docker images + compose stack + `deploy.sh`

## TODO — required before taking real money

These are **operator inputs** (keys/files), not code:

1. **Stripe keys** → `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` in
   `backend/.env`; create the webhook endpoint (`checkout.session.completed` →
   `https://<api-host>/api/webhooks/stripe`). Test with `sk_test_…` first.
2. **Product files** → upload real `luts/<handle>.zip` archives to a private
   S3/R2 bucket; set the `AWS_*` vars.
3. **Email** → SMTP creds (`EMAIL_*`), sender domain with SPF/DKIM.
4. **Hosting** → run `./deploy.sh` on a server; put TLS (Caddy/nginx/CDN) in
   front; set `ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS`, `CSRF_TRUSTED_ORIGINS`,
   `FRONTEND_URL`, `API_BASE_URL`, `NEXT_PUBLIC_*`, and the `SECURE_*` flags.
5. **Catalog truth** → either keep the in-repo catalog (edit
   `backend/catalog/mockdata.py` with your real products/prices) or connect
   Shopify (`SHOPIFY_STOREFRONT_TOKEN`).

## TODO — recommended next (code, in priority order)

1. **Refund handling** — listen to Stripe `charge.refunded` and revoke the
   order's DownloadGrants (see SECURITY.md §5.1). ~half-day.
2. **Redis cache in production** — accurate global rate limits across gunicorn
   workers (currently per-process LocMem). ~1 hour.
3. **Server-side paid-lines snapshot** — replace the 500-char Stripe-metadata
   snapshot with a DB row keyed by session id; removes the oversized-cart
   fallback. ~half-day.
4. **Ops hygiene** — error tracking (Sentry), uptime checks, DB backups,
   `pip-audit`/`npm audit` in CI.
5. **Admin hardening** — IP-allowlist `/admin/`, or disable it publicly.

## TODO — nice-to-have / product ideas

- Discount codes (Stripe Coupons/Promotion Codes plug straight in)
- Customer reviews / ratings on product pages
- Real preview videos per product (current clips are placeholders)
- Analytics (privacy-friendly: Plausible/Fathom) + conversion events
- Sales tax/VAT via Stripe Tax if selling into the EU/UK at volume

(CI already exists: `.github/workflows/ci.yml` runs backend pytest + frontend
lint/tsc/test/build on every push and PR.)
