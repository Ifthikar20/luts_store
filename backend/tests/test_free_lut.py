"""
Weekly free LUT: discovery, claim-by-email (no payment), idempotency, download.
"""
import pytest
from django.core import mail
from rest_framework.test import APIClient

pytestmark = pytest.mark.django_db


@pytest.fixture
def client():
    return APIClient()


def test_free_lut_endpoint_returns_the_free_product(client):
    resp = client.get("/api/free-lut")
    assert resp.status_code == 200
    body = resp.json()
    assert "free" in body["tags"]
    assert body["priceRange"]["min"]["amount"] in ("0.00", "0")
    assert "file_key" not in body  # private key never leaked


def test_free_lut_appears_in_inventory(client):
    handles = [p["handle"] for p in client.get("/api/products").json()["products"]]
    assert "aurora-skies" in handles


def test_claim_creates_grant_and_one_email(
    client, django_capture_on_commit_callbacks
):
    with django_capture_on_commit_callbacks(execute=True):
        resp = client.post(
            "/api/free-lut/claim", data={"email": "freebie@example.com"}, format="json"
        )
    assert resp.status_code == 200
    order_id = resp.json()["orderId"]

    from delivery.models import DownloadGrant
    from orders.models import Order

    order = Order.objects.get(shopify_order_id=order_id)
    assert order.total == 0
    assert DownloadGrant.objects.filter(order=order).count() == 1
    assert len(mail.outbox) == 1
    assert mail.outbox[0].to == ["freebie@example.com"]


def test_claim_is_idempotent_per_email(
    client, django_capture_on_commit_callbacks
):
    for _ in range(2):
        with django_capture_on_commit_callbacks(execute=True):
            client.post(
                "/api/free-lut/claim",
                data={"email": "Freebie@Example.com"},
                format="json",
            )
    from orders.models import Order

    # Case-insensitive normalization -> one order, one email.
    assert Order.objects.filter(email="freebie@example.com").count() == 1
    assert len(mail.outbox) == 1


def test_claim_requires_email(client):
    assert client.post("/api/free-lut/claim", data={}, format="json").status_code == 400


def test_claimed_free_lut_downloads(client, django_capture_on_commit_callbacks):
    with django_capture_on_commit_callbacks(execute=True):
        order_id = client.post(
            "/api/free-lut/claim", data={"email": "freebie@example.com"}, format="json"
        ).json()["orderId"]
    conf = client.get(f"/api/orders/{order_id}").json()
    assert len(conf["downloads"]) == 1
    dl = client.get(conf["downloads"][0]["downloadUrl"])
    assert dl.status_code == 200
    assert dl["Content-Disposition"].startswith("attachment;")
