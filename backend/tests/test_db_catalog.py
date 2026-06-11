"""
DB-backed catalog tests.

Once a published Product exists, the store must serve from the database (the
admin) instead of the in-repo fixture, producing the identical public contract.
"""
import pytest
from rest_framework.test import APIClient

from catalog.models import Collection, IncludedLut, Product

pytestmark = pytest.mark.django_db


@pytest.fixture
def client():
    return APIClient()


@pytest.fixture
def db_product():
    coll = Collection.objects.create(handle="mobile-capcut", title="Mobile / CapCut")
    product = Product.objects.create(
        handle="capcut-moody-vlog",
        title="CapCut Moody Vlog",
        description="Desaturated, cinematic vlog look.",
        product_type=Product.LUT_PACK,
        price="14.00",
        lut_count=8,
        tags="mobile, capcut, vlog, moody",
        formats=".cube",
        compatible_apps="Premiere Pro, DaVinci Resolve, Final Cut, CapCut",
        featured_image_url="https://example.com/a.jpg",
        featured=True,
    )
    product.collections.add(coll)
    IncludedLut.objects.create(product=product, name="Moody Base", tone="low-sat start", position=0)
    return product


def test_listing_serves_from_db(client, db_product):
    # With a published DB product, the store serves ONLY DB products.
    products = client.get("/api/products").json()["products"]
    handles = {p["handle"] for p in products}
    assert handles == {"capcut-moody-vlog"}


def test_product_detail_contract(client, db_product):
    p = client.get("/api/products/capcut-moody-vlog").json()
    assert p["title"] == "CapCut Moody Vlog"
    assert p["priceRange"]["min"] == {"amount": "14.00", "currencyCode": "USD"}
    assert p["metafields"]["lutCount"] == 8
    assert p["metafields"]["formats"] == [".cube"]
    assert p["tags"] == ["mobile", "capcut", "vlog", "moody"]
    assert p["includedLuts"] == [{"name": "Moody Base", "tone": "low-sat start"}]
    assert p["variants"][0]["id"] == f"gid://shopify/ProductVariant/{db_product.pk}"


def test_unpublished_product_hidden(client, db_product):
    Product.objects.create(
        handle="draft-pack",
        title="Draft",
        price="9.00",
        featured_image_url="https://example.com/d.jpg",
        published=False,
    )
    handles = {p["handle"] for p in client.get("/api/products").json()["products"]}
    assert "draft-pack" not in handles


def test_cart_resolves_db_variant(client, db_product):
    # Adding the DB product's variant to a cart must resolve (find_variant).
    resp = client.post(
        "/api/cart",
        {"lines": [{"merchandiseId": f"gid://shopify/ProductVariant/{db_product.pk}", "quantity": 1}]},
        format="json",
    )
    assert resp.status_code in (200, 201)
    body = resp.json()
    assert body["totalQuantity"] == 1


def test_seed_command_populates(client):
    from django.core.management import call_command

    # No DB products yet -> store serves the fixture catalog.
    assert Product.objects.count() == 0
    call_command("seed_catalog")
    assert Product.objects.filter(handle="midnight-noir").exists()
    # Now the API serves the seeded DB catalog.
    handles = {p["handle"] for p in client.get("/api/products").json()["products"]}
    assert "midnight-noir" in handles
