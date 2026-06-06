import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/site";

// Allow all crawlers across public marketing/catalog pages, but disallow
// private/transactional routes (account library, cart, post-purchase page).
// Points crawlers at the dynamic sitemap.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/account", "/cart", "/thank-you"],
    },
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
