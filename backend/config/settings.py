"""
Django settings for the LUTs Store BFF.

All secrets and environment-specific configuration are read from the
environment (a local .env file in development). Nothing sensitive is
hardcoded. See backend/.env.example for the full list of variables.
"""
from pathlib import Path

from decouple import Csv, config

try:
    import dj_database_url
except ImportError:  # pragma: no cover - optional dependency
    dj_database_url = None

BASE_DIR = Path(__file__).resolve().parent.parent

# ---------------------------------------------------------------------------
# Core security
# ---------------------------------------------------------------------------
# SECRET_KEY comes from the environment. The fallback below is INSECURE and is
# intended for local development ONLY. Set SECRET_KEY in any real environment.
# An empty value (e.g. a blank `SECRET_KEY=` line copied from .env.example) is
# treated as unset so local dev still boots.
SECRET_KEY = (
    config("SECRET_KEY", default="").strip()
    or "dev-insecure-key-do-not-use-in-production-change-me"
)

# DEBUG defaults to False. Only turn it on explicitly for local dev.
DEBUG = config("DEBUG", default=False, cast=bool)

ALLOWED_HOSTS = config(
    "ALLOWED_HOSTS",
    default="localhost,127.0.0.1",
    cast=Csv(),
)

# ---------------------------------------------------------------------------
# Shopify / mock mode
# ---------------------------------------------------------------------------
SHOPIFY_STORE_DOMAIN = config(
    "SHOPIFY_STORE_DOMAIN", default="example-store.myshopify.com"
)
SHOPIFY_STOREFRONT_TOKEN = config("SHOPIFY_STOREFRONT_TOKEN", default="")
SHOPIFY_STOREFRONT_API_VERSION = config(
    "SHOPIFY_STOREFRONT_API_VERSION", default="2024-10"
)
SHOPIFY_ADMIN_TOKEN = config("SHOPIFY_ADMIN_TOKEN", default="")
SHOPIFY_ADMIN_API_VERSION = config("SHOPIFY_ADMIN_API_VERSION", default="2024-10")
SHOPIFY_WEBHOOK_SECRET = config("SHOPIFY_WEBHOOK_SECRET", default="")

# MOCK_MODE is ON whenever there is no Storefront token. In this mode the app
# serves the in-repo fixture catalog and never contacts Shopify.
MOCK_MODE = not bool(SHOPIFY_STOREFRONT_TOKEN.strip())

# ---------------------------------------------------------------------------
# Payments — Stripe Checkout (self-contained, no Shopify store required)
# ---------------------------------------------------------------------------
# When STRIPE_SECRET_KEY is set the backend takes payments through Stripe's
# hosted Checkout: begin_checkout creates a Checkout Session and returns its URL;
# Stripe then calls the signed /api/webhooks/stripe endpoint on
# ``checkout.session.completed``, which feeds the SAME order->grant->email
# ->download pipeline as the Shopify webhook. With the key unset, checkout falls
# back to Shopify (live) or the in-app demo (mock).
STRIPE_SECRET_KEY = config("STRIPE_SECRET_KEY", default="")
STRIPE_WEBHOOK_SECRET = config("STRIPE_WEBHOOK_SECRET", default="")
# Optional publishable key (only needed for a custom client-side Stripe UI; the
# hosted Checkout flow used here does not require it server-side).
STRIPE_PUBLISHABLE_KEY = config("STRIPE_PUBLISHABLE_KEY", default="")
STRIPE_ENABLED = bool(STRIPE_SECRET_KEY.strip())

