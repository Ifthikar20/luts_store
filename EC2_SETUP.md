# Simple EC2 deployment

The whole store on **one small EC2 instance** + a **private S3 bucket**.
Nothing else — no load balancer, no ECS/Kubernetes, no RDS (Postgres runs in
the compose stack on the instance with a data volume).

```
DNS (A records: luts.example.com, api.luts.example.com)
        │
   EC2 t3.small ── Caddy (:443, auto-TLS) ──► Next.js :3000  +  Django :8000
        │
   S3 (private) ◄── presigned 60-second URLs from Django
```

## 1. Launch the instance

- **AMI:** Ubuntu 24.04 LTS · **Type:** `t3.small` (2 GB) is plenty
- **Storage:** 20 GB gp3
- **Security group (inbound):** `22` (your IP only), `80`, `443`.
  **Do NOT open 3000/8000** — Caddy is the only public entrance.

```bash
ssh ubuntu@<ec2-ip>
sudo apt-get update && sudo apt-get install -y docker.io docker-compose-v2 caddy git
sudo usermod -aG docker ubuntu && exit   # re-ssh so the group applies
```

## 2. Get the app running

```bash
git clone https://github.com/Ifthikar20/luts_store.git && cd luts_store
./deploy.sh        # creates .env files w/ generated secrets, builds, starts, health-checks
```

Then edit the env files with your real values and run `./deploy.sh` again:

- **`.env`** (build-time public URLs):
  `NEXT_PUBLIC_API_URL=https://api.luts.example.com/api`,
  `NEXT_PUBLIC_SITE_URL=https://luts.example.com`
- **`backend/.env`**: `ALLOWED_HOSTS=api.luts.example.com`,
  `CORS_ALLOWED_ORIGINS=https://luts.example.com`,
  `CSRF_TRUSTED_ORIGINS=https://luts.example.com`,
  `FRONTEND_URL=https://luts.example.com`,
  `API_BASE_URL=https://api.luts.example.com`,
  `SESSION_COOKIE_SECURE=True`, `CSRF_COOKIE_SECURE=True`,
  plus your **Stripe**, **S3** and **SMTP** keys (see `GOING_LIVE.md`).

## 3. TLS with Caddy (2 lines per host, certs are automatic)

`/etc/caddy/Caddyfile`:

```
luts.example.com {
    reverse_proxy localhost:3000
}
api.luts.example.com {
    reverse_proxy localhost:8000
}
```

```bash
sudo systemctl reload caddy
```

Point both DNS A records at the instance's Elastic IP first. Caddy fetches and
renews Let's Encrypt certificates by itself, and Django already honours
`X-Forwarded-Proto` (`SECURE_PROXY_SSL_HEADER` is set).

## 4. The secured S3 bucket

Follow **`LIVE_SETUP.md` §A** (it has the exact console steps + IAM JSON).
The short version:

1. Create a bucket with **Block Public Access: ON** (all four). Never make it
   public — customers get 60-second presigned URLs, not bucket access.
2. Upload your products as `luts/<product-handle>.zip`
   (e.g. `luts/midnight-noir.zip`).
3. Create an IAM user whose **only** permission is `s3:GetObject` on
   `arn:aws:s3:::<bucket>/luts/*`, and put its keys in `backend/.env`
   (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_S3_BUCKET`,
   `AWS_S3_REGION`).

> **Even simpler & safer on EC2:** skip step 3 — attach an **IAM role** to the
> instance with that same `s3:GetObject`-only policy, set just `AWS_S3_BUCKET`
> (+ `AWS_S3_REGION`) and leave the key vars blank. boto3 picks up the role
> automatically, so there are no long-lived keys on disk at all.

## 5. Stripe webhook

In the Stripe dashboard add the endpoint
`https://api.luts.example.com/api/webhooks/stripe` for
`checkout.session.completed`, and put the `whsec_…` in `backend/.env`.

## 6. Verify, then maintain

```bash
docker compose exec backend python manage.py verify_integrations  # read-only checks
./deploy.sh status                      # containers + health
./deploy.sh logs                        # tail everything
git pull && ./deploy.sh                 # deploy an update
docker compose exec db pg_dump -U luts luts | gzip > backup-$(date +%F).sql.gz  # backup
```

That's the entire production footprint: **one EC2 box, one private bucket,
Stripe, and your SMTP provider.**
