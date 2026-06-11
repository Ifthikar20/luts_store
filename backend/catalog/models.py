"""
Database-backed catalog (the source the Django admin edits).

When any published Product rows exist, ``catalog.source`` serves the store from
these models instead of the in-repo ``mockdata`` fixture — so the admin at
``/admin`` becomes the product dashboard. Each model knows how to render itself
into the exact public ``Product``/collection contract the API already returns
(see ``Product.to_contract``), so nothing downstream (cart, checkout, delivery)
needs to change.
"""
from __future__ import annotations

import io
import zipfile
from typing import Any

from django.conf import settings
from django.db import models


def _csv_to_list(value: str) -> list[str]:
    """Split a comma-separated admin field into a clean list."""
    return [part.strip() for part in (value or "").split(",") if part.strip()]


def _media_url(name: str) -> str:
    """Stable, same-origin URL for an uploaded media object.

    Points at the ``/api/media/<key>`` endpoint, which 302-redirects to a fresh
    presigned S3 URL (or the local file in dev). Stable so SSR/CDN caching works
    even though the underlying presigned URL rotates.
    """
    base = settings.API_BASE_URL.rstrip("/")
    return f"{base}/api/media/{name}"


def lut_upload_to(instance: "Product", filename: str) -> str:
    """LUT files always land at the canonical private key ``luts/<handle>.zip``."""
    prefix = getattr(settings, "S3_KEY_PREFIX", "luts").strip("/")
    return f"{prefix}/{instance.handle}.zip"


def media_upload_to(instance, filename: str) -> str:
    """Preview images/videos live under ``media/`` (publicly served via /api/media)."""
    handle = getattr(instance, "handle", None) or getattr(
        getattr(instance, "product", None), "handle", "misc"
    )
    return f"media/{handle}/{filename}"


class Collection(models.Model):
    handle = models.SlugField(unique=True, help_text="URL slug, e.g. 'cinematic'.")
    title = models.CharField(max_length=120)
    description = models.TextField(blank=True)
    image = models.URLField(blank=True, help_text="Cover image URL.")
    position = models.PositiveIntegerField(
        default=0, help_text="Lower numbers sort first."
    )

    class Meta:
        ordering = ["position", "id"]

    def __str__(self) -> str:
        return self.title


