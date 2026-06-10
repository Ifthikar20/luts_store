# AWS setup — run the scripts in order

Everything from `EC2_SETUP.md`, automated. Run each script from this `aws/`
directory; each is idempotent (safe to re-run) and records its results in
`state.env` for the next one.

**Prereqs (one time):** [AWS CLI v2](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html)
installed and `aws configure` done with an admin-ish user.

```bash
cd aws
cp config.env.example config.env   # edit: bucket name, region, domains, repo URL

./01-s3.sh                         # private, encrypted product-files bucket
./01-s3.sh upload ~/my-luts        # upload <handle>.zip files (repeatable)
./02-iam.sh                        # s3:GetObject-only role for the instance
./03-ec2.sh                        # security group + key + Ubuntu instance + Elastic IP

# >>> point your two DNS A records at the printed Elastic IP, then:

./04-app.sh                        # clone + env files + Docker stack + Caddy TLS

cp production-secrets.env.example production-secrets.env   # fill in Stripe + SMTP
./05-secrets.sh                    # push secrets + restart + verify_integrations
```

Done. The storefront is at `https://<DOMAIN>`, the API at
`https://<API_DOMAIN>/api/health`.

| Script | Creates | Re-run to |
| --- | --- | --- |
| `01-s3.sh` | Private bucket (Block Public Access + SSE) | upload more files |
| `02-iam.sh` | Role + instance profile, `s3:GetObject` on `luts/*` only | update the policy |
| `03-ec2.sh` | SG (22/80/443 only), key pair, t3.small, Elastic IP | reuses everything existing |
| `04-app.sh` | App env files, Docker stack, Caddyfile | **deploy code updates** (`git pull` + rebuild) |
| `05-secrets.sh` | Stripe/SMTP values in server's `backend/.env` | rotate keys |

Notes:

- **No AWS keys ever land on the server** — S3 access comes from the instance
  role (02), scoped to read the `luts/` prefix only.
- Local files that must never be committed (already git-ignored):
  `config.env`, `state.env`, `production-secrets.env`, `*.pem`.
- Stripe webhook: add `https://<API_DOMAIN>/api/webhooks/stripe` with events
  `checkout.session.completed` and `charge.refunded` in the Stripe dashboard
  (that's where `STRIPE_WEBHOOK_SECRET` comes from).
- Tear-down: terminate the instance, release the Elastic IP, delete the SG,
  role/profile and bucket (in that order) from the AWS console, then delete
  `state.env`.
