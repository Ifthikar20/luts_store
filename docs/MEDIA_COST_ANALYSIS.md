# Preview-media pipeline — cost analysis

How much the **upload → transcode → S3 → CloudFront** pipeline costs to run on
standard AWS (us-east-1, on-demand list prices, June 2026). Numbers are modelled
for **500** and **5,000** monthly active users (MAU).

> **The one thing to understand first.** Uploads are **admin-only**, so
> transcoding is a *one-time, fixed* cost tied to how many products you have —
> **not** to how many users you have. What scales with users is **CloudFront
> egress** (bytes of preview media delivered). So the bill is mostly a flat
> floor plus a small, predictable per-user video-delivery line.

---

## Architecture being costed

| Stage | Service | Notes |
| --- | --- | --- |
| Upload | Django admin → **private S3** (`media/`) | Block Public Access ON, SSE-S3. Admin-only. |
| Transcode (video) | **AWS Elemental MediaConvert** | One HLS ladder (1080/720/480) + poster per clip. One-time per upload. |
| Optimise (image) | **Pillow** on the EC2 box | Re-encode to WebP. No AWS charge (uses existing compute). |
| Deliver | **CloudFront** (OAC → S3 `media/*`) | Edge-cached; cheap egress; ideal for many small HLS segments. |
| Paid files | **S3 presigned URLs** (`luts/*`) | Never on the CDN. Short-lived signed links. |

---

## Assumptions (stated so you can adjust)

**Catalog (drives fixed cost):**
- 30 products, each with **1 preview clip (~20 s)** + ~3 images.
- HLS ladder per clip ≈ 23 MB of segments; original ≈ 15 MB; images ≈ 5 MB → **~45 MB/product**.
- Total media at rest ≈ **1.4 GB**; paid LUT `.zip`s ≈ **1.5 GB** → ~3 GB in S3.

**Per active user / month (drives variable cost):**
- ~3 sessions; per session browses ~5 product pages and plays ~3 preview clips.
- Clips are muted autoplay loops, **paused when scrolled offscreen** (built in),
  adaptive avg **~2.5 Mbps** (mobile-heavy) → ~9 MB per clip watched.
- Video ≈ 28 MB + WebP images ≈ 7 MB + homepage hero ≈ 9 MB ≈ **~45 MB/session**.
- ≈ **~120 MB/user/month** of CloudFront egress. *(This is the key swing
  variable — see sensitivity below.)*

---

## Fixed monthly cost (same for 500 or 5,000 users)

| Item | Basis | Monthly |
| --- | --- | --- |
| EC2 `t3.small` (app + Postgres container) | $0.0208/hr × 730 | **$15.18** |
| EBS 20 GB gp3 (**encrypted**) | $0.08/GB | $1.60 |
| Public IPv4 (Elastic IP) | $0.005/hr | $3.65 |
| S3 storage (~3 GB, SSE-S3) | $0.023/GB | $0.07 |
| Route 53 hosted zone | per zone | $0.50 |
| MediaConvert (30 clips, one-time ≈ $0.40) | amortised | ~$0.00 |
| **Fixed subtotal** | | **≈ $21.00/mo** |

> A 1-year EC2 Compute Savings Plan drops the `t3.small` to ~$9/mo, taking the
> fixed floor to **~$15.50/mo**. No RDS (Postgres runs in a container on the
> instance), no load balancer, no NAT gateway — those are the usual budget
> killers and we avoid all three.

---

## Variable cost — CloudFront egress (scales with users)

CloudFront NA/EU egress is **$0.085/GB** (first 10 TB); requests $0.01/10k.

| Users (MAU) | Egress (≈120 MB ea.) | Egress $ | Requests $ | Variable total |
| --- | --- | --- | --- | --- |
| 500 | ~60 GB | $5.10 | ~$0.08 | **~$5.20** |
| 5,000 | ~600 GB | $51.00 | ~$0.75 | **~$51.75** |

---

## Bottom line

| | 500 users | 5,000 users |
| --- | --- | --- |
| Fixed (infra) | ~$21.00 | ~$21.00 |
| Variable (CDN) | ~$5.20 | ~$51.75 |
| **Total — list price** | **≈ $26 / mo** | **≈ $73 / mo** |
| **Total — with CloudFront free tier¹** | **≈ $21 / mo** | **≈ $21 / mo** |
| **Total — with EC2 Savings Plan** | **≈ $20 / mo** | **≈ $67 / mo** |

¹ See "The two free tiers" below. **Per-user economics:** roughly **$0.01–$0.05
per active user per month**, all-in.

---

## The two free tiers (they are NOT the same thing)

This trips everyone up. AWS has two *different* free tiers and only one of them
is permanent:

