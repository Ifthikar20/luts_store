#!/usr/bin/env bash
#
# 02-iam.sh — least-privilege IAM for the EC2 instance.
#
# Creates a role + instance profile whose ONLY permission is s3:GetObject on
# $BUCKET_NAME/luts/* — the instance can serve presigned downloads and nothing
# else. No access keys are created; boto3 picks the role up automatically.
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

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
    \"Sid\": \"ReadLutFilesOnly\",
    \"Effect\": \"Allow\",
    \"Action\": \"s3:GetObject\",
    \"Resource\": \"arn:aws:s3:::${BUCKET_NAME}/luts/*\"
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

say "attaching least-privilege S3 policy (s3:GetObject on ${BUCKET_NAME}/luts/* only)"
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
