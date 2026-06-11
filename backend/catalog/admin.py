"""
Django admin = the LUT product dashboard.

Log in at ``/admin`` to create, edit, publish and price LUT packs and bundles.
The moment a product is published, ``catalog.source`` serves the store from the
database instead of the in-repo fixture.
"""
from django.contrib import admin

from .models import Collection, IncludedLut, Product, ProductImage


@admin.register(Collection)
class CollectionAdmin(admin.ModelAdmin):
    list_display = ("title", "handle", "position")
    list_editable = ("position",)
    prepopulated_fields = {"handle": ("title",)}
    search_fields = ("title", "handle")


class ProductImageInline(admin.TabularInline):
    model = ProductImage
    extra = 1


class IncludedLutInline(admin.TabularInline):
    model = IncludedLut
    extra = 3


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = (
        "title",
        "handle",
        "product_type",
        "price",
        "lut_count",
        "featured",
        "available",
        "published",
    )
    list_editable = ("price", "featured", "available", "published")
    list_filter = ("product_type", "featured", "published", "collections")
    search_fields = ("title", "handle", "tags")
    prepopulated_fields = {"handle": ("title",)}
    filter_horizontal = ("collections",)
    inlines = [IncludedLutInline, ProductImageInline]
    save_on_top = True
    fieldsets = (
        (None, {"fields": ("title", "handle", "product_type", "description", "best_for")}),
        ("Pricing", {"fields": ("price", "compare_at_price", "currency")}),
        (
            "Details",
            {
                "fields": (
                    "lut_count",
                    "tags",
                    "formats",
                    "compatible_apps",
                    "vendor",
                    "collections",
                )
            },
        ),
        (
            "Media",
            {
                "fields": (
                    "featured_image_url",
                    "featured_image_alt",
                    "before_image_url",
                    "after_image_url",
                    "preview_video_url",
                )
            },
        ),
        ("Delivery", {"fields": ("file_key",)}),
        (
            "Visibility",
            {"fields": ("published", "available", "featured", "position")},
        ),
    )
