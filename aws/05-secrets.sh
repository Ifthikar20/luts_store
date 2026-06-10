#!/usr/bin/env bash
#
# 05-secrets.sh — push your secret keys to the server and redeploy.
#
# Reads aws/production-secrets.env (KEY=VALUE lines), upserts each into the
# server's backend/.env over SSH, restarts the stack, and verifies the
# integrations. Re-run any time you rotate a key.
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

[ -n "${EIP:-}" ] || die "no EIP in state — run ./03-ec2.sh first."
PEM="$AWSDIR/$KEY_NAME.pem"
[ -f "$PEM" ] || die "$PEM missing — needed to ssh."
SECRETS="$AWSDIR/production-secrets.env"
[ -f "$SECRETS" ] || die "aws/production-secrets.env missing — cp aws/production-secrets.env.example aws/production-secrets.env and fill it in."

if grep -q CHANGEME "$SECRETS"; then
  die "aws/production-secrets.env still contains CHANGEME placeholders — fill in real values first."
fi

say "pushing secrets to ubuntu@$EIP and redeploying"

ssh -i "$PEM" -o StrictHostKeyChecking=accept-new "ubuntu@$EIP" 'bash -s' < <(
  cat <<'HEAD'
set -euo pipefail
cd luts_store
set_var() {
  if grep -q "^$1=" backend/.env; then
    sed -i "s|^$1=.*|$1=$(printf '%s' "$2" | sed 's/[&|]/\\&/g')|" backend/.env
  else
    echo "$1=$2" >> backend/.env
  fi
}
HEAD
  # Emit one set_var call per non-comment, non-empty line of the secrets file.
  grep -vE '^\s*(#|$)' "$SECRETS" | while IFS='=' read -r key value; do
    printf "set_var %q %q\n" "$key" "$value"
  done
  cat <<'TAIL'
docker compose up -d --force-recreate backend
sleep 5
docker compose exec -T backend python manage.py verify_integrations || true
echo "REMOTE-OK"
TAIL
)

echo
ok "secrets applied. Smoke-test the funnel: visit your store, buy with Stripe's"
echo "  test card 4242 4242 4242 4242, and check the email + download arrive."
