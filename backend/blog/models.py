"""
Blog posts — a lightweight, SEO-focused CMS the admin authors and publishes.

A post is written in Markdown in the Django admin; the API renders it to HTML so
the storefront (Next.js) can server-render it for search engines. Only published
posts are exposed publicly, so drafts never leak. This is the "publish -> shows
on the site" loop: tick *Published* in /admin and the post appears at /blog.
"""
from __future__ import annotations

import re

from django.db import models
from django.utils import timezone


class PublishedManager(models.Manager):
    def published(self):
        return self.filter(published=True, published_at__lte=timezone.now())


class Post(models.Model):
    title = models.CharField(max_length=200)
    slug = models.SlugField(
        unique=True, max_length=220, help_text="URL: /blog/<slug>."
    )
    excerpt = models.CharField(
        max_length=300,
        help_text="One- or two-sentence summary — shown on cards and used as the "
        "SEO meta description.",
    )
    body = models.TextField(help_text="Post content in Markdown.")
    cover_image_url = models.URLField(
        blank=True, help_text="Cover image (used on the card + Open Graph)."
    )
    author_name = models.CharField(max_length=120, default="The Looks Lab")

    published = models.BooleanField(
        default=False, help_text="Tick to make the post live on /blog."
    )
    published_at = models.DateTimeField(
        null=True, blank=True, help_text="Auto-set when first published."
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = PublishedManager()

    class Meta:
        ordering = ["-published_at", "-created_at"]

    def __str__(self) -> str:  # pragma: no cover - repr only
        return self.title

    def save(self, *args, **kwargs):
        # Stamp the publish time the first time it goes live.
        if self.published and self.published_at is None:
            self.published_at = timezone.now()
        super().save(*args, **kwargs)

    # --- rendering -----------------------------------------------------------
    def body_html(self) -> str:
        """Render the Markdown body to HTML (authored by trusted admins)."""
        try:
            import markdown

            return markdown.markdown(
                self.body, extensions=["extra", "smarty", "sane_lists"]
            )
        except Exception:  # pragma: no cover - markdown missing/edge
            # Degrade to paragraphs so content still renders.
            paras = [p.strip() for p in self.body.split("\n\n") if p.strip()]
            return "".join(f"<p>{p}</p>" for p in paras)

    def reading_time(self) -> int:
        """Whole-minute reading estimate (~200 wpm), min 1."""
        words = len(re.findall(r"\w+", self.body))
        return max(1, round(words / 200))

    def _summary(self) -> dict:
        return {
            "slug": self.slug,
            "title": self.title,
            "excerpt": self.excerpt,
            "coverImage": self.cover_image_url,
            "author": self.author_name,
            "publishedAt": self.published_at.isoformat() if self.published_at else None,
            "readingTime": self.reading_time(),
        }

    def to_summary(self) -> dict:
        """Card/list shape (no body)."""
        return self._summary()

    def to_detail(self) -> dict:
        """Full post shape, including rendered HTML."""
        return {**self._summary(), "bodyHtml": self.body_html()}
