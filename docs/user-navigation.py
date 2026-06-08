#!/usr/bin/env python3
"""Generate an SVG user-navigation map for the LUTs store (from real routes)."""

W, H = 1500, 980
PAPER = "#F4F3EC"
INK = "#1d1d1f"
SLATE = "#6e6e73"
SKY = "#0071e3"
SKY_BG = "#E6F0FB"
GREEN = "#0a8754"
GREEN_BG = "#E3F3EC"
GREY_BG = "#ECECE6"
HAIR = "#D8D8D0"

parts = []
parts.append(
    f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" '
    f'viewBox="0 0 {W} {H}" font-family="Georgia, \'Times New Roman\', serif">'
)
parts.append(f'<rect width="{W}" height="{H}" fill="{PAPER}"/>')

# arrowhead marker
parts.append(
    '<defs>'
    '<marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" '
    'markerHeight="7" orient="auto-start-reverse">'
    f'<path d="M0 0L10 5L0 10z" fill="{SLATE}"/></marker>'
    '<marker id="arrSky" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" '
    'markerHeight="7" orient="auto-start-reverse">'
    f'<path d="M0 0L10 5L0 10z" fill="{SKY}"/></marker>'
    '</defs>'
)


def box(x, y, w, h, title, sub="", fill="#fff", stroke=HAIR, tcol=INK, r=14):
    parts.append(
        f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{r}" '
        f'fill="{fill}" stroke="{stroke}" stroke-width="1.5"/>'
    )
    cx = x + w / 2
    if sub:
        parts.append(
            f'<text x="{cx}" y="{y+h/2-6}" text-anchor="middle" '
            f'font-size="18" font-weight="bold" fill="{tcol}">{title}</text>'
        )
        parts.append(
            f'<text x="{cx}" y="{y+h/2+15}" text-anchor="middle" '
            f'font-size="13" font-style="italic" fill="{SLATE}">{sub}</text>'
        )
    else:
        parts.append(
            f'<text x="{cx}" y="{y+h/2+6}" text-anchor="middle" '
            f'font-size="18" font-weight="bold" fill="{tcol}">{title}</text>'
        )


def label(x, y, text, size=13, col=SLATE, anchor="middle", weight="normal", style="normal"):
    parts.append(
        f'<text x="{x}" y="{y}" text-anchor="{anchor}" font-size="{size}" '
        f'font-weight="{weight}" font-style="{style}" fill="{col}">{text}</text>'
    )


def arrow(x1, y1, x2, y2, sky=False, dash=False):
    m = "arrSky" if sky else "arr"
    col = SKY if sky else SLATE
    d = ' stroke-dasharray="5 4"' if dash else ""
    parts.append(
        f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{col}" '
        f'stroke-width="2"{d} marker-end="url(#{m})"/>'
    )


# ---- title ----
label(W / 2, 44, "Luts.store — User Navigation", size=30, col=INK, weight="bold")
label(W / 2, 70, "purchase funnel (blue) · supporting pages (grey/green) — routes from src/app", size=14, style="italic")

# ---- persistent header band ----
box(50, 96, W - 100, 56, "", fill="#fff", stroke=SKY, r=12)
label(W / 2, 122, "PERSISTENT HEADER  (on every page)", size=13, col=SKY, weight="bold")
label(
    W / 2, 142,
    "Logo → Home    ·    Cinematic · Drone/DJI · Mobile/CapCut · Film · Bundles    ·    \U0001f50d Search    ·    \U0001f464 Account    ·    \U0001f6d2 Cart drawer",
    size=14, col=INK,
)

# ---- main purchase funnel (row) ----
fy = 230
fw, fh = 188, 78
xs = [50, 290, 530, 770, 1010, 1250]
funnel = [
    ("Home", "/", SKY_BG),
    ("Collection", "/collections/[handle]", SKY_BG),
    ("Product", "/luts/[handle]", SKY_BG),
    ("Cart", "/cart", SKY_BG),
    ("Checkout", "/checkout", "#FBE9D6"),
    ("Thank-you", "/thank-you", GREEN_BG),
]
for (t, s, c), x in zip(funnel, xs):
    box(x, fy, fw, fh, t, s, fill=c, stroke=SKY if c == SKY_BG else HAIR)

