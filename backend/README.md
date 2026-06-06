# LUTs Store — Backend (BFF)

A secured Django REST **Backend-for-Frontend** for a LUTs (video color-grading
Look-Up Tables) e-commerce store. It sits between a Next.js frontend and
Shopify, exposing a small, stable JSON API in `camelCase`.

The whole app runs in **mock mode** with **zero external services** — no
Shopify credentials required. When real Shopify tokens are supplied, the exact
same service-layer functions call Shopify instead, so the views never change.

---

## Tech stack

- Python 3.11, Django 5.x, Django REST Framework
- django-cors-headers, requests, python-decouple, dj-database-url
- gunicorn (production WSGI server; in `requirements.txt` only)
- SQLite by default; optional Postgres via `DATABASE_URL`
- pytest + pytest-django for tests

## Project layout

```
backend/
├── config/                 # Django project package (settings, urls, wsgi, asgi)
├── common/                 # shared utilities (health view, security.py = HMAC verify)
├── catalog/                # collections + products (services.py, mockdata.py)
├── cart/                   # cart CRUD (MockCart model, services.py)
├── orders/                 # Order + Purchase models, orders/paid webhook receiver
├── delivery/               # DownloadGrant model, signing.py, signed download endpoint
├── shopify_client/         # Storefront (GraphQL) + Admin (REST) clients + queries.py
├── tests/                  # pytest suite (HMAC, signing, API smoke)
├── manage.py
├── requirements.txt
├── pytest.ini
├── .env.example
└── .gitignore
```

## Setup

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

cp .env.example .env          # optional; sensible dev defaults exist without it
python manage.py migrate
python manage.py runserver
```

Run the tests:

```bash
python -m pytest
```

## Mock mode

`MOCK_MODE` is **ON whenever `SHOPIFY_STOREFRONT_TOKEN` is empty** (computed in
`config/settings.py`). In mock mode:

- Catalog/cart data comes from the in-repo fixture `catalog/mockdata.py`
  (5 collections, 12 individual LUTs, 3 bundles).
- Carts are persisted in the `MockCart` table (uuid id).
- `checkoutUrl` is a **placeholder**: `https://<store-domain>/cart/c/<id>`.
  In real mode this is replaced by Shopify's actual `checkoutUrl`.
- `GET /api/download/<token>` returns JSON `{url, expiresAt}` instead of
  redirecting to a signed S3 URL.

Set `SHOPIFY_STOREFRONT_TOKEN` (and the other Shopify vars) to switch to real
mode. The service layer (`catalog/services.py`, `cart/services.py`) branches on
`MOCK_MODE` and normalizes Shopify's GraphQL responses into the identical
public shapes.

## Environment variables

See `.env.example` for the fully-documented list. Highlights:

| Var | Purpose |
| --- | --- |
| `SECRET_KEY` | Django secret. Insecure dev fallback if unset (**dev only**). |
| `DEBUG` | Defaults `False`. |
| `ALLOWED_HOSTS` | Comma-separated. |
| `CORS_ALLOWED_ORIGINS` | Comma-separated; default `http://localhost:3000`. Never `*`. |
| `CSRF_TRUSTED_ORIGINS` | Comma-separated. |
| `DATABASE_URL` | Optional Postgres; SQLite if empty. |
| `SECURE_SSL_REDIRECT` / `SECURE_HSTS_SECONDS` | Prod TLS toggles (off in dev http). |
| `SESSION_COOKIE_SECURE` / `CSRF_COOKIE_SECURE` | Cookie Secure flags (off in dev http). |
| `SHOPIFY_STORE_DOMAIN` | `your-store.myshopify.com`. |
| `SHOPIFY_STOREFRONT_TOKEN` | Empty ⇒ mock mode. |
| `SHOPIFY_ADMIN_TOKEN` | **Server-side only.** Never exposed by any endpoint. |
| `SHOPIFY_WEBHOOK_SECRET` | Used to verify webhook HMAC signatures. |
| `DOWNLOAD_TOKEN_MAX_AGE` | Download token lifetime (seconds, default 24h). |
| `DOWNLOAD_S3_BASE_URL` | Base for signed download URLs. |
| `FRONTEND_URL` / `SITE_URL` | Public site origin for links in emails (default `http://localhost:3000`). |
| `API_BASE_URL` | Public origin of this API; makes email download links absolute (default `http://localhost:8000`). |
| `EMAIL_BACKEND` | Defaults to console (dev). Set to the SMTP backend in prod. |
| `EMAIL_HOST` / `EMAIL_PORT` / `EMAIL_HOST_USER` / `EMAIL_HOST_PASSWORD` / `EMAIL_USE_TLS` | SMTP settings (prod). |
| `DEFAULT_FROM_EMAIL` | From address on customer emails. |
| `SUPPORT_EMAIL` | Support address surfaced in customer emails. |

