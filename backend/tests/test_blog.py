"""Blog API: published-only list/detail, Markdown rendered to HTML."""
import pytest
from rest_framework.test import APIClient

from blog.models import Post

pytestmark = pytest.mark.django_db


@pytest.fixture
def client():
    return APIClient()


def test_seed_posts_are_listed(client):
    resp = client.get("/api/blog/posts")
    assert resp.status_code == 200
    slugs = {p["slug"] for p in resp.json()}
    assert {"what-is-a-lut", "why-you-need-luts"} <= slugs
    one = resp.json()[0]
    assert {"slug", "title", "excerpt", "coverImage", "readingTime"} <= set(one)
    assert "bodyHtml" not in one  # list is summaries only


def test_detail_renders_markdown(client):
    resp = client.get("/api/blog/posts/what-is-a-lut")
    assert resp.status_code == 200
    body = resp.json()
    assert "<h2" in body["bodyHtml"]  # markdown headings rendered
    assert body["title"]


def test_unknown_slug_404(client):
    assert client.get("/api/blog/posts/nope").status_code == 404


def test_drafts_are_hidden(client):
    Post.objects.create(
        title="Draft", slug="draft-post", excerpt="x", body="secret", published=False
    )
    assert client.get("/api/blog/posts/draft-post").status_code == 404
    slugs = {p["slug"] for p in client.get("/api/blog/posts").json()}
    assert "draft-post" not in slugs
