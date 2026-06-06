#!/usr/bin/env bash
#
# dev.sh — one-shot setup + run for The Looks Lab (backend :8000 + frontend :3000)
#
#   ./dev.sh            setup (if needed) and run both servers
#   ./dev.sh setup      install deps + migrate only, don't start servers
#   ./dev.sh backend    run only the Django backend
#   ./dev.sh frontend   run only the Next.js frontend
#
# Safe to re-run: it skips work that's already done. Ctrl-C stops both servers.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND="$ROOT/backend"
FRONTEND="$ROOT/frontend"

# ---- pretty output --------------------------------------------------------
BLUE='\033[34m'; GREEN='\033[32m'; YELLOW='\033[33m'; RED='\033[31m'; DIM='\033[2m'; RST='\033[0m'
say()  { printf "${BLUE}▸ %s${RST}\n" "$*"; }
ok()   { printf "${GREEN}✓ %s${RST}\n" "$*"; }
warn() { printf "${YELLOW}! %s${RST}\n" "$*"; }
die()  { printf "${RED}✗ %s${RST}\n" "$*" >&2; exit 1; }

# ---- prerequisites --------------------------------------------------------
check_prereqs() {
  command -v python3 >/dev/null 2>&1 || die "python3 not found. Install Python 3.11+."
  command -v node    >/dev/null 2>&1 || die "node not found. Install Node 18+ (22 recommended)."
  command -v npm     >/dev/null 2>&1 || die "npm not found."
  ok "python3 $(python3 -V 2>&1 | awk '{print $2}')  •  node $(node -v)  •  npm $(npm -v)"
}

# ---- backend setup --------------------------------------------------------
setup_backend() {
  say "Backend: setting up"
  cd "$BACKEND"
  if [ ! -d .venv ]; then
    say "creating virtualenv (.venv)"
    python3 -m venv .venv
  fi
  # use the venv's interpreter directly — no 'activate' needed
  ./.venv/bin/python -m pip install --quiet --upgrade pip
  say "installing Python deps"
  ./.venv/bin/python -m pip install --quiet -r requirements.txt
  if [ ! -f .env ]; then
    cp .env.example .env
    warn "created backend/.env from .env.example (blank SHOPIFY_*/AWS_* = mock mode)"
  fi
  say "applying migrations"
  ./.venv/bin/python manage.py migrate --noinput >/dev/null
  ok "backend ready"
}

# ---- frontend setup -------------------------------------------------------
setup_frontend() {
  say "Frontend: setting up"
  cd "$FRONTEND"
  if [ ! -d node_modules ]; then
    say "installing Node deps (npm install)"
    npm install --no-fund --no-audit
  else
    ok "node_modules present (skipping npm install)"
  fi
  if [ ! -f .env.local ]; then
    cp .env.local.example .env.local
    warn "created frontend/.env.local (NEXT_PUBLIC_API_URL=http://localhost:8000/api)"
  fi
  ok "frontend ready"
}

# ---- runners --------------------------------------------------------------
run_backend()  { cd "$BACKEND";  exec ./.venv/bin/python manage.py runserver 8000; }
run_frontend() { cd "$FRONTEND"; exec npm run dev; }

run_both() {
  pids=()
  cleanup() { printf "\n"; say "stopping…"; for p in "${pids[@]}"; do kill "$p" 2>/dev/null || true; done; }
  trap cleanup INT TERM EXIT

  ( cd "$BACKEND";  ./.venv/bin/python manage.py runserver 8000 ) & pids+=($!)
  ( cd "$FRONTEND"; npm run dev ) & pids+=($!)

  printf "\n"
  ok "Backend  → http://localhost:8000/api/health"
  ok "Frontend → http://localhost:3000"
  printf "${DIM}(Ctrl-C to stop both)${RST}\n\n"
  wait
}

# ---- main -----------------------------------------------------------------
cmd="${1:-all}"
case "$cmd" in
  setup)
    check_prereqs; setup_backend; setup_frontend
    ok "Setup complete. Run ./dev.sh to start both servers." ;;
  backend)
    check_prereqs; setup_backend; say "starting backend"; run_backend ;;
  frontend)
    check_prereqs; setup_frontend; say "starting frontend"; run_frontend ;;
  all|"")
    check_prereqs; setup_backend; setup_frontend; run_both ;;
  *)
    die "unknown command '$cmd' (use: setup | backend | frontend | all)" ;;
esac
