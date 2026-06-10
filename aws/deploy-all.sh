#!/usr/bin/env bash
#
# deploy-all.sh — run the whole AWS bring-up (01→05) as one command, with
# checkpoints so you never repeat finished steps from scratch.
#
# Each step records DONE_<n>=1 in state.env when it succeeds; a re-run skips
# everything already done and resumes from the first unfinished step. There's a
# BREAKPOINT after 03 because you must point DNS at the Elastic IP before 04,
# and step 05 is skipped (not failed) until aws/production-secrets.env is filled.
#
#   ./deploy-all.sh             run remaining steps, pausing at breakpoints
#   ./deploy-all.sh status      show which steps are done / pending
#   ./deploy-all.sh --yes       don't pause at the DNS breakpoint (DNS already set)
#   ./deploy-all.sh --from 3    re-run from step 3 onward (clears later checkpoints)
#   ./deploy-all.sh --only 4    run just step 4 (e.g. redeploy code) and stop
#   ./deploy-all.sh reset       clear all step checkpoints (AWS resources untouched)
#
# Nothing here is destructive: the child scripts only create-or-reuse, and we
# never terminate instances or delete resources. Tear-down stays manual.
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
cd "$AWSDIR"

steps=(01 02 03 04 05)
step_name() { # keep names here; works on macOS's Bash 3.2 (no associative arrays)
  case "$1" in
    01) echo "S3 private product-files bucket" ;;
    02) echo "IAM role (s3:GetObject on luts/* only)" ;;
    03) echo "Security group + key + EC2 + Elastic IP" ;;
    04) echo "App deploy (clone + Docker stack + Caddy TLS)" ;;
    05) echo "Secrets (Stripe / SMTP) push + verify" ;;
  esac
}

norm()      { printf '%02d' "$((10#$1))"; }          # 3 or 03 -> 03
done_flag() { local v="DONE_$1"; [ "${!v:-0}" = "1" ]; }

run_step() { # returns 0 = ok (mark done), 10 = intentionally skipped
  case "$1" in
    01) ./01-s3.sh ;;
    02) ./02-iam.sh ;;
    03) ./03-ec2.sh ;;
    04) ./04-app.sh ;;
    05)
      local s="$AWSDIR/production-secrets.env"
      if [ ! -f "$s" ] || grep -q CHANGEME "$s" 2>/dev/null; then
        warn "step 05 skipped — fill in aws/production-secrets.env, then ./05-secrets.sh"
        return 10
      fi
      ./05-secrets.sh ;;
  esac
}

breakpoint_after() { # pause after 03 so DNS can be pointed at the EIP
  [ "$1" = "03" ] || return 0
  done_flag 04 && return 0
  echo
  warn "BREAKPOINT — before step 04, create two DNS A records pointing at the Elastic IP:"
  echo "      $DOMAIN      →  ${EIP:-<see above>}"
  echo "      $API_DOMAIN  →  ${EIP:-<see above>}"
  echo "  (Caddy needs DNS resolving to issue TLS certificates.)"
  if [ "${ASSUME_YES:-0}" = "1" ]; then
    say "--yes given — continuing without waiting."
  else
    read -r -p "  Press Enter once DNS is set (Ctrl-C to stop; re-run later to resume)… " _
  fi
}

# --- args --------------------------------------------------------------------
ASSUME_YES=0; FROM=""; ONLY=""; CMD="run"
while [ $# -gt 0 ]; do
  case "$1" in
    status)   CMD="status" ;;
    reset)    CMD="reset" ;;
    --yes|-y) ASSUME_YES=1 ;;
    --from)   FROM="$(norm "${2:?--from needs a step number}")"; shift ;;
    --only)   ONLY="$(norm "${2:?--only needs a step number}")"; shift ;;
    *) die "usage: ./deploy-all.sh [status|reset] [--from N] [--only N] [--yes]" ;;
  esac
  shift
done

if [ "$CMD" = status ]; then
  say "deploy checkpoints (aws/state.env):"
  for n in "${steps[@]}"; do
    if done_flag "$n"; then ok "$n  $(step_name "$n")"; else warn "$n  $(step_name "$n") — pending"; fi
  done
  [ -n "${EIP:-}" ] && echo "  Elastic IP: $EIP"
  exit 0
fi

if [ "$CMD" = reset ]; then
  for n in "${steps[@]}"; do put_state "DONE_$n" 0; done
  ok "step checkpoints cleared — AWS resources left untouched."
  exit 0
fi

# --from N: clear checkpoints from N onward so those steps re-run.
if [ -n "$FROM" ]; then
  for n in "${steps[@]}"; do (( 10#$n >= 10#$FROM )) && put_state "DONE_$n" 0; done
fi

say "using SSH key: $PEM"
for n in "${steps[@]}"; do
  if [ -n "$ONLY" ] && [ "$n" != "$ONLY" ]; then continue; fi
  if [ -z "$ONLY" ] && done_flag "$n"; then ok "step $n already done ($(step_name "$n")) — skipping"; continue; fi

  echo; say "=== step $n: $(step_name "$n") ==="
  rc=0; run_step "$n" || rc=$?
  if [ "$rc" -eq 10 ]; then continue; fi          # skipped on purpose, don't mark done
  [ "$rc" -eq 0 ] || die "step $n failed (exit $rc). Fix it and re-run — finished steps stay checkpointed."

  put_state "DONE_$n" 1
  source "$STATE"                                  # pick up EIP and friends for later steps
  breakpoint_after "$n"
  [ -n "$ONLY" ] && break
done

echo
ok "deploy-all complete. Run './deploy-all.sh status' any time to see progress."
