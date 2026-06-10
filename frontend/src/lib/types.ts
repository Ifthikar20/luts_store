// Shared types mirroring the Django BFF's camelCase JSON contract.
// These are the EXACT shapes the storefront consumes.

export interface Money {
  amount: string;
  currencyCode: string;
}

export interface Image {
  url: string;
  altText: string;
}

export interface PriceRange {
  min: Money;
  max: Money;
}

export interface Variant {
  id: string;
  title: string;
  price: Money;
  availableForSale: boolean;
}

export interface CollectionRef {
  handle: string;
  title: string;
}

export interface ProductMetafields {
  lutCount: number;
  formats: string[];
  compatibleApps: string[];
}

export interface Product {
  id: string;
  handle: string;
  title: string;
  description: string;
  descriptionHtml: string;
  featuredImage: Image;
  images: Image[];
  priceRange: PriceRange;
  // Optional "was" price — present on discounted items (e.g. bundles). When set
  // and higher than priceRange.min, the UI shows a strikethrough + savings.
  compareAtPrice?: Money;
  // Per-product preview assets. `afterImage` (the graded frame) + `beforeImage`
  // drive a real before/after slider on the product page; `previewVideo` is a
  // short muted looping clip of the look in motion. All optional.
  beforeImage?: string;
  afterImage?: string | null;
  previewVideo?: string | null;
  // Concise use-case phrase ("Best for …") — the bold lead of card captions.
  bestFor?: string;
  // The named LUTs inside a pack (or member packs, for bundles): each has a
  // coloring name + a short tone note. Drives the "Inside the pack" section.
  includedLuts?: { name: string; tone: string }[];
  variants: Variant[];
  tags: string[];
  productType: string;
  vendor: string;
  collections: CollectionRef[];
  metafields: ProductMetafields;
  featured?: boolean;
}

export interface Collection {
  handle: string;
  title: string;
  description: string;
  image: string;
  productCount: number;
}

export interface CollectionWithProducts {
  handle: string;
  title: string;
  description: string;
  products: Product[];
}

export interface CartLineMerchandise {
  id: string;
  title: string;
  product: {
    handle: string;
    title: string;
    featuredImage: Image;
  };
  price: Money;
}

export interface CartLine {
  id: string;
  quantity: number;
  merchandise: CartLineMerchandise;
}

export interface Cart {
  id: string;
  checkoutUrl: string;
  totalQuantity: number;
  cost: {
    subtotal: Money;
    total: Money;
  };
  lines: CartLine[];
}

export interface ProductsResponse {
  products: Product[];
}

/* -------------------------------------------------------------------------- */
/* Phase 3: discovery (search, sort, filters, facets)                         */
/* -------------------------------------------------------------------------- */

// The sort keys accepted by GET /api/products (?sort=). Must stay in sync with
// the backend's VALID_SORTS. `featured` is the default.
export type SortKey =
  | "featured"
  | "price-asc"
  | "price-desc"
  | "title-asc"
  | "newest";

// A single selectable facet value with the number of in-scope products.
export interface FacetCount {
  value: string;
  count: number;
}

// GET /api/facets response — drives the filter UI.
export interface Facets {
  priceRange: { min: number; max: number };
  tags: FacetCount[];
  productTypes: FacetCount[];
}

// The full discovery query understood by getProducts(). Every field is
// optional and composes (collection scope + search + price + tags + sort).
export interface ProductQuery {
  collection?: string;
  featured?: boolean;
  search?: string;
  sort?: SortKey;
  minPrice?: number;
  maxPrice?: number;
  tags?: string[];
}

export interface CartLineInput {
  merchandiseId: string;
  quantity: number;
}

/* -------------------------------------------------------------------------- */
/* Phase 2: accounts, download library, order confirmation                    */
/* -------------------------------------------------------------------------- */

export interface User {
  id: number;
  email: string;
}

// Social sign-in providers (login required to buy).
export type SocialProvider = "google" | "apple";

export interface AuthResponse {
  token: string;
  user: User;
}

// Response from GET /api/auth/google/login.
// - mode "google": navigate the browser to `authorizeUrl` (Google's hosted
//   sign-in screen; the Django backend owns the whole OAuth flow + session).
// - mode "mock": Google isn't configured — the SPA shows the demo email field.
export interface GoogleLoginResponse {
  mode: "google" | "mock";
  authorizeUrl?: string;
}

/* -------------------------------------------------------------------------- */
/* Shopify Customer Accounts portal (session-based, OPTIONAL login)           */
/* -------------------------------------------------------------------------- */

// The logged-in customer for the account/library portal. Backed by a
// server-side Django session (httpOnly cookie), not a JS-readable token.
export interface Customer {
  email: string;
}

// Response from GET /api/auth/shopify/login.
// - mode "shopify": navigate the browser to `authorizeUrl` (hosted Shopify
//   login). - mode "mock": the SPA shows a local demo email field instead.
export interface ShopifyLoginResponse {
  mode: "shopify" | "mock";
  authorizeUrl?: string;
}

// Response from GET /api/auth/session.
export interface CustomerSession {
  authenticated: boolean;
  customer: Customer | null;
}

// Response from POST /api/auth/shopify/mock-complete (MOCK-only demo login).
export interface MockCompleteResponse {
  customer: Customer;
}

// One purchased LUT in the customer's download library. `downloadUrl` is a
// signed, expiring API path (GET /api/download/<token>).
export interface DownloadItem {
  productHandle: string;
  title: string;
  grantedAt: string;
  downloadUrl: string;
  expiresAt: string;
}

// A single immediate-download entry on the thank-you confirmation.
export interface ConfirmationDownload {
  title: string;
  downloadUrl: string;
  expiresAt: string;
}

export interface OrderConfirmation {
  orderId: string;
  email: string;
  lines: { title: string; quantity: number }[];
  total: Money;
  downloads: ConfirmationDownload[];
}

// Generic, non-enumerating response from POST /api/orders/resend-downloads.
// The `detail` is identical whether or not the email had any purchases.
export interface ResendDownloadsResponse {
  status: string;
  detail: string;
}

/* -------------------------------------------------------------------------- */
/* Phase 5: engagement (newsletter + contact)                                 */
/* -------------------------------------------------------------------------- */

// Generic success body shared by POST /api/newsletter and POST /api/contact.
// Both endpoints are non-enumerating: the `detail` never reveals whether an
// address already existed.
export interface EngagementResponse {
  status: string;
  detail: string;
}

// Payload for POST /api/contact.
export interface ContactInput {
  name: string;
  email: string;
  message: string;
}

/* -------------------------------------------------------------------------- */
/* Checkout (guest, login-free)                                               */
/* -------------------------------------------------------------------------- */

// Response from POST /api/checkout.
// - mode "shopify": `checkoutUrl` is an absolute Shopify URL — navigate the
//   browser to it (full page redirect).
// - mode "mock":    `checkoutUrl` is the in-app demo path "/checkout?cart=..."
//   — handle it with the client router.
export interface CheckoutResponse {
  // "stripe" / "shopify" -> absolute hosted-checkout URL (full-page redirect).
  // "mock" -> relative in-app demo checkout path (client router push).
  mode: "stripe" | "shopify" | "mock";
  checkoutUrl: string;
}

// Response from POST /api/checkout/complete (mock-only demo completion).
export interface CheckoutCompleteResponse {
  orderId: string;
}
