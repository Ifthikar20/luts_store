// DEV-ONLY mock catalog.
// The storefront falls back to this data when the Django BFF is unreachable
// so the UI can render standalone during development. It is never used when
// the API responds successfully. Do NOT treat these prices/availability as
// authoritative — production always reads from the API.

import type {
  Cart,
  Collection,
  CollectionWithProducts,
  Product,
} from "./types";

const U = "https://images.unsplash.com/";
const img = (id: string, alt: string) => ({
  url: `${U}${id}?auto=format&fit=crop&w=1200&q=80`,
  altText: alt,
});

const money = (amount: string) => ({ amount, currencyCode: "USD" });

function makeProduct(p: {
  handle: string;
  title: string;
  price: string;
  desc: string;
  imgId: string;
  imgId2: string;
  productType: string;
  collections: { handle: string; title: string }[];
  tags: string[];
  lutCount: number;
  formats: string[];
  apps: string[];
  featured?: boolean;
}): Product {
  return {
    id: `gid://product/${p.handle}`,
    handle: p.handle,
    title: p.title,
    description: p.desc,
    descriptionHtml: `<p>${p.desc}</p>`,
    featuredImage: img(p.imgId, p.title),
    images: [img(p.imgId, p.title), img(p.imgId2, `${p.title} preview`)],
    priceRange: { min: money(p.price), max: money(p.price) },
    variants: [
      {
        id: `gid://variant/${p.handle}`,
        title: "Digital download",
        price: money(p.price),
        availableForSale: true,
      },
    ],
    tags: p.tags,
    productType: p.productType,
    vendor: "Luts.shop",
    collections: p.collections,
    metafields: {
      lutCount: p.lutCount,
      lutType: "3D creative look LUT",
      formats: p.formats,
      compatibleApps: p.apps,
    },
    featured: p.featured,
  };
}

export const mockCollections: Collection[] = [
  {
    handle: "cinematic",
    title: "Cinematic",
    description: "Filmic teal & orange grades engineered for narrative work.",
    image: `${U}photo-1485846234645-a62644f84728?auto=format&fit=crop&w=1200&q=80`,
    productCount: 3,
  },
  {
    handle: "moody",
    title: "Moody & Dark",
    description: "Low-key, crushed-black looks with rich shadow tonality.",
    image: `${U}photo-1492691527719-9d1e07e534b4?auto=format&fit=crop&w=1200&q=80`,
    productCount: 2,
  },
  {
    handle: "vibrant",
    title: "Vibrant",
    description: "Punchy, saturated palettes for travel, lifestyle and social.",
    image: `${U}photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=1200&q=80`,
    productCount: 2,
  },
  {
    handle: "bundles",
    title: "Bundles",
    description: "Every look we make, packaged at the best value.",
    image: `${U}photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80`,
    productCount: 1,
  },
];

