"""
Seed the database catalog from the in-repo mock fixture.

    python manage.py seed_catalog

Idempotent: creates Collection/Product rows (with images + included LUTs) for
anything not already present, so you start the admin with the existing demo
catalog to edit instead of a blank store. Pass ``--reset`` to wipe DB products
first. Existing products are left untouched unless ``--reset`` is given.
"""
from __future__ import annotations

from decimal import Decimal, InvalidOperation

from django.core.management.base import BaseCommand
from django.db import transaction

from catalog import mockdata
from catalog.models import Collection, IncludedLut, Product, ProductImage


def _dec(amount: str) -> Decimal:
    try:
        return Decimal(str(amount))
    except (InvalidOperation, TypeError):
        return Decimal("0")


class Command(BaseCommand):
    help = "Populate the DB catalog from the in-repo mock fixture (idempotent)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--reset",
            action="store_true",
            help="Delete existing DB products/collections first.",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        if options["reset"]:
            Product.objects.all().delete()
            Collection.objects.all().delete()
            self.stdout.write("Cleared existing DB catalog.")

        # --- collections -----------------------------------------------------
        coll_by_handle: dict[str, Collection] = {}
        for i, c in enumerate(mockdata.all_collections()):
            obj, _ = Collection.objects.update_or_create(
                handle=c["handle"],
                defaults={
                    "title": c["title"],
                    "description": c["description"],
                    "image": c["image"],
                    "position": i,
                },
            )
            coll_by_handle[obj.handle] = obj

        # --- products --------------------------------------------------------
        created = skipped = 0
        for i, p in enumerate(mockdata.all_products()):
            if Product.objects.filter(handle=p["handle"]).exists():
                skipped += 1
                continue

            price = _dec(p["priceRange"]["min"]["amount"])
            compare = (
                _dec(p["compareAtPrice"]["amount"])
                if p.get("compareAtPrice")
                else None
            )
            featured_image = p.get("featuredImage") or {}
            metafields = p.get("metafields") or {}

            product = Product.objects.create(
                handle=p["handle"],
                title=p["title"],
                description=p.get("description", ""),
                product_type="Bundle" if p.get("productType") == "Bundle" else "LUT Pack",
                price=price,
                compare_at_price=compare,
                currency=p["priceRange"]["min"].get("currencyCode", "USD"),
                vendor=p.get("vendor", "Luts.shop"),
                best_for=p.get("bestFor", ""),
                lut_count=int(metafields.get("lutCount", 1) or 1),
                tags=", ".join(p.get("tags", [])),
                formats=", ".join(metafields.get("formats", [".cube"])),
                compatible_apps=", ".join(metafields.get("compatibleApps", [])),
                featured_image_url=featured_image.get("url", ""),
                featured_image_alt=featured_image.get("altText", "") or "",
                before_image_url=p.get("beforeImage") or "",
                after_image_url=p.get("afterImage") or "",
                preview_video_url=p.get("previewVideo") or "",
                file_key=p.get("file_key", "") or "",
                featured=bool(p.get("featured")),
                available=True,
                published=True,
                position=i,
            )
            # collections (skip the featured image, which is images[0])
            product.collections.set(
                [
                    coll_by_handle[c["handle"]]
                    for c in p.get("collections", [])
                    if c["handle"] in coll_by_handle
                ]
            )
            for j, img in enumerate(p.get("images", [])[1:]):
                ProductImage.objects.create(
                    product=product,
                    url=img["url"],
                    alt=img.get("altText", "") or "",
                    position=j,
                )
            for j, lut in enumerate(p.get("includedLuts", [])):
                IncludedLut.objects.create(
                    product=product,
                    name=lut["name"],
                    tone=lut["tone"],
                    position=j,
                )
            created += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Seeded catalog: {created} products created, {skipped} already present, "
                f"{Collection.objects.count()} collections."
            )
        )
