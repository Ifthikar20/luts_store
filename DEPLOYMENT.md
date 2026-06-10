# Deployment & Production Hardening — The Looks Lab

This guide covers running the LUTs store in a production-like environment:
environment variables, secrets, switching from mock mode to live Shopify,
Postgres, gunicorn/static files, TLS/security headers, CORS/CSRF, email, S3 file
delivery, and the bundled `docker-compose` stack.

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the system design and request flows.

---

## 1. Topology

```
Browser ──► Next.js (storefront, :3000) ──► Django BFF (:8000) ──► Stripe / Shopify / Postgres / S3
```

- The **frontend** holds no secrets; it only receives `NEXT_PUBLIC_*` values.
- The **backend** owns all secrets, the database, webhook handling, and signed
  download links.
- **Payments**: Stripe Checkout (hosted; active when `STRIPE_SECRET_KEY` is set —
  see GOING_LIVE.md) or Shopify's hosted checkout. Card data never touches this stack.
- **Shopify** (optional) supplies the live catalog/cart; without it the in-repo
  mock catalog serves the storefront (a valid combo with live Stripe payments).

---

## 2. Environment variables

### Backend (`backend/.env`)

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `SECRET_KEY` | **Yes (prod)** | insecure dev fallback | Django cryptographic key. Set a strong random value. |
| `DEBUG` | No | `False` | Never `True` in production. |
| `ALLOWED_HOSTS` | **Yes (prod)** | `localhost,127.0.0.1` | Comma-separated hostnames Django will serve. |
| `CORS_ALLOWED_ORIGINS` | **Yes (prod)** | `http://localhost:3000` | Exact frontend origin(s). Never opened to `*`. |
| `CSRF_TRUSTED_ORIGINS` | **Yes (prod)** | `http://localhost:3000` | Scheme+host of the frontend for CSRF. |
| `DATABASE_URL` | Recommended | empty → SQLite | Postgres DSN, e.g. `postgres://user:pass@host:5432/luts`. |
| `SECURE_SSL_REDIRECT` | Prod | `False` | Redirect HTTP→HTTPS. Enable behind TLS. |
| `SECURE_HSTS_SECONDS` | Prod | `0` | HSTS max-age (e.g. `31536000`). Also enables subdomains+preload when >0. |
| `SESSION_COOKIE_SECURE` | Prod | `False` | Send session cookie over HTTPS only. |
| `CSRF_COOKIE_SECURE` | Prod | `False` | Send CSRF cookie over HTTPS only. |
| `SHOPIFY_STORE_DOMAIN` | Live mode | `example-store.myshopify.com` | `your-store.myshopify.com`. |
| `SHOPIFY_STOREFRONT_TOKEN` | Live mode | empty → **mock mode** | Storefront API token. Setting this leaves mock mode. |
| `SHOPIFY_STOREFRONT_API_VERSION` | No | `2024-10` | Storefront API version. |
| `SHOPIFY_ADMIN_TOKEN` | Live mode | empty | Admin API token (order reads/fulfillment). |
| `SHOPIFY_ADMIN_API_VERSION` | No | `2024-10` | Admin API version. |
| `SHOPIFY_WEBHOOK_SECRET` | Live mode | empty | Shared secret to verify `orders/paid` HMAC. |
| `STRIPE_SECRET_KEY` | Stripe payments | empty → demo checkout | Stripe secret key (`sk_live_…`/`sk_test_…`). Setting it makes `/api/checkout` return a hosted Stripe Checkout URL. |
| `STRIPE_WEBHOOK_SECRET` | Stripe payments | empty | Signing secret (`whsec_…`) for the `checkout.session.completed` endpoint at `/api/webhooks/stripe`. |
| `STRIPE_PUBLISHABLE_KEY` | No | empty | Only needed for a custom client-side Stripe UI; unused by the hosted flow. |
| `DOWNLOAD_TOKEN_MAX_AGE` | No | `86400` | Signed download-token (grant link) lifetime, seconds. |
| `DOWNLOAD_S3_BASE_URL` | No | `https://example-bucket.s3.amazonaws.com` | Legacy base; presigned flow derives URLs via boto3 instead. |
| `AWS_ACCESS_KEY_ID` | Real delivery | empty → mock | IAM access key for presigned S3 downloads. Setting keys+bucket enables real delivery. |
| `AWS_SECRET_ACCESS_KEY` | Real delivery | empty | IAM secret key. |
| `AWS_S3_REGION` | Real delivery | `us-east-1` | Bucket region. |
| `AWS_S3_BUCKET` | Real delivery | empty | **Private** bucket holding the LUT files. |
| `AWS_S3_ENDPOINT_URL` | No | empty | Custom endpoint for S3-compatible stores (MinIO/R2/Wasabi). |
| `S3_KEY_PREFIX` | No | `luts` | Key prefix; objects are `<prefix>/<handle>.zip` (server-derived). |
| `DOWNLOAD_URL_TTL` | No | `60` | Presigned-URL lifetime (seconds). Keep short. |
| `FRONTEND_URL` / `SITE_URL` | Prod | `http://localhost:3000` | Customer-facing links in emails. |
| `API_BASE_URL` | Prod | `http://localhost:8000` | Public origin of the backend, to make download links absolute in emails. |
| `EMAIL_BACKEND` | Prod | console backend | Set to the SMTP backend for real mail. |
| `EMAIL_HOST` / `EMAIL_PORT` | Prod (SMTP) | `localhost` / `25` | SMTP server. |
| `EMAIL_HOST_USER` / `EMAIL_HOST_PASSWORD` | Prod (SMTP) | empty | SMTP credentials. |
| `EMAIL_USE_TLS` | Prod (SMTP) | `False` | STARTTLS for SMTP. |
| `DEFAULT_FROM_EMAIL` | No | `The Looks Lab <hello@thelookslab.com>` | From address. |
| `SUPPORT_EMAIL` | No | `support@thelookslab.com` | Support address in emails. |