class Product(models.Model):
    LUT_PACK = "LUT Pack"
    BUNDLE = "Bundle"
    TYPE_CHOICES = [(LUT_PACK, "LUT Pack"), (BUNDLE, "Bundle")]

    handle = models.SlugField(
        unique=True, help_text="URL slug, e.g. 'midnight-noir'. Also the S3 file name."
    )
    title = models.CharField(max_length=160)
    description = models.TextField(blank=True)
    product_type = models.CharField(
        max_length=40, choices=TYPE_CHOICES, default=LUT_PACK
    )

    price = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    compare_at_price = models.DecimalField(
        max_digits=8,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Optional 'was' price to show a discount.",
    )
    currency = models.CharField(max_length=3, default="USD")

    vendor = models.CharField(max_length=80, default="Luts.shop")
    best_for = models.CharField(
        max_length=200,
        blank=True,
        help_text="Bold use-case lead on cards, e.g. 'moody vlogs and rainy-day b-roll'.",
    )
    lut_count = models.PositiveIntegerField(default=1, help_text="LUTs in this pack.")
    tags = models.CharField(
        max_length=240,
        blank=True,
        help_text="Comma-separated, e.g. 'mobile, capcut, vlog, moody'. Add 'free' for the weekly free LUT.",
    )
    formats = models.CharField(max_length=120, default=".cube", help_text="Comma-separated.")
    compatible_apps = models.CharField(
        max_length=240,
        default="Premiere Pro,DaVinci Resolve,Final Cut,CapCut",
        help_text="Comma-separated.",
    )

    featured_image_url = models.URLField(
        blank=True, help_text="Main image URL (or upload a file below)."
    )
    featured_image_file = models.FileField(
        upload_to=media_upload_to, blank=True, help_text="Upload the main image."
    )
    featured_image_alt = models.CharField(max_length=200, blank=True)
    before_image_url = models.URLField(blank=True, help_text="Ungraded frame (before/after slider).")
    after_image_url = models.URLField(blank=True, help_text="Graded frame (enables the slider).")
    preview_video_url = models.URLField(blank=True, help_text="Looping preview clip URL (or upload below).")
    preview_video_file = models.FileField(
        upload_to=media_upload_to, blank=True, help_text="Upload a looping preview clip (mp4)."
    )

    lut_file = models.FileField(
        upload_to=lut_upload_to,
        blank=True,
        help_text="Upload the downloadable LUT pack (.zip, or a single .cube — it's zipped for you).",
    )
    file_key = models.CharField(
        max_length=200,
        blank=True,
        help_text="Private S3 object key. Auto-set when you upload; blank = 'luts/<handle>.zip'.",
    )

    collections = models.ManyToManyField(
        Collection, blank=True, related_name="products"
    )

    featured = models.BooleanField(default=False, help_text="Float to the top of listings.")
    available = models.BooleanField(default=True, help_text="Uncheck to mark sold-out.")
    published = models.BooleanField(
        default=True, help_text="Uncheck to hide from the store (draft)."
    )
    position = models.PositiveIntegerField(default=0, help_text="Lower numbers sort first.")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["position", "id"]

    def __str__(self) -> str:
        return self.title

    # --- contract rendering --------------------------------------------------
    def gid(self) -> str:
        return f"gid://shopify/Product/{self.pk}"

    def variant_gid(self) -> str:
        return f"gid://shopify/ProductVariant/{self.pk}"

    def _money(self, amount) -> dict[str, str]:
        from decimal import Decimal, InvalidOperation

        try:
            value = Decimal(str(amount))
        except (InvalidOperation, TypeError):
            value = Decimal("0")
        return {"amount": f"{value:.2f}", "currencyCode": self.currency}

    def resolved_file_key(self) -> str:
        if self.lut_file:
            return self.lut_file.name
        return self.file_key.strip() if self.file_key.strip() else f"luts/{self.handle}.zip"

    def featured_image(self) -> str:
        return _media_url(self.featured_image_file.name) if self.featured_image_file else self.featured_image_url

    def preview_video(self) -> str | None:
        if self.preview_video_file:
            return _media_url(self.preview_video_file.name)
        return self.preview_video_url or None

    def save(self, *args, **kwargs):
        # Process an uploaded LUT file: a bare .cube is zipped into the pack;
        # a .zip is kept as-is. The result is stored at luts/<handle>.zip.
        upload = self.lut_file
        if upload and hasattr(upload, "file") and not upload._committed:
            name = (upload.name or "").lower()
            if name.endswith(".cube") or name.endswith(".3dl"):
                from django.core.files.base import ContentFile

                raw = upload.read()
                buf = io.BytesIO()
                with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
                    zf.writestr(upload.name.rsplit("/", 1)[-1], raw)
                self.lut_file.save(
                    f"{self.handle}.zip", ContentFile(buf.getvalue()), save=False
                )
        super().save(*args, **kwargs)
        # Keep file_key in sync with the uploaded object's key.
        if self.lut_file and self.file_key != self.lut_file.name:
            self.file_key = self.lut_file.name
            super().save(update_fields=["file_key"])

    def to_contract(self) -> dict[str, Any]:
        """Render this product into the public Product contract dict.

        Mirrors ``catalog.mockdata._product`` exactly so the API output is
        identical whether it comes from the DB or the fixture.
        """
        alt = self.featured_image_alt or f"{self.title} LUT preview"
        price = self._money(self.price)
        featured = self.featured_image()
        images = [{"url": featured, "altText": alt}]
        images += [
            {"url": im.display_url(), "altText": im.alt or f"{self.title} sample frame"}
            for im in self.extra_images.all()
        ]
        formats = _csv_to_list(self.formats) or [".cube"]
        apps = _csv_to_list(self.compatible_apps) or [
            "Premiere Pro",
            "DaVinci Resolve",
            "Final Cut",
            "CapCut",
        ]
        data: dict[str, Any] = {
            "id": self.gid(),
            "handle": self.handle,
            "file_key": self.resolved_file_key(),
            "title": self.title,
            "description": self.description,
            "descriptionHtml": f"<p>{self.description}</p>",
            "bestFor": self.best_for,
            "includedLuts": [
                {"name": lut.name, "tone": lut.tone}
                for lut in self.included_luts.all()
            ],
            "featuredImage": {"url": featured, "altText": alt},
            "images": images,
            "beforeImage": self.before_image_url or featured,
            "afterImage": self.after_image_url or None,
            "previewVideo": self.preview_video(),
            "priceRange": {"min": price, "max": price},
            "variants": [
                {
                    "id": self.variant_gid(),
                    "title": "Default",
                    "price": price,
                    "availableForSale": self.available,
                }
            ],
            "tags": _csv_to_list(self.tags),
            "productType": self.product_type,
            "vendor": self.vendor,
            "collections": [
                {"handle": c.handle, "title": c.title}
                for c in self.collections.all()
            ],
            "metafields": {
                "lutCount": self.lut_count,
                "formats": formats,
                "compatibleApps": apps,
            },
            "featured": self.featured,
        }
        if self.compare_at_price is not None:
            data["compareAtPrice"] = self._money(self.compare_at_price)
        return data


class ProductImage(models.Model):
    product = models.ForeignKey(
        Product, on_delete=models.CASCADE, related_name="extra_images"
    )
    url = models.URLField(blank=True, help_text="Image URL (or upload a file).")
    image = models.FileField(upload_to=media_upload_to, blank=True, help_text="Upload an image.")
    alt = models.CharField(max_length=200, blank=True)
    position = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["position", "id"]

    def display_url(self) -> str:
        return _media_url(self.image.name) if self.image else self.url

    def __str__(self) -> str:
        return f"image for {self.product.handle}"


class IncludedLut(models.Model):
    product = models.ForeignKey(
        Product, on_delete=models.CASCADE, related_name="included_luts"
    )
    name = models.CharField(max_length=120)
    tone = models.CharField(max_length=200, help_text="Short coloring note.")
    position = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["position", "id"]

    def __str__(self) -> str:
        return self.name
