"""Seed two foundational, SEO-friendly posts (idempotent: skips existing slugs)."""
from django.db import migrations
from django.utils import timezone


WHAT_IS_A_LUT = """\
A **LUT** — short for *Look-Up Table* — is a small file that tells your video or
photo software exactly how to transform one color into another. Feed it a color
in, and it returns a color out. Apply it across every pixel of your footage and
you get a consistent, deliberate *look* in a single click.

## The one-sentence version

A LUT is a colour preset that works in almost any editor — drag it on, and your
footage instantly takes on a finished, cinematic grade.

## How a LUT actually works

Think of a LUT as a lookup chart for color. For every input color (a particular
red, green and blue value), the table stores the output color the look should
produce. A **3D LUT** (the `.cube` files we ship) maps the full color cube, so it
can shift hue, saturation and contrast together — not just brightness.

Because the mapping is baked into the file, the result is identical everywhere:

- The same `.cube` looks the same in **DaVinci Resolve**, **Premiere Pro**,
  **Final Cut** and **CapCut**.
- It doesn't depend on sliders or an app's internal tools.
- It applies in milliseconds, even to 4K footage.

## Creative vs. technical LUTs

There are two broad families:

1. **Creative (look) LUTs** — the stylized grades you buy: a teal-and-orange
   blockbuster, a warm golden hour, a film emulation. *These are what our store
   sells.*
2. **Technical (conversion) LUTs** — utilities that normalize footage, e.g.
   converting a flat **Log** profile to standard **Rec.709** so colors look
   correct before you grade.

## LUT vs. preset — not the same thing

People mix these up. A **LUT** transforms *color only* and works across apps. A
**preset** (like a Lightroom `.xmp`) saves a specific app's *slider settings* —
exposure, curves, masks — and only works in that one app. A LUT is more portable;
a preset can adjust more than color but is locked to its host.

## How you use one

1. Shoot your footage (ideally in a flat/Log profile for maximum flexibility).
2. Drop the `.cube` onto your clip or adjustment layer.
3. Dial the intensity to taste and tweak exposure if needed.

That's it — a professional grade in seconds, no color-science degree required.
"""

WHY_YOU_NEED_LUTS = """\
You *can* grade every clip by hand. But if you shoot regularly — for clients,
social, or your own films — LUTs save hours and make your work look unmistakably
yours. Here's why a good LUT pack pays for itself fast.

## 1. Speed: a finished look in one drag

Hand-grading a single shot can take ten minutes. A LUT applies the same result
instantly. Multiply that across a 40-clip edit and you've reclaimed an afternoon.

## 2. Consistency across an entire project

The fastest way to look amateur is **shots that don't match**. A LUT applies the
exact same transform to every clip, so your montage feels like one cohesive piece
— even when it's stitched from different cameras and lighting.

> Consistency is what separates a *reel* from a *random folder of clips*.

## 3. A signature style

Great creators are recognizable. A curated set of looks becomes your visual
fingerprint — the thing that makes a viewer think *"that's their work"* before
they see your name.

## 4. They work everywhere you do

Because a `.cube` is app-agnostic, the same look follows you from **Premiere** to
**Resolve** to **CapCut** on your phone. Learn it once, use it forever.

## 5. A confident starting point

Even when you plan to grade by hand, a LUT gives you a strong base to push from —
far better than staring at flat Log footage wondering where to begin.

---

### What to look for in a LUT pack

- **Subtlety** — good LUTs enhance footage; they don't fight it.
- **Range** — looks for day, night, skin tones and aerials.
- **Format coverage** — `.cube` (and `.3dl`) for broad app support.
- **Camera-agnostic grading** so it holds up across your gear.

Our [Everything Bundle](/luts/the-everything-bundle) packs 55 looks across all
four categories — the simplest way to give every project a polished, consistent
grade.
"""

POSTS = [
    {
        "title": "What Is a LUT? A Plain-English Guide",
        "slug": "what-is-a-lut",
        "excerpt": "A LUT is a one-click color preset that gives your footage a "
        "finished, cinematic look in any editor. Here's how it works — in plain "
        "English.",
        "body": WHAT_IS_A_LUT,
        "cover_image_url": "https://images.unsplash.com/photo-1485846234645-a62644f84728?w=1200&q=80",
    },
    {
        "title": "Why You Need LUTs: Faster, More Consistent Color",
        "slug": "why-you-need-luts",
        "excerpt": "LUTs save hours, keep every shot consistent, and give your "
        "work a signature style that works in any editor. Here's why they pay for "
        "themselves.",
        "body": WHY_YOU_NEED_LUTS,
        "cover_image_url": "https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=1200&q=80",
    },
]


def seed(apps, schema_editor):
    Post = apps.get_model("blog", "Post")
    now = timezone.now()
    for data in POSTS:
        if Post.objects.filter(slug=data["slug"]).exists():
            continue
        Post.objects.create(
            published=True, published_at=now, author_name="The Looks Lab", **data
        )


def unseed(apps, schema_editor):
    Post = apps.get_model("blog", "Post")
    Post.objects.filter(slug__in=[p["slug"] for p in POSTS]).delete()


class Migration(migrations.Migration):
    dependencies = [("blog", "0001_initial")]
    operations = [migrations.RunPython(seed, unseed)]
