# Going live — AWS S3 + Shopify

This guide takes the store from **mock mode** to **live**. The code is already
env-driven: it switches automatically when the right variables are set. After
setting them, run the one-command verifier:

```bash
cd backend && source .venv/bin/activate
python manage.py verify_integrations
```

It performs **read-only** checks and prints secret-redacted, actionable
diagnostics (exit non-zero on failure).

> **Provide secrets securely — never paste them into chat or commit them.**
> Put them in the environment's configuration (env vars / secrets) or in a
> local, git-ignored `backend/.env`. `backend/.env` is in `.gitignore`; this
> remote container is ephemeral, so prefer the environment's secret store for
> anything durable.

---

## A. AWS S3 — secure digital delivery

The bucket stays **private**; customers only ever get short-lived presigned
URLs minted server-side. Downloads can't be manipulated (HMAC token →
server-derived key → SigV4 presign → 60s TTL).

### 1. Create a private bucket
- Create an S3 bucket (e.g. `thelookslab-luts`).
- **Block Public Access: ON** (all four settings). No public ACLs/policy.

### 2. Upload your LUT files at the expected keys
The server derives each object key as `S3_KEY_PREFIX/<handle>.zip` (default
prefix `luts`). For the current catalog that means:

```
luts/midnight-noir.zip
luts/golden-hour-drama.zip
luts/urban-blockbuster.zip
luts/dji-aerial-vivid.zip
…            (one .zip per product handle; see catalog/mockdata.py)
```

(When you move the catalog to Shopify, set each product's file key to match,
or keep the `S3_KEY_PREFIX/<handle>.zip` convention.)

