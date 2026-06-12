#!/usr/bin/env bash
#
# ship.sh — one command to push the latest code and redeploy it to the live box.
#
#   ./ship.sh                 deploy the current git branch to production
#   ./ship.sh <branch>        deploy a specific branch
#   ./ship.sh --no-push       deploy whatever is already on origin (skip git push)
#   ./ship.sh --yes           don't prompt (e.g. when the tree has local changes)
#   ./ship.sh status          show the live AWS deploy checkpoints
#
# What it does, in order:
#   1. pushes the branch to origin            (so the server has the code to pull)
#   2. points the live server at that branch  (REPO_BRANCH in aws/config.env)
#   3. runs aws/04-app.sh, which SSHes to the EC2 box, pulls the branch, rebuilds
#      the Docker stack and reloads Caddy. collectstatic + migrate run inside the
#      backend container on start (see docker-compose.yml), so there's nothing
#      else to do by hand.
#
# Re-runnable and non-destructive: the server only ever pulls + rebuilds.
# Requires the AWS bring-up (aws/deploy-all.sh, steps 01–03) to have run once.

set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

# `status` needs no git work — hand straight to the AWS orchestrator and exit.
if [ "${1:-}" = "status" ]; then
  exec ./aws/deploy-all.sh status
fi

# --- args --------------------------------------------------------------------
BRANCH=""; PUSH=1; ASSUME_YES=0
while [ $# -gt 0 ]; do
  case "$1" in
    --no-push)  PUSH=0 ;;
    --yes|-y)   ASSUME_YES=1 ;;
    -*)         echo "usage: ./ship.sh [<branch>] [--no-push] [--yes] | status" >&2; exit 2 ;;
    *)          BRANCH="$1" ;;
  esac
  shift
done

# Pull in the shared aws helpers (say/ok/warn/die) and validate the AWS context
# (aws CLI + creds + aws/config.env + the SSH key). Fails fast before we push if
# the live environment isn't set up.
# shellcheck disable=SC1091
source "$ROOT/aws/lib.sh"

# Branch to ship: explicit arg, else the branch currently checked out.
if [ -z "$BRANCH" ]; then
  BRANCH="$(git rev-parse --abbrev-ref HEAD)"
  [ "$BRANCH" != "HEAD" ] || die "detached HEAD — pass a branch: ./ship.sh <branch>"
fi
say "shipping branch: $BRANCH"

# Only committed code deploys — the server pulls from origin. Warn on a dirty tree.
if [ -n "$(git status --porcelain)" ]; then
  warn "working tree has uncommitted changes — they will NOT be deployed (only $BRANCH on origin will)."
  if [ "$ASSUME_YES" != "1" ]; then
    read -r -p "  Continue anyway? [y/N] " ans
    case "$ans" in y|Y|yes|YES) ;; *) die "aborted — commit your changes first, or pass --yes." ;; esac
  fi
fi

# --- 1. push -----------------------------------------------------------------
if [ "$PUSH" = "1" ]; then
  say "pushing $BRANCH to origin"
  pushed=0
  for i in 1 2 3 4 5; do
    if git push -u origin "$BRANCH"; then pushed=1; break; fi
    [ "$i" -lt 5 ] || break
    delay=$((2 ** i)); warn "push failed — retrying in ${delay}s ($i/4)"; sleep "$delay"
  done
  [ "$pushed" = "1" ] || die "git push failed after retries."
  ok "pushed $BRANCH"
else
  say "--no-push: deploying whatever is on origin/$BRANCH"
fi

# --- 2. point the live server at this branch ---------------------------------
# aws/04-app.sh reads REPO_BRANCH from aws/config.env (via lib.sh) and the server
# does `git reset --hard origin/$REPO_BRANCH`. Upsert it so the box builds the
# branch we just pushed. config.env is git-ignored, so this is local-only state.
CFG="$ROOT/aws/config.env"
if grep -qE '^REPO_BRANCH=' "$CFG"; then
  sed -i.bak "s|^REPO_BRANCH=.*|REPO_BRANCH=$BRANCH|" "$CFG" && rm -f "$CFG.bak"
else
  echo "REPO_BRANCH=$BRANCH" >> "$CFG"
fi
ok "live server pinned to origin/$BRANCH"

# --- 3. redeploy on the box --------------------------------------------------
say "redeploying on the live instance (pull + rebuild + reload)…"
./aws/04-app.sh

echo
ok "shipped $BRANCH to production."
