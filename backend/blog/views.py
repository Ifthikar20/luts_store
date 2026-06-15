"""
Public blog API (read-only).

* GET /api/blog/posts          -> [{slug, title, excerpt, coverImage, author,
                                    publishedAt, readingTime}]  (published only)
* GET /api/blog/posts/<slug>   -> the above + {bodyHtml}        (published only)

Drafts (``published=False``) are never returned, so unpublished work can't leak.
"""
from __future__ import annotations

from rest_framework.decorators import (
    api_view,
    authentication_classes,
    permission_classes,
    throttle_classes,
)
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle

from .models import Post


@api_view(["GET"])
@authentication_classes([])
@permission_classes([])
@throttle_classes([AnonRateThrottle])
def list_posts(request):
    posts = Post.objects.published()
    return Response([p.to_summary() for p in posts])


@api_view(["GET"])
@authentication_classes([])
@permission_classes([])
@throttle_classes([AnonRateThrottle])
def post_detail(request, slug: str):
    post = Post.objects.published().filter(slug=slug).first()
    if post is None:
        return Response({"detail": "Not found."}, status=404)
    return Response(post.to_detail())
