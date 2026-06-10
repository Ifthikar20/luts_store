#!/usr/bin/env bash
#
# 04-app.sh — install and start the application on the instance (over SSH).
#
# Clones the repo, writes both env files with the production URLs + the S3
# bucket (credentials come from the instance ROLE — no keys on disk), builds
# and starts the Docker stack, and configures Caddy for auto-TLS.
#
# Re-runnable: pulls the latest code and redeploys.
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

[ -n "${EIP:-}" ] || die "no EIP in state — run ./03-ec2.sh first."
PEM="$AWSDIR/$KEY_NAME.pem"
[ -f "$PEM" ] || die "$PEM missing — needed to ssh."

SSH=(ssh -i "$PEM" -o StrictHostKeyChecking=accept-new "ubuntu@$EIP")

say "deploying to ubuntu@$EIP (this builds Docker images — first run takes a few minutes)"

"${SSH[@]}" REPO_URL="$REPO_URL" DOMAIN="$DOMAIN" API_DOMAIN="$API_DOMAIN" \
  BUCKET_NAME="$BUCKET_NAME" AWS_REGION="$AWS_REGION" 'bash -s' <<'REMOTE'
set -euo pipefail

# Wait for cloud-init (docker/caddy install) to finish on a fresh instance.
cloud-init status --wait >/dev/null 2>&1 || true

# --- code --------------------------------------------------------------------
if [ -d luts_store ]; then
  cd luts_store && git pull --ff-only
else
  git clone "$REPO_URL" luts_store && cd luts_store
fi

gen() { python3 -c "import secrets;print(secrets.token_urlsafe($1))"; }

# --- root .env (compose build args: PUBLIC urls) ------------------------------
if [ ! -f .env ]; then
  cp .env.example .env
  sed -i "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=$(gen 24)|" .env || true
fi
grep -q '^NEXT_PUBLIC_API_URL=' .env \
  && sed -i "s|^NEXT_PUBLIC_API_URL=.*|NEXT_PUBLIC_API_URL=https://${API_DOMAIN}/api|" .env \
  || echo "NEXT_PUBLIC_API_URL=https://${API_DOMAIN}/api" >> .env
grep -q '^NEXT_PUBLIC_SITE_URL=' .env \
  && sed -i "s|^NEXT_PUBLIC_SITE_URL=.*|NEXT_PUBLIC_SITE_URL=https://${DOMAIN}|" .env \
  || echo "NEXT_PUBLIC_SITE_URL=https://${DOMAIN}" >> .env
# docker-compose.yml passes ALLOWED_HOSTS from THIS file into the backend
# container (its environment: block overrides backend/.env) — so the public
# API host must be declared here.
grep -q '^ALLOWED_HOSTS=' .env \
  && sed -i "s|^ALLOWED_HOSTS=.*|ALLOWED_HOSTS=${API_DOMAIN},localhost,127.0.0.1,backend|" .env \
  || echo "ALLOWED_HOSTS=${API_DOMAIN},localhost,127.0.0.1,backend" >> .env

# --- backend/.env --------------------------------------------------------------
if [ ! -f backend/.env ]; then
  cp backend/.env.example backend/.env
  sed -i "s|^SECRET_KEY=.*|SECRET_KEY=$(gen 48)|" backend/.env
fi
set_var() { # KEY VALUE — upsert in backend/.env
  if grep -q "^$1=" backend/.env; then
    sed -i "s|^$1=.*|$1=$2|" backend/.env
  else
    echo "$1=$2" >> backend/.env
  fi
}
set_var DEBUG False
set_var ALLOWED_HOSTS "${API_DOMAIN},localhost,backend"
set_var CORS_ALLOWED_ORIGINS "https://${DOMAIN}"
set_var CSRF_TRUSTED_ORIGINS "https://${DOMAIN}"
set_var FRONTEND_URL "https://${DOMAIN}"
set_var API_BASE_URL "https://${API_DOMAIN}"
set_var SESSION_COOKIE_SECURE True
set_var CSRF_COOKIE_SECURE True
# S3 delivery via the INSTANCE ROLE — bucket only, no keys on disk.
set_var AWS_S3_BUCKET "${BUCKET_NAME}"
set_var AWS_S3_REGION "${AWS_REGION}"

# --- build + start -------------------------------------------------------------
./deploy.sh

# --- caddy (auto-TLS reverse proxy) ---------------------------------------------
sudo tee /etc/caddy/Caddyfile >/dev/null <<CADDY
${DOMAIN} {
    reverse_proxy localhost:3000
}
${API_DOMAIN} {
    reverse_proxy localhost:8000
}
CADDY
sudo systemctl reload caddy
echo "REMOTE-OK"
REMOTE

echo
ok "application deployed."
echo "  storefront:  https://$DOMAIN          (TLS issues automatically once DNS resolves)"
echo "  API:         https://$API_DOMAIN/api/health"
echo
echo "  Final step — your secret keys (Stripe, SMTP):"
echo "    cp aws/production-secrets.env.example aws/production-secrets.env   # fill it in"
echo "    ./05-secrets.sh                                                    # pushes + redeploys"
