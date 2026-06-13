#!/usr/bin/env bash
#
# 07-budget.sh — a spend alarm so you never get a surprise bill.
#
# Creates an AWS Budget that emails you when this month's cost crosses 80% of
# your limit (actual) and again when it's *forecast* to exceed 100%. AWS Budgets
# is free for the first two budgets, so this monitoring itself costs nothing.
#
# Set in aws/config.env:
#   BUDGET_LIMIT=30                 # USD/month you want to stay under
#   BUDGET_ALERT_EMAIL=you@x.com    # where alerts go
#
# This is the answer to "how do I know if I'm being charged?": you'll get an
# email the moment spend moves, and you can watch live in the Billing console.
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

: "${BUDGET_ALERT_EMAIL:?set BUDGET_ALERT_EMAIL in aws/config.env}"
LIMIT="${BUDGET_LIMIT:-30}"
ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
NAME="luts-store-monthly"

if aws budgets describe-budget --account-id "$ACCOUNT_ID" --budget-name "$NAME" >/dev/null 2>&1; then
  ok "budget '$NAME' already exists — updating limit to \$$LIMIT"
  aws budgets update-budget --account-id "$ACCOUNT_ID" --new-budget "{
    \"BudgetName\": \"$NAME\",
    \"BudgetLimit\": {\"Amount\": \"$LIMIT\", \"Unit\": \"USD\"},
    \"TimeUnit\": \"MONTHLY\",
    \"BudgetType\": \"COST\"
  }" >/dev/null
else
  say "creating \$$LIMIT/month budget, alerting $BUDGET_ALERT_EMAIL"
  aws budgets create-budget --account-id "$ACCOUNT_ID" \
    --budget "{
      \"BudgetName\": \"$NAME\",
      \"BudgetLimit\": {\"Amount\": \"$LIMIT\", \"Unit\": \"USD\"},
      \"TimeUnit\": \"MONTHLY\",
      \"BudgetType\": \"COST\"
    }" \
    --notifications-with-subscribers "[
      {
        \"Notification\": {\"NotificationType\": \"ACTUAL\", \"ComparisonOperator\": \"GREATER_THAN\", \"Threshold\": 80, \"ThresholdType\": \"PERCENTAGE\"},
        \"Subscribers\": [{\"SubscriptionType\": \"EMAIL\", \"Address\": \"$BUDGET_ALERT_EMAIL\"}]
      },
      {
        \"Notification\": {\"NotificationType\": \"FORECASTED\", \"ComparisonOperator\": \"GREATER_THAN\", \"Threshold\": 100, \"ThresholdType\": \"PERCENTAGE\"},
        \"Subscribers\": [{\"SubscriptionType\": \"EMAIL\", \"Address\": \"$BUDGET_ALERT_EMAIL\"}]
      }
    ]" >/dev/null
  ok "budget created"
fi

echo
ok "Spend alerts are live for $BUDGET_ALERT_EMAIL (limit \$$LIMIT/mo)."
echo "  See live spend any time:  https://console.aws.amazon.com/billing/home#/bills"
echo "  Free-tier usage:          https://console.aws.amazon.com/billing/home#/freetier"
