# Going live

The app ships in **mock mode** (in-repo catalog, simulated checkout, generated
`.cube`, console email) so it runs with zero config. Flipping to production is
entirely a matter of setting environment variables in `backend/.env` — no code
changes. Each subsystem activates independently the moment its keys are present.

| Subsystem | Activates when… | Until then |
| --- | --- | --- |
| **Payments (Stripe)** | `STRIPE_SECRET_KEY` set | in-app demo checkout |
| File delivery (S3) | AWS keys + bucket set | streams a generated `.cube` |
| Catalog (Shopify) | `SHOPIFY_STOREFRONT_TOKEN` set | in-repo fixture catalog |
| Email receipts | `EMAIL_BACKEND` = SMTP | printed to the console |

---

## 1. Payments — Stripe Checkout (recommended, self-contained)

This is the real payment processor; it needs **no Shopify store**.

1. Create a Stripe account → **Developers → API keys**. Copy the **Secret key**
   (use `sk_test_…` first).
2. **Developers → Webhooks → Add endpoint:**
   - URL: `https://<your-api-host>/api/webhooks/stripe`
   - Event: `checkout.session.completed`
   - Copy the endpoint's **Signing secret** (`whsec_…`).
3. Set in `backend/.env`:
   ```env
   STRIPE_SECRET_KEY=sk_test_xxx
   STRIPE_WEBHOOK_SECRET=whsec_xxx
   FRONTEND_URL=https://your-storefront.com   # success/cancel redirects
   ```
4. Restart the backend. Done.

**Flow:** `POST /api/checkout` now returns `{mode:"stripe", checkoutUrl}` → the
storefront full-page-redirects to Stripe's hosted card page → on success Stripe
calls `POST /api/webhooks/stripe`, which (signature-verified) runs the shared
`ingest_paid_order` pipeline: **Order + DownloadGrants + receipt email**. The
thank-you page resolves `?order=stripe-<session_id>`; if the webhook lags, it
retrieves the paid session from Stripe and ingests it synchronously (idempotent).

**Local testing without a public URL** — use the Stripe CLI:
```bash
stripe listen --forward-to localhost:8000/api/webhooks/stripe   # prints whsec_…
stripe trigger checkout.session.completed
```

> Pricing note: in MOCK_MODE the line amounts come from the in-repo catalog. With
> Shopify live, amounts come from the resolved Shopify cart. Either way the
> webhook re-resolves the cart server-side — client-supplied prices are never
> trusted.

---

## 2. File delivery — private S3 / R2

The signed-download code is complete; it just needs a bucket + the real files.

1. Create a **private** bucket (AWS S3, Cloudflare R2, Wasabi, MinIO…).
2. Upload each product's archive as `luts/<product-handle>.zip` (matching the
   catalog handles; prefix configurable via `S3_KEY_PREFIX`).
3. Set in `backend/.env`:
   ```env
   AWS_ACCESS_KEY_ID=...
   AWS_SECRET_ACCESS_KEY=...
   AWS_S3_BUCKET=your-bucket
   AWS_S3_REGION=us-east-1
   # AWS_S3_ENDPOINT_URL=https://<account>.r2.cloudflarestorage.com   # for R2/MinIO
   ```

`/api/download/<token>` then 302-redirects to a short-lived (`DOWNLOAD_URL_TTL`,
default 60s) presigned URL instead of streaming the placeholder.

---

## 3. Catalog — Shopify (optional)

Keep the curated mock catalog, or go live:
```env
SHOPIFY_STORE_DOMAIN=your-store.myshopify.com
SHOPIFY_STOREFRONT_TOKEN=...        # turns MOCK_MODE off
SHOPIFY_WEBHOOK_SECRET=...          # only if you also use Shopify checkout
```
Stripe + the mock catalog is a perfectly valid combo (Stripe re-prices from the
catalog). You only need Shopify if you want Shopify to own the catalog/checkout.

---

## 4. Email receipts — SMTP

Receipts already render and send (console backend in dev). For real delivery:
```env
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=smtp.youresp.com
EMAIL_PORT=587
EMAIL_HOST_USER=...
EMAIL_HOST_PASSWORD=...
EMAIL_USE_TLS=True
DEFAULT_FROM_EMAIL=Luts.shop <hello@luts.shop>
API_BASE_URL=https://<your-api-host>   # makes download links in emails absolute
```

---

## 5. Production checklist

- [ ] `DEBUG=False`, real `SECRET_KEY`, correct `ALLOWED_HOSTS` / `CORS_ALLOWED_ORIGINS`
- [ ] `DATABASE_URL` → Postgres (SQLite is the dev default)
- [ ] Stripe **live** keys + webhook endpoint (swap `sk_test_`/`whsec_` for live)
- [ ] S3 bucket private; real `.zip` files uploaded under `luts/<handle>.zip`
- [ ] SMTP verified (sender domain SPF/DKIM)
- [ ] `pip install -r requirements.txt` (now includes `stripe`)
- [ ] `python manage.py migrate`
- [ ] Run `python manage.py check --deploy`
