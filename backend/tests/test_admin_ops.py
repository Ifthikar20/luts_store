"""
Tests for the admin operations features: bundle delivery, the sales dashboard,
upload validation, and grant resend/revoke wiring.
"""
import pytest
from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import Client

from catalog import db_source
from catalog.models import Product
from delivery.models import DownloadGrant
from orders.services import ingest_paid_order

pytestmark = pytest.mark.django_db


# --- bundle delivery -------------------------------------------------------
def test_deliverable_handles_expands_a_bundle():
    a = Product.objects.create(handle="pack-a", title="A", price="10.00", featured_image_url="x")
    b = Product.objects.create(handle="pack-b", title="B", price="10.00", featured_image_url="x")
    bundle = Product.objects.create(
        handle="mega-bundle", title="Mega", price="15.00",
        product_type=Product.BUNDLE, featured_image_url="x",
    )
    bundle.bundled_products.set([a, b])

    assert set(db_source.deliverable_handles("mega-bundle")) == {"pack-a", "pack-b"}
    assert db_source.deliverable_handles("pack-a") == ["pack-a"]  # normal product
    assert db_source.deliverable_handles("unknown") == ["unknown"]  # safe fallback


def test_bundle_purchase_grants_every_member():
    a = Product.objects.create(handle="pack-a", title="A", price="10.00", featured_image_url="x")
    b = Product.objects.create(handle="pack-b", title="B", price="10.00", featured_image_url="x")
    bundle = Product.objects.create(
        handle="mega-bundle", title="Mega", price="15.00",
        product_type=Product.BUNDLE, featured_image_url="x",
    )
    bundle.bundled_products.set([a, b])

    order, created = ingest_paid_order(
        {"id": "ord-1", "email": "buyer@example.com",
         "line_items": [{"handle": "mega-bundle", "title": "Mega", "quantity": 1}]}
    )
    assert created
    handles = set(order.download_grants.values_list("product_handle", flat=True))
    assert handles == {"pack-a", "pack-b"}


# --- sales dashboard -------------------------------------------------------
def test_dashboard_requires_staff():
    client = Client()
    resp = client.get("/admin/dashboard/")
    assert resp.status_code in (302, 403)  # redirected to login


def test_dashboard_renders_for_staff():
    User.objects.create_superuser("boss", "boss@example.com", "pw12345!")
    client = Client()
    client.force_login(User.objects.get(username="boss"))
    ingest_paid_order(
        {"id": "ord-2", "email": "b@example.com", "total_price": "39.00",
         "line_items": [{"handle": "midnight-noir", "title": "Midnight Noir", "quantity": 1}]}
    )
    resp = client.get("/admin/dashboard/")
    assert resp.status_code == 200
    assert b"Sales dashboard" in resp.content
    assert b"Top LUTs" in resp.content


# --- upload validation -----------------------------------------------------
def test_lut_upload_rejects_bad_extension():
    product = Product.objects.create(handle="x", title="X", price="9.00", featured_image_url="x")
    product.lut_file = SimpleUploadedFile("notes.txt", b"nope", content_type="text/plain")
    with pytest.raises(ValidationError):
        product.full_clean()


def test_image_upload_rejects_bad_extension():
    product = Product.objects.create(handle="y", title="Y", price="9.00", featured_image_url="x")
    product.featured_image_file = SimpleUploadedFile("x.exe", b"nope")
    with pytest.raises(ValidationError):
        product.full_clean()
