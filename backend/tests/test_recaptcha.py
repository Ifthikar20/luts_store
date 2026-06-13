"""
Google reCAPTCHA v3 verification: config-gated, score-thresholded, fail-open on
provider outage. Plus integration: review creation is blocked for a low score.
"""
import pytest
from rest_framework.test import APIClient

from common import recaptcha

pytestmark = pytest.mark.django_db


class _Resp:
    def __init__(self, payload):
        self._p = payload

    def json(self):
        return self._p


def test_disabled_is_noop(settings):
    settings.RECAPTCHA_SECRET_KEY = ""
    # No token needed when unconfigured.
    assert recaptcha.verify(None, action="login") is True


def test_enabled_requires_token(settings):
    settings.RECAPTCHA_SECRET_KEY = "secret"
    assert recaptcha.verify("", action="login") is False


def test_enabled_accepts_good_score(settings, monkeypatch):
    settings.RECAPTCHA_SECRET_KEY = "secret"
    settings.RECAPTCHA_MIN_SCORE = 0.5
    monkeypatch.setattr(
        recaptcha.requests,
        "post",
        lambda *a, **k: _Resp({"success": True, "score": 0.9, "action": "login"}),
    )
    assert recaptcha.verify("tok", action="login") is True


def test_enabled_rejects_low_score(settings, monkeypatch):
    settings.RECAPTCHA_SECRET_KEY = "secret"
    settings.RECAPTCHA_MIN_SCORE = 0.5
    monkeypatch.setattr(
        recaptcha.requests,
        "post",
        lambda *a, **k: _Resp({"success": True, "score": 0.1, "action": "login"}),
    )
    assert recaptcha.verify("tok", action="login") is False


def test_enabled_rejects_unsuccessful(settings, monkeypatch):
    settings.RECAPTCHA_SECRET_KEY = "secret"
    monkeypatch.setattr(
        recaptcha.requests,
        "post",
        lambda *a, **k: _Resp({"success": False, "error-codes": ["timeout-or-duplicate"]}),
    )
    assert recaptcha.verify("tok", action="login") is False


def test_fails_open_on_network_error(settings, monkeypatch):
    settings.RECAPTCHA_SECRET_KEY = "secret"

    def boom(*a, **k):
        raise recaptcha.requests.RequestException("google down")

    monkeypatch.setattr(recaptcha.requests, "post", boom)
    # Availability over strictness: an outage must not lock everyone out.
    assert recaptcha.verify("tok", action="login") is True


def test_review_creation_blocked_for_bot(settings, monkeypatch):
    settings.RECAPTCHA_SECRET_KEY = "secret"
    monkeypatch.setattr(
        recaptcha.requests,
        "post",
        lambda *a, **k: _Resp({"success": True, "score": 0.0}),
    )
    from django.utils import timezone  # noqa: F401
    from delivery.models import DownloadGrant

    DownloadGrant.objects.create(email="buyer@example.com", product_handle="midnight-noir")
    client = APIClient()
    client.post("/api/auth/shopify/mock-complete", {"email": "buyer@example.com"}, format="json")

    resp = client.post(
        "/api/products/midnight-noir/reviews/create",
        {"rating": 5, "body": "spammy", "recaptchaToken": "bot"},
        format="json",
    )
    assert resp.status_code == 400
    assert "human" in resp.json()["detail"].lower()
