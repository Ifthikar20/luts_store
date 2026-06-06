# Architecture — The Looks Lab (LUTs store)

A three-tier / Backend-for-Frontend (BFF) commerce architecture: a custom
**Next.js** UI, a custom **Django** backend that owns business logic and
secrets, and **Shopify** as the commerce engine (catalog, cart, hosted
checkout, payments). Digital LUT files are delivered via signed, expiring
download links.

```
┌─────────────┐   HTTPS    ┌──────────────────┐   HTTPS/API   ┌─────────────────────┐
│   BROWSER   │ ─────────► │   NEXT.JS (UI)   │ ────────────► │   DJANGO (BFF/API)  │
│  (customer) │ ◄───────── │  presentation    │ ◄──────────── │  business logic     │
└─────────────┘            └──────────────────┘               └─────────┬───────────┘
      │                                                                  │
      │                                                    ┌─────────────┼──────────────┐
      │  redirect to pay                                   ▼             ▼              ▼
      │                                            ┌────────────┐ ┌───────────┐ ┌─────────────┐
      └───────────────────────────────────────►   │  SHOPIFY   │ │ POSTGRES/ │ │  S3 / CDN   │
              Shopify-hosted checkout              │ Storefront │ │  SQLite   │ │ .cube files │
                                                   │ + Admin API│ └───────────┘ └─────────────┘
      ◄────── orders/paid webhook ──────────────── └────────────┘
                     (back to Django)
```

## Tiers

### 1. Next.js — Presentation (`frontend/`)
- Renders the entire custom UI; holds **no secrets**.
- Talks **only** to the Django BFF (`NEXT_PUBLIC_API_URL`), never to Shopify's Admin API directly.
- SSR/SSG for SEO pages (product, category); client-side for cart.

### 2. Django — Backend-for-Frontend (`backend/`)
- The brain: holds the Shopify Admin token + webhook secret, owns the database.
- Exposes a clean REST API to the frontend (`/api/...`).
- Orchestrates Shopify's Storefront + Admin APIs; can cache responses.
- Receives Shopify webhooks (`orders/paid`) and runs post-purchase logic.
- Issues signed, expiring download links for the `.cube` files.

### 3. Shopify + stores — Commerce engine
- **Storefront API** (GraphQL): products, collections, cart, checkout URL.
- **Admin API**: manage products, read orders, fulfillment (server-side only).
- **Hosted checkout**: PCI/fraud/tax handled by Shopify — the one part not rebuilt.
- **Postgres/SQLite**: custom data (orders, purchases, download grants).
- **S3/CDN**: the actual LUT file assets.

## Key flows

1. **Browse**: Browser → Next.js → Django → (cache or Storefront API) → render.
2. **Cart**: Next.js → Django → Storefront API `cartCreate`/`cartLinesAdd` → returns cart + `checkoutUrl`.
3. **Checkout**: Browser is redirected to Shopify's hosted `checkoutUrl`; returns to a Next.js thank-you page.
4. **Delivery**: Shopify `orders/paid` webhook → Django (HMAC-verified) → record purchase → issue signed download links → email.

## Mock mode (runs with zero credentials)
Both tiers ship realistic mock data so the full app runs without any Shopify
account. The backend enters `MOCK_MODE` when `SHOPIFY_STOREFRONT_TOKEN` is
unset and serves an in-repo LUT catalog; the frontend also falls back to local
mock data if the API is unreachable (dev-only).

## Security posture
- Secrets only via environment (`.env`), never committed; frontend exposes only `NEXT_PUBLIC_*`.
- Webhook HMAC-SHA256 verified with constant-time comparison.
- Signed, time-limited download tokens (tamper-proof, expiring).
- Strict CORS, security headers/CSP, throttling, secure cookies (prod-gated).
- Payment data never touches our servers — Shopify-hosted checkout only.

See `backend/README.md` and `frontend/README.md` for per-tier detail.