## Security measures

1. **Secrets from env only.** All credentials are read via `python-decouple`
   from a `.env` file; nothing is hardcoded. `SECRET_KEY` has a clearly-labelled
   insecure dev fallback. `.env` is gitignored; `.env.example` documents every var.
2. **Shopify Admin token + webhook secret are server-side only** and are never
   returned through any endpoint.
3. **Webhook HMAC verification.** `POST /api/webhooks/shopify/orders-paid`
   recomputes HMAC-SHA256 over the **raw** request body using
   `SHOPIFY_WEBHOOK_SECRET` and compares with `hmac.compare_digest`
   (constant-time) against the `X-Shopify-Hmac-Sha256` header. Invalid ⇒ `401`.
   Implemented in `common/security.py`; unit-tested.
4. **Hardened defaults.** `DEBUG=False` by default; `ALLOWED_HOSTS`,
   `CORS_ALLOWED_ORIGINS`, `CSRF_TRUSTED_ORIGINS` all come from env. CORS is
   restricted to the frontend origin via django-cors-headers — **never**
   `CORS_ALLOW_ALL_ORIGINS`.
5. **Security headers / cookies.** `SECURE_CONTENT_TYPE_NOSNIFF`,
   `X_FRAME_OPTIONS=DENY`, env-gated `SECURE_SSL_REDIRECT` / `SECURE_HSTS_SECONDS`,
   and `Secure`/`HttpOnly`/`SameSite` session & CSRF cookies (Secure flags
   env-gated so local http dev works).
6. **Throttling.** DRF `AnonRateThrottle` + `UserRateThrottle` enabled globally
   (120/min anon, 240/min user). Webhook and download endpoints are CSRF-exempt
   (non-browser / link-driven) but still throttled and otherwise protected.
7. **Signed, expiring download tokens.** `delivery/signing.py` uses Django's
   `django.core.signing.dumps/loads` (HMAC-backed) with a `max_age`. Tokens are
   tamper-proof and self-expiring; tampered ⇒ `401`, expired ⇒ `410`. Unit-tested.
8. **Idempotent webhook handling.** Orders are deduped by `shopify_order_id`
   (unique), so Shopify retries are safe no-ops.

## Post-purchase email pipeline

When a paid order is ingested (via the `orders/paid` webhook, or simulated —
see below), an on-brand **order-confirmation email** is sent listing the
purchased items, the total, and the signed download links. The links reuse the
same signed-token machinery as the thank-you page / library, and point at the
API download endpoint (`API_BASE_URL` makes them absolute in emails). A "saved
to your library" note links to `FRONTEND_URL/account`.

