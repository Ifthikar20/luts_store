#!/usr/bin/env bash
#
# 06-cdn.sh — put a CloudFront CDN in front of the PUBLIC preview assets.
#
# Preview images + HLS video (under s3://$BUCKET_NAME/media/*) are public
# storefront content. Serving them through CloudFront gives edge caching, cheap
# egress, and fast delivery of the many small HLS segments. The bucket stays
# private (Block Public Access ON): CloudFront reads it via an Origin Access
# Control (OAC), and a bucket policy grants CloudFront s3:GetObject on media/*
# ONLY — so the paid LUT files under luts/* are NEVER reachable via the CDN.
#
# Idempotent. On success it prints the CloudFront domain to set as CDN_BASE_URL
# (04-app.sh reads it from state.env automatically).
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

[ -n "${BUCKET_NAME:-}" ] || die "BUCKET_NAME unset — set it in config.env (run ./01-s3.sh first)."
ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
OAC_NAME="${BUCKET_NAME}-oac"
CALLER_REF="luts-cdn-${BUCKET_NAME}"

# --- CORS on the bucket: hls.js fetches segments cross-origin (storefront ->
# CloudFront), which is subject to CORS. Preview assets are public, so allow GET.
say "setting bucket CORS (allow cross-origin GET for the HLS player)"
aws s3api put-bucket-cors --bucket "$BUCKET_NAME" --cors-configuration '{
  "CORSRules": [{
    "AllowedOrigins": ["*"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 3000
  }]
}'
ok "CORS set"

# --- Origin Access Control (signs CloudFront->S3 requests with SigV4) ---------
OAC_ID="$(aws cloudfront list-origin-access-controls \
  --query "OriginAccessControlList.Items[?Name=='${OAC_NAME}'].Id | [0]" \
  --output text 2>/dev/null)"
if [ -z "$OAC_ID" ] || [ "$OAC_ID" = "None" ]; then
  say "creating Origin Access Control $OAC_NAME"
  OAC_ID="$(aws cloudfront create-origin-access-control \
    --origin-access-control-config "{
      \"Name\": \"${OAC_NAME}\",
      \"SigningProtocol\": \"sigv4\",
      \"SigningBehavior\": \"always\",
      \"OriginAccessControlOriginType\": \"s3\"
    }" --query 'OriginAccessControl.Id' --output text)"
  ok "OAC created ($OAC_ID)"
else
  ok "OAC already exists ($OAC_ID)"
fi

# --- CloudFront distribution --------------------------------------------------
ORIGIN_DOMAIN="${BUCKET_NAME}.s3.${AWS_REGION}.amazonaws.com"
DIST_ID="$(aws cloudfront list-distributions \
  --query "DistributionList.Items[?Comment=='${CALLER_REF}'].Id | [0]" \
  --output text 2>/dev/null)"

if [ -z "$DIST_ID" ] || [ "$DIST_ID" = "None" ]; then
  say "creating CloudFront distribution (first deploy takes a few minutes to propagate)"
  # CachingOptimized managed policy id (same in every account/region).
  CACHE_POLICY="658327ea-f89d-4fab-a63d-7e88639e58f6"
  DIST_CONFIG="{
    \"CallerReference\": \"${CALLER_REF}-$(date +%s)\",
    \"Comment\": \"${CALLER_REF}\",
    \"Enabled\": true,
    \"Origins\": {
      \"Quantity\": 1,
      \"Items\": [{
        \"Id\": \"s3-media\",
        \"DomainName\": \"${ORIGIN_DOMAIN}\",
        \"OriginAccessControlId\": \"${OAC_ID}\",
        \"S3OriginConfig\": {\"OriginAccessIdentity\": \"\"}
      }]
    },
    \"DefaultCacheBehavior\": {
      \"TargetOriginId\": \"s3-media\",
      \"ViewerProtocolPolicy\": \"redirect-to-https\",
      \"CachePolicyId\": \"${CACHE_POLICY}\",
      \"Compress\": true,
      \"AllowedMethods\": {
        \"Quantity\": 2,
        \"Items\": [\"GET\", \"HEAD\"],
        \"CachedMethods\": {\"Quantity\": 2, \"Items\": [\"GET\", \"HEAD\"]}
      }
    },
    \"DefaultRootObject\": \"\",
    \"PriceClass\": \"PriceClass_100\"
  }"
  CREATE="$(aws cloudfront create-distribution --distribution-config "$DIST_CONFIG")"
  DIST_ID="$(echo "$CREATE" | python3 -c 'import json,sys;print(json.load(sys.stdin)["Distribution"]["Id"])')"
  ok "distribution created ($DIST_ID)"
else
  ok "distribution already exists ($DIST_ID)"
fi

CF_DOMAIN="$(aws cloudfront get-distribution --id "$DIST_ID" \
  --query 'Distribution.DomainName' --output text)"

# --- Bucket policy: allow ONLY this distribution to read media/* --------------
DIST_ARN="arn:aws:cloudfront::${ACCOUNT_ID}:distribution/${DIST_ID}"
say "granting CloudFront read access to s3://${BUCKET_NAME}/media/* (luts/* stays private)"
aws s3api put-bucket-policy --bucket "$BUCKET_NAME" --policy "{
  \"Version\": \"2012-10-17\",
  \"Statement\": [{
    \"Sid\": \"AllowCloudFrontMediaRead\",
    \"Effect\": \"Allow\",
    \"Principal\": {\"Service\": \"cloudfront.amazonaws.com\"},
    \"Action\": \"s3:GetObject\",
    \"Resource\": \"arn:aws:s3:::${BUCKET_NAME}/media/*\",
    \"Condition\": {\"StringEquals\": {\"AWS:SourceArn\": \"${DIST_ARN}\"}}
  }]
}"
ok "bucket policy set"

put_state CLOUDFRONT_DIST_ID "$DIST_ID"
put_state CLOUDFRONT_DOMAIN "$CF_DOMAIN"
echo
ok "CDN ready: https://${CF_DOMAIN}"
echo "  CDN_BASE_URL=https://${CF_DOMAIN}  (04-app.sh sets this automatically on redeploy)"
echo "  Re-run ./04-app.sh to push CDN_BASE_URL + MEDIACONVERT_ROLE_ARN to the app."
