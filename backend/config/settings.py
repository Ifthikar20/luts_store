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
SECRET_KEY = config(
    "SECRET_KEY",
    default="dev-insecure-key-do-not-use-in-production-change-me",
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
# Download tokens
# ---------------------------------------------------------------------------
DOWNLOAD_TOKEN_MAX_AGE = config("DOWNLOAD_TOKEN_MAX_AGE", default=86400, cast=int)
DOWNLOAD_S3_BASE_URL = config(
    "DOWNLOAD_S3_BASE_URL", default="https://example-bucket.s3.amazonaws.com"
)

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
    "orders",
    "delivery",
    "accounts",
    "engagement",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    # CorsMiddleware must come as early as possible, before CommonMiddleware.
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
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

SECURE_SSL_REDIRECT = config("SECURE_SSL_REDIRECT", default=False, cast=bool)
SECURE_HSTS_SECONDS = config("SECURE_HSTS_SECONDS", default=0, cast=int)
SECURE_HSTS_INCLUDE_SUBDOMAINS = SECURE_HSTS_SECONDS > 0
SECURE_HSTS_PRELOAD = SECURE_HSTS_SECONDS > 0
# Honor the X-Forwarded-Proto header from a TLS-terminating proxy/CDN.
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

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
    },
    # TokenAuthentication lets the SPA authenticate with `Authorization: Token
    # <token>`. Tokens are returned over the API for this demo; PRODUCTION
    # NOTE: prefer httpOnly cookies or Shopify Customer Accounts so the token is
    # never readable by JS (mitigates XSS token theft). See accounts/README note.
    "DEFAULT_AUTHENTICATION_CLASSES": [
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