1. **The new-account free tier** — temporary.
   - Old model (accounts before ~July 2025): each service is free *up to a cap
     for your first 12 months* — e.g. **750 hrs/mo of a `t3.micro`**, 30 GB EBS,
     5 GB S3. After 12 months it all becomes paid.
   - New model (accounts created after mid-2025): you get **up to $200 in
     credits** to spend over ~6 months instead of per-service caps.
   - **Our stack uses a `t3.small`, which is NOT free-tier eligible** (only
     `t3.micro`/`t2.micro` are). So even on a brand-new account you are likely
     **already paying for the EC2 instance** — the rest (small EBS, a few GB of
     S3) may be covered for the first year.

2. **The CloudFront "Always Free" tier — permanent, never expires.**
   - **1 TB data-transfer-out + 10,000,000 requests + 2,000,000 CloudFront
     Functions invocations, every month, forever.**
   - This is independent of account age. It's why the CDN line in the table is
     effectively **$0 for both 500 and 5,000 users** (60 GB and 600 GB are well
     under 1 TB). You'd only start paying CloudFront past ~8,000 MAU at these
     viewing habits. The "list price" row is the honest worst case if AWS ever
     changes that policy.

**So, "are we already in free tier?"** Partly. CloudFront: yes, basically always.
EC2 `t3.small`: almost certainly **no** — that ~$15/mo is real from day one. If
you want the *cheapest possible* footprint, see below.

## How to know if (and how much) you're paying

You never have to guess:

- **Run `./07-budget.sh`** — sets a $30/mo (configurable) budget that **emails you**
  at 80% actual and 100% forecast. Free. This is the proactive answer.
- **Billing console → Bills**: live month-to-date charges, per service —
  <https://console.aws.amazon.com/billing/home#/bills>
- **Billing console → Free Tier**: shows your free-tier usage vs limits and
  whether you're about to exceed them —
  <https://console.aws.amazon.com/billing/home#/freetier>
- **Cost Explorer**: daily graph by service to spot what's growing.

## Cutting it to the bone (cheapest viable setup)

| Lever | Saving | Trade-off |
| --- | --- | --- |
| `t3.small` → `t3.micro` (free-tier eligible) | up to ~$15/mo for 12 mo | 1 GB RAM is tight for frontend+backend+Postgres+Redis; OK for very low traffic, may need swap |
| 1-yr Compute Savings Plan on `t3.small` | ~40% (~$6/mo) | 1-year commitment |
| Drop Redis container (rate-limit falls back to in-memory) | RAM headroom | per-instance throttling only |
| Keep media watch-time down | the whole CDN line | — |

The database is **already the cheapest option**: a `postgres:16` container on the
instance's (now encrypted) EBS volume — **no RDS, $0 extra**. Going smaller
(SQLite) saves nothing here and loses concurrency, so Postgres-in-container stays.

## Encryption at rest (implemented)

"Encrypt what we save, decrypt it when we read" is handled transparently at the
storage layer — no app code, no key management for you:

| What | Where | How |
| --- | --- | --- |
| Uploaded media + LUT files | S3 (`media/`, `luts/`) | **SSE-S3 (AES-256)**, on by default (`aws/01-s3.sh`) |
| **Database** (Postgres data), app files, OS | EC2 root **EBS volume** | **EBS encryption** via the AWS-managed `aws/ebs` KMS key (`aws/03-ec2.sh`) |
| Data in transit | Browser ↔ CloudFront ↔ S3 / Caddy ↔ app | HTTPS / TLS everywhere |

Both use **AWS-managed KMS keys, which are free** (only *customer-managed* KMS
keys cost ~$1/key/mo). Encryption/decryption is automatic on every write/read —
nothing to call from the application.

> **EBS encryption only applies to a newly-launched instance.** If you already
> ran `03-ec2.sh` before this change, the existing root volume stays unencrypted.
> To fix: snapshot it → copy the snapshot with encryption enabled → launch a new
> instance from the encrypted snapshot (or just re-run the bring-up on a fresh
> instance and re-deploy — data lives in S3 + the DB, which you can dump/restore).

---

## Sensitivity — what actually moves the needle

Video watch time is ~80% of the variable cost. If your previews are longer or
loop more aggressively:

| Avg egress/user | 5,000 users egress | CDN $ (list) | 5,000-user total |
| --- | --- | --- | --- |
| 120 MB (base) | 600 GB | $51 | ~$74 |
| 250 MB (heavy looping) | 1.22 TB | ~$104 | ~$126 |
| 400 MB (long clips) | 1.95 TB | ~$166 | ~$188 |

Levers to keep it cheap (most already in place):
- **Pause offscreen** (done in `HlsVideo`) — biggest single saver.
- Keep clips **short (≤20 s) and muted**; cap the top rendition at 1080p (done).
- Lean on **CloudFront caching** so repeat views never re-hit S3 (done via OAC + CachingOptimized).
- Consider a **poster-first / click-to-play** option for long clips to avoid
  autoplaying full streams to bouncing visitors.

## When to scale up

A `t3.small` comfortably serves a mostly-static, CDN-offloaded storefront at
5,000 MAU. If API/SSR CPU climbs, the next step is `t3.medium` (~+$15/mo) or an
ALB + a second instance — neither needed at these numbers. MediaConvert and
CloudFront scale to any size with no architectural change.
