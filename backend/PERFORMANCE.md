# Performance & Bottlenecks — The Looks Lab BFF

This document captures the expected performance bottlenecks of the Django BFF
and the mitigations, plus how to reproduce a load test with the bundled Locust
swarm.

## Running the load test

```bash
# 1. Start the backend (mock mode is fine for shape; live mode shows real latency)
python manage.py runserver 0.0.0.0:8000

# 2. Drive load (interactive UI on :8089)
locust -f backend/loadtest/locustfile.py --host http://localhost:8000

# ...or headless
locust -f backend/loadtest/locustfile.py --host http://localhost:8000 \
    --headless -u 50 -r 10 -t 1m
```

`locust` lives in `backend/requirements-dev.txt`. The swarm browses products /
collections / search / product detail and walks the cart -> checkout funnel,
weighted toward reads (the realistic traffic mix).

## Expected bottlenecks

1. **Shopify Storefront/Admin API latency (live mode).** Every catalog, cart,
   and checkout call in live mode is a synchronous outbound GraphQL request
   (`requests`, 15s timeout). This is the dominant latency source and is
   entirely external — p95 is bounded by Shopify, not us. It also imposes
   Shopify's own API rate limits.
2. **N+1 / repeated work in the catalog service.** `list_collections` calls
   `products_in_collection` per collection to compute counts;
   `list_products`/`facets` deep-copy and re-scan the whole fixture (mock) or
   re-fetch+filter in process (live) on every request. There is no result cache,
   so identical popular queries do redundant work.
3. **No caching layer.** Catalog and facet responses are recomputed per request
   even though the catalog changes rarely. Cold every time.
4. **Synchronous email send on the request path.** Order confirmation is sent
   via `transaction.on_commit`; an unhealthy SMTP server can slow the worker
   that committed the order (it is best-effort/swallowed, but still inline).
5. **Single SQLite file (default).** Fine for dev; write contention under
   concurrency. Production should use Postgres.
6. **Download endpoint scraping.** The login-free `/api/download/<token>`
   endpoint and presigned-URL minting (a boto3 client build + SigV4 sign per
   request) cost CPU and can be hammered.

## Mitigations

- **Redis cache for catalog + facets.** Cache `list_products`, `facets`,
  `list_collections`, and product detail keyed by their query params with a
  short TTL (e.g. 60–300s) and bust on catalog change / webhook. Removes the
  per-request recompute and absorbs Shopify latency for hot reads. Wire via
  Django's cache framework (`django.core.cache`) + `django-redis`.
- **CDN in front of presigned files.** Serve the private-S3 objects through a
  CDN (CloudFront with an Origin Access Control to the private bucket) so file
  bytes are edge-cached and the origin/egress is offloaded. Presigned-URL TTL
  stays short; the CDN does the heavy lifting for bytes.
- **DB indexes + Postgres.** `Order.shopify_order_id` is already unique-indexed
  (idempotency). Add indexes on `DownloadGrant(email)` and
  `DownloadGrant(user)` for library lookups. Use Postgres in production
  (`DATABASE_URL`) to remove SQLite write contention.
- **Gunicorn workers / process tuning.** Scale horizontally with gunicorn
  workers (`--workers`, `WEB_CONCURRENCY`); since live-mode requests are
  I/O-bound on Shopify, consider async or gthread workers to raise concurrency
  per box. Keep the Shopify client timeout tight to fail fast.
- **Throttling as backpressure.** DRF scoped throttles already protect the app:
  `anon` 120/min, `user` 240/min, `auth` 10/min, `sensitive` 5/min, and a
  dedicated `download` 60/min bucket. These cap abuse and shed load gracefully
  (429) before the DB / Shopify / SMTP get overwhelmed.
- **Memoize catalog indexes.** The fixture indexes (`_PRODUCTS_BY_HANDLE`, etc.)
  are already module-level; avoid the per-request `deepcopy` on read-only paths
  where the response is serialized immediately, or cache the serialized form.
- **Move email fully off the request path** with a task queue (Celery/RQ) in
  production so SMTP latency never touches a web worker.
