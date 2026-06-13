"""Security-header middleware: CSP on JSON, Permissions-Policy/CORP everywhere."""
import os
import subprocess
import sys

import pytest
from django.conf import settings
from rest_framework.test import APIClient

pytestmark = pytest.mark.django_db


@pytest.fixture
def client():
    return APIClient()


def test_cookies_are_hardened():
    # HttpOnly + SameSite=Lax on both cookies; bounded, refreshed session.
    assert settings.SESSION_COOKIE_HTTPONLY is True
    assert settings.CSRF_COOKIE_HTTPONLY is True
    assert settings.SESSION_COOKIE_SAMESITE == "Lax"
    assert settings.CSRF_COOKIE_SAMESITE == "Lax"
    assert settings.SESSION_SAVE_EVERY_REQUEST is True
    assert settings.SESSION_COOKIE_AGE > 0


def test_secure_cookies_use_host_prefix():
    """With the *_SECURE flags on (production/HTTPS), cookies get __Host- names."""
    env = {
        **os.environ,
        "SESSION_COOKIE_SECURE": "True",
        "CSRF_COOKIE_SECURE": "True",
        "DJANGO_SETTINGS_MODULE": "config.settings",
    }
    code = (
        "from django.conf import settings;"
        "print(settings.SESSION_COOKIE_NAME, settings.CSRF_COOKIE_NAME)"
    )
    out = subprocess.check_output(
        [sys.executable, "-c", f"import django;django.setup();{code}"],
        env=env,
        text=True,
    ).strip()
    assert out == "__Host-sessionid __Host-csrftoken"


def test_json_api_gets_locked_down_csp(client):
    resp = client.get("/api/products")
    assert resp.status_code == 200
    assert resp["Content-Security-Policy"] == (
        "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; "
        "form-action 'none'"
    )


def test_permissions_policy_and_corp_present(client):
    resp = client.get("/api/health")
    assert "camera=()" in resp["Permissions-Policy"]
    assert resp["Cross-Origin-Resource-Policy"] == "same-site"


def test_baseline_security_headers(client):
    resp = client.get("/api/health")
    assert resp["X-Content-Type-Options"] == "nosniff"
    assert resp["X-Frame-Options"] == "DENY"
    assert resp["Referrer-Policy"] == "strict-origin-when-cross-origin"


def test_admin_ip_allowlist_blocks_when_set(client, settings):
    # No allowlist -> admin reachable (redirects to login, not 404).
    assert client.get("/admin/").status_code != 404
    # With an allowlist that excludes the test client -> 404 (hidden).
    settings.ADMIN_IP_ALLOWLIST = ["10.0.0.1"]
    assert client.get("/admin/").status_code == 404
    # A request from an allowed IP passes.
    ok = client.get("/admin/", HTTP_X_FORWARDED_FOR="10.0.0.1")
    assert ok.status_code != 404
