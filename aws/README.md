# AWS setup — run the scripts in order

Everything from `EC2_SETUP.md`, automated. Run each script from this `aws/`
directory; each is idempotent (safe to re-run) and records its results in
`state.env` for the next one.

**Prereqs (one time):** [AWS CLI v2](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html)
installed and `aws configure` done with an admin-ish user.

```bash
cd aws
cp config.env.example config.env   # edit: bucket name, region, domains, repo URL
```

### One command (recommended): `./deploy-all.sh`

`deploy-all.sh` runs 01→05 in order **with checkpoints** — each finished step is
recorded in `state.env`, so a re-run resumes from where you stopped instead of
repeating everything. It pauses at one breakpoint (after 03) so you can point DNS
at the Elastic IP, and it skips 05 until you've filled in your secrets.

```bash
./deploy-all.sh            # run all remaining steps, pausing at the DNS breakpoint
./deploy-all.sh status     # show which steps are done / pending
./deploy-all.sh --yes      # don't pause at the breakpoint (DNS already set)
./deploy-all.sh --only 4   # just redeploy the app (git pull + rebuild)
./deploy-all.sh --from 3   # re-run from step 3 onward
./deploy-all.sh reset      # clear checkpoints (AWS resources untouched)
```

`./01-s3.sh upload ~/my-luts` (uploading your `<handle>.zip` files) stays a
separate, repeatable step — run it whenever your catalog changes.

### Or step-by-step

```bash
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

### Going live on the IP first, domain later

No domain yet? Set `USE_IP=1` in `config.env` and deploy on the Elastic IP over
plain HTTP — the storefront serves on `http://<EIP>/` and the API on
`http://<EIP>/api`. `deploy-all.sh` skips the DNS breakpoint in this mode.

When your domain is ready: set `USE_IP=0`, fill in `DOMAIN`/`API_DOMAIN`, point
the two A records at the EIP, then re-run just the app step:

```bash
./deploy-all.sh --only 4      # rewrites env + Caddy for HTTPS, redeploys
```

Caddy issues TLS automatically once DNS resolves. (IP mode is HTTP-only — fine
for testing, but don't put real Stripe live keys behind it; switch to the domain
first so traffic is encrypted.)

### Reusing a key you already have (e.g. `fynda-deploy.pem`)

By default 03 creates a fresh key pair and saves `aws/<KEY_NAME>.pem`. To use a
private key you already downloaded, set both in `config.env`:

```bash
KEY_NAME=fynda-deploy                                    # the AWS key-pair name
KEY_FILE=~/Downloads/LUTS.shop/luts_store/fynda-deploy.pem
```

With `KEY_FILE` set, 03 **never creates or overwrites** the key — it just checks
the file is present and the pair exists in your region — and 04/05 ssh with that
exact file. The `.pem` stays git-ignored; never commit it.

| Script | Creates | Re-run to |
| --- | --- | --- |
| `deploy-all.sh` | Runs 01→05 with checkpoints + a DNS breakpoint | resume where you stopped (skips finished steps) |
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
