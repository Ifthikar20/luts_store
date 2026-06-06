# The Looks Lab — Frontend

A premium, Framer-style storefront for **The Looks Lab**, a store selling
cinematic color-grading LUTs (`.cube` / `.3dl`). This is the UI tier; it talks
to a Django **BFF** (backend-for-frontend) that returns camelCase JSON.

Built with **Next.js 15 (App Router)**, **React 19**, **TypeScript**,
**Tailwind CSS**, **Framer Motion**, and **lucide-react**.

---

## Quick start

```bash
cd frontend
npm install
cp .env.local.example .env.local   # set NEXT_PUBLIC_API_URL if not localhost
npm run dev                        # http://localhost:3000
```

The backend does **not** need to be running. If the API is unreachable the UI
falls back to a sample catalog (see *Resilience* below), so you can develop and
preview the entire storefront standalone.

### Scripts

| Script            | Description                                  |
| ----------------- | -------------------------------------------- |
| `npm run dev`     | Start the dev server                         |
| `npm run build`   | Production build (also typechecks + lints)   |
| `npm run start`   | Serve the production build                   |
| `npm run lint`    | ESLint (`eslint-config-next`)                |
| `npm run typecheck` | `tsc --noEmit`                             |

---

## Environment

Only `NEXT_PUBLIC_`-prefixed variables are read on the client. **There are no
secrets in this frontend.**

| Variable              | Default                       | Purpose                        |
| --------------------- | ----------------------------- | ------------------------------ |
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000/api`   | Base URL of the Django BFF     |

See `.env.local.example`.

---

## Project structure

```
frontend/
├── next.config.mjs          # security headers, image remotePatterns, CSP
├── tailwind.config.ts       # cinematic theme: grades, blobs, marquee, grain
├── src/
│   ├── app/
│   │   ├── layout.tsx        # fonts, providers, Nav/Footer/CartDrawer, transitions
│   │   ├── page.tsx          # landing page
│   │   ├── globals.css       # Tailwind + glass/grain/gradient utilities
│   │   ├── not-found.tsx
│   │   ├── collections/[handle]/page.tsx
│   │   ├── luts/[handle]/page.tsx
│   │   └── cart/page.tsx
│   ├── components/
│   │   ├── Nav, Footer, Hero, ProductCard, ProductGrid, CategoryCard,
│   │   │   BeforeAfterSlider, BundleCard, FAQ, CartDrawer, ProductDetail,
│   │   │   HowItWorks, LogoMarquee, SectionHeading, Providers, PageTransition
│   │   └── motion/           # Reveal, GradientBlob, Marquee, MagneticButton
│   ├── context/CartContext.tsx
│   └── lib/
│       ├── api.ts            # BFF client + dev-only mock fallback
│       ├── types.ts          # exact camelCase contract
│       ├── mock.ts           # dev-only sample catalog
│       └── format.ts         # money formatting + cn helper
```

---

## API integration

`src/lib/api.ts` wraps the BFF. The exact JSON contract lives in
`src/lib/types.ts`. Endpoints consumed:

- `GET /collections`
- `GET /collections/{handle}`
- `GET /products?collection=&featured=true&search=`
- `GET /products/{handle}`
- `POST /cart` · `GET /cart/{id}` · `POST|PATCH|DELETE /cart/{id}/lines`

### Resilience (dev-only mock fallback)

Every read request is wrapped in `try/catch` with a **short abort timeout**. On
failure it returns data from `src/lib/mock.ts` so the UI renders even when the
backend is down. This is **development-only** — it is clearly commented as such
and is never relied upon in production. When the API responds, mock data is
never used.

---

## Design language

A dark, cinematic aesthetic fitting a color-grading brand:

- Near-black base (`#0a0a0b`) with a subtle SVG **film-grain overlay**.
- Two signature gradients: **teal → orange** ("teal & orange" grade) and
  **violet → magenta**, used in text, buttons, and animated background blobs.
- **Glassmorphism** cards (`backdrop-blur`, thin borders), generous whitespace,
  large bold display type.
- Type pairing via `next/font`: **Space Grotesk** (display) + **Inter** (body).
- **Framer Motion** throughout: hero entrance stagger, `whileInView`
  scroll-reveals, hover lift + glow on product cards, animated gradient blobs, a
  hover-pausing marquee, page transitions, magnetic buttons, a condensing sticky
  nav, and a spring-physics slide-in cart drawer.
- Fully **responsive** (mobile-first) and **`prefers-reduced-motion`** aware —
  motion primitives short-circuit their animations, and `globals.css` neutralises
  animations as a global safety net.

> **Fonts & offline builds:** `next/font/google` self-hosts the fonts at build
> time. If the build machine has no network to fetch them, swap to
> `next/font/local` with `.woff2` files in `public/fonts`, or rely on the system
> stack already declared in `tailwind.config.ts`. (Noted inline in
> `src/app/layout.tsx`.)

---

## Security-conscious practices

- **No secrets in the client.** Only `NEXT_PUBLIC_` envs are referenced.
- **Security headers** set in `next.config.mjs` for every route:
  - `Content-Security-Policy` scoped to self, the API origin (`connect-src`),
    `images.unsplash.com` (`img-src`), and inline styles/fonts that Next + Framer
    Motion require. *(Script `unsafe-inline`/`unsafe-eval` are kept for Next's
    dev/runtime; tighten with nonces in a hardened deploy.)*
  - `X-Frame-Options: DENY` and `frame-ancestors 'none'` (clickjacking).
  - `X-Content-Type-Options: nosniff`.
  - `Referrer-Policy: strict-origin-when-cross-origin`.
  - `Permissions-Policy` denying camera/mic/geolocation/topics.
- **`next/image` `remotePatterns`** allow `images.unsplash.com` only.
- **Never trust client-side prices/availability.** All amounts and the
  `checkoutUrl` come from the API; the cart page navigates to the server-issued
  `checkoutUrl` rather than computing a checkout in the browser. Only the cart
  **id** is persisted to `localStorage` — never line/price data.

---

## Pages

- `/` — landing: Hero, logo marquee, featured grid, categories, interactive
  before/after slider, bundle highlight, how-it-works, FAQ.
- `/collections/[handle]` — category page with animated product grid.
- `/luts/[handle]` — product detail: gallery, price, "what's included"
  (lutCount / formats / compatibleApps), add-to-cart, related products.
- `/cart` — full cart page with quantity controls and server-driven checkout.
