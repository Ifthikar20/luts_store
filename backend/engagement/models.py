"""Lightweight engagement records: newsletter subscribers + contact messages.

These power the storefront's footer newsletter signup and the /contact form.
Both endpoints are intentionally non-enumerating (see ``engagement.views``).
"""
from __future__ import annotations

from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models


class NewsletterSubscriber(models.Model):
    """A single email opted in to the newsletter.

    ``email`` is unique so the subscribe endpoint can ``get_or_create`` and
    return an identical generic response whether or not the address already
    existed (no enumeration).
    """

    email = models.EmailField(unique=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:  # pragma: no cover - repr only
        return f"NewsletterSubscriber({self.email})"


class ContactMessage(models.Model):
    """A message submitted through the /contact form."""

    name = models.CharField(max_length=120)
    email = models.EmailField()
    message = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:  # pragma: no cover - repr only
        return f"ContactMessage(from={self.email}, at={self.created_at:%Y-%m-%d})"


class Review(models.Model):
    """A product review written by an AUTHENTICATED, VERIFIED buyer.

    Authenticity is enforced server-side (``engagement.views.create_review``):
    a review can only be created by a logged-in customer who holds a non-revoked
    ``DownloadGrant`` for that product, and there is at most one review per
    (product, user). So the "Verified" badge actually means a verified purchase
    — it cannot be self-asserted, unlike the old hard-coded placeholders.
    """

    product_handle = models.CharField(max_length=255, db_index=True)
    user = models.ForeignKey(
        "auth.User", on_delete=models.CASCADE, related_name="reviews"
    )
    author_name = models.CharField(max_length=120)
    rating = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)]
    )
    title = models.CharField(max_length=140, blank=True)
    body = models.TextField()
    # Always true today (creation is gated on a verified purchase); kept explicit
    # so the gate is auditable and the column can carry future review sources.
    verified = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["product_handle", "user"],
                name="one_review_per_user_per_product",
            )
        ]

    def __str__(self) -> str:  # pragma: no cover - repr only
        return f"Review({self.product_handle}, {self.author_name}, {self.rating} stars)"

    def to_public(self) -> dict:
        """The shape the storefront renders (date label is computed client-side)."""
        return {
            "id": str(self.pk),
            "name": self.author_name or "Customer",
            "rating": self.rating,
            "date": self.created_at.isoformat(),
            "title": self.title,
            "body": self.body,
            "verified": self.verified,
        }