export const mockProducts: Product[] = [
  makeProduct({
    handle: "nocturne-cinematic",
    title: "Nocturne — Cinematic Pack",
    price: "49.00",
    desc: "A teal & orange flagship grade tuned for night exteriors and neon. Filmic rolloff in the highlights, clean skin tones, deep but readable shadows.",
    imgId: "photo-1485846234645-a62644f84728",
    imgId2: "photo-1470071459604-3b5ec3a7fe05",
    productType: "LUT Pack",
    collections: [{ handle: "cinematic", title: "Cinematic" }],
    tags: ["teal-orange", "night", "film"],
    lutCount: 12,
    formats: [".cube", ".3dl"],
    apps: ["Premiere Pro", "DaVinci Resolve", "Final Cut Pro", "LumaFusion"],
    featured: true,
  }),
  makeProduct({
    handle: "kodak-portrait",
    title: "Kodak Portrait",
    price: "39.00",
    desc: "Warm analog emulation inspired by classic motion-picture stock. Gentle contrast, creamy skin, halated highlights.",
    imgId: "photo-1506634572416-48cdfe530110",
    imgId2: "photo-1524504388940-b1c1722653e1",
    productType: "LUT Pack",
    collections: [{ handle: "cinematic", title: "Cinematic" }],
    tags: ["analog", "portrait", "warm"],
    lutCount: 8,
    formats: [".cube"],
    apps: ["Premiere Pro", "DaVinci Resolve", "Photoshop"],
    featured: true,
  }),
  makeProduct({
    handle: "midnight-noir",
    title: "Midnight Noir",
    price: "44.00",
    desc: "Crushed blacks, cold steel midtones and a restrained palette for thrillers and music videos.",
    imgId: "photo-1492691527719-9d1e07e534b4",
    imgId2: "photo-1419242902214-272b3f66ee7a",
    productType: "LUT Pack",
    collections: [
      { handle: "moody", title: "Moody & Dark" },
      { handle: "cinematic", title: "Cinematic" },
    ],
    tags: ["moody", "dark", "noir"],
    lutCount: 10,
    formats: [".cube", ".3dl"],
    apps: ["DaVinci Resolve", "Premiere Pro"],
    featured: true,
  }),
  makeProduct({
    handle: "ember-moody",
    title: "Ember",
    price: "35.00",
    desc: "Smoky, desaturated warmth with amber shadows — built for golden-hour drama and documentary.",
    imgId: "photo-1470770841072-f978cf4d019e",
    imgId2: "photo-1418065460487-3e41a6c84dc5",
    productType: "LUT Pack",
    collections: [{ handle: "moody", title: "Moody & Dark" }],
    tags: ["moody", "warm", "documentary"],
    lutCount: 6,
    formats: [".cube"],
    apps: ["Final Cut Pro", "Premiere Pro", "LumaFusion"],
  }),
  makeProduct({
    handle: "tropic-vibrant",
    title: "Tropic",
    price: "29.00",
    desc: "High-saturation, high-clarity look for travel and lifestyle. Lush greens, electric blues, glowing skin.",
    imgId: "photo-1469474968028-56623f02e42e",
    imgId2: "photo-1507525428034-b723cf961d3e",
    productType: "LUT Pack",
    collections: [{ handle: "vibrant", title: "Vibrant" }],
    tags: ["vibrant", "travel", "punchy"],
    lutCount: 9,
    formats: [".cube", ".3dl"],
    apps: ["Premiere Pro", "Final Cut Pro", "LumaFusion", "Photoshop"],
    featured: true,
  }),
  makeProduct({
    handle: "neon-pop",
    title: "Neon Pop",
    price: "32.00",
    desc: "Violet → magenta synthwave palette with glowing highlights and vivid color separation.",
    imgId: "photo-1492571350019-22de08371fd3",
    imgId2: "photo-1551376347-075b0121a65b",
    productType: "LUT Pack",
    collections: [{ handle: "vibrant", title: "Vibrant" }],
    tags: ["vibrant", "neon", "synthwave"],
    lutCount: 7,
    formats: [".cube"],
    apps: ["Premiere Pro", "DaVinci Resolve"],
  }),
  makeProduct({
    handle: "the-everything-bundle",
    title: "The Everything Bundle",
    price: "129.00",
    desc: "Every pack we make in one download — 52 looks in .cube and .3dl, graded for everything from DJI and iPhone to mirrorless. The whole library, the best price.",
    imgId: "photo-1500530855697-b586d89ba3ee",
    imgId2: "photo-1502082553048-f009c37129b9",
    productType: "Bundle",
    collections: [{ handle: "bundles", title: "Bundles" }],
    tags: ["bundle", "value", "all-access"],
    lutCount: 52,
    formats: [".cube", ".3dl"],
    apps: [
      "Premiere Pro",
      "DaVinci Resolve",
      "Final Cut Pro",
      "LumaFusion",
      "Photoshop",
    ],
    featured: true,
  }),
];

export function mockCollectionWithProducts(
  handle: string,
): CollectionWithProducts | null {
  const col = mockCollections.find((c) => c.handle === handle);
  if (!col) return null;
  return {
    handle: col.handle,
    title: col.title,
    description: col.description,
    products: mockProducts.filter((p) =>
      p.collections.some((c) => c.handle === handle),
    ),
  };
}

export function mockProductByHandle(handle: string): Product | null {
  return mockProducts.find((p) => p.handle === handle) ?? null;
}

// A purely in-memory mock cart so the drawer/cart page work offline.
export function emptyMockCart(): Cart {
  return {
    id: "mock-cart",
    checkoutUrl: "#mock-checkout",
    totalQuantity: 0,
    cost: { subtotal: money("0.00"), total: money("0.00") },
    lines: [],
  };
}
