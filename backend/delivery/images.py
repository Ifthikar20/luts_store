"""
Lightweight image optimisation for uploaded preview images.

When an admin uploads a product image we re-encode it to WebP (and downscale
oversized originals) so the storefront serves a much smaller file over the CDN.
This is cheap and synchronous — preview images are capped at 15 MB — and never
fatal: any failure leaves the original in place and the caller falls back to it.

The optimised object is written next to the original under
``media/img/<handle>/<stem>.webp`` and its key returned. Pillow is the only
extra dependency; if it is somehow unavailable we degrade gracefully.
"""
from __future__ import annotations

import io
import posixpath

from django.core.files.base import ContentFile
from django.core.files.storage import default_storage

# Largest dimension we keep — anything bigger is downscaled. 2048px is plenty
# for a full-bleed product hero on a retina display.
MAX_EDGE = 2048
WEBP_QUALITY = 82


def optimize_image(source_key: str) -> str | None:
    """Re-encode ``source_key`` to a CDN-friendly WebP; return the new key.

    Returns the optimised object's key on success, or ``None`` if optimisation
    was skipped/failed (the caller then serves the original upload unchanged).
    """
    try:
        from PIL import Image, ImageOps
    except Exception:  # pragma: no cover - Pillow missing
        return None

    try:
        with default_storage.open(source_key, "rb") as fh:
            img = Image.open(fh)
            img.load()
    except Exception:
        return None

    try:
        # Honour EXIF orientation, then flatten to RGB (WebP has no palette/CMYK).
        img = ImageOps.exif_transpose(img)
        if img.mode not in ("RGB", "RGBA"):
            img = img.convert("RGB")
        img.thumbnail((MAX_EDGE, MAX_EDGE), Image.LANCZOS)

        buf = io.BytesIO()
        img.save(buf, format="WEBP", quality=WEBP_QUALITY, method=6)
    except Exception:
        return None

    folder = posixpath.dirname(source_key).replace("media/", "media/img/", 1)
    stem = posixpath.splitext(posixpath.basename(source_key))[0]
    out_key = f"{folder}/{stem}.webp"
    # storage.save() returns the actual stored name (S3 overwrites in place;
    # the local dev backend may suffix on collision) — use what it gives back.
    return default_storage.save(out_key, ContentFile(buf.getvalue()))
