"""
Security + tamper-resistance tests for the login-free download endpoint.

Covers GOAL 1:
* tampered token (changed handle / flipped byte) -> 403
* expired token -> 403
* valid token in mock mode streams a .cube file as an attachment with the
  correct filename
* valid token in REAL mode 302-redirects to a presigned S3 URL whose key was
  derived SERVER-SIDE (not from the token), with no path traversal possible,
  and a short TTL
* the endpoint is throttled (dedicated ``download`` scope)

The real-mode S3 is exercised with moto (mocked AWS). The import is guarded so
the suite still runs if moto is not installed (those tests skip).
"""
import time
import urllib.parse

import pytest

from delivery.models import DownloadGrant
from delivery.signing import make_download_token
from rest_framework.test import APIClient

pytestmark = pytest.mark.django_db

try:
    from moto import mock_aws

    HAS_MOTO = True
except ImportError:  # pragma: no cover - dev dependency
    HAS_MOTO = False


@pytest.fixture
def client():
    return APIClient()


def _grant(handle="midnight-noir", email="b@e.com"):
    return DownloadGrant.objects.create(email=email, product_handle=handle)


# ---------------------------------------------------------------------------
# Tamper / expiry -> 403
# ---------------------------------------------------------------------------
def test_tampered_token_byte_flip_403(client):
    grant = _grant()
    token = make_download_token(grant.id, grant.product_handle)
    tampered = token[:-3] + ("aaa" if token[-3:] != "aaa" else "bbb")
    resp = client.get(f"/api/download/{tampered}")
    assert resp.status_code == 403


def test_tampered_token_changed_handle_403(client):
    """Editing the handle in the token breaks the HMAC signature -> 403.

    Proves you cannot edit a token to fetch a product you didn't buy: the handle
    is part of the signed payload.
    """
    grant = _grant(handle="midnight-noir")
    token = make_download_token(grant.id, grant.product_handle)
    # Splice a different handle into the (base64) payload portion.
    payload_part = token.split(":", 1)[0]
    tampered = token.replace(payload_part, payload_part[:-2] + "ZZ", 1)
    resp = client.get(f"/api/download/{tampered}")
    assert resp.status_code == 403


def test_expired_token_403(client, settings):
    settings.DOWNLOAD_TOKEN_MAX_AGE = 1
    grant = _grant()
    token = make_download_token(grant.id, grant.product_handle)
    time.sleep(2)
    resp = client.get(f"/api/download/{token}")
    assert resp.status_code == 403


# ---------------------------------------------------------------------------
# Mock mode -> streams a .cube attachment
# ---------------------------------------------------------------------------
def test_mock_mode_streams_cube_attachment(client, settings):
    settings.S3_DELIVERY_ENABLED = False
    grant = _grant(handle="midnight-noir")
    token = make_download_token(grant.id, grant.product_handle)
    resp = client.get(f"/api/download/{token}")

    assert resp.status_code == 200
    assert resp["Content-Disposition"] == 'attachment; filename="midnight-noir.cube"'
    body = resp.content.decode()
    assert "LUT_3D_SIZE" in body  # valid-looking .cube content


# ---------------------------------------------------------------------------
# Real mode -> 302 to a presigned URL, key derived server-side, short TTL
# ---------------------------------------------------------------------------
@pytest.mark.skipif(not HAS_MOTO, reason="moto not installed")
def test_real_mode_redirects_to_presigned_url_server_derived_key(client, settings):
    settings.S3_DELIVERY_ENABLED = True
    settings.AWS_ACCESS_KEY_ID = "testing"
    settings.AWS_SECRET_ACCESS_KEY = "testing"
    settings.AWS_S3_REGION = "us-east-1"
    settings.AWS_S3_BUCKET = "luts-private"
    settings.AWS_S3_ENDPOINT_URL = ""
    settings.S3_KEY_PREFIX = "luts"
    settings.DOWNLOAD_URL_TTL = 45

    with mock_aws():
        import boto3

        boto3.client("s3", region_name="us-east-1").create_bucket(
            Bucket="luts-private"
        )

        grant = _grant(handle="midnight-noir")
        token = make_download_token(grant.id, grant.product_handle)
        resp = client.get(f"/api/download/{token}")

    assert resp.status_code == 302
    location = resp["Location"]
    parsed = urllib.parse.urlparse(location)
    qs = urllib.parse.parse_qs(parsed.query)

    # The key is the SERVER-DERIVED one (luts/<handle>.zip), present in the path.
    assert "luts/midnight-noir.zip" in urllib.parse.unquote(parsed.path)
    # It is an AWS SigV4 presigned URL...
    assert qs["X-Amz-Algorithm"][0] == "AWS4-HMAC-SHA256"
    assert "X-Amz-Signature" in qs
    # ...with a SHORT TTL.
    assert int(qs["X-Amz-Expires"][0]) == 45
    assert int(qs["X-Amz-Expires"][0]) <= 300
    # Forces an attachment download with a sensible filename.
    disp = urllib.parse.unquote(qs["response-content-disposition"][0])
    assert disp == 'attachment; filename="midnight-noir.zip"'


@pytest.mark.skipif(not HAS_MOTO, reason="moto not installed")
def test_real_mode_no_path_traversal(client, settings):
    """A token crafted with a traversal handle is not honored.

    The grant's handle is what the key is derived from, and the token's handle
    must match the grant's. A token claiming "../secret" does not match the
    grant -> 404, and the key is never built from token-supplied path segments.
    """
    settings.S3_DELIVERY_ENABLED = True
    settings.AWS_ACCESS_KEY_ID = "testing"
    settings.AWS_SECRET_ACCESS_KEY = "testing"
    settings.AWS_S3_BUCKET = "luts-private"
    settings.S3_KEY_PREFIX = "luts"

    grant = _grant(handle="midnight-noir")
    # Sign a token whose handle does NOT match the grant (attacker-crafted).
    bad_token = make_download_token(grant.id, "../../etc/passwd")
    resp = client.get(f"/api/download/{bad_token}")
    # Handle mismatch -> grant not found -> 404 (never reaches S3).
    assert resp.status_code == 404


def test_unknown_grant_404(client):
    token = make_download_token(999999, "midnight-noir")
    resp = client.get(f"/api/download/{token}")
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Throttling
# ---------------------------------------------------------------------------
def test_download_endpoint_is_throttled(client, monkeypatch):
    """Proves the endpoint is wired to the dedicated 'download' scoped throttle.

    DRF binds THROTTLE_RATES at import time, so we patch the throttle's rate
    directly (settings overrides don't propagate to it).
    """
    from delivery.views import DownloadScopedThrottle
    from rest_framework.throttling import SimpleRateThrottle

    monkeypatch.setitem(DownloadScopedThrottle.THROTTLE_RATES, "download", "3/min")
    SimpleRateThrottle.cache.clear()

    grant = _grant()
    token = make_download_token(grant.id, grant.product_handle)

    statuses = []
    for _ in range(5):
        statuses.append(client.get(f"/api/download/{token}").status_code)

    assert 429 in statuses
    SimpleRateThrottle.cache.clear()
