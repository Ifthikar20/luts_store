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

## Security
Secrets live only in `backend/.env` (gitignored). The frontend exposes only
`NEXT_PUBLIC_*` values. Webhooks are HMAC-verified; downloads use signed,
expiring tokens; payment data never touches our servers (Shopify-hosted
checkout). Details in each tier's README and `ARCHITECTURE.md`.
