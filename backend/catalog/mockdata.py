"""
In-repo mock catalog used whenever ``settings.MOCK_MODE`` is True.

This module is the single source of truth for the fake (but realistic) catalog
that lets the entire backend run with zero external services. The data here is
already shaped very close to the public API contract; the service layer applies
only light derivation (e.g. computing ``productCount`` for collections).

Image URLs point at Unsplash placeholders (cinematic-looking photos). They are
not committed assets -- in real mode Shopify supplies real CDN URLs.
"""
from __future__ import annotations

import copy
from typing import Any

CURRENCY = "USD"
VENDOR = "The Looks Lab"

# ---------------------------------------------------------------------------
# Collections
# ---------------------------------------------------------------------------
COLLECTIONS: list[dict[str, Any]] = [
    {
        "handle": "cinematic",
        "title": "Cinematic",
        "description": "Filmic, story-driven color grades for narrative and "
        "commercial work. Rich contrast, controlled highlights, and timeless tones.",
        "image": "https://images.unsplash.com/photo-1485846234645-a62644f84728?w=1200&q=80",
    },
    {
        "handle": "drone-dji",
        "title": "Drone / DJI",
        "description": "Aerial-optimized LUTs tuned for DJI D-Log and D-Cinelike "
        "footage. Bring punch and clarity to skies, landscapes, and water.",
        "image": "https://images.unsplash.com/photo-1473968512647-3e447244af8f?w=1200&q=80",
    },
    {
        "handle": "mobile-capcut",
        "title": "Mobile / CapCut",
        "description": "One-tap looks built for phone footage and CapCut creators. "
        "Punchy, social-ready grades that drop straight into your edit.",
        "image": "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=1200&q=80",
    },
    {
        "handle": "film-emulation",
        "title": "Film Emulation",
        "description": "Faithful emulations of classic motion-picture and still "
        "film stocks. Authentic grain response, halation, and color science.",
        "image": "https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?w=1200&q=80",
    },
    {
        "handle": "bundles",
        "title": "Bundles",
        "description": "Save with curated collections of our most popular LUT packs "
        "bundled together at a discount.",
        "image": "https://images.unsplash.com/photo-1500051638674-ff996a0ec29e?w=1200&q=80",
    },
]


def _money(amount: str) -> dict[str, str]:
    return {"amount": amount, "currencyCode": CURRENCY}


def _image(url: str, alt: str) -> dict[str, str]:
    return {"url": url, "altText": alt}


def _single_variant(pid: str, title: str, price: str, available: bool = True):
    return [
        {
            "id": f"gid://shopify/ProductVariant/{pid}",
            "title": title,
            "price": _money(price),
            "availableForSale": available,
        }
    ]


def _metafields(lut_count: int) -> dict[str, Any]:
    return {
        "lutCount": lut_count,
        "formats": [".cube"],
        "compatibleApps": [
            "Premiere Pro",
            "DaVinci Resolve",
            "Final Cut",
            "CapCut",
        ],
    }


def _product(
    *,
    pid: str,
    handle: str,
    title: str,
    description: str,
    price: str,
    image_url: str,
    extra_image_url: str,
    tags: list[str],
    product_type: str,
    collections: list[str],
    lut_count: int,
    featured: bool = False,
    max_price: str | None = None,
    file_key: str | None = None,
    compare_at_price: str | None = None,
    before_image: str | None = None,
    after_image: str | None = None,
    preview_video: str | None = None,
) -> dict[str, Any]:
    alt = f"{title} LUT preview"
    coll_map = {c["handle"]: c["title"] for c in COLLECTIONS}
    product = {
        "id": f"gid://shopify/Product/{pid}",
        "handle": handle,
        # Server-side S3 object key for the purchasable file. This is the ONLY
        # source of the download key; it is never read from the client/token.
        # Defaults to "<S3_KEY_PREFIX>/<handle>.zip" via file_key_for_handle().
        "file_key": file_key or f"luts/{handle}.zip",
        "title": title,
        "description": description,
        "descriptionHtml": f"<p>{description}</p>",
        "featuredImage": _image(image_url, alt),
        "images": [
            _image(image_url, alt),
            _image(extra_image_url, f"{title} sample frame"),
        ],
        # Per-product before/after preview. `beforeImage` defaults to the
        # featured (ungraded) frame; `afterImage` is the graded result. When
        # both are present the product page shows a real before/after slider.
        "beforeImage": before_image or image_url,
        "afterImage": after_image,
        # Optional short, muted, looping preview clip of the look in motion.
        "previewVideo": preview_video,
        "priceRange": {
            "min": _money(price),
            "max": _money(max_price or price),
        },
        "variants": _single_variant(f"{pid}1", "Default", price),
        "tags": tags,
        "productType": product_type,
        "vendor": VENDOR,
        "collections": [
            {"handle": h, "title": coll_map[h]} for h in collections
        ],
        "metafields": _metafields(lut_count),
        "featured": featured,
    }
    # Optional "was" price for showing a discount (e.g. bundles vs buying the
    # individual packs). Only present when explicitly set.
    if compare_at_price is not None:
        product["compareAtPrice"] = _money(compare_at_price)
    return product


