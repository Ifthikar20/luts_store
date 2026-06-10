# Security model — Luts.store

How the store defends the things that matter: **money** (nobody gets paid
product without paying), **files** (nobody downloads without a grant), and
**data** (no card data, minimal PII). This documents what is enforced in code,
what was considered, and the challenges that remain for the operator.

---

## 1. Payments (Stripe Checkout)

| Threat | Defense |
| --- | --- |
| Card data exposure / PCI scope | **No card data ever touches our servers.** Stripe's hosted Checkout page collects it; we qualify for PCI **SAQ-A** (the lightest level). |
| Client-side price tampering | The client never sends prices. `POST /api/checkout` re-resolves the cart **server-side** and builds Stripe line items from catalog prices. |
| Forged "payment succeeded" webhooks | `/api/webhooks/stripe` verifies the `Stripe-Signature` header (HMAC over the exact raw body, with timestamp tolerance) against `STRIPE_WEBHOOK_SECRET`. Invalid → 400, no side effects. |
| Webhook replay | Ingestion is **idempotent** — orders key on `stripe-<session_id>`; replays return the existing order and send no second email. |
| **Cart mutation during payment** | The session stores a **metadata snapshot of the paid lines** at creation time. The webhook grants downloads from that snapshot — *not* the live cart, which the shopper could mutate in another tab while on Stripe's card page. (Regression-tested.) |
| Success-redirect spoofing | Visiting `/thank-you?order=stripe-<id>` with a made-up id doesn't mint anything: the backend retrieves the session **from Stripe** and ingests only if `payment_status == "paid"`. |

Same pattern for the Shopify path: `orders/paid` webhooks are HMAC-SHA256
verified (constant-time compare) and idempotent by order id.

## 2. Digital file delivery

- Download links are **HMAC-signed, expiring tokens** (`django.core.signing`,
  salted, default 24 h). Tampering with one byte or the product handle → 403.
- The S3 object key is **derived server-side** from the granted product handle
  (`luts/<handle>.zip`) — never read from the token or request → no path
  traversal, no arbitrary-object reads.
- Real delivery 302-redirects to a **presigned S3 URL with a 60-second TTL**;
  a leaked URL dies almost immediately. The bucket stays fully private.
- The download endpoint is throttled (60/min) against scraping/brute force.

## 3. API abuse & enumeration

- **Rate limits**: global anon/user throttles plus a stricter `sensitive`
  bucket (5/min) on order-creating / email-sending endpoints, and `auth`
  (10/min) on login/register.
- **Non-enumerating responses**: login errors, "resend downloads", newsletter
  and contact endpoints return identical responses whether or not the email
  exists — no account/purchase enumeration.
- Auth: DRF tokens (hashed Django passwords) or an httpOnly session cookie via
  Shopify OAuth + PKCE. No JWT in localStorage. CORS is locked to the exact
  frontend origin; CSRF/session cookies are `HttpOnly` + `SameSite=Lax`.
- **Payload obfuscation (deterrent only):** the storefront wraps JSON POST
  bodies in an encoded envelope that the backend unwraps transparently
  (`common/obfuscation.py`), so payloads aren't casually readable in DevTools
  or trivially replayed. The key ships in the JS bundle by necessity — this is
  explicitly NOT a security boundary; TLS + server-side validation are.

## 4. Secrets & configuration

- All secrets live in `backend/.env` (git-ignored) / the deploy environment.
  The frontend receives only `NEXT_PUBLIC_*` values and holds no secrets.
- Behind TLS, set: `DEBUG=False`, strong `SECRET_KEY`, `ALLOWED_HOSTS`,
  `SECURE_SSL_REDIRECT`, `SECURE_HSTS_SECONDS`, `SESSION_COOKIE_SECURE`,
  `CSRF_COOKIE_SECURE` (all env-driven; see `DEPLOYMENT.md`).

---

## 5. Known challenges / residual risks (operator action)

These are honest gaps — none block launch, but you should know them:

1. ~~**Refunds don't revoke downloads.**~~ **Fixed:** the Stripe
   `charge.refunded` webhook (and `manage.py refund_order <id>`) revokes the
   order's grants — downloads 403, library/confirmation hide them, buyer is
   notified. Residual: refunds made entirely outside Stripe (e.g. a manual bank
   transfer) still require running the management command.
2. **Digital goods fraud is a business risk, not a code bug.** Stolen-card
   purchases + instant download = unrecoverable product. Enable **Stripe
   Radar**, and consider delaying high-value bundle delivery emails by a few
   minutes.
3. **Oversized-cart snapshot fallback.** If a cart's line snapshot exceeds
   Stripe's 500-char metadata cap (≈15+ distinct items), the webhook falls back
   to the live cart, reopening the mutation window for that rare case. Fix if
   carts grow: persist a server-side snapshot keyed by session id.
4. **Token lifetime trade-off.** A forwarded confirmation email = working
   download links for 24 h (`DOWNLOAD_TOKEN_MAX_AGE`). That's a deliberate
   guest-UX choice; shorten it or require login if leakage matters more.
5. **Throttling is per-process memory** (LocMemCache). Behind multiple gunicorn
   workers/replicas the effective rate multiplies. Point Django's cache at
   Redis in production for accurate global limits.
6. **Operational security is yours**: TLS/HSTS at the proxy, Postgres backups,
   dependency updates (`pip-audit` / `npm audit`), log monitoring, and keeping
   `/admin/` off the public internet (IP allowlist or separate host).
7. **No `security.txt` / disclosure policy yet** — add one if the store gets
   real traffic.

## 6. What an attacker *cannot* do (tested)

- Buy at a tampered price (server-side pricing; signed webhooks).
- Get grants for items added to the cart after paying (snapshot test).
- Mint orders by guessing thank-you URLs (Stripe-verified `paid` status).
- Forge/replay webhooks (signature + idempotency tests, both providers).
- Download without a grant, after expiry, or for a different product
  (tamper/expiry/path-traversal tests).
- Enumerate accounts or purchases via auth/resend endpoints (tests).

Run the suite: `cd backend && python -m pytest` (103 tests).
