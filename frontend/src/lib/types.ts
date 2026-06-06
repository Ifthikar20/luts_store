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

export interface AuthResponse {
  token: string;
  user: User;
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
