"""
Product reviews — authentic, purchase-gated.

A review can be created ONLY by a logged-in customer who owns a non-revoked
download grant for that product (so "Verified" can't be self-asserted). The
public list endpoint returns real per-product data + an aggregate rating.
"""
import pytest
from rest_framework.test import APIClient

from engagement.models import Review

pytestmark = pytest.mark.django_db


@pytest.fixture
def client():
    return APIClient()


def _login(client, email):
    """Establish a session via the mock customer portal."""
    client.post(
        "/api/auth/shopify/mock-complete", {"email": email}, format="json"
    )


def _grant(email, handle, revoked=False):
    from django.utils import timezone
    from delivery.models import DownloadGrant

    return DownloadGrant.objects.create(
        email=email,
        product_handle=handle,
        revoked_at=timezone.now() if revoked else None,
    )


def test_list_empty_by_default(client):
    resp = client.get("/api/products/midnight-noir/reviews")
    assert resp.status_code == 200
    body = resp.json()
    assert body == {"average": 0.0, "count": 0, "reviews": [], "canReview": False}


def test_anonymous_cannot_create(client):
    resp = client.post(
        "/api/products/midnight-noir/reviews/create",
        {"rating": 5, "body": "great"},
        format="json",
    )
    assert resp.status_code == 401
    assert Review.objects.count() == 0


def test_logged_in_non_buyer_is_forbidden(client):
    _login(client, "lurker@example.com")
    resp = client.post(
        "/api/products/midnight-noir/reviews/create",
        {"rating": 5, "body": "I didn't buy this"},
        format="json",
    )
    assert resp.status_code == 403
    assert Review.objects.count() == 0


def test_revoked_grant_cannot_review(client):
    _grant("refunded@example.com", "midnight-noir", revoked=True)
    _login(client, "refunded@example.com")
    resp = client.post(
        "/api/products/midnight-noir/reviews/create",
        {"rating": 4, "body": "refunded buyer"},
        format="json",
    )
    assert resp.status_code == 403


def test_verified_buyer_can_create_and_it_shows_up(client):
    _grant("buyer@example.com", "midnight-noir")
    _login(client, "buyer@example.com")

    resp = client.post(
        "/api/products/midnight-noir/reviews/create",
        {"rating": 5, "title": "Stunning", "body": "Filmic in one drag.", "name": "Sam"},
        format="json",
    )
    assert resp.status_code == 201
    r = resp.json()["review"]
    assert r["rating"] == 5 and r["verified"] is True and r["name"] == "Sam"

    # Public list now reflects it.
    body = client.get("/api/products/midnight-noir/reviews").json()
    assert body["count"] == 1
    assert body["average"] == 5.0
    assert body["reviews"][0]["title"] == "Stunning"


def test_one_review_per_user_updates_in_place(client):
    _grant("buyer@example.com", "midnight-noir")
    _login(client, "buyer@example.com")
    client.post(
        "/api/products/midnight-noir/reviews/create",
        {"rating": 3, "body": "ok"},
        format="json",
    )
    client.post(
        "/api/products/midnight-noir/reviews/create",
        {"rating": 5, "body": "grew on me"},
        format="json",
    )
    assert Review.objects.filter(product_handle="midnight-noir").count() == 1
    assert client.get("/api/products/midnight-noir/reviews").json()["average"] == 5.0


def test_rating_is_validated(client):
    _grant("buyer@example.com", "midnight-noir")
    _login(client, "buyer@example.com")
    for bad in (0, 6, "x", None):
        resp = client.post(
            "/api/products/midnight-noir/reviews/create",
            {"rating": bad, "body": "text"},
            format="json",
        )
        assert resp.status_code == 400


def test_can_review_flag_for_buyer(client):
    _grant("buyer@example.com", "midnight-noir")
    _login(client, "buyer@example.com")
    body = client.get("/api/products/midnight-noir/reviews").json()
    assert body["canReview"] is True
    # ...but not for a product they didn't buy.
    other = client.get("/api/products/golden-hour-drama/reviews").json()
    assert other["canReview"] is False