### Frontend (`frontend/.env.local`, or build args for Docker)

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | **Yes** | `http://localhost:8000/api` | Backend API base. **Public** — baked into the bundle and the CSP `connect-src`. |
| `NEXT_PUBLIC_SITE_URL` | **Yes** | `http://localhost:3000` | Canonical site URL for SEO metadata, `sitemap.xml`, `robots.txt`. **Public.** |

> `NEXT_PUBLIC_*` values are embedded in the client bundle at **build time** and
> are visible to anyone. Never place secrets here. For Docker, pass them as
> `--build-arg` (compose does this from the root `.env`).

---

## 3. Secrets management

- Secrets live **only** in `backend/.env` (gitignored) or your platform's secret
  store (e.g. AWS Secrets Manager, GCP Secret Manager, Kubernetes Secrets).
- Never commit a real `.env`. Only `*.env.example` files are tracked.
- Rotate `SECRET_KEY`, Shopify tokens, and `SHOPIFY_WEBHOOK_SECRET` on any
  suspected exposure.
- The frontend has no secrets — only `NEXT_PUBLIC_*`.

---

## 4. Switching from mock mode to live Shopify

The backend runs in **MOCK_MODE** whenever `SHOPIFY_STOREFRONT_TOKEN` is blank
(it serves the in-repo fixture catalog and never contacts Shopify). To go live:

1. In your Shopify admin, create a **custom app** and grant Storefront API +
   Admin API scopes (products, collections, orders, checkout).
2. Set in `backend/.env`:
   - `SHOPIFY_STORE_DOMAIN=your-store.myshopify.com`
   - `SHOPIFY_STOREFRONT_TOKEN=<storefront token>`  ← leaving mock mode
   - `SHOPIFY_ADMIN_TOKEN=<admin token>`
   - `SHOPIFY_WEBHOOK_SECRET=<webhook signing secret>`
3. Restart the backend. `MOCK_MODE` is now off.

### Register the `orders/paid` webhook

Point a Shopify webhook (Admin → Settings → Notifications → Webhooks, or the
Admin API) at:

```
POST https://<your-backend-domain>/api/webhooks/shopify/orders-paid
Topic: orders/paid
Format: JSON
```

The backend verifies the `X-Shopify-Hmac-Sha256` header with
`SHOPIFY_WEBHOOK_SECRET` using a constant-time comparison, records the purchase,
issues signed expiring download links, and emails the customer.

