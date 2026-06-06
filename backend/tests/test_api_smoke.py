"""
API smoke tests in mock mode.

These exercise the full request path (URLs -> views -> service -> mockdata)
and assert the public contract shapes the frontend depends on.
"""
import base64
import hashlib
import hmac
import json

import pytest
from django.conf import settings
from rest_framework.test import APIClient

pytestmark = pytest.mark.django_db


@pytest.fixture
def client():
    return APIClient()


def test_mock_mode_is_on():
    # No Storefront token configured in the test env -> mock mode.
    assert settings.MOCK_MODE is True


def test_health(client):
    resp = client.get("/api/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok", "mockMode": True}


def test_collections(client):
    resp = client.get("/api/collections")
    assert resp.status_code == 200
    data = resp.json()
    handles = {c["handle"] for c in data}
    assert {"cinematic", "drone-dji", "mobile-capcut", "film-emulation", "bundles"} <= handles
    for c in data:
        assert {"handle", "title", "description", "image", "productCount"} <= set(c)
        assert c["productCount"] >= 1


def test_collection_detail_and_404(client):
    resp = client.get("/api/collections/cinematic")
    assert resp.status_code == 200
    data = resp.json()
    assert data["handle"] == "cinematic"
    assert len(data["products"]) >= 1

    assert client.get("/api/collections/does-not-exist").status_code == 404


def test_products_list_and_filters(client):
    resp = client.get("/api/products")
    assert resp.status_code == 200
    products = resp.json()["products"]
    assert len(products) >= 15  # 12 LUTs + 3 bundles

    # Shape check on first product.
    p = products[0]
    for key in (
        "id", "handle", "title", "description", "descriptionHtml",
        "featuredImage", "images", "priceRange", "variants", "tags",
        "productType", "vendor", "collections", "metafields",
    ):
        assert key in p, f"missing {key}"
    assert p["priceRange"]["min"]["currencyCode"] == "USD"
    assert p["metafields"]["formats"] == [".cube"]

    featured = client.get("/api/products?featured=true").json()["products"]
    assert len(featured) >= 1
    assert all(fp.get("featured") for fp in featured)

    coll = client.get("/api/products?collection=drone-dji").json()["products"]
    assert all(any(c["handle"] == "drone-dji" for c in cp["collections"]) for cp in coll)

    search = client.get("/api/products?search=drone").json()["products"]
    assert len(search) >= 1


def test_product_detail_and_404(client):
    resp = client.get("/api/products/midnight-noir")
    assert resp.status_code == 200
    assert resp.json()["handle"] == "midnight-noir"
    assert client.get("/api/products/nope").status_code == 404


def test_cart_lifecycle(client):
    # Pull a real variant id from the catalog.
    product = client.get("/api/products/midnight-noir").json()
    variant_id = product["variants"][0]["id"]

    # Create empty cart.
    created = client.post("/api/cart", {"lines": []}, format="json")
    assert created.status_code == 201
    cart = created.json()
    assert cart["totalQuantity"] == 0
    assert cart["checkoutUrl"].startswith("https://")
    cart_id = cart["id"]

    # Add a line.
    added = client.post(
        f"/api/cart/{cart_id}/lines",
        {"merchandiseId": variant_id, "quantity": 2},
        format="json",
    ).json()
    assert added["totalQuantity"] == 2
    assert len(added["lines"]) == 1
    line = added["lines"][0]
    assert line["merchandise"]["product"]["handle"] == "midnight-noir"
    line_id = line["id"]

    # Patch quantity.
    patched = client.patch(
        f"/api/cart/{cart_id}/lines",
        {"lineId": line_id, "quantity": 5},
        format="json",
    ).json()
    assert patched["totalQuantity"] == 5

    # Remove line.
    removed = client.delete(
        f"/api/cart/{cart_id}/lines",
        {"lineId": line_id},
        format="json",
    ).json()
    assert removed["totalQuantity"] == 0

    # Fetch cart.
    fetched = client.get(f"/api/cart/{cart_id}")
    assert fetched.status_code == 200


def test_cart_rejects_unknown_merchandise(client):
    created = client.post("/api/cart", {"lines": []}, format="json").json()
    resp = client.post(
        f"/api/cart/{created['id']}/lines",
        {"merchandiseId": "gid://shopify/ProductVariant/does-not-exist", "quantity": 1},
        format="json",
    )
    assert resp.status_code == 400


def test_cart_404_unknown_id(client):
    assert client.get("/api/cart/00000000-0000-0000-0000-000000000000").status_code == 404


def _sign(body: bytes, secret: str) -> str:
    return base64.b64encode(
        hmac.new(secret.encode(), body, hashlib.sha256).digest()
    ).decode()


def test_webhook_rejects_bad_hmac(client, settings):
    settings.SHOPIFY_WEBHOOK_SECRET = "shh"
    body = json.dumps({"id": 999}).encode()
    resp = client.post(
        "/api/webhooks/shopify/orders-paid",
        data=body,
        content_type="application/json",
        HTTP_X_SHOPIFY_HMAC_SHA256="wrong",
    )
    assert resp.status_code == 401


def test_webhook_accepts_valid_and_is_idempotent(client, settings):
    settings.SHOPIFY_WEBHOOK_SECRET = "shh"
    payload = {
        "id": 555,
        "email": "buyer@example.com",
        "total_price": "39.00",
        "currency": "USD",
        "line_items": [
            {"title": "Midnight Noir", "handle": "midnight-noir", "quantity": 1}
        ],
    }
    body = json.dumps(payload).encode()
    sig = _sign(body, "shh")

    first = client.post(
        "/api/webhooks/shopify/orders-paid",
        data=body,
        content_type="application/json",
        HTTP_X_SHOPIFY_HMAC_SHA256=sig,
    )
    assert first.status_code == 200
    assert first.json()["created"] is True

    # Replay -> idempotent (created False, still 200).
    second = client.post(
        "/api/webhooks/shopify/orders-paid",
        data=body,
        content_type="application/json",
        HTTP_X_SHOPIFY_HMAC_SHA256=sig,
    )
    assert second.status_code == 200
    assert second.json()["created"] is False

    from orders.models import Order
    from delivery.models import DownloadGrant

    assert Order.objects.filter(shopify_order_id="555").count() == 1
    assert DownloadGrant.objects.filter(product_handle="midnight-noir").count() == 1


def test_download_token_endpoint(client):
    from delivery.models import DownloadGrant
    from delivery.signing import make_download_token

    grant = DownloadGrant.objects.create(email="b@e.com", product_handle="midnight-noir")
    token = make_download_token(grant.id, "midnight-noir")
    resp = client.get(f"/api/download/{token}")
    # Mock mode streams a .cube attachment (no longer JSON).
    assert resp.status_code == 200
    assert resp["Content-Disposition"].startswith("attachment;")


def test_download_token_invalid(client):
    resp = client.get("/api/download/not-a-real-token")
    assert resp.status_code == 403