# ---------------------------------------------------------------------------
# Shopify Customer Accounts (OAuth 2.0 / OpenID Connect, PKCE) — OPTIONAL login
# ---------------------------------------------------------------------------
# Powers the hosted-login account/library portal at account.<domain>, exactly
# like thelookslab.com (response_type=code, scope
# "openid email customer-account-api:full"). This is a BFF: after login we hold
# a server-side Django SESSION (httpOnly cookie), never a JS-readable token.
#
# LOGIN IS OPTIONAL. Guest checkout and the login-free signed-token downloads
# are completely unaffected by anything in this block.
#
# SHOP_ID is the NUMERIC shop id used in the shopify.com customer-account URLs
# (https://shopify.com/authentication/<SHOP_ID>/oauth/authorize). CLIENT_ID is
# the headless / customer-account API client id. CLIENT_SECRET is only needed
# for a confidential client (public clients use PKCE alone). See LIVE_SETUP.md.
SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID = config(
    "SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID", default=""
).strip()
SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_SECRET = config(
    "SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_SECRET", default=""
).strip()
SHOPIFY_CUSTOMER_ACCOUNT_SHOP_ID = config(
    "SHOPIFY_CUSTOMER_ACCOUNT_SHOP_ID", default=""
).strip()
SHOPIFY_CUSTOMER_ACCOUNT_API_VERSION = config(
    "SHOPIFY_CUSTOMER_ACCOUNT_API_VERSION", default="2024-10"
)
SHOPIFY_CUSTOMER_ACCOUNT_REDIRECT_URI = config(
    "SHOPIFY_CUSTOMER_ACCOUNT_REDIRECT_URI",
    default="http://localhost:8000/api/auth/shopify/callback",
)

# Enabled only when BOTH a client id and a numeric shop id are configured. When
# disabled the customer-auth views serve a clearly-gated MOCK path so the portal
# runs locally with NO Shopify credentials.
SHOPIFY_CUSTOMER_ACCOUNTS_ENABLED = bool(
    SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID and SHOPIFY_CUSTOMER_ACCOUNT_SHOP_ID
)

# ---------------------------------------------------------------------------
# Download tokens
# ---------------------------------------------------------------------------
DOWNLOAD_TOKEN_MAX_AGE = config("DOWNLOAD_TOKEN_MAX_AGE", default=86400, cast=int)
DOWNLOAD_S3_BASE_URL = config(
    "DOWNLOAD_S3_BASE_URL", default="https://example-bucket.s3.amazonaws.com"
)

# ---------------------------------------------------------------------------
# Secure file delivery via S3 (presigned URLs)
# ---------------------------------------------------------------------------
# Real digital delivery is backed by a PRIVATE S3 (or S3-compatible) bucket.
# When AWS credentials AND a bucket are present we are in "real delivery" mode:
# the download endpoint resolves a server-derived object key and 302-redirects
# to a short-lived, AWS-SigV4-signed presigned URL. With these unset we stay in
# the placeholder/streaming mock path so the demo download button still works.
AWS_ACCESS_KEY_ID = config("AWS_ACCESS_KEY_ID", default="")
AWS_SECRET_ACCESS_KEY = config("AWS_SECRET_ACCESS_KEY", default="")
AWS_S3_REGION = config("AWS_S3_REGION", default="us-east-1")
AWS_S3_BUCKET = config("AWS_S3_BUCKET", default="")
# Optional custom endpoint for S3-compatible stores (MinIO, R2, Wasabi, ...).
AWS_S3_ENDPOINT_URL = config("AWS_S3_ENDPOINT_URL", default="")
# Prefix under which LUT files live in the bucket. Object keys are derived
# server-side as ``<prefix>/<handle>.zip`` (never taken from the client/token).
S3_KEY_PREFIX = config("S3_KEY_PREFIX", default="luts")
# Lifetime (seconds) of a presigned download URL. Short so a leaked URL expires
# fast. Distinct from DOWNLOAD_TOKEN_MAX_AGE (the signed-token / grant lifetime).
DOWNLOAD_URL_TTL = config("DOWNLOAD_URL_TTL", default=60, cast=int)

# Real S3 delivery is active whenever a bucket is configured. Credentials may
# come from the explicit AWS_* keys OR from boto3's default chain (e.g. an EC2
# instance role) — so on EC2 you can attach a least-privilege role and leave
# the key vars blank. Keep this independent of MOCK_MODE: a store could run
# live Shopify but still demo downloads, or vice-versa. The download view
# branches on this flag.
S3_DELIVERY_ENABLED = bool(AWS_S3_BUCKET.strip())

