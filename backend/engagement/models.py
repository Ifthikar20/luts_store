"""Lightweight engagement records: newsletter subscribers + contact messages.

These power the storefront's footer newsletter signup and the /contact form.
Both endpoints are intentionally non-enumerating (see ``engagement.views``).
"""
from __future__ import annotations

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
