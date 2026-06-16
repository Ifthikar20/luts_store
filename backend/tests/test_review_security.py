"""
Review security: content filtering (sanitize markup + mask profanity) and
field-level encryption at rest (ciphertext in the DB, plaintext via the API).
"""
import pytest
from django.db import connection
from rest_framework.test import APIClient

from common import moderation
from engagement.models import Review

pytestmark = pytest.mark.django_db


@pytest.fixture
def client():
    return APIClient()


def _buyer(client, email="buyer@example.com", handle="midnight-noir"):
    from delivery.models import DownloadGrant

    DownloadGrant.objects.create(email=email, product_handle=handle)
    client.post("/api/auth/shopify/mock-complete", {"email": email}, format="json")


# --- unit: moderation ------------------------------------------------------
def test_sanitize_strips_markup():
    assert moderation.sanitize("hi <script>alert(1)</script> there") == "hi alert(1) there"
    assert moderation.sanitize("<b>bold</b>") == "bold"


def test_profanity_masked_including_inflections():
    out = moderation.clean_review_text("this is fucking bullshit")
    assert "fucking" not in out and "bullshit" not in out
    assert out.startswith("this is f")  # first letter kept, rest masked


# --- integration: create endpoint cleans content ---------------------------
def test_posted_review_is_sanitized_and_masked(client):
    _buyer(client)
    resp = client.post(
        "/api/products/midnight-noir/reviews/create",
        {
            "rating": 5,
            "title": "Great <b>look</b>",
            "body": "This is fucking great <script>alert(1)</script>",
            "recaptchaToken": "x",
        },
        format="json",
    )
    assert resp.status_code == 201
    r = resp.json()["review"]
    assert "<" not in r["body"] and "<" not in r["title"]  # markup stripped
    assert "fucking" not in r["body"]  # profanity masked
    assert "f" in r["body"] and "*" in r["body"]


# --- integration: encryption at rest ---------------------------------------
def test_review_body_is_encrypted_in_the_database(client):
    _buyer(client)
    client.post(
        "/api/products/midnight-noir/reviews/create",
        {"rating": 5, "body": "supersecretreviewtext", "recaptchaToken": "x"},
        format="json",
    )
    # Read the raw column, bypassing the field's decrypt.
    with connection.cursor() as c:
        c.execute("SELECT title, body FROM engagement_review LIMIT 1")
        raw_title, raw_body = c.fetchone()
    assert raw_body.startswith("enc:v1:")
    assert "supersecretreviewtext" not in raw_body

    # ...but the model/API return plaintext.
    review = Review.objects.first()
    assert review.body == "supersecretreviewtext"
    listed = client.get("/api/products/midnight-noir/reviews").json()
    assert listed["reviews"][0]["body"] == "supersecretreviewtext"
