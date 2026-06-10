#!/usr/bin/env bash
#
# new-product.sh — scaffold a new product's assets and print its catalog entry.
#
#   scripts/new-product.sh <handle> "<Title>" <price>
#   e.g. scripts/new-product.sh nordic-frost "Nordic Frost" 39
#
# Creates frontend/public/products/<handle>/ for the PUBLIC marketing assets
# (drop before.jpg, after.jpg, preview.mp4 there) and prints:
#   1) the exact _product(...) block to paste into backend/catalog/mockdata.py
#   2) the command to upload the PRIVATE download to S3.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

handle="${1:-}"; title="${2:-}"; price="${3:-}"
[ -n "$handle" ] && [ -n "$title" ] && [ -n "$price" ] || {
  echo "usage: scripts/new-product.sh <handle> \"<Title>\" <price>" >&2; exit 1; }

dir="frontend/public/products/$handle"
mkdir -p "$dir"
cat > "$dir/README.txt" <<EOF
Drop this product's PUBLIC marketing assets here:
  before.jpg   — ungraded frame
  after.jpg    — graded frame (the LUT applied)
  preview.mp4  — short, muted, looping clip of the look (a few seconds)
They are served at /products/$handle/<file> (same-origin, no CDN needed).
The PRIVATE download (.zip) does NOT go here — it goes to S3 (see below).
EOF

pid=$(( (RANDOM % 9000) + 1000 ))
cat <<SNIPPET

  ✓ Created $dir/  — drop before.jpg, after.jpg, preview.mp4 in it.

  1) Paste this into the PRODUCTS list in backend/catalog/mockdata.py:

    _product(
        pid="$pid",
        handle="$handle",
        title="$title",
        description="TODO one-line description.",
        price="$(printf '%.2f' "$price")",
        image_url="/products/$handle/after.jpg",
        extra_image_url="/products/$handle/before.jpg",
        before_image="/products/$handle/before.jpg",
        after_image="/products/$handle/after.jpg",
        preview_video="/products/$handle/preview.mp4",
        tags=["cinematic"],
        product_type="LUT Pack",
        collections=["cinematic"],
        lut_count=8,
    ),

  2) Upload the PRIVATE download archive to S3 (named <handle>.zip):

    cd aws && ./01-s3.sh upload <folder-containing-$handle.zip>

  See docs/ADDING_A_PRODUCT.md for the full walkthrough.
SNIPPET
