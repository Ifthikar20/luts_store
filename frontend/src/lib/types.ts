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

export interface CartLineInput {
  merchandiseId: string;
  quantity: number;
}
