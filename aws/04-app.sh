#!/usr/bin/env bash
#
# 04-app.sh — install and start the application on the instance (over SSH).
#
# Clones the repo, writes both env files with the public URLs + the S3 bucket
# (credentials come from the instance ROLE — no keys on disk), builds and starts
# the Docker stack, and configures Caddy as the reverse proxy.
#
# Two modes (set in aws/config.env):
#   USE_IP=1   serve plain HTTP on the Elastic IP (http://<EIP>) — no domain or
#              TLS. Frontend on /, API on /api. Good for testing before DNS.
#   USE_IP=0   (default) serve https://$DOMAIN + https://$API_DOMAIN with Caddy
#              auto-TLS. Requires the two DNS A records to resolve to the EIP.
#
# Re-runnable: pulls the latest code and redeploys. Flip USE_IP and re-run to
# move from the IP to your real domain later.
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

[ -n "${EIP:-}" ] || die "no EIP in state — run ./03-ec2.sh first."
[ -f "$PEM" ] || die "$PEM missing — needed to ssh."   # $PEM resolved in lib.sh

# --- mode: compute the URLs/hosts the server gets configured with -------------
if [ "${USE_IP:-0}" = "1" ]; then
  SITE_URL="http://$EIP"; API_URL="http://$EIP/api"; API_BASE="http://$EIP"
  PUB_HOST="$EIP"; SECURE=False; CADDY_MODE=ip
  say "mode: IP-only over HTTP — $SITE_URL (no TLS; buy a domain later, set USE_IP=0, re-run)"
else
  { [ -n "${DOMAIN:-}" ] && [ "$DOMAIN" != "luts.example.com" ]; } \
    || die "DOMAIN is unset/placeholder. Set real DOMAIN+API_DOMAIN in config.env, or set USE_IP=1 to deploy on the IP for now."
  SITE_URL="https://$DOMAIN"; API_URL="https://$API_DOMAIN/api"; API_BASE="https://$API_DOMAIN"
  PUB_HOST="$API_DOMAIN"; SECURE=True; CADDY_MODE=domain
  say "mode: domains over HTTPS — $SITE_URL + $API_URL"
fi

SSH=(ssh -i "$PEM" -o StrictHostKeyChecking=accept-new "ubuntu@$EIP")

# Drop any stale host key for this IP — recreating an instance behind the same
# Elastic IP changes the host key, which would otherwise block SSH.
ssh-keygen -R "$EIP" >/dev/null 2>&1 || true

say "deploying to ubuntu@$EIP (this builds Docker images — first run takes a few minutes)"

# CDN + transcode wiring (produced by 06-cdn.sh / 02-iam.sh into state.env).
# Empty when those scripts haven't run — the app then serves preview media via
# presigned redirects with no HLS, so deploys still work without them.
CDN_BASE_URL=""
[ -n "${CLOUDFRONT_DOMAIN:-}" ] && CDN_BASE_URL="https://${CLOUDFRONT_DOMAIN}"

"${SSH[@]}" REPO_URL="$REPO_URL" REPO_BRANCH="${REPO_BRANCH:-}" \
  SITE_URL="$SITE_URL" API_URL="$API_URL" API_BASE="$API_BASE" \
  PUB_HOST="$PUB_HOST" SECURE="$SECURE" CADDY_MODE="$CADDY_MODE" \
  DOMAIN="${DOMAIN:-}" API_DOMAIN="${API_DOMAIN:-}" EIP="$EIP" \
  BUCKET_NAME="$BUCKET_NAME" AWS_REGION="$AWS_REGION" \
  CDN_BASE_URL="$CDN_BASE_URL" \
  MEDIACONVERT_ROLE_ARN="${MEDIACONVERT_ROLE_ARN:-}" 'bash -s' <<'REMOTE'
set -euo pipefail

# Wait for cloud-init (docker/caddy install) to finish on a fresh instance.
cloud-init status --wait >/dev/null 2>&1 || true

# --- code --------------------------------------------------------------------
# REPO_BRANCH (optional) deploys a specific branch; empty = the repo default.
if [ ! -d luts_store ]; then
  git clone "$REPO_URL" luts_store
fi
cd luts_store
git fetch origin
if [ -n "$REPO_BRANCH" ]; then
  git checkout "$REPO_BRANCH" 2>/dev/null || git checkout -b "$REPO_BRANCH" "origin/$REPO_BRANCH"
  git reset --hard "origin/$REPO_BRANCH"
else
  git pull --ff-only
fi

gen() { python3 -c "import secrets;print(secrets.token_urlsafe($1))"; }

# --- root .env (compose build args: PUBLIC urls) ------------------------------
if [ ! -f .env ]; then
  cp .env.example .env
  sed -i "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=$(gen 24)|" .env || true
