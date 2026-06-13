#!/usr/bin/env bash
#
# 02-iam.sh — least-privilege IAM for the EC2 instance + MediaConvert.
#
# Creates:
#   1. A MediaConvert SERVICE role ($MC_ROLE_NAME) that MediaConvert assumes to
#      read uploaded clips and write HLS/poster outputs under $BUCKET_NAME/media/*.
#   2. The EC2 role + instance profile, scoped to GetObject/PutObject on
#      $BUCKET_NAME/luts/* (LUT downloads + admin uploads) and /media/* (preview
#      images/videos), PLUS permission to submit MediaConvert jobs and PassRole
#      the service role above. Nothing else.
# No access keys are created; boto3 picks the instance role up automatically.
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
MC_ROLE_NAME="${ROLE_NAME}-mediaconvert"
MC_ROLE_ARN="arn:aws:iam::${ACCOUNT_ID}:role/${MC_ROLE_NAME}"

# --- 1) MediaConvert service role -------------------------------------------
MC_TRUST='{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": {"Service": "mediaconvert.amazonaws.com"},
    "Action": "sts:AssumeRole"
  }]
}'
MC_POLICY="{
  \"Version\": \"2012-10-17\",
  \"Statement\": [{
    \"Effect\": \"Allow\",
    \"Action\": [\"s3:GetObject\", \"s3:PutObject\"],
    \"Resource\": \"arn:aws:s3:::${BUCKET_NAME}/media/*\"
  }]
}"
if aws iam get-role --role-name "$MC_ROLE_NAME" >/dev/null 2>&1; then
  ok "MediaConvert role $MC_ROLE_NAME already exists"
else
  say "creating MediaConvert service role $MC_ROLE_NAME"
  aws iam create-role --role-name "$MC_ROLE_NAME" \
    --assume-role-policy-document "$MC_TRUST" >/dev/null
  ok "MediaConvert role created"
fi
aws iam put-role-policy --role-name "$MC_ROLE_NAME" \
  --policy-name mediaconvert-s3 --policy-document "$MC_POLICY"
put_state MEDIACONVERT_ROLE_ARN "$MC_ROLE_ARN"
ok "MediaConvert role can read/write ${BUCKET_NAME}/media/*"

# --- 2) EC2 instance role ----------------------------------------------------
TRUST='{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": {"Service": "ec2.amazonaws.com"},
    "Action": "sts:AssumeRole"
  }]
}'

POLICY="{
  \"Version\": \"2012-10-17\",
  \"Statement\": [{
    \"Sid\": \"LutFilesReadWrite\",
    \"Effect\": \"Allow\",
    \"Action\": [\"s3:GetObject\", \"s3:PutObject\"],
    \"Resource\": \"arn:aws:s3:::${BUCKET_NAME}/luts/*\"
  }, {
    \"Sid\": \"MediaReadWrite\",
    \"Effect\": \"Allow\",
    \"Action\": [\"s3:GetObject\", \"s3:PutObject\"],
    \"Resource\": \"arn:aws:s3:::${BUCKET_NAME}/media/*\"
  }, {
    \"Sid\": \"SubmitTranscodeJobs\",
    \"Effect\": \"Allow\",
    \"Action\": [
      \"mediaconvert:CreateJob\",
      \"mediaconvert:GetJob\",
      \"mediaconvert:DescribeEndpoints\"
    ],
    \"Resource\": \"*\"
  }, {
    \"Sid\": \"PassMediaConvertRole\",
    \"Effect\": \"Allow\",
    \"Action\": \"iam:PassRole\",
    \"Resource\": \"${MC_ROLE_ARN}\"
  }]
}"

if aws iam get-role --role-name "$ROLE_NAME" >/dev/null 2>&1; then
  ok "role $ROLE_NAME already exists"
else
  say "creating role $ROLE_NAME"
  aws iam create-role --role-name "$ROLE_NAME" \
    --assume-role-policy-document "$TRUST" >/dev/null
  ok "role created"
fi

say "attaching least-privilege policy (S3 luts/* + media/*, MediaConvert submit)"
aws iam put-role-policy --role-name "$ROLE_NAME" \
  --policy-name read-lut-files --policy-document "$POLICY"
ok "policy attached"

if aws iam get-instance-profile --instance-profile-name "$ROLE_NAME" >/dev/null 2>&1; then
  ok "instance profile already exists"
else
  say "creating instance profile"
  aws iam create-instance-profile --instance-profile-name "$ROLE_NAME" >/dev/null
  aws iam add-role-to-instance-profile \
    --instance-profile-name "$ROLE_NAME" --role-name "$ROLE_NAME"
  ok "instance profile created"
  say "waiting 10s for IAM propagation"
  sleep 10
fi

put_state IAM_READY 1
ok "IAM ready — next: ./03-ec2.sh"
echo "  MediaConvert role: $MC_ROLE_ARN"
