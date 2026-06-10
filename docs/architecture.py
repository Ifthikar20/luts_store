#!/usr/bin/env python3
"""Generate an architecture diagram (SVG) for the LUTs store."""

W, H = 1640, 1180
PAPER = "#F4F3EC"
INK = "#1d1d1f"
SLATE = "#6e6e73"
HAIR = "#D8D8D0"
BLUE = "#0071e3"; BLUE_BG = "#E6F0FB"
INDIGO = "#5856d6"; INDIGO_BG = "#ECEBFB"
AMBER = "#b06a1f"; AMBER_BG = "#FBEEDD"
GREEN = "#0a8754"; GREEN_BG = "#E3F3EC"
GREY_BG = "#ECECE6"

p = []
p.append(
    f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" '
    f'viewBox="0 0 {W} {H}" font-family="Georgia,serif">'
)
p.append(f'<rect width="{W}" height="{H}" fill="{PAPER}"/>')
p.append(
    '<defs><marker id="a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" '
    'markerHeight="7" orient="auto-start-reverse">'
    f'<path d="M0 0L10 5L0 10z" fill="{SLATE}"/></marker>'
    '<marker id="ag" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" '
    'markerHeight="8" orient="auto-start-reverse">'
    f'<path d="M0 0L10 5L0 10z" fill="{GREEN}"/></marker></defs>'
)


def esc(t):
    return str(t).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def box(x, y, w, h, title, sub="", fill="#fff", stroke=HAIR, tcol=INK, r=12, ts=15, ss=11.5):
    p.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{r}" fill="{fill}" stroke="{stroke}" stroke-width="1.5"/>')
    cx = x + w / 2
    title = esc(title)
    sub = esc(sub)
    if sub:
        p.append(f'<text x="{cx}" y="{y+h/2-3}" text-anchor="middle" font-size="{ts}" font-weight="bold" fill="{tcol}">{title}</text>')
        p.append(f'<text x="{cx}" y="{y+h/2+15}" text-anchor="middle" font-size="{ss}" fill="{SLATE}">{sub}</text>')
    else:
        p.append(f'<text x="{cx}" y="{y+h/2+5}" text-anchor="middle" font-size="{ts}" font-weight="bold" fill="{tcol}">{title}</text>')


def lab(x, y, t, s=13, c=SLATE, anc="middle", w="normal"):
    p.append(f'<text x="{x}" y="{y}" text-anchor="{anc}" font-size="{s}" font-weight="{w}" fill="{c}">{esc(t)}</text>')


