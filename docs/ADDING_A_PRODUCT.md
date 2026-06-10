# Adding a new LUT product

A product is **one catalog entry + three asset types**. There is no upload GUI;
this is a deliberate, version-controlled workflow. A new product has:

| Asset | Visibility | Where it lives | URL the app uses |
| --- | --- | --- | --- |
| **Download** `.zip`/`.cube` | **private** (paid) | S3 bucket, key `luts/<handle>.zip` | resolved server-side at download time |
| **Before** image | public | `frontend/public/products/<handle>/before.jpg` | `/products/<handle>/before.jpg` |
| **After** image | public | `frontend/public/products/<handle>/after.jpg` | `/products/<handle>/after.jpg` |
| **Preview** video | public | `frontend/public/products/<handle>/preview.mp4` | `/products/<handle>/preview.mp4` |

> Why split? The download is what customers **pay for**, so it stays in the
> private bucket and is only ever served via short-lived presigned URLs. The
> before/after/preview are **marketing** — they must load in any browser, so
> they're served as ordinary public files (same-origin from Next.js — no CDN,
> CORS, or CSP changes needed).

## Quickest path (scaffold script)

```bash
scripts/new-product.sh nordic-frost "Nordic Frost" 39
```

This creates `frontend/public/products/nordic-frost/` and prints the exact
`_product(...)` block to paste plus the S3 upload command. Then:

1. **Drop the marketing assets** into that folder:
   `before.jpg`, `after.jpg`, `preview.mp4`
   (preview = a few seconds, muted, looping; keep it small — a few MB).
2. **Paste the printed block** into the `PRODUCTS` list in
   `backend/catalog/mockdata.py` and fill in the description / tags / collection
   / `lut_count`.
3. **Upload the download** to the private S3 bucket (must be named
   `<handle>.zip`):
   ```bash
   cd aws && ./01-s3.sh upload /path/to/folder-with/nordic-frost.zip
   ```
   The backend serves it from `luts/nordic-frost.zip` automatically (the key is
   derived from the handle).
4. **Ship it:** commit (the public assets are part of the repo) and redeploy —
   on the server `./deploy.sh` (or locally just restart). Visit
   `/luts/nordic-frost`; the product page shows the before/after slider and the
   motion preview because those fields are set.

## Doing it manually

Skip the script and add a `_product(...)` entry directly. The relevant fields:

```python
_product(
    pid="1234",                 # any unique number
    handle="nordic-frost",      # URL slug; the .zip MUST be luts/nordic-frost.zip
    title="Nordic Frost",
    description="Cool, crisp winter grade …",
    price="39.00",
    image_url="/products/nordic-frost/after.jpg",   # featured / card image
    extra_image_url="/products/nordic-frost/before.jpg",
    before_image="/products/nordic-frost/before.jpg",
    after_image="/products/nordic-frost/after.jpg", # → enables the real slider
    preview_video="/products/nordic-frost/preview.mp4",
    tags=["cinematic", "cool"],
    product_type="LUT Pack",
    collections=["cinematic"],  # must match a handle in COLLECTIONS
    lut_count=8,
),
```

`before_image`, `after_image` and `preview_video` are **optional** — omit them
and the product simply shows its gallery image with no comparison/video.

## Notes

- **Handle ↔ file name must match.** `handle="nordic-frost"` ⇒ download key
  `luts/nordic-frost.zip`. That's the only link between the catalog and S3.
- **Hosting assets elsewhere?** You can use absolute URLs (S3/CloudFront/etc.)
  instead of `/products/...`. Remote **images** need their host added to
  `images.remotePatterns` and remote **video** hosts to the CSP `media-src`
  (both in `frontend/next.config.mjs`). Local `/public` files need neither.
- **Shopify mode:** if you run live Shopify (`SHOPIFY_STOREFRONT_TOKEN` set),
  the catalog comes from Shopify, not `mockdata.py`. Before/after/preview fields
  would then be added via Shopify product metafields (not yet mapped — open an
  issue if you go that route). The private download still lives in S3.
- **`midnight-noir`** is wired with demo before/after + preview as a live
  reference — see its entry in `mockdata.py`.
```