# ---------------------------------------------------------------------------
# Frontend / public site URL (used to build links inside emails)
# ---------------------------------------------------------------------------
# FRONTEND_URL is where customer-facing links (library, support) point. It
# defaults to the local Next.js dev origin. SITE_URL is accepted as an alias.
FRONTEND_URL = config(
    "FRONTEND_URL",
    default=config("SITE_URL", default="http://localhost:3000"),
)
SITE_URL = FRONTEND_URL

# Public origin of THIS backend API (e.g. https://api.thelookslab.com). Used to
# turn the relative ``/api/download/<token>`` paths into absolute, clickable
# links inside emails. Defaults to the local dev API origin.
API_BASE_URL = config("API_BASE_URL", default="http://localhost:8000")

# ---------------------------------------------------------------------------
# Email delivery
# ---------------------------------------------------------------------------
# In development the console backend prints emails to stdout (no SMTP needed).
# Set EMAIL_BACKEND to django.core.mail.backends.smtp.EmailBackend in any real
# environment and supply the EMAIL_HOST/PORT/HOST_USER/HOST_PASSWORD/USE_TLS
# vars below. Tests override this to the locmem backend (see tests/conftest.py).
EMAIL_BACKEND = config(
    "EMAIL_BACKEND",
    default="django.core.mail.backends.console.EmailBackend",
)
EMAIL_HOST = config("EMAIL_HOST", default="localhost")
EMAIL_PORT = config("EMAIL_PORT", default=25, cast=int)
EMAIL_HOST_USER = config("EMAIL_HOST_USER", default="")
EMAIL_HOST_PASSWORD = config("EMAIL_HOST_PASSWORD", default="")
EMAIL_USE_TLS = config("EMAIL_USE_TLS", default=False, cast=bool)
DEFAULT_FROM_EMAIL = config(
    "DEFAULT_FROM_EMAIL", default="The Looks Lab <hello@thelookslab.com>"
)
# Support address surfaced in customer emails.
SUPPORT_EMAIL = config("SUPPORT_EMAIL", default="support@thelookslab.com")

# ---------------------------------------------------------------------------
# Applications
# ---------------------------------------------------------------------------
INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # Third party
    "rest_framework",
    "rest_framework.authtoken",
    "corsheaders",
    # Local apps
    "common",
    "catalog",
    "cart",
    "checkout",
    "orders",
    "delivery",
    "accounts",
    "customer_auth",
    "engagement",
    "analytics",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    # Attach CSP / Permissions-Policy / CORP to every response (see
    # common/security_headers.py).
    "common.security_headers.SecurityHeadersMiddleware",
    # CorsMiddleware must come as early as possible, before CommonMiddleware.
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    # Unwrap the storefront's obfuscated JSON envelopes before any body parsing
    # (obfuscation only — see common/obfuscation.py; plain JSON still works).
    "common.obfuscation.ObfuscatedPayloadMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

# ---------------------------------------------------------------------------
# Database (SQLite by default, optional Postgres via DATABASE_URL)
# ---------------------------------------------------------------------------
DATABASE_URL = config("DATABASE_URL", default="")
if DATABASE_URL and dj_database_url is not None:
    DATABASES = {
        "default": dj_database_url.parse(DATABASE_URL, conn_max_age=600)
    }
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
        }
    }

# ---------------------------------------------------------------------------
# Cache — backs DRF rate limiting. With REDIS_URL set, throttle counters are
# SHARED across all gunicorn workers / replicas, so limits are enforced
# globally (LocMem counts per-process, which multiplies the effective limit).
# ---------------------------------------------------------------------------
REDIS_URL = config("REDIS_URL", default="")
if REDIS_URL:
    CACHES = {
        "default": {
            "BACKEND": "django.core.cache.backends.redis.RedisCache",
            "LOCATION": REDIS_URL,
        }
    }
else:
    CACHES = {
        "default": {
            "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
        }
    }

# ---------------------------------------------------------------------------
# Auth / i18n / static
# ---------------------------------------------------------------------------
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# ---------------------------------------------------------------------------
# CORS / CSRF (restricted to the frontend origin; never CORS_ALLOW_ALL)
# ---------------------------------------------------------------------------
CORS_ALLOWED_ORIGINS = config(
    "CORS_ALLOWED_ORIGINS",
    default="http://localhost:3000",
    cast=Csv(),
)
CORS_ALLOW_CREDENTIALS = True

