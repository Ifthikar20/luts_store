#!/usr/bin/env bash
# Shared helpers for the aws/*.sh scripts. Sourced, not executed.
set -euo pipefail

AWSDIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

BLUE='\033[34m'; GREEN='\033[32m'; YELLOW='\033[33m'; RED='\033[31m'; RST='\033[0m'
say()  { printf "${BLUE}▸ %s${RST}\n" "$*"; }
ok()   { printf "${GREEN}✓ %s${RST}\n" "$*"; }
warn() { printf "${YELLOW}! %s${RST}\n" "$*"; }
die()  { printf "${RED}✗ %s${RST}\n" "$*" >&2; exit 1; }

command -v aws >/dev/null 2>&1 || die "aws CLI not found — install AWS CLI v2 and run 'aws configure'."
aws sts get-caller-identity >/dev/null 2>&1 || die "AWS credentials not working — run 'aws configure'."

[ -f "$AWSDIR/config.env" ] || die "aws/config.env missing — cp aws/config.env.example aws/config.env and edit it."
# shellcheck disable=SC1091
source "$AWSDIR/config.env"
export AWS_DEFAULT_REGION="$AWS_REGION"

# state.env accumulates ids produced by the scripts (consumed by later ones).
STATE="$AWSDIR/state.env"
touch "$STATE"
# shellcheck disable=SC1090
source "$STATE"

put_state() { # key value — upsert into state.env
  local key="$1" value="$2"
  grep -vE "^${key}=" "$STATE" > "$STATE.tmp" || true
  echo "${key}=${value}" >> "$STATE.tmp"
  mv "$STATE.tmp" "$STATE"
  export "${key}=${value}"
}

# --- SSH key (single source of truth for 03/04/05) ---------------------------
# Set KEY_FILE in config.env to reuse a private key you already have
# (e.g. fynda-deploy.pem); 03 then never creates or overwrites a key pair.
# Otherwise PEM defaults to aws/$KEY_NAME.pem, which 03 creates.
if [ -n "${KEY_FILE:-}" ]; then
  PEM="${KEY_FILE/#\~/$HOME}"   # expand a leading ~ to $HOME
else
  PEM="$AWSDIR/${KEY_NAME:-luts-store}.pem"
fi
export PEM
