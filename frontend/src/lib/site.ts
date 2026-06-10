// Canonical public site URL, shared by SEO metadata, sitemap, robots and
// JSON-LD. Mirrors the metadataBase in app/layout.tsx. Only NEXT_PUBLIC_ envs
// are available in both server and client bundles.
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
).replace(/\/$/, "");

export const SITE_NAME = "Luts.shop";

// Absolute URL helper for a site-relative path (e.g. "/about" -> full URL).
export function absoluteUrl(path: string): string {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}
