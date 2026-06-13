#!/usr/bin/env bash
#
# 03-ec2.sh — launch the server.
#
# Creates: a security group (22 from $SSH_CIDR, 80/443 from anywhere), a key
# pair (saved to aws/$KEY_NAME.pem), an Ubuntu 24.04 instance with the IAM role
# from 02 attached, and an Elastic IP. cloud-init installs docker + caddy + git.
#
# The root EBS volume is ENCRYPTED (AWS-managed aws/ebs KMS key, no extra cost):
# that gives encryption at rest for everything on the box — including the
# Postgres data volume — transparently (encrypt on write, decrypt on read).
#
# Prints the Elastic IP — point your DNS A records ($DOMAIN and $API_DOMAIN) at
# it, then run ./04-app.sh.
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

# --- security group ---------------------------------------------------------
VPC_ID=$(aws ec2 describe-vpcs --filters Name=is-default,Values=true \
  --query 'Vpcs[0].VpcId' --output text)
[ "$VPC_ID" != "None" ] || die "no default VPC in $AWS_REGION — create one or set a VPC up manually."

SG_ID=$(aws ec2 describe-security-groups \
  --filters "Name=group-name,Values=$SG_NAME" "Name=vpc-id,Values=$VPC_ID" \
  --query 'SecurityGroups[0].GroupId' --output text 2>/dev/null || echo None)
if [ "$SG_ID" = "None" ]; then
  say "creating security group $SG_NAME (22 from $SSH_CIDR; 80/443 from anywhere)"
  SG_ID=$(aws ec2 create-security-group --group-name "$SG_NAME" \
    --description "luts-store: ssh + caddy only" --vpc-id "$VPC_ID" \
    --query GroupId --output text)
  aws ec2 authorize-security-group-ingress --group-id "$SG_ID" \
    --protocol tcp --port 22 --cidr "$SSH_CIDR" >/dev/null
  aws ec2 authorize-security-group-ingress --group-id "$SG_ID" \
    --protocol tcp --port 80 --cidr 0.0.0.0/0 >/dev/null
  aws ec2 authorize-security-group-ingress --group-id "$SG_ID" \
    --protocol tcp --port 443 --cidr 0.0.0.0/0 >/dev/null
  ok "security group $SG_ID (app ports 3000/8000 stay closed — Caddy is the only door)"
else
  ok "security group exists: $SG_ID"
fi
put_state SG_ID "$SG_ID"

# --- key pair ----------------------------------------------------------------
# $PEM is resolved in lib.sh: aws/$KEY_NAME.pem by default, or KEY_FILE if set.
if [ -n "${KEY_FILE:-}" ]; then
  # You brought your own key (e.g. fynda-deploy.pem). Never create or overwrite
  # it — just make sure it's present locally and registered in this AWS region.
  [ -f "$PEM" ] || die "KEY_FILE=$KEY_FILE not found — point it at your .pem."
  chmod 400 "$PEM" 2>/dev/null || true
  if aws ec2 describe-key-pairs --key-names "$KEY_NAME" >/dev/null 2>&1; then
    ok "using your existing key pair '$KEY_NAME' ($PEM)"
  else
    die "key pair '$KEY_NAME' is not in AWS region $AWS_REGION.
   Register the public half of your key once, then re-run:
     ssh-keygen -y -f '$PEM' > '$PEM.pub'
     aws ec2 import-key-pair --key-name '$KEY_NAME' \\
       --public-key-material fileb://'$PEM.pub'"
  fi
elif aws ec2 describe-key-pairs --key-names "$KEY_NAME" >/dev/null 2>&1; then
  ok "key pair $KEY_NAME exists"
  [ -f "$PEM" ] || warn "but $PEM is not on this machine — you'll need the original to ssh."
else
  say "creating key pair $KEY_NAME"
  aws ec2 create-key-pair --key-name "$KEY_NAME" \
    --query KeyMaterial --output text > "$PEM"
  chmod 400 "$PEM"
  ok "private key saved to $PEM (keep it safe; never commit it)"
fi

# --- AMI (Ubuntu 24.04 LTS, canonical-published, via public SSM parameter) ---
AMI=$(aws ssm get-parameter \
  --name /aws/service/canonical/ubuntu/server/24.04/stable/current/amd64/hvm/ebs-gp3/ami-id \
  --query Parameter.Value --output text)
ok "AMI: $AMI (Ubuntu 24.04 LTS)"

# --- launch -------------------------------------------------------------------
if [ -n "${INSTANCE_ID:-}" ] && aws ec2 describe-instances --instance-ids "$INSTANCE_ID" \
     --query 'Reservations[0].Instances[0].State.Name' --output text 2>/dev/null \
     | grep -qE 'running|pending'; then
  ok "instance already running: $INSTANCE_ID"
else
  USERDATA=$(cat <<'EOF'
#!/bin/bash
set -e
apt-get update
apt-get install -y docker.io docker-compose-v2 caddy git curl
usermod -aG docker ubuntu
systemctl enable --now docker caddy
EOF
)
  say "launching $INSTANCE_TYPE"
  INSTANCE_ID=$(aws ec2 run-instances \
    --image-id "$AMI" --instance-type "$INSTANCE_TYPE" \
    --key-name "$KEY_NAME" --security-group-ids "$SG_ID" \
    --iam-instance-profile "Name=$ROLE_NAME" \
    --block-device-mappings '[{"DeviceName":"/dev/sda1","Ebs":{"VolumeSize":20,"VolumeType":"gp3","Encrypted":true}}]' \
    --user-data "$USERDATA" \
    --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=luts-store}]' \
    --query 'Instances[0].InstanceId' --output text)
  put_state INSTANCE_ID "$INSTANCE_ID"
  say "waiting for instance to be running"
  aws ec2 wait instance-running --instance-ids "$INSTANCE_ID"
  ok "instance running: $INSTANCE_ID"
fi
put_state INSTANCE_ID "$INSTANCE_ID"

# --- elastic ip ---------------------------------------------------------------
if [ -n "${EIP_ALLOC:-}" ] && aws ec2 describe-addresses --allocation-ids "$EIP_ALLOC" >/dev/null 2>&1; then
  ok "elastic IP already allocated"
else
  say "allocating Elastic IP"
  EIP_ALLOC=$(aws ec2 allocate-address --domain vpc --query AllocationId --output text)
  put_state EIP_ALLOC "$EIP_ALLOC"
fi
aws ec2 associate-address --instance-id "$INSTANCE_ID" --allocation-id "$EIP_ALLOC" >/dev/null
EIP=$(aws ec2 describe-addresses --allocation-ids "$EIP_ALLOC" --query 'Addresses[0].PublicIp' --output text)
put_state EIP "$EIP"

echo
ok "server is up:  ssh -i $PEM ubuntu@$EIP"
echo
echo "  NOW DO THIS (before ./04-app.sh):"
echo "    Create two DNS A records pointing at $EIP:"
echo "      $DOMAIN      →  $EIP"
echo "      $API_DOMAIN  →  $EIP"
echo "  (Caddy needs the DNS in place to issue TLS certificates.)"
