"""
Admin upload + LUT-processing + media-serving tests (local filesystem storage).

Covers: a bare .cube upload is zipped to luts/<handle>.zip and wired into
delivery; uploaded images/videos surface in the contract via /api/media; and the
media endpoint refuses to serve the private luts/ prefix.
"""
import io
import zipfile

import pytest
from django.core.files.storage import default_storage
from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils.functional import empty
from rest_framework.test import APIClient

from catalog.models import Product, ProductImage

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def _tmp_media(settings, tmp_path):
    # Point uploads at a temp dir and reset the lazy default storage so the
    # new MEDIA_ROOT takes effect for this test.
    settings.MEDIA_ROOT = str(tmp_path)
    default_storage._wrapped = empty
    yield
    default_storage._wrapped = empty


@pytest.fixture
def client():
    return APIClient()


def _product(**kw):
    defaults = dict(handle="midnight-noir", title="Midnight Noir", price="39.00")
    defaults.update(kw)
    return Product.objects.create(**defaults)


def test_cube_upload_is_zipped_to_canonical_key():
    product = _product()
    product.lut_file = SimpleUploadedFile(
        "look.cube", b"TITLE look\nLUT_3D_SIZE 2\n", content_type="application/octet-stream"
    )
    product.save()

    assert product.lut_file.name == "luts/midnight-noir.zip"
    assert product.resolved_file_key() == "luts/midnight-noir.zip"
    assert product.file_key == "luts/midnight-noir.zip"

    with default_storage.open("luts/midnight-noir.zip") as fh:
        zf = zipfile.ZipFile(io.BytesIO(fh.read()))
        assert "look.cube" in zf.namelist()


def test_zip_upload_kept_as_is():
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr("a.cube", b"x")
    product = _product(handle="urban-blockbuster", title="Urban")
    product.lut_file = SimpleUploadedFile("pack.zip", buf.getvalue(), content_type="application/zip")
    product.save()
    assert product.lut_file.name == "luts/urban-blockbuster.zip"


def test_uploaded_image_surfaces_in_contract(settings):
    settings.API_BASE_URL = "http://testserver"
    product = _product(featured_image_url="")
    product.featured_image_file = SimpleUploadedFile("hero.jpg", b"\xff\xd8\xff", content_type="image/jpeg")
    product.save()

    contract = product.to_contract()
    name = product.featured_image_file.name
    assert contract["featuredImage"]["url"] == f"http://testserver/api/media/{name}"
    assert name.startswith("media/midnight-noir/")


def test_media_endpoint_redirects_for_uploaded_file(client):
    product = _product()
    img = ProductImage.objects.create(product=product)
    img.image = SimpleUploadedFile("g.jpg", b"\xff\xd8\xff", content_type="image/jpeg")
    img.save()

    resp = client.get(f"/api/media/{img.image.name}")
    assert resp.status_code == 302


def test_media_endpoint_refuses_private_luts(client):
    # The media endpoint must never serve the private LUT prefix.
    resp = client.get("/api/media/luts/midnight-noir.zip")
    assert resp.status_code == 404