def arr(x1, y1, x2, y2, g=False, dash=False):
    col = GREEN if g else SLATE
    m = "ag" if g else "a"
    d = ' stroke-dasharray="6 4"' if dash else ""
    p.append(f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{col}" stroke-width="2"{d} marker-end="url(#{m})"/>')


def band(x, y, w, h, label, col):
    p.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="18" fill="none" stroke="{col}" stroke-width="1.5" stroke-dasharray="2 5"/>')
    p.append(f'<text x="{x+16}" y="{y+24}" font-size="13" font-weight="bold" fill="{col}" letter-spacing="1">{esc(label)}</text>')

lab(W/2, 46, "Luts.shop — Architecture", 30, INK, "middle", "bold")
lab(W/2, 72, "Next.js storefront  ·  Django BFF (camelCase contract)  ·  dual MOCK / LIVE mode  ·  green = purchase→download pipeline", 13.5, SLATE)

# Browser
box(W/2-150, 96, 300, 50, "User · Browser", "", fill="#fff", stroke=INK)
arr(W/2, 146, W/2, 176)

# FRONTEND band
band(40, 176, W-80, 150, "FRONTEND — Next.js App Router (SSR/ISR + client)", BLUE)
box(70, 212, 470, 92, "Pages / UI", "Home · Collections · Product · Cart · Checkout · Thank-you · Account", fill=BLUE_BG, stroke=BLUE)
box(580, 212, 360, 92, "Client state (Context)", "CartContext (localStorage id) · AuthContext", fill=BLUE_BG, stroke=BLUE)
box(980, 212, 580, 92, "lib/api.ts", "typed fetch layer — all calls to the Django BFF over /api/*", fill=BLUE_BG, stroke=BLUE)
arr(W/2, 326, W/2, 356)
lab(W/2+150, 348, "HTTPS  JSON (camelCase)", 12)

# BACKEND band
band(40, 356, W-80, 196, "BACKEND — Django REST Framework  (the BFF / API, ~50 endpoints)", INDIGO)
apps = [
    ("catalog", "products,\ncollections, facets"),
    ("cart", "create / add /\nupdate / remove"),
    ("checkout", "start +\ncomplete"),
    ("orders", "ingest, confirm,\nresend, webhook"),
    ("delivery", "downloads,\nlibrary, signing"),
    ("accounts", "register / login\n/ me (token)"),
    ("customer_auth", "Shopify OAuth\nsession"),
    ("engagement", "newsletter,\ncontact"),
]
bx = 70; bw = 178; gap = 6
ay = 392
for i, (name, sub) in enumerate(apps):
    col = i % 4
    row = i // 4
    x = 70 + col * (bw + gap + 188)  # spread across
    # simpler: 4 per row
    x = 70 + col * 372
    y = ay + row * 74
    fill = GREEN_BG if name in ("checkout", "orders", "delivery") else INDIGO_BG
    stroke = GREEN if name in ("checkout", "orders", "delivery") else INDIGO
    box(x, y, 350, 60, name, sub.replace("\n", " "), fill=fill, stroke=stroke, ts=14, ss=11)

arr(W/2, 552, W/2, 582)

# SERVICE band
band(40, 582, W-80, 88, "SERVICE LAYER", AMBER)
box(70, 612, W-140, 44, "services.py  —  if settings.MOCK_MODE:  mock fixtures   else:  live integrations", "", fill=AMBER_BG, stroke=AMBER, ts=14)
arr(W/2, 670, W/2, 700)

# DATA + EXTERNAL band
band(40, 700, W-80, 240, "DATA & EXTERNAL INTEGRATIONS", GREEN)
box(70, 736, 270, 100, "SQLite / Postgres", "Order · Purchase\nDownloadGrant · MockCart · User", fill=GREEN_BG, stroke=GREEN, ts=14, ss=11.5)
box(360, 736, 290, 100, "Shopify Storefront", "products & checkout\n(LIVE mode only)", fill=GREY_BG, stroke=SLATE, ts=14, ss=11.5)
box(670, 736, 290, 100, "Payment", "Shopify hosted checkout\n(or Stripe — TBD)", fill="#FBE9D6", stroke=AMBER, ts=14, ss=11.5)
box(980, 736, 270, 100, "AWS S3 / R2", "real .zip/.cube files\npresigned URLs", fill=GREEN_BG, stroke=GREEN, ts=14, ss=11.5)
box(1270, 736, 290, 100, "Email / SMTP", "order receipt\n(console in dev)", fill=GREEN_BG, stroke=GREEN, ts=14, ss=11.5)

# multi-line text fix for the 5 data boxes (since box() put sub on one line)
# (acceptable—single line shown)

# Purchase pipeline callout (green path)
py = 980
lab(70, py-6, "PURCHASE → DOWNLOAD PIPELINE", 14, GREEN, "start", "bold")
steps = [
    "Add to cart", "Checkout", "Payment OK\n(webhook)", "ingest_paid_order",
    "DownloadGrant\n+ \U0001f4e7 receipt email", "Signed link", "Download file",
]
sw = 198; sgap = 16; sy = py + 6
sx = 70
for i, s in enumerate(steps):
    box(sx, sy, sw, 58, s.split("\n")[0], s.split("\n")[1] if "\n" in s else "", fill=GREEN_BG, stroke=GREEN, ts=13.5, ss=11)
    if i < len(steps) - 1:
        arr(sx + sw, sy + 29, sx + sw + sgap, sy + 29, g=True)
    sx += sw + sgap

lab(W/2, H-26, "MOCK mode (current): in-repo catalog, simulated checkout, generated .cube, console email.   LIVE: set Shopify/Stripe + S3 + SMTP keys.", 13, SLATE)

p.append("</svg>")
open("docs/architecture.svg", "w").write("\n".join(p))
print("wrote docs/architecture.svg")
