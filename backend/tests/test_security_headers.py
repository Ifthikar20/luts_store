"""Security-header middleware: CSP on JSON, Permissions-Policy/CORP everywhere."""
import pytest
from rest_framework.test import APIClient

pytestmark = pytest.mark.django_db


@pytest.fixture
def client():
    return APIClient()


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
