"""
Preview-media pipeline tests: CDN URL rendering, image→WebP optimisation, and
adaptive-HLS transcode submission (MediaConvert mocked — no AWS in CI).
"""
import io

import pytest
from django.core.files.storage import default_storage
from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils.functional import empty

from catalog.models import Product
from delivery import images, transcode

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def _tmp_media(settings, tmp_path):
    settings.MEDIA_ROOT = str(tmp_path)
    settings.API_BASE_URL = "http://testserver"
    settings.CDN_BASE_URL = ""
    default_storage._wrapped = empty
    yield
    default_storage._wrapped = empty


def _product(**kw):
    defaults = dict(handle="midnight-noir", title="Midnight Noir", price="39.00")
    defaults.update(kw)
    return Product.objects.create(**defaults)


def _png_bytes(w=4000, h=10) -> bytes:
    from PIL import Image

    buf = io.BytesIO()
    Image.new("RGB", (w, h), (10, 20, 30)).save(buf, format="PNG")
    return buf.getvalue()


# --------------------------------------------------------------- CDN URLs
def test_cdn_url_used_when_configured(settings):
    settings.CDN_BASE_URL = "https://cdn.example.net"
    product = _product(featured_image_url="")
    product.featured_image_file = SimpleUploadedFile(
        "hero.png", _png_bytes(), content_type="image/png"
    )
    product.save()

    url = product.to_contract()["featuredImage"]["url"]
    assert url.startswith("https://cdn.example.net/media/")


def test_media_url_falls_back_to_api_without_cdn(settings):
    settings.CDN_BASE_URL = ""
    product = _product(featured_image_url="")
    product.featured_image_file = SimpleUploadedFile(
        "hero.png", _png_bytes(), content_type="image/png"
    )
    product.save()
    url = product.to_contract()["featuredImage"]["url"]
    assert url.startswith("http://testserver/api/media/")


# --------------------------------------------------------- image optimisation
def test_uploaded_image_is_optimised_to_webp():
    product = _product(featured_image_url="")
    product.featured_image_file = SimpleUploadedFile(
        "hero.png", _png_bytes(w=4000, h=10), content_type="image/png"
    )
    product.save()

    key = product.featured_image_cdn_key
    assert key.startswith("media/img/midnight-noir/")
    assert key.endswith(".webp")
    assert default_storage.exists(key)
    # featured_image() prefers the optimised key.
    assert key in product.featured_image()


def test_optimize_image_downscales_oversized():
    from PIL import Image

    product = _product()
    product.featured_image_file = SimpleUploadedFile(
        "wide.png", _png_bytes(w=5000, h=8), content_type="image/png"
    )
    product.save()
    with default_storage.open(product.featured_image_cdn_key, "rb") as fh:
        out = Image.open(fh)
        assert max(out.size) <= images.MAX_EDGE


# --------------------------------------------------------------- transcode
def test_output_keys(settings):
    settings.AWS_S3_BUCKET = "my-bucket"
    keys = transcode.output_keys("midnight-noir")
    assert keys["hls_key"] == "media/hls/midnight-noir/master.m3u8"
    assert keys["poster_key"] == "media/hls/midnight-noir/poster.0000000.jpg"
    assert keys["dest"] == "s3://my-bucket/media/hls/midnight-noir/"


def test_build_settings_shape(settings):
    settings.AWS_S3_BUCKET = "my-bucket"
    s = transcode._build_settings("media/midnight-noir/clip.mp4", "midnight-noir")
    assert s["Inputs"][0]["FileInput"] == "s3://my-bucket/media/midnight-noir/clip.mp4"
    groups = {g["Name"]: g for g in s["OutputGroups"]}
    assert set(groups) == {"HLS", "Poster"}
    # Three-rendition ladder.
    assert len(groups["HLS"]["Outputs"]) == 3
    heights = [o["VideoDescription"]["Height"] for o in groups["HLS"]["Outputs"]]
    assert heights == [1080, 720, 480]


def test_submit_hls_job_calls_create_job(settings, monkeypatch):
    settings.AWS_S3_BUCKET = "my-bucket"
    settings.MEDIACONVERT_ROLE_ARN = "arn:aws:iam::123:role/mc"
    settings.MEDIACONVERT_QUEUE_ARN = ""
    captured = {}

    class FakeClient:
        def create_job(self, **kwargs):
            captured.update(kwargs)
            return {"Job": {"Id": "job-123"}}

    monkeypatch.setattr(transcode, "get_client", lambda: FakeClient())
    res = transcode.submit_hls_job("media/midnight-noir/clip.mp4", "midnight-noir")

    assert res["job_id"] == "job-123"
    assert res["hls_key"] == "media/hls/midnight-noir/master.m3u8"
    assert captured["Role"] == "arn:aws:iam::123:role/mc"
    assert "Queue" not in captured  # omitted when no queue ARN


def test_save_submits_transcode_when_enabled(settings, monkeypatch):
    settings.AWS_S3_BUCKET = "my-bucket"
    settings.MEDIACONVERT_ROLE_ARN = "arn:aws:iam::123:role/mc"
    settings.TRANSCODE_ENABLED = True

    calls = {}

    def fake_submit(source_key, handle):
        calls["source"] = source_key
        return {
            "job_id": "job-9",
            "hls_key": f"media/hls/{handle}/master.m3u8",
            "poster_key": f"media/hls/{handle}/poster.0000000.jpg",
        }

    monkeypatch.setattr(transcode, "transcode_enabled", lambda: True)
    monkeypatch.setattr(transcode, "submit_hls_job", fake_submit)

    product = _product()
    product.preview_video_file = SimpleUploadedFile(
        "clip.mp4", b"\x00\x00\x00\x18ftyp", content_type="video/mp4"
    )
    product.save()

    assert product.transcode_job_id == "job-9"
    assert product.transcode_status == "SUBMITTED"
    assert product.preview_hls_key == "media/hls/midnight-noir/master.m3u8"
    assert calls["source"].startswith("media/midnight-noir/")

    # HLS only surfaces in the contract once the job is COMPLETE.
    assert product.to_contract()["previewHls"] is None
    product.transcode_status = "COMPLETE"
    product.save(update_fields=["transcode_status"])
    assert product.to_contract()["previewHls"] is not None


def test_save_without_mediaconvert_stores_clip_as_is(settings):
    settings.TRANSCODE_ENABLED = False
    product = _product()
    product.preview_video_file = SimpleUploadedFile(
        "clip.mp4", b"\x00\x00\x00\x18ftyp", content_type="video/mp4"
    )
    product.save()
    assert product.transcode_status == ""
    assert product.transcode_job_id == ""
    # Falls back to progressive playback of the stored file.
    assert product.to_contract()["previewVideo"].endswith(".mp4")
    assert product.to_contract()["previewHls"] is None