### 3. Create a least-privilege IAM user
Programmatic access only. Attach a policy scoped to **GetObject on the prefix**:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PresignLutDownloads",
      "Effect": "Allow",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::thelookslab-luts/luts/*"
    }
  ]
}
```

(Grant `s3:PutObject` separately/temporarily only if you upload via these keys.)

### 4. Set env vars
```
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
AWS_S3_REGION=us-east-1
AWS_S3_BUCKET=thelookslab-luts
S3_KEY_PREFIX=luts
DOWNLOAD_URL_TTL=60
# S3-compatible (R2/MinIO/Wasabi) only:
# AWS_S3_ENDPOINT_URL=https://<account>.r2.cloudflarestorage.com
```
`S3_DELIVERY_ENABLED` flips on automatically once keys + bucket are present.
`verify_integrations` will then head_bucket, confirm every product object
exists, and mint a test presigned URL.

---

## B. Shopify — live catalog, cart, checkout, webhooks

### 1. Create a custom app (in the Shopify admin)
Settings → Apps and sales channels → Develop apps → Create an app.

- **Storefront API** access → install → copy the **Storefront access token**.
- **Admin API** scopes: `read_products`, `read_orders` (add `write_*` only if
  you fulfill via the API) → install → copy the **Admin access token**.

### 2. Set env vars
```
SHOPIFY_STORE_DOMAIN=your-store.myshopify.com
SHOPIFY_STOREFRONT_TOKEN=...        # turning this on disables MOCK_MODE
SHOPIFY_ADMIN_TOKEN=...
SHOPIFY_WEBHOOK_SECRET=...          # see step 4
SHOPIFY_STOREFRONT_API_VERSION=2024-10
SHOPIFY_ADMIN_API_VERSION=2024-10
API_BASE_URL=https://api.yourdomain.com      # where Shopify reaches the BFF
FRONTEND_URL=https://yourdomain.com          # used in emails / return links
```

### 3. Map products & collections
Create your LUTs as Shopify **products** (digital) and your categories as
**collections** with handles matching your URLs (`cinematic`, `drone-dji`,
`mobile-capcut`, `film-emulation`, `bundles`). The live Storefront queries are
already implemented in `backend/shopify_client/`.

### 4. Register the `orders/paid` webhook
Point it at the BFF (this drives fulfillment: download grants + email):

```
Topic:   orders/paid
URL:     https://api.yourdomain.com/api/webhooks/shopify/orders-paid
Format:  JSON
```
Set `SHOPIFY_WEBHOOK_SECRET` to the webhook signing secret. The endpoint
verifies the HMAC with constant-time comparison and rejects bad signatures.

### 5. Checkout return URL
`POST /api/checkout` returns Shopify's hosted `checkoutUrl`; the frontend
redirects there. Configure the post-purchase **return/thank-you URL** in
Shopify to `https://yourdomain.com/thank-you?order={order_id}` so the customer
lands back on our login-free download page.

---

## B2. Shopify Customer Accounts (login) — OPTIONAL

This adds **hosted Shopify login** for the account/library portal at
`account.<domain>`, exactly like thelookslab.com — OAuth 2.0 / OpenID Connect
with PKCE, `response_type=code`, scope `openid email customer-account-api:full`.
We run it as a BFF: after login the browser holds a **server-side Django
session** (httpOnly cookie), never a JS-readable token.

> **Login is OPTIONAL.** Guest checkout and the login-free signed-token
> downloads are completely unaffected. With no credentials set, the portal uses
> a clearly-gated **MOCK** path (a demo email field) so it runs locally with no
> Shopify connection.

### 1. Enable the new customer accounts + Customer Account API
In the Shopify admin: **Settings → Customer accounts** → choose **New customer
accounts**. Then enable the **Customer Account API** for a headless / custom
client (Settings → Apps and sales channels → Develop apps → your app →
**Customer Account API**, or the Headless channel).

### 2. Create the customer-account client and collect its ids
From the Customer Account API / Headless channel configuration, copy:
- **Client ID** (the customer-account API client id).
- **Shop ID** — the **numeric** id that appears in the customer-account URLs
  `https://shopify.com/authentication/<SHOP_ID>/oauth/authorize`.
- (Only if you configured a **confidential** client) the **Client secret**.
  Public clients use PKCE alone and need no secret.

### 3. Set the allowed redirect + JavaScript origins
In the client config, add the **callback/redirect URI** EXACTLY as the backend
will send it:
```
https://api.yourdomain.com/api/auth/shopify/callback     # production
http://localhost:8000/api/auth/shopify/callback          # local
```
Add your storefront origin (e.g. `https://yourdomain.com`) to the allowed
JavaScript/redirect origins as required by the channel.

### 4. Set env vars
```
SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID=...          # enabling REAL mode needs this + SHOP_ID
SHOPIFY_CUSTOMER_ACCOUNT_SHOP_ID=123456789      # the NUMERIC shop id
SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_SECRET=         # confidential clients only; else blank
SHOPIFY_CUSTOMER_ACCOUNT_API_VERSION=2024-10
SHOPIFY_CUSTOMER_ACCOUNT_REDIRECT_URI=https://api.yourdomain.com/api/auth/shopify/callback
```
`SHOPIFY_CUSTOMER_ACCOUNTS_ENABLED` flips on automatically once **both**
`CLIENT_ID` and `SHOP_ID` are present; otherwise the MOCK login path is used.

### 5. Cookies / CORS across origins
The session rides an httpOnly cookie. With the storefront and API on the **same
site** (e.g. `yourdomain.com` + `api.yourdomain.com`), `SameSite=Lax` works and
is the default. For a **truly cross-site** split, set the session cookie to
`SameSite=None; Secure` (HTTPS only) and ensure `CORS_ALLOW_CREDENTIALS=True`
with the storefront in `CORS_ALLOWED_ORIGINS` / `CSRF_TRUSTED_ORIGINS` (already
wired). Locally `localhost:3000` ↔ `localhost:8000` is same-site, so Lax is fine.

### 6. Login flow (for reference)
`GET /api/auth/shopify/login?returnTo=/account` → `{mode, authorizeUrl}`; the
SPA navigates to `authorizeUrl`. Shopify redirects back to
`/api/auth/shopify/callback?code=&state=`; the BFF verifies `state` + the
id_token (`nonce` + `exp`), `get_or_create`s the user (attaching any download
grants by email), logs in the session, and 302s to `FRONTEND_URL + returnTo`.

> **Security caveat:** id_token **signature** verification against Shopify's
> JWKS is a documented production TODO (`customer_auth/oauth.py`). The flow
> verifies `nonce` + `exp` (the minimum); add JWKS-based RS256 verification
> (PyJWT + `PyJWKClient`) before going live for full assurance.

### 7. What the customer sees: "Sign in to Shop"
With New customer accounts, Shopify hands the whole login to **Shop** — its
centralized buyer identity (the same account behind **Shop Pay** and the **Shop
app**). So after "Continue with Shopify" the customer lands on a Shopify-hosted
**"Sign in to Shop"** screen, not a Luts.shop page. Expect:

- **Passwordless:** the customer enters their email and gets a **one-time code**,
  or signs in with a **passkey** (Face ID / fingerprint). There is no password
  to manage, reset, or 2FA to configure — Shop owns all of it.
- **Consent screen:** an OAuth/OIDC consent ("share your email, name, avatar
  with …") for the `openid email customer-account-api:full` scopes. After the
  customer approves, Shop redirects to our `/api/auth/shopify/callback`.
- **One identity across stores:** a Shop account works on every Shopify store
  that uses it — returning customers are recognized instantly.

**Branding note:** the sign-in screen is **Shopify-branded ("Shop")** and
**cannot be fully white-labeled to Luts.shop** on standard plans — the same
constraint every Shopify store using new customer accounts lives with. Our
`/account/login` page sets expectations with a "powered by Shop" note before the
redirect. Login remains **optional**: guest checkout and login-free downloads
are unaffected.

---

## C. Verify

```bash
python manage.py verify_integrations
```
Expected when fully live: S3 bucket reachable + all product objects present +
presign ok; Storefront ok (shop name) + Admin ok + `orders/paid` webhook →
your endpoint + webhook secret set.

## D. Production hardening reminders
Set `DEBUG=False`, real `ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS`,
`CSRF_TRUSTED_ORIGINS`, `SECURE_SSL_REDIRECT=True`, `SECURE_HSTS_SECONDS`,
cookie `*_SECURE=True`, a strong `SECRET_KEY`, Postgres `DATABASE_URL`, and SMTP
email vars. Full reference: **[DEPLOYMENT.md](./DEPLOYMENT.md)**.
