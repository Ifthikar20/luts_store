import type { MetadataRoute } from "next";
import { getCollections, getProducts } from "@/lib/api";
import { absoluteUrl } from "@/lib/site";

// Dynamic sitemap: static marketing/legal routes + every collection + every
// product. getCollections/getProducts fall back to mock data when the BFF is
// unreachable, so the sitemap (and the build) always succeed offline. Excludes
// private/transactional routes (/account, /cart, /thank-you) — those are also
// disallowed in robots.ts.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: absoluteUrl("/"), lastModified: now, priority: 1 },
    { url: absoluteUrl("/search"), lastModified: now, priority: 0.5 },
    { url: absoluteUrl("/about"), lastModified: now, priority: 0.6 },
    { url: absoluteUrl("/contact"), lastModified: now, priority: 0.6 },
    { url: absoluteUrl("/help"), lastModified: now, priority: 0.6 },
    { url: absoluteUrl("/policies/privacy"), lastModified: now, priority: 0.3 },
    { url: absoluteUrl("/policies/terms"), lastModified: now, priority: 0.3 },
    { url: absoluteUrl("/policies/refund"), lastModified: now, priority: 0.3 },
    { url: absoluteUrl("/policies/license"), lastModified: now, priority: 0.3 },
  ];

  const [collections, products] = await Promise.all([
    getCollections(),
    getProducts(),
  ]);

  const collectionRoutes: MetadataRoute.Sitemap = collections.map((c) => ({
    url: absoluteUrl(`/collections/${c.handle}`),
    lastModified: now,
    priority: 0.7,
  }));

  const productRoutes: MetadataRoute.Sitemap = products.map((p) => ({
    url: absoluteUrl(`/luts/${p.handle}`),
    lastModified: now,
    priority: 0.8,
  }));

  return [...staticRoutes, ...collectionRoutes, ...productRoutes];
}