---

## 5. Database (Postgres)

SQLite is the zero-config default for local dev. For production set
`DATABASE_URL` to a Postgres DSN — the `psycopg[binary]` driver is in
`requirements.txt`:

```
DATABASE_URL=postgres://user:pass@db-host:5432/luts
```

Run migrations on deploy:

```bash
python manage.py migrate --noinput
```

(The `docker-compose` backend service runs this automatically before gunicorn.)

---

## 6. Gunicorn + static files

The backend image runs:

```bash
gunicorn config.wsgi:application --bind 0.0.0.0:8000 --workers 3
```

Tune workers via a process manager / `WEB_CONCURRENCY`. Django admin/DRF static
assets are collected at image build time:

```bash
python manage.py collectstatic --noinput   # → backend/staticfiles/
```

In production, serve `STATIC_ROOT` via your CDN/reverse proxy (or add WhiteNoise
if you want gunicorn to serve them directly).

---

## 7. TLS / security headers

Terminate TLS at your load balancer/CDN and enable in `backend/.env`:

```
SECURE_SSL_REDIRECT=True
SECURE_HSTS_SECONDS=31536000     # enables HSTS incl. subdomains + preload
SESSION_COOKIE_SECURE=True
CSRF_COOKIE_SECURE=True
```

`SECURE_PROXY_SSL_HEADER` already honors `X-Forwarded-Proto: https` from a
TLS-terminating proxy. `SECURE_CONTENT_TYPE_NOSNIFF` and `X_FRAME_OPTIONS=DENY`
are always on.

---

## 8. CORS / ALLOWED_HOSTS / CSRF

- `ALLOWED_HOSTS` — exact backend hostnames (never `*` in prod).
- `CORS_ALLOWED_ORIGINS` — the exact frontend origin(s); credentials are allowed,
  so wildcard CORS is never used.
- `CSRF_TRUSTED_ORIGINS` — scheme+host of the frontend.

Example for a live deploy:

```
ALLOWED_HOSTS=api.thelookslab.com
CORS_ALLOWED_ORIGINS=https://thelookslab.com
CSRF_TRUSTED_ORIGINS=https://thelookslab.com
```

---

## 9. CSP nonce hardening (frontend)

`frontend/next.config.mjs` ships a Content-Security-Policy. For dev/runtime
compatibility it currently allows `'unsafe-inline'`/`'unsafe-eval'` for scripts
and `'unsafe-inline'` for styles (required by Next's runtime style injection +
Framer Motion). For a hardened deploy, generate a per-request **nonce** in
middleware and replace the loose `script-src` with `script-src 'self'
'nonce-<value>'`, dropping `'unsafe-eval'`. The CSP's `connect-src` is derived
from `NEXT_PUBLIC_API_URL`, so set that to the live backend origin.

---

## 10. Email / SMTP

Development uses the console backend (emails print to stdout). For real delivery:

```
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=smtp.youresp.com
EMAIL_PORT=587
EMAIL_HOST_USER=...
EMAIL_HOST_PASSWORD=...
EMAIL_USE_TLS=True
DEFAULT_FROM_EMAIL=The Looks Lab <hello@thelookslab.com>
```

---

## 11. Secure digital delivery (S3)

LUT files are delivered from a **private** S3 (or S3-compatible) bucket via
short-lived **presigned URLs**. The download endpoint requires **no login** —
the signed token is the only credential, so guests who buy via the email link or
thank-you page can download immediately.

### Bucket setup (private + Block Public Access)

1. Create a bucket (e.g. `luts-private`) and **enable S3 Block Public Access**
   (all four settings ON). No bucket policy grants public read.
2. Upload files under the key prefix, named by product handle:
   `s3://luts-private/luts/<handle>.zip` (matches `S3_KEY_PREFIX`).
3. The bucket is **never** publicly readable. The *only* way to fetch an object
   is a presigned URL minted by the backend.

### Least-privilege IAM user

