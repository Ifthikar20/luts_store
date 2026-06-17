"""Review actions: sort, helpful votes, reporting (+ auto-hide), delete-own."""
import pytest
from rest_framework.test import APIClient

from engagement.models import Review, ReviewReport

pytestmark = pytest.mark.django_db


def _buyer(client, email, handle="midnight-noir"):
    from delivery.models import DownloadGrant

    DownloadGrant.objects.create(email=email, product_handle=handle)
    client.post("/api/auth/shopify/mock-complete", {"email": email}, format="json")


def _post_review(client, handle="midnight-noir", rating=5, body="great pack"):
    return client.post(
        f"/api/products/{handle}/reviews/create",
        {"rating": rating, "body": body, "recaptchaToken": "x"},
        format="json",
    )


def test_helpful_vote_toggles(client_factory=APIClient):
    author = APIClient()
    _buyer(author, "author@example.com")
    rid = _post_review(author).json()["review"]["id"]

    voter = APIClient()
    _buyer(voter, "voter@example.com")
    on = voter.post(f"/api/reviews/{rid}/helpful")
    assert on.status_code == 200 and on.json()["helpfulCount"] == 1
    assert on.json()["youVoted"] is True
    off = voter.post(f"/api/reviews/{rid}/helpful")
    assert off.json()["helpfulCount"] == 0 and off.json()["youVoted"] is False


def test_helpful_requires_login():
    author = APIClient()
    _buyer(author, "a@example.com")
    rid = _post_review(author).json()["review"]["id"]
    assert APIClient().post(f"/api/reviews/{rid}/helpful").status_code == 401


def test_report_auto_hides_after_threshold():
    author = APIClient()
    _buyer(author, "author2@example.com")
    rid = _post_review(author).json()["review"]["id"]

    # Four distinct reporters trip the auto-hide threshold.
    for i in range(4):
        c = APIClient()
        _buyer(c, f"r{i}@example.com")
        assert c.post(f"/api/reviews/{rid}/report").status_code == 200
    review = Review.objects.get(pk=rid)
    assert review.report_count == 4
    assert review.status == Review.HIDDEN
    assert ReviewReport.objects.filter(review=review).count() == 4

    # Hidden reviews drop out of the public list.
    listed = APIClient().get("/api/products/midnight-noir/reviews").json()
    assert listed["count"] == 0


def test_delete_only_own_review():
    author = APIClient()
    _buyer(author, "owner@example.com")
    rid = _post_review(author).json()["review"]["id"]

    stranger = APIClient()
    _buyer(stranger, "stranger@example.com")
    assert stranger.post(f"/api/reviews/{rid}/delete").status_code == 403
    assert Review.objects.filter(pk=rid).exists()

    assert author.post(f"/api/reviews/{rid}/delete").status_code == 200
    assert not Review.objects.filter(pk=rid).exists()


def test_sort_highest_lowest():
    a = APIClient()
    _buyer(a, "a3@example.com")
    _post_review(a, rating=2, body="meh")
    b = APIClient()
    _buyer(b, "b3@example.com")
    _post_review(b, rating=5, body="amazing")

    hi = APIClient().get("/api/products/midnight-noir/reviews?sort=highest").json()
    assert [r["rating"] for r in hi["reviews"]] == [5, 2]
    lo = APIClient().get("/api/products/midnight-noir/reviews?sort=lowest").json()
    assert [r["rating"] for r in lo["reviews"]] == [2, 5]


def test_list_reviews_is_bounded_and_no_n_plus_1(django_assert_max_num_queries):
    """Many reviews + a logged-in viewer must NOT trigger a per-review query."""
    from django.contrib.auth.models import User
    from engagement.models import Review

    for i in range(25):
        u = User.objects.create(username=f"u{i}@e.com", email=f"u{i}@e.com")
        Review.objects.create(
            product_handle="midnight-noir", user=u, author_name=f"U{i}",
            rating=(i % 5) + 1, body="nice pack",
        )
    viewer = APIClient()
    _buyer(viewer, "viewer-q@example.com")  # logged in -> exercises youVoted path

    # A constant, small number of queries regardless of review count (aggregate
    # + page + one votes prefetch + session/auth), NOT one-per-review.
    with django_assert_max_num_queries(12):
        resp = viewer.get("/api/products/midnight-noir/reviews")
    body = resp.json()
    assert body["count"] == 25
    assert len(body["reviews"]) == 25  # under the 200 cap