- **Templates:** `templates/email/order_confirmation.{html,txt}` (multipart).
- **Sender:** `delivery/emails.py` (`send_order_confirmation`).
- **Idempotency:** `Order.confirmation_email_sent_at` guards against duplicate
  sends; webhook retries / re-ingest never send a second email. The send is
  scheduled on `transaction.on_commit` and wrapped in try/except so a mail
  failure never breaks webhook ingestion (it's logged).
- **Backend:** dev defaults to the console backend (prints to stdout). Set
  `EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend` plus
  `EMAIL_HOST/PORT/HOST_USER/HOST_PASSWORD/USE_TLS` and `DEFAULT_FROM_EMAIL`
  for real delivery. Tests use the in-memory (locmem) backend.

### Simulating an order (no Shopify needed)

Exercise the whole pipeline — grants + confirmation email — without Shopify:

```bash
python manage.py simulate_order \
    --email buyer@example.com \
    --handle midnight-noir \
    --handle dji-aerial-vivid
```

Each `--handle` becomes a line item (titles/prices come from the catalog when
available). The synthesized `orders/paid`-shaped payload is run through the same
`ingest_paid_order` service the webhook uses, so `Order`/`Purchase`/
`DownloadGrant` rows are created and the confirmation email is printed to the
console backend. Pass `--order-id` to control idempotency (re-running the same
id re-sends), and `--currency` to override the currency.

## API contract

All responses are JSON in `camelCase`, base path `/api`.

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/health` | `{"status":"ok","mockMode":bool}` |
| GET | `/api/collections` | `[{handle,title,description,image,productCount}]` |
| GET | `/api/collections/{handle}` | `{handle,title,description,products:[Product]}`; 404 if unknown |
| GET | `/api/products` | `{products:[Product]}`; `?collection=`, `?featured=true`, `?search=` |
| GET | `/api/products/{handle}` | `Product`; 404 if unknown |
| POST | `/api/cart` | body `{lines?:[{merchandiseId,quantity}]}` → `Cart` |
| GET | `/api/cart/{id}` | `Cart`; 404 if unknown |
| POST | `/api/cart/{id}/lines` | body `{merchandiseId,quantity}` → `Cart` |
| PATCH | `/api/cart/{id}/lines` | body `{lineId,quantity}` → `Cart` |
| DELETE | `/api/cart/{id}/lines` | body `{lineId}` → `Cart` |
| POST | `/api/webhooks/shopify/orders-paid` | verifies HMAC; 200 ok, 401 bad sig. On success sends the order-confirmation email (idempotent). |
| GET | `/api/orders/{idOrToken}` | thank-you confirmation `{orderId,email,lines,total,downloads}`; 404 if unknown |
| POST | `/api/orders/resend-downloads` | body `{email}` → always generic 200 (no enumeration); re-sends the most recent order's links if the email exists. Throttled (`sensitive`, 5/min). |
| GET | `/api/download/{token}` | mock: `{url,expiresAt}`; real: 302 to signed S3 URL |

### `Product` shape

```json
{
  "id": "...", "handle": "...", "title": "...",
  "description": "...", "descriptionHtml": "...",
  "featuredImage": {"url": "...", "altText": "..."},
  "images": [{"url": "...", "altText": "..."}],
  "priceRange": {"min": {"amount": "39.00", "currencyCode": "USD"},
                 "max": {"amount": "39.00", "currencyCode": "USD"}},
  "variants": [{"id": "...", "title": "...",
                "price": {"amount": "39.00", "currencyCode": "USD"},
                "availableForSale": true}],
  "tags": ["..."], "productType": "LUT Pack", "vendor": "The Looks Lab",
  "collections": [{"handle": "...", "title": "..."}],
  "metafields": {"lutCount": 8, "formats": [".cube"],
                 "compatibleApps": ["Premiere Pro","DaVinci Resolve","Final Cut","CapCut"]},
  "featured": true
}
```

### `Cart` shape

```json
{
  "id": "...", "checkoutUrl": "...", "totalQuantity": 2,
  "cost": {"subtotal": {"amount": "78.00", "currencyCode": "USD"},
           "total":    {"amount": "78.00", "currencyCode": "USD"}},
  "lines": [{
    "id": "...", "quantity": 2,
    "merchandise": {
      "id": "...", "title": "Default",
      "product": {"handle": "...", "title": "...",
                  "featuredImage": {"url": "...", "altText": "..."}},
      "price": {"amount": "39.00", "currencyCode": "USD"}
    }
  }]
}
```

## Real Shopify mode (notes)

- `shopify_client/storefront.py` implements `cartCreate`, `cartLinesAdd`,
  `cartLinesUpdate`, `cartLinesRemove`, plus product/collection queries
  (GraphQL strings live in `shopify_client/queries.py`).
- `shopify_client/admin.py` implements an order read via the Admin REST API.
- These paths are written correctly but are **not exercised without real
  credentials**.
- In real mode `Cart.checkoutUrl` is Shopify's genuine checkout URL, and the
  download endpoint 302-redirects to a short-lived signed object-storage URL.

## Production

Serve with gunicorn:

```bash
gunicorn config.wsgi:application
```

Set `DEBUG=False`, a strong `SECRET_KEY`, real `ALLOWED_HOSTS`, and enable
`SECURE_SSL_REDIRECT=True`, `SECURE_HSTS_SECONDS`, `SESSION_COOKIE_SECURE=True`,
`CSRF_COOKIE_SECURE=True` behind TLS.
