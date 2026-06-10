#!/usr/bin/env bash
#
# deploy.sh — one-shot production-style deploy of the LUTs store via Docker.
#
#   ./deploy.sh                build + start the full stack (db, backend, frontend)
#   ./deploy.sh status         show container status + health
#   ./deploy.sh logs           follow logs
#   ./deploy.sh down           stop the stack (data volume is kept)
#
# First run: creates .env and backend/.env from their examples (generating a
# strong SECRET_KEY + Postgres password), then builds and starts everything.
# Re-run after changing env or code: it rebuilds and restarts in place.
#
# Live integrations (Stripe / S3 / SMTP / Shopify) activate automatically when
# their keys are present in backend/.env — see GOING_LIVE.md. Without keys the
# stack runs in full demo mode.

set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"

BLUE='\033[34m'; GREEN='\033[32m'; YELLOW='\033[33m'; RED='\033[31m'; RST='\033[0m'
say()  { printf "${BLUE}▸ %s${RST}\n" "$*"; }
ok()   { printf "${GREEN}✓ %s${RST}\n" "$*"; }
warn() { printf "${YELLOW}! %s${RST}\n" "$*"; }
die()  { printf "${RED}✗ %s${RST}\n" "$*" >&2; exit 1; }

compose() { docker compose "$@"; }

check_prereqs() {
  command -v docker >/dev/null 2>&1 || die "docker not found — install Docker first."
  docker compose version >/dev/null 2>&1 || die "docker compose v2 not found."
  ok "docker $(docker --version | sed 's/Docker version //;s/,.*//')"
}

rand() { python3 - "$1" <<'PY'
import secrets, sys
print(secrets.token_urlsafe(int(sys.argv[1])))
PY
}

ensure_env() {
  # Root .env: compose-level config (Postgres creds, public URLs).
  if [ ! -f .env ]; then
    say "creating .env from .env.example"
    cp .env.example .env
    local pgpass; pgpass="$(rand 24)"
    sed -i.bak "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=${pgpass}|" .env 2>/dev/null || true
    rm -f .env.bak
    ok ".env created"
  fi

  # backend/.env: application config + secrets.
  if [ ! -f backend/.env ]; then
    say "creating backend/.env from backend/.env.example"
    cp backend/.env.example backend/.env
    local key; key="$(rand 48)"
    sed -i.bak "s|^SECRET_KEY=.*|SECRET_KEY=${key}|" backend/.env
    rm -f backend/.env.bak
    ok "backend/.env created with a generated SECRET_KEY"
  fi
}

report_modes() {
  # Read a var from backend/.env (last assignment wins; empty if unset).
  getvar() { grep -E "^$1=" backend/.env | tail -1 | cut -d= -f2-; }
  say "integration status (backend/.env):"
  [ -n "$(getvar STRIPE_SECRET_KEY)" ] \
    && ok  "payments: Stripe LIVE (checkout -> hosted Stripe page)" \
    || warn "payments: demo checkout (set STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET)"
  [ -n "$(getvar AWS_S3_BUCKET)" ] \
    && ok  "delivery: real S3 presigned downloads" \
    || warn "delivery: placeholder .cube files (set AWS_* + upload luts/<handle>.zip)"
  case "$(getvar EMAIL_BACKEND)" in
    *smtp*) ok "email: SMTP receipts" ;;
    *)      warn "email: console only (set EMAIL_BACKEND=...smtp.EmailBackend + EMAIL_*)" ;;
  esac
  [ -n "$(getvar SHOPIFY_STOREFRONT_TOKEN)" ] \
    && ok  "catalog: live Shopify" \
    || warn "catalog: in-repo mock catalog (fine for Stripe-only stores)"
}

wait_for() { # url, name, tries
  local url="$1" name="$2" tries="${3:-30}"
  say "waiting for ${name} (${url})"
  for _ in $(seq 1 "$tries"); do
    if curl -fsS -o /dev/null "$url" 2>/dev/null; then ok "${name} is up"; return 0; fi
    sleep 2
  done
  warn "${name} did not respond after $((tries*2))s — check: docker compose logs"
  return 1
}

case "${1:-up}" in
  up|"")
    check_prereqs
    ensure_env
    report_modes
    say "building images (backend, frontend)"
    compose build
    say "starting stack"
    compose up -d
    wait_for "http://localhost:8000/api/health" "backend API"
    wait_for "http://localhost:3000" "storefront"
    echo
    ok "deployed:  storefront http://localhost:3000   API http://localhost:8000/api"
    echo "  Next: put real keys in backend/.env (see GOING_LIVE.md), then ./deploy.sh again."
    echo "  For public traffic, put a TLS proxy (Caddy/nginx/CDN) in front of :3000 and :8000,"
    echo "  set NEXT_PUBLIC_API_URL/NEXT_PUBLIC_SITE_URL in .env to the public URLs, and set"
    echo "  ALLOWED_HOSTS/CORS_ALLOWED_ORIGINS/CSRF_TRUSTED_ORIGINS + the SECURE_* flags in backend/.env."
    ;;
  status) compose ps ;;
  logs)   compose logs -f --tail=100 ;;
  down)   compose down; ok "stack stopped (volume pgdata kept)" ;;
  *) die "usage: ./deploy.sh [up|status|logs|down]" ;;
esac