# ---------------------------------------------------------------------------
# Individual LUT products (~12) + 3 bundles
# ---------------------------------------------------------------------------
PRODUCTS: list[dict[str, Any]] = [
    # --- Cinematic ---
    _product(
        pid="1001",
        handle="midnight-noir",
        title="Midnight Noir",
        description="Moody, low-key cinematic grade with crushed blacks and cool "
        "teal shadows. Perfect for night exteriors and dramatic interiors.",
        price="39.00",
        image_url="https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=1200&q=80",
        extra_image_url="https://images.unsplash.com/photo-1440404653325-ab127d49abc1?w=1200&q=80",
        # Demo before/after + motion preview (swap for the product's real assets;
        # see docs/ADDING_A_PRODUCT.md). before = ungraded frame, after = graded.
        before_image="https://images.unsplash.com/photo-1440404653325-ab127d49abc1?w=1200&q=80",
        after_image="https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=1200&q=80",
        preview_video="https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
        tags=["cinematic", "moody", "night"],
        product_type="LUT Pack",
        collections=["cinematic"],
        lut_count=8,
        featured=True,
    ),
    _product(
        pid="1002",
        handle="golden-hour-drama",
        title="Golden Hour Drama",
        description="Warm, glowing highlights and amber midtones that recreate the "
        "magic of golden hour in any footage.",
        price="34.00",
        image_url="https://images.unsplash.com/photo-1470770841072-f978cf4d019e?w=1200&q=80",
        extra_image_url="https://images.unsplash.com/photo-1500534623283-312aade485b7?w=1200&q=80",
        tags=["cinematic", "warm", "golden-hour"],
        product_type="LUT Pack",
        collections=["cinematic"],
        lut_count=6,
    ),
    _product(
        pid="1003",
        handle="urban-blockbuster",
        title="Urban Blockbuster",
        description="High-contrast orange-and-teal action grade engineered for "
        "city streets, cars, and modern commercials.",
        price="44.00",
        image_url="https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=1200&q=80",
        extra_image_url="https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?w=1200&q=80",
        tags=["cinematic", "teal-orange", "urban"],
        product_type="LUT Pack",
        collections=["cinematic"],
        lut_count=10,
        featured=True,
    ),
    # --- Drone / DJI ---
    _product(
        pid="2001",
        handle="dji-aerial-vivid",
        title="DJI Aerial Vivid",
        description="Vibrant aerial grade tuned for DJI D-Log M. Clean skies, "
        "saturated foliage, and crisp coastlines.",
        price="29.00",
        image_url="https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1200&q=80",
        extra_image_url="https://images.unsplash.com/photo-1542224566-6e85f2e6772f?w=1200&q=80",
        tags=["drone", "dji", "d-log", "aerial"],
        product_type="LUT Pack",
        collections=["drone-dji"],
        lut_count=7,
        featured=True,
    ),
    _product(
        pid="2002",
        handle="dji-cinelike-natural",
        title="DJI Cinelike Natural",
        description="Natural, true-to-life conversion for DJI D-Cinelike footage. "
        "Balanced contrast with faithful skin tones.",
        price="29.00",
        image_url="https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=1200&q=80",
        extra_image_url="https://images.unsplash.com/photo-1454496522488-7a8e488e8606?w=1200&q=80",
        tags=["drone", "dji", "d-cinelike", "natural"],
        product_type="LUT Pack",
        collections=["drone-dji"],
        lut_count=5,
    ),
    _product(
        pid="2003",
        handle="mavic-sunset-skies",
        title="Mavic Sunset Skies",
        description="Dramatic sunset and dusk grade for aerial work. Pulls gorgeous "
        "magentas and oranges out of flat log skies.",
        price="32.00",
        image_url="https://images.unsplash.com/photo-1444465693019-aa0b6392460d?w=1200&q=80",
        extra_image_url="https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?w=1200&q=80",
        tags=["drone", "dji", "sunset"],
        product_type="LUT Pack",
        collections=["drone-dji"],
        lut_count=6,
    ),
    # --- Mobile / CapCut ---
    _product(
        pid="3001",
        handle="capcut-clean-creator",
        title="CapCut Clean Creator",
        description="Bright, clean, social-ready look optimized for phone footage. "
        "Drops straight into CapCut for one-tap grading.",
        price="12.00",
        image_url="https://images.unsplash.com/photo-1556656793-08538906a9f8?w=1200&q=80",
        extra_image_url="https://images.unsplash.com/photo-1512790182412-b19e6d62bc39?w=1200&q=80",
        tags=["mobile", "capcut", "social", "clean"],
        product_type="LUT Pack",
        collections=["mobile-capcut"],
        lut_count=10,
        featured=True,
    ),
    _product(
        pid="3002",
        handle="capcut-moody-vlog",
        title="CapCut Moody Vlog",
        description="Desaturated, cinematic vlog look for mobile creators who want "
        "a premium, moody aesthetic.",
        price="14.00",
        image_url="https://images.unsplash.com/photo-1502920917128-1aa500764cbd?w=1200&q=80",
        extra_image_url="https://images.unsplash.com/photo-1496317899792-9d7dbcd928a1?w=1200&q=80",
        tags=["mobile", "capcut", "vlog", "moody"],
        product_type="LUT Pack",
        collections=["mobile-capcut"],
        lut_count=8,
    ),
    _product(
        pid="3003",
        handle="mobile-vibrant-pop",
        title="Mobile Vibrant Pop",
        description="Punchy, saturated pop grade for reels and shorts. Makes colors "
        "jump on small screens.",
        price="12.00",
        image_url="https://images.unsplash.com/photo-1533750349088-cd871a92f312?w=1200&q=80",
        extra_image_url="https://images.unsplash.com/photo-1490750967868-88aa4486c946?w=1200&q=80",
        tags=["mobile", "capcut", "vibrant", "pop"],
        product_type="LUT Pack",
        collections=["mobile-capcut"],
        lut_count=12,
    ),
    # --- Film Emulation ---
    _product(
        pid="4001",
        handle="kodak-2383-emulation",
        title="Kodak 2383 Emulation",
        description="Classic print-film emulation with rich reds, deep blacks, and "
        "the timeless look of theatrical release prints.",
        price="49.00",
        image_url="https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?w=1200&q=80",
        extra_image_url="https://images.unsplash.com/photo-1495707902641-75cac588d2e9?w=1200&q=80",
        tags=["film", "emulation", "kodak", "print"],
        product_type="LUT Pack",
        collections=["film-emulation"],
        lut_count=9,
        featured=True,
    ),
    _product(
        pid="4002",
        handle="portra-400-still",
        title="Portra 400 Still",
        description="Soft, warm still-film emulation inspired by Portra 400. "
        "Beautiful skin tones and pastel highlights.",
        price="42.00",
        image_url="https://images.unsplash.com/photo-1452587925148-ce544e77e70d?w=1200&q=80",
        extra_image_url="https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=1200&q=80",
        tags=["film", "emulation", "portra", "warm"],
        product_type="LUT Pack",
        collections=["film-emulation"],
        lut_count=7,
    ),
    _product(
        pid="4003",
        handle="vintage-super8",
        title="Vintage Super 8",
        description="Faded, nostalgic Super 8 home-movie look with lifted blacks "
        "and gentle color shifts.",
        price="38.00",
        image_url="https://images.unsplash.com/photo-1485846234645-a62644f84728?w=1200&q=80",
        extra_image_url="https://images.unsplash.com/photo-1500917293891-ef795e70e1f6?w=1200&q=80",
        tags=["film", "emulation", "vintage", "super8"],
        product_type="LUT Pack",
        collections=["film-emulation"],
        lut_count=6,
    ),
    # --- Bundles ---
    _product(
        pid="5001",
        handle="the-cinematic-bundle",
        title="The Cinematic Bundle",
        description="Our three cinematic packs together — Nocturne, Ember and "
        "Midnight Noir. 24 looks built on real log and flat footage, from neon "
        "night exteriors to warm, natural skin. Costs less than buying the "
        "three packs on their own.",
        price="79.00",
        compare_at_price="117.00",
        image_url="https://images.unsplash.com/photo-1500051638674-ff996a0ec29e?w=1200&q=80",
        extra_image_url="https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=1200&q=80",
        tags=["bundle", "cinematic", "value"],
        product_type="Bundle",
        collections=["bundles", "cinematic"],
        lut_count=24,
        featured=True,
    ),
    _product(
        pid="5002",
        handle="dji-starter-pack",
        title="DJI Starter Pack",
        description="Everything a drone pilot needs to grade D-Log and D-Cinelike "
        "footage. Three aerial packs bundled together.",
        price="59.00",
        compare_at_price="90.00",
        image_url="https://images.unsplash.com/photo-1473968512647-3e447244af8f?w=1200&q=80",
        extra_image_url="https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1200&q=80",
        tags=["bundle", "drone", "dji", "value"],
        product_type="Bundle",
        collections=["bundles", "drone-dji"],
        lut_count=18,
    ),
    _product(
        pid="5003",
        handle="the-everything-bundle",
        title="The Everything Bundle",
        description="Our entire library in one place. Every cinematic, drone, "
        "mobile, and film-emulation LUT we make, at the best possible price.",
        price="129.00",
        compare_at_price="299.00",
        image_url="https://images.unsplash.com/photo-1542038784456-1ea8e935640e?w=1200&q=80",
        extra_image_url="https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?w=1200&q=80",
        tags=["bundle", "everything", "value", "complete"],
        product_type="Bundle",
        collections=["bundles", "cinematic", "drone-dji", "mobile-capcut", "film-emulation"],
        lut_count=120,
        featured=True,
    ),
]