Create an IAM user whose keys go in `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`,
with a policy granting **only** `s3:GetObject` on the key prefix:

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": "s3:GetObject",
    "Resource": "arn:aws:s3:::luts-private/luts/*"
  }]
}
```

No list, no put, no delete, no access outside `luts/*`. If the keys leak, the
blast radius is read-only on the LUT files.

### Why downloads cannot be manipulated

| Control | Effect |
| --- | --- |
| **HMAC-signed token** (`django.core.signing`) | The token carries the grant id + product handle + expiry, signed with `SECRET_KEY`. **Any** edit → `BadSignature` → **403**. |
| **Server-derived key** | The S3 object key is computed server-side as `<S3_KEY_PREFIX>/<handle>.zip` from the *validated* handle. It is never read from the client/token → no path traversal, no IDOR. Editing the handle to grab another product breaks the signature. |
| **AWS SigV4 presigned URL** | The S3 URL is signed with the IAM secret; it cannot be forged or its key/params edited. |
| **Short TTL** | `DOWNLOAD_URL_TTL` (default 60s) means a leaked presigned URL expires almost immediately. The grant link (`DOWNLOAD_TOKEN_MAX_AGE`) is separately bounded. |
| **Throttling** | `GET /api/download/<token>` is rate-limited by a dedicated `download` scope (60/min per IP) to deter scraping/enumeration. |

### Behavior

`GET /api/download/<token>`:
- Validates the token (signature + expiry). Bad/expired/tampered → **403**;
  unknown/mismatched grant → **404**.
- **Real mode** (AWS keys + bucket set): **302 redirect** to the presigned S3
  URL (`ResponseContentDisposition: attachment; filename="<handle>.zip"`).
- **Mock mode** (no AWS keys): streams a small generated `.cube` placeholder as
  an attachment (`Content-Disposition: attachment; filename="<handle>.cube"`) so
  the demo download button works with zero external services.

### CDN (optional, recommended)

For scale, front the private bucket with CloudFront (Origin Access Control) and
edge-cache the bytes; keep the presigned-URL TTL short. See `PERFORMANCE.md`.

---

## 11b. Checkout flow

`POST /api/checkout` `{cartId, email?}` → `{mode, checkoutUrl}`:

- **Real mode** (`SHOPIFY_STOREFRONT_TOKEN` set): `mode="shopify"`,
  `checkoutUrl` is Shopify's **hosted checkout** URL for the cart (from the
  Storefront `cartCreate`). Configure Shopify's checkout **return URL** to your
  storefront thank-you page (`FRONTEND_URL`), and register the `orders/paid`
  webhook (see §4) — that webhook creates the order, grants, and sends the
  confirmation email.
- **Mock mode**: `mode="mock"`, `checkoutUrl="/checkout?cart=<cartId>"` — a
  **relative** path the frontend renders as a demo checkout page.

`POST /api/checkout/complete` `{cartId, email}` → `{orderId}` — **MOCK MODE
ONLY** (returns **404** in real mode). It simulates Shopify completing payment +
firing `orders/paid` for the demo: builds the order from the cart (idempotent on
a synthetic id), issues `DownloadGrant`s for the email (attached to a user if one
exists), and sends one confirmation email. In production this is done by the real
`orders/paid` webhook, never this endpoint.

The thank-you confirmation `GET /api/orders/<orderId>` returns the guest's
`downloads` **login-free** for both real orders and the mock-completed order.

---

## 12. Running via docker-compose (prod-like local)

A `docker-compose.yml` at the repo root wires Postgres + backend + frontend.

```bash
cp .env.example .env                     # Postgres creds, ALLOWED_HOSTS, NEXT_PUBLIC_*
cp backend/.env.example backend/.env     # app config (leave SHOPIFY_* blank for mock mode)
docker compose up --build
# frontend → http://localhost:3000
# backend  → http://localhost:8000/api
```

- `db` (postgres:16) has a healthcheck; `backend` waits for it, runs `migrate`,
  then starts gunicorn.
- `compose` assembles the backend `DATABASE_URL` from the root `.env` Postgres
  vars (overriding any value in `backend/.env`).
- Mock mode still works under compose — leave the `SHOPIFY_*` vars blank.
- Both Dockerfiles run as **non-root** users.

This stack is for prod-like local runs and as a deployment reference, not a
turnkey production cluster (add a TLS-terminating proxy, managed Postgres,
secrets store, and CDN for a real deploy).
