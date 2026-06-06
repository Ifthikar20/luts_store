# Deployment & Production Hardening — The Looks Lab

This guide covers running the LUTs store in a production-like environment:
environment variables, secrets, switching from mock mode to live Shopify,
Postgres, gunicorn/static files, TLS/security headers, CORS/CSRF, email, S3 file
delivery, and the bundled `docker-compose` stack.

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the system design and request flows.

---

## 1. Topology

```
Browser ──► Next.js (storefront, :3000) ──► Django BFF (:8000) ──► Shopify / Postgres / S3
```

- The **frontend** holds no secrets; it only receives `NEXT_PUBLIC_*` values.
- The **backend** owns all secrets, the database, webhook handling, and signed
  download links.
- **Shopify** is the commerce engine (catalog, cart, hosted checkout, payments).

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
| `DOWNLOAD_TOKEN_MAX_AGE` | No | `86400` | Signed download-link lifetime (seconds). |
| `DOWNLOAD_S3_BASE_URL` | Live delivery | `https://example-bucket.s3.amazonaws.com` | Base for real LUT file URLs. |
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

## 11. S3 for real LUT file delivery

In mock mode, downloads are served from in-repo fixtures. In production, host the
`.cube` files in private S3 and set `DOWNLOAD_S3_BASE_URL`. The backend issues
**signed, expiring** download tokens (`DOWNLOAD_TOKEN_MAX_AGE`, default 24h)
exchanged at `GET /api/download/<token>` — the bucket itself stays private and is
never exposed directly.

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