# Index helpers -------------------------------------------------------------
_PRODUCTS_BY_HANDLE = {p["handle"]: p for p in PRODUCTS}
_COLLECTIONS_BY_HANDLE = {c["handle"]: c for c in COLLECTIONS}
# Map a variant id -> its product, for cart line resolution.
_PRODUCT_BY_VARIANT_ID = {
    variant["id"]: p for p in PRODUCTS for variant in p["variants"]
}


def all_products() -> list[dict[str, Any]]:
    return copy.deepcopy(PRODUCTS)


def all_collections() -> list[dict[str, Any]]:
    return copy.deepcopy(COLLECTIONS)


def get_product(handle: str) -> dict[str, Any] | None:
    product = _PRODUCTS_BY_HANDLE.get(handle)
    return copy.deepcopy(product) if product else None


def get_collection(handle: str) -> dict[str, Any] | None:
    collection = _COLLECTIONS_BY_HANDLE.get(handle)
    return copy.deepcopy(collection) if collection else None


def products_in_collection(handle: str) -> list[dict[str, Any]]:
    return [
        copy.deepcopy(p)
        for p in PRODUCTS
        if any(c["handle"] == handle for c in p["collections"])
    ]


def file_key_for_handle(handle: str) -> str:
    """Resolve a product handle to its S3 object key, derived SERVER-SIDE.

    Uses the product's stored ``file_key`` when present, otherwise defaults to
    ``"<S3_KEY_PREFIX>/<handle>.zip"``. The handle is the validated identity
    carried by the signed download token; the key is always computed here (never
    supplied by the client) so a tampered/handcrafted token cannot point the
    download at an arbitrary object (no path traversal / IDOR).
    """
    from django.conf import settings

    product = _PRODUCTS_BY_HANDLE.get(handle)
    if product and product.get("file_key"):
        return str(product["file_key"])
    prefix = getattr(settings, "S3_KEY_PREFIX", "luts").strip("/")
    return f"{prefix}/{handle}.zip"


def find_variant(variant_id: str) -> dict[str, Any] | None:
    """Return ``{"product": product, "variant": variant}`` for a variant id."""
    product = _PRODUCT_BY_VARIANT_ID.get(variant_id)
    if not product:
        return None
    variant = next(v for v in product["variants"] if v["id"] == variant_id)
    return {"product": copy.deepcopy(product), "variant": copy.deepcopy(variant)}