CSRF_TRUSTED_ORIGINS = config(
    "CSRF_TRUSTED_ORIGINS",
    default="http://localhost:3000",
    cast=Csv(),
)

# ---------------------------------------------------------------------------
# Security headers / cookies (env-gated so http dev works)
# ---------------------------------------------------------------------------
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = "DENY"
# Don't leak full URLs to other origins; isolate the browsing context.
SECURE_REFERRER_POLICY = "strict-origin-when-cross-origin"
SECURE_CROSS_ORIGIN_OPENER_POLICY = "same-origin"

SECURE_SSL_REDIRECT = config("SECURE_SSL_REDIRECT", default=False, cast=bool)
SECURE_HSTS_SECONDS = config("SECURE_HSTS_SECONDS", default=0, cast=int)
SECURE_HSTS_INCLUDE_SUBDOMAINS = SECURE_HSTS_SECONDS > 0
SECURE_HSTS_PRELOAD = SECURE_HSTS_SECONDS > 0
# Honor the X-Forwarded-Proto header from a TLS-terminating proxy/CDN.
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

# Cap request body size (bytes) to blunt memory-exhaustion POSTs. Our payloads
# are tiny JSON; 1 MB is generous. File delivery is via S3 redirects, not uploads.
DATA_UPLOAD_MAX_MEMORY_SIZE = config(
    "DATA_UPLOAD_MAX_MEMORY_SIZE", default=1_048_576, cast=int
)
DATA_UPLOAD_MAX_NUMBER_FIELDS = 200

SESSION_COOKIE_SECURE = config("SESSION_COOKIE_SECURE", default=False, cast=bool)
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = "Lax"

CSRF_COOKIE_SECURE = config("CSRF_COOKIE_SECURE", default=False, cast=bool)
CSRF_COOKIE_HTTPONLY = True
CSRF_COOKIE_SAMESITE = "Lax"

# ---------------------------------------------------------------------------
# Django REST Framework (throttling enabled with sane defaults)
# ---------------------------------------------------------------------------
REST_FRAMEWORK = {
    "DEFAULT_RENDERER_CLASSES": [
        "rest_framework.renderers.JSONRenderer",
    ],
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {
        "anon": "120/min",
        "user": "240/min",
        # Dedicated, stricter bucket for credential endpoints (login/register)
        # to blunt brute-force / enumeration attempts.
        "auth": "10/min",
        # Stricter bucket for sensitive, email-triggering endpoints (resend
        # downloads) to blunt enumeration / mail-bombing attempts.
        "sensitive": "5/min",
        # Dedicated bucket for the public, login-free download endpoint to deter
        # scraping/enumeration of signed links (60 requests/min per client IP).
        "download": "60/min",
        # Public analytics-event ingestion (batched, allowlisted, PII-free).
        "events": "120/min",
    },
    # Two auth schemes run side by side:
    #  * SessionAuthentication — the PREFERRED path. The Shopify Customer
    #    Accounts portal (customer_auth) establishes a server-side Django session
    #    (httpOnly cookie) so no token is ever readable by JS (mitigates XSS
    #    token theft). IsAuthenticated views (e.g. /api/me/downloads) accept it.
    #  * TokenAuthentication — LEGACY. Kept for back-compat with the existing
    #    `Authorization: Token <token>` accounts endpoints and their tests.
    # Session is listed first so a logged-in browser is recognized without a
    # token header. NOTE: DRF's SessionAuthentication enforces CSRF on unsafe
    # methods for session-authed requests; the GET endpoints here are unaffected
    # and the sensitive POSTs are CSRF-exempt by design (see customer_auth.views).
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework.authentication.SessionAuthentication",
        "rest_framework.authentication.TokenAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.AllowAny",
    ],
    "UNAUTHENTICATED_USER": None,
}

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {"console": {"class": "logging.StreamHandler"}},
    "root": {"handlers": ["console"], "level": "INFO"},
}
