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
| EBS 30 GB gp3 | $0.08/GB | $2.40 |
| Public IPv4 (Elastic IP) | $0.005/hr | $3.65 |
| S3 storage (~3 GB) | $0.023/GB | $0.07 |
| Route 53 hosted zone | per zone | $0.50 |
| MediaConvert (30 clips, one-time ≈ $0.40) | amortised | ~$0.00 |
| **Fixed subtotal** | | **≈ $21.80/mo** |

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
| Fixed (infra) | ~$21.80 | ~$21.80 |
| Variable (CDN) | ~$5.20 | ~$51.75 |
| **Total — list price** | **≈ $27 / mo** | **≈ $74 / mo** |
| **Total — with CloudFront free tier¹** | **≈ $22 / mo** | **≈ $22 / mo** |
| **Total — with EC2 Savings Plan** | **≈ $21 / mo** | **≈ $68 / mo** |

¹ AWS's **perpetual** CloudFront free tier includes **1 TB egress + 10M requests
per month**. Both scenarios (60 GB and 600 GB) sit *under* 1 TB, so in practice
the CDN line is **$0 today** — you only start paying CloudFront past ~8,000 MAU
at these viewing habits. The "list price" row is the honest worst case if that
free tier ever goes away.

**Per-user economics:** roughly **$0.01–$0.05 per active user per month**, all-in.

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