for i in range(len(xs) - 1):
    arrow(xs[i] + fw, fy + fh / 2, xs[i + 1], fy + fh / 2, sky=True)

label(530 + fw / 2, fy - 14, "browse", size=12, style="italic")
label(770 + fw / 2 - 60, fy - 14, "Add to cart → drawer", size=12, style="italic")
label(1010 + fw / 2, fy + fh + 22, "demo — no real payment taken", size=12, style="italic", col="#b06a1f")
label(1010 + fw / 2 - 90, fy - 14, "guest checkout (email)", size=12, style="italic")

# ---- search feeds product ----
# Search node beneath Product, arrow up into the funnel.
box(530, 360, 188, 64, "Search", "/search", fill=GREY_BG)
arrow(530 + fw / 2, 360, 530 + fw / 2, fy + fh, sky=False)
label(530 + fw / 2 + 86, 350, "results → product", size=11, style="italic")

# ---- post-purchase deliverables ----
box(1180, 360, 270, 92, "", fill=GREEN_BG, stroke=GREEN, r=14)
label(1180 + 135, 392, "⬇  Download delivery", size=16, col=GREEN, weight="bold")
label(1180 + 135, 414, "signed .cube / .zip link (expiring)", size=12.5, style="italic", col=INK)
label(1180 + 135, 433, "+ confirmation email", size=12.5, style="italic", col=INK)
arrow(1250 + fw / 2, fy + fh, 1180 + 135, 360, sky=False)

# ---- account cluster ----
ay = 560
box(1010, ay, 188, 70, "Account", "/account", fill=GREEN_BG, stroke=GREEN)
box(770, ay - 40, 188, 56, "Sign in", "/account/login", fill="#fff")
box(770, ay + 44, 188, 56, "Register", "/account/register", fill="#fff")
arrow(770 + 188, ay - 12, 1010, ay + 18)
arrow(770 + 188, ay + 72, 1010, ay + 52)
# account -> download library
box(1250, ay, 200, 70, "Download library", "past purchases", fill=GREEN_BG, stroke=GREEN)
arrow(1010 + 188, ay + 35, 1250, ay + 35)
# thank-you / delivery also reachable from library
arrow(1180 + 135, 452, 1350, ay, dash=True)
label(1300, 520, "logged-in re-download", size=11, style="italic")

# ---- footer cluster ----
gy = 770
label(60, gy - 14, "PERSISTENT FOOTER", size=13, col=SLATE, weight="bold", anchor="start")
footer = [
    ("About", "/about"),
    ("Help", "/help"),
    ("Contact", "/contact"),
    ("License", "/policies/license"),
    ("Privacy", "/policies/privacy"),
    ("Terms", "/policies/terms"),
    ("Refund", "/policies/refund"),
]
fx = 50
for t, s in footer:
    box(fx, gy, 195, 60, t, s, fill=GREY_BG)
    fx += 207

# ---- legend ----
ly = 892
def chip(x, fill, stroke, text):
    parts.append(f'<rect x="{x}" y="{ly}" width="22" height="16" rx="4" fill="{fill}" stroke="{stroke}"/>')
    label(x + 30, ly + 13, text, size=13, anchor="start")

chip(60, SKY_BG, SKY, "purchase funnel")
chip(260, GREEN_BG, GREEN, "account / delivery")
chip(470, GREY_BG, HAIR, "discovery / info pages")
label(700, ly + 13, "→ solid = primary flow", size=13, anchor="start")
label(900, ly + 13, "⇢ dashed = optional", size=13, anchor="start")

parts.append("</svg>")

with open("docs/user-navigation.svg", "w") as f:
    f.write("\n".join(parts))
print("wrote docs/user-navigation.svg")
