# The Looks Lab — LUTs Store

A custom-UI e-commerce store for selling video color-grading **LUTs** (Look-Up
Tables) — individual LUTs, categorized collections, and bundles — built on a
**Next.js + Django + Shopify** architecture.

- **Frontend** (`frontend/`) — Next.js (App Router) + Tailwind + Framer Motion. A modern, cinematic, animated storefront. Holds no secrets.
- **Backend** (`backend/`) — Django + DRF Backend-for-Frontend. Owns business logic, secrets, the database, webhook handling, and signed digital delivery. Talks to Shopify.
- **Shopify** — commerce engine: catalog, cart, hosted checkout, payments.

See **[ARCHITECTURE.md](./ARCHITECTURE.md)** for the full design and request flows.

## Quick start (mock mode — no Shopify account needed)

Both tiers run out of the box with realistic mock data.

### Backend
```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env            # dev defaults are fine; leave Shopify tokens blank for mock mode
python manage.py migrate
python manage.py runserver       # http://localhost:8000
```

### Frontend
```bash
cd frontend
npm install
cp .env.local.example .env.local # NEXT_PUBLIC_API_URL=http://localhost:8000/api
npm run dev                       # http://localhost:3000
```

Open http://localhost:3000.

## Going live with Shopify
Fill the Shopify env vars in `backend/.env` (Storefront token, Admin token,
webhook secret, shop domain). The backend automatically switches from mock
mode to real Shopify calls once `SHOPIFY_STOREFRONT_TOKEN` is set. Configure a
Shopify webhook for `orders/paid` pointing at
`/api/webhooks/shopify/orders-paid`. See `backend/README.md`.

## Testing
```bash
# Backend — Django + pytest (67 tests, runs in mock mode, SQLite)
cd backend && source .venv/bin/activate && python -m pytest

# Frontend — Vitest + React Testing Library (lib + component tests)
cd frontend && npm run test          # watch mode
cd frontend && npm run test -- --run # one-shot (CI)
```

## CI
`.github/workflows/ci.yml` runs on every push and pull request with two jobs:
- **backend** — Python 3.11: `manage.py check`, `makemigrations --check
  --dry-run`, and `pytest` (mock mode, SQLite — no Shopify env).
- **frontend** — Node 22: `npm ci`, `lint`, `tsc --noEmit`, `vitest --run`, and
  `next build`. Both jobs cache dependencies.

## Docker
A prod-like local stack (Postgres + Django + Next.js):
```bash
cp .env.example .env                  # Postgres creds + NEXT_PUBLIC_* (public)
cp backend/.env.example backend/.env  # app config (blank SHOPIFY_* = mock mode)
docker compose up --build             # frontend :3000, backend :8000
```
Both images run as non-root; the backend runs migrations then gunicorn; the
frontend serves Next's `standalone` output. See **[DEPLOYMENT.md](./DEPLOYMENT.md)**.

## Security
Secrets live only in `backend/.env` (gitignored). The frontend exposes only
`NEXT_PUBLIC_*` values. Webhooks are HMAC-verified; downloads use signed,
expiring tokens; payment data never touches our servers (Shopify-hosted
checkout). Details in each tier's README and `ARCHITECTURE.md`.

## Going live (AWS S3 + Shopify)
Step-by-step setup (private bucket + least-privilege IAM, Shopify custom app,
`orders/paid` webhook) is in **[LIVE_SETUP.md](./LIVE_SETUP.md)**. After setting
the secrets, verify everything read-only with:
```bash
make verify        # python manage.py verify_integrations
```

## Production
Full environment-variable reference, secrets management, going live with
Shopify, TLS/HSTS, CORS/CSRF, Postgres, email, and S3 delivery are documented in
**[DEPLOYMENT.md](./DEPLOYMENT.md)** and **[LIVE_SETUP.md](./LIVE_SETUP.md)**.
