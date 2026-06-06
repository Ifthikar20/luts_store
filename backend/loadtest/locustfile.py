"""
Locust load test for the LUTs Store BFF.

Exercises the hot read paths (browse, collections, search, product detail) and
the write funnel (cart create + add line + begin checkout). Designed to surface
the bottlenecks documented in backend/PERFORMANCE.md (Shopify API latency in
live mode, N+1 catalog scans, lack of caching).

Run (mock mode backend on :8000):

    locust -f backend/loadtest/locustfile.py --host http://localhost:8000

Then open http://localhost:8089 to drive the swarm, or headless:

    locust -f backend/loadtest/locustfile.py --host http://localhost:8000 \
        --headless -u 50 -r 10 -t 1m
"""
from __future__ import annotations

import random

from locust import HttpUser, between, task

# A handful of known fixture handles/variants for realistic requests. In live
# mode these still exist; adjust if your real catalog differs.
HANDLES = [
    "midnight-noir",
    "golden-hour-drama",
    "urban-blockbuster",
    "dji-aerial-vivid",
    "capcut-clean-creator",
    "kodak-2383-emulation",
]
COLLECTIONS = ["cinematic", "drone-dji", "mobile-capcut", "film-emulation", "bundles"]
SEARCH_TERMS = ["cinematic", "drone", "film", "warm", "vibrant", "bundle"]


class StorefrontUser(HttpUser):
    """A shopper browsing the catalog and (sometimes) starting checkout."""

    wait_time = between(0.5, 2.5)

    # ---- read paths (most traffic) ----
    @task(5)
    def browse_products(self):
        self.client.get("/api/products", name="/api/products")

    @task(3)
    def browse_collection(self):
        handle = random.choice(COLLECTIONS)
        self.client.get(
            f"/api/products?collection={handle}", name="/api/products?collection"
        )
        self.client.get(f"/api/collections/{handle}", name="/api/collections/<h>")

    @task(3)
    def search(self):
        term = random.choice(SEARCH_TERMS)
        self.client.get(f"/api/products?search={term}", name="/api/products?search")

    @task(2)
    def product_detail(self):
        handle = random.choice(HANDLES)
        self.client.get(f"/api/products/{handle}", name="/api/products/<h>")

    @task(1)
    def facets(self):
        self.client.get("/api/facets", name="/api/facets")

    # ---- write funnel (less traffic) ----
    @task(1)
    def cart_and_checkout(self):
        # Resolve a product to get a real variant id.
        handle = random.choice(HANDLES)
        prod = self.client.get(
            f"/api/products/{handle}", name="/api/products/<h>"
        )
        if prod.status_code != 200:
            return
        variants = prod.json().get("variants") or []
        if not variants:
            return
        variant_id = variants[0]["id"]

        created = self.client.post(
            "/api/cart",
            json={"lines": [{"merchandiseId": variant_id, "quantity": 1}]},
            name="/api/cart [create]",
        )
        if created.status_code != 201:
            return
        cart_id = created.json()["id"]

        # Add another line.
        self.client.post(
            f"/api/cart/{cart_id}/lines",
            json={"merchandiseId": variant_id, "quantity": 1},
            name="/api/cart/<id>/lines [add]",
        )

        # Begin checkout (mock returns a relative url; live returns Shopify URL).
        self.client.post(
            "/api/checkout", json={"cartId": cart_id}, name="/api/checkout"
        )