fi
set_root() { # KEY VALUE — upsert in root .env
  if grep -q "^$1=" .env; then sed -i "s|^$1=.*|$1=$2|" .env; else echo "$1=$2" >> .env; fi
}
set_root NEXT_PUBLIC_API_URL "$API_URL"
set_root NEXT_PUBLIC_SITE_URL "$SITE_URL"
# Let the storefront CSP + next/image allow the CDN origin (preview media).
[ -n "${CDN_BASE_URL:-}" ] && set_root NEXT_PUBLIC_CDN_URL "$CDN_BASE_URL"
# Public reCAPTCHA v3 site key (bot protection on sign-in + reviews). The CSP
# allows Google's reCAPTCHA hosts only when this is set.
[ -n "${RECAPTCHA_SITE_KEY:-}" ] && set_root NEXT_PUBLIC_RECAPTCHA_SITE_KEY "$RECAPTCHA_SITE_KEY"
# Trustpilot verified-reviews widget (public ids; baked into the frontend build).
[ -n "${TRUSTPILOT_BUSINESS_UNIT_ID:-}" ] && set_root NEXT_PUBLIC_TRUSTPILOT_BUSINESS_UNIT_ID "$TRUSTPILOT_BUSINESS_UNIT_ID"
[ -n "${TRUSTPILOT_TEMPLATE_ID:-}" ] && set_root NEXT_PUBLIC_TRUSTPILOT_TEMPLATE_ID "$TRUSTPILOT_TEMPLATE_ID"
[ -n "${TRUSTPILOT_DOMAIN:-}" ] && set_root NEXT_PUBLIC_TRUSTPILOT_DOMAIN "$TRUSTPILOT_DOMAIN"
# docker-compose.yml passes ALLOWED_HOSTS from THIS file into the backend
# container (its environment: block overrides backend/.env).
set_root ALLOWED_HOSTS "${PUB_HOST},localhost,127.0.0.1,backend"

# --- backend/.env --------------------------------------------------------------
if [ ! -f backend/.env ]; then
  cp backend/.env.example backend/.env
  sed -i "s|^SECRET_KEY=.*|SECRET_KEY=$(gen 48)|" backend/.env
fi
set_var() { # KEY VALUE — upsert in backend/.env
  if grep -q "^$1=" backend/.env; then sed -i "s|^$1=.*|$1=$2|" backend/.env; else echo "$1=$2" >> backend/.env; fi
}
set_var DEBUG False
set_var ALLOWED_HOSTS "${PUB_HOST},localhost,backend"
set_var CORS_ALLOWED_ORIGINS "$SITE_URL"
set_var CSRF_TRUSTED_ORIGINS "$SITE_URL"
set_var FRONTEND_URL "$SITE_URL"
set_var API_BASE_URL "$API_BASE"
# OAuth callbacks must match the deployment host (and be registered with the
# provider). Auto-set them so login works the moment keys are added.
set_var GOOGLE_REDIRECT_URI "${API_BASE}/api/auth/google/callback"
set_var SHOPIFY_CUSTOMER_ACCOUNT_REDIRECT_URI "${API_BASE}/api/auth/shopify/callback"
# Over plain HTTP (IP mode) cookies must NOT be Secure or sessions/CSRF break.
set_var SESSION_COOKIE_SECURE "$SECURE"
set_var CSRF_COOKIE_SECURE "$SECURE"
# In HTTPS/domain mode, force TLS at the app layer and send a long-lived HSTS
# header (1 year, preload). Skipped on plain-IP HTTP where HSTS is invalid and a
# redirect loop would lock you out.
if [ "$SECURE" = "True" ]; then
  set_var SECURE_SSL_REDIRECT True
  set_var SECURE_HSTS_SECONDS 31536000
else
  set_var SECURE_SSL_REDIRECT False
  set_var SECURE_HSTS_SECONDS 0
fi
# S3 delivery via the INSTANCE ROLE — bucket only, no keys on disk.
set_var AWS_S3_BUCKET "$BUCKET_NAME"
set_var AWS_S3_REGION "$AWS_REGION"
# Preview media via CloudFront + adaptive-HLS transcode (both optional). Set
# only when 06-cdn.sh / 02-iam.sh have produced them; blank keeps the presigned
# /api/media path with no HLS.
[ -n "${CDN_BASE_URL:-}" ] && set_var CDN_BASE_URL "$CDN_BASE_URL"
[ -n "${MEDIACONVERT_ROLE_ARN:-}" ] && set_var MEDIACONVERT_ROLE_ARN "$MEDIACONVERT_ROLE_ARN"

# --- build + start -------------------------------------------------------------
./deploy.sh

# --- caddy (reverse proxy) ------------------------------------------------------
if [ "$CADDY_MODE" = "ip" ]; then
  # Plain HTTP on :80, single host. /api/* -> backend, everything else -> frontend.
  sudo tee /etc/caddy/Caddyfile >/dev/null <<'CADDY'
:80 {
    # API, Django admin dashboard, and admin static files -> backend.
    handle /api/* {
        reverse_proxy localhost:8000
    }
    handle /admin* {
        reverse_proxy localhost:8000
    }
    handle /static/* {
        reverse_proxy localhost:8000
    }
    # Everything else -> storefront.
    handle {
        reverse_proxy localhost:3000
    }
}
CADDY
else
  sudo tee /etc/caddy/Caddyfile >/dev/null <<CADDY
${DOMAIN} {
    reverse_proxy localhost:3000
}
${API_DOMAIN} {
    reverse_proxy localhost:8000
}
CADDY
fi
sudo systemctl reload caddy
echo "REMOTE-OK"
REMOTE

echo
ok "application deployed."
if [ "$CADDY_MODE" = "ip" ]; then
  echo "  storefront:  $SITE_URL"
  echo "  API health:  $API_URL/health"
  echo "  (plain HTTP on the IP — later: set USE_IP=0 + real DOMAIN/API_DOMAIN, re-run ./04-app.sh)"
else
  echo "  storefront:  https://$DOMAIN          (TLS issues automatically once DNS resolves)"
  echo "  API:         https://$API_DOMAIN/api/health"
fi
echo
echo "  Secret keys (Stripe, SMTP):"
echo "    cp aws/production-secrets.env.example aws/production-secrets.env   # fill it in"
echo "    ./05-secrets.sh                                                    # pushes + redeploys"
