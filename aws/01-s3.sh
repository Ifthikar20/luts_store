#!/usr/bin/env bash
#
# 01-s3.sh — create the PRIVATE product-files bucket (and upload files).
#
#   ./01-s3.sh                  create the bucket, block all public access
#   ./01-s3.sh upload <dir>     upload <dir>/*.zip as s3://$BUCKET_NAME/luts/<name>.zip
#
# Files must be named <product-handle>.zip (e.g. midnight-noir.zip) — the
# backend derives keys as luts/<handle>.zip.
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

create_bucket() {
  if aws s3api head-bucket --bucket "$BUCKET_NAME" 2>/dev/null; then
    ok "bucket $BUCKET_NAME already exists"
  else
    say "creating bucket $BUCKET_NAME in $AWS_REGION"
    if [ "$AWS_REGION" = "us-east-1" ]; then
      aws s3api create-bucket --bucket "$BUCKET_NAME" >/dev/null
    else
      aws s3api create-bucket --bucket "$BUCKET_NAME" \
        --create-bucket-configuration "LocationConstraint=$AWS_REGION" >/dev/null
    fi
    ok "bucket created"
  fi

  say "blocking ALL public access (the bucket stays private; buyers get presigned URLs)"
  aws s3api put-public-access-block --bucket "$BUCKET_NAME" \
    --public-access-block-configuration \
    "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"
  ok "public access blocked"

  say "enabling default encryption (SSE-S3)"
  aws s3api put-bucket-encryption --bucket "$BUCKET_NAME" \
    --server-side-encryption-configuration \
    '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'
  ok "encryption on"

  put_state BUCKET_READY 1
  echo
  ok "S3 ready. Upload your product files with:  ./01-s3.sh upload <directory-of-zips>"
}

upload_files() {
  local dir="${1:-}"
  [ -d "$dir" ] || die "usage: ./01-s3.sh upload <directory containing <handle>.zip files>"
  say "uploading $dir/*.zip to s3://$BUCKET_NAME/luts/"
  aws s3 sync "$dir" "s3://$BUCKET_NAME/luts/" --exclude "*" --include "*.zip"
  ok "uploaded:"
  aws s3 ls "s3://$BUCKET_NAME/luts/"
}

case "${1:-create}" in
  create) create_bucket ;;
  upload) upload_files "${2:-}" ;;
  *) die "usage: ./01-s3.sh [create|upload <dir>]" ;;
esac
