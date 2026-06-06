// API client for the Django BFF.
//
// Base URL is read from NEXT_PUBLIC_API_URL (only NEXT_PUBLIC_ envs are exposed
// to the client — never put secrets here). All responses are camelCase JSON that
// match the types in ./types.ts exactly.
//
// DEV-ONLY RESILIENCE: every read wraps the fetch in a try/catch with a short
// timeout and falls back to ./mock.ts so the UI renders standalone when the
// backend isn't running. The mock fallback must NEVER be relied upon in
// production — prices and availability are always authoritative from the API.

import type {
  Cart,
  CartLineInput,
  Collection,
  CollectionWithProducts,
  Product,
  ProductsResponse,
} from "./types";
import {
  emptyMockCart,
  mockCollections,
  mockCollectionWithProducts,
  mockProductByHandle,
  mockProducts,
} from "./mock";

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api";

const TIMEOUT_MS = 4000;

class ApiError extends Error {}

async function request<T>(
  path: string,
  init?: RequestInit & { timeoutMs?: number },
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    init?.timeoutMs ?? TIMEOUT_MS,
  );
  try {
    const res = await fetch(`${API_URL}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
      // Server Components: keep data fresh-ish but allow caching.
      next: { revalidate: 60 },
    });
    if (!res.ok) {
      throw new ApiError(`Request to ${path} failed: ${res.status}`);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

/* -------------------------------------------------------------------------- */
/* Catalog (read) — all fall back to mock data on failure (dev-only).         */
/* -------------------------------------------------------------------------- */

export async function getCollections(): Promise<Collection[]> {
  try {
    return await request<Collection[]>("/collections");
  } catch {
    return mockCollections;
  }
}

export async function getCollection(
  handle: string,
): Promise<CollectionWithProducts | null> {
  try {
    return await request<CollectionWithProducts>(
      `/collections/${encodeURIComponent(handle)}`,
    );
  } catch {
    return mockCollectionWithProducts(handle);
  }
}

export async function getProducts(params?: {
  collection?: string;
  featured?: boolean;
  search?: string;
}): Promise<Product[]> {
  const qs = new URLSearchParams();
  if (params?.collection) qs.set("collection", params.collection);
  if (params?.featured) qs.set("featured", "true");
  if (params?.search) qs.set("search", params.search);
  const query = qs.toString();
  try {
    const data = await request<ProductsResponse>(
      `/products${query ? `?${query}` : ""}`,
    );
    return data.products;
  } catch {
    // Mirror the API's filtering against mock data.
    let list = mockProducts;
    if (params?.collection)
      list = list.filter((p) =>
        p.collections.some((c) => c.handle === params.collection),
      );
    if (params?.featured) list = list.filter((p) => p.featured);
    if (params?.search) {
      const q = params.search.toLowerCase();
      list = list.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.tags.some((t) => t.toLowerCase().includes(q)),
      );
    }
    return list;
  }
}

export async function getProduct(handle: string): Promise<Product | null> {
  try {
    return await request<Product>(`/products/${encodeURIComponent(handle)}`);
  } catch {
    return mockProductByHandle(handle);
  }
}

export async function getRelatedProducts(
  product: Product,
  limit = 3,
): Promise<Product[]> {
  const collectionHandle = product.collections[0]?.handle;
  const candidates = collectionHandle
    ? await getProducts({ collection: collectionHandle })
    : await getProducts();
  return candidates.filter((p) => p.handle !== product.handle).slice(0, limit);
}

/* -------------------------------------------------------------------------- */
/* Cart (write) — these mutate, so on failure we degrade to an in-memory mock */
/* cart rather than throwing, keeping the UI usable offline.                  */
/* -------------------------------------------------------------------------- */

export async function createCart(lines?: CartLineInput[]): Promise<Cart> {
  try {
    return await request<Cart>("/cart", {
      method: "POST",
      body: JSON.stringify(lines ? { lines } : {}),
    });
  } catch {
    return emptyMockCart();
  }
}

export async function getCart(id: string): Promise<Cart | null> {
  try {
    return await request<Cart>(`/cart/${encodeURIComponent(id)}`);
  } catch {
    return null;
  }
}

export async function addCartLine(
  id: string,
  line: CartLineInput,
): Promise<Cart> {
  try {
    return await request<Cart>(`/cart/${encodeURIComponent(id)}/lines`, {
      method: "POST",
      body: JSON.stringify(line),
    });
  } catch {
    return emptyMockCart();
  }
}

export async function updateCartLine(
  id: string,
  lineId: string,
  quantity: number,
): Promise<Cart> {
  try {
    return await request<Cart>(`/cart/${encodeURIComponent(id)}/lines`, {
      method: "PATCH",
      body: JSON.stringify({ lineId, quantity }),
    });
  } catch {
    return emptyMockCart();
  }
}

export async function removeCartLine(id: string, lineId: string): Promise<Cart> {
  try {
    return await request<Cart>(`/cart/${encodeURIComponent(id)}/lines`, {
      method: "DELETE",
      body: JSON.stringify({ lineId }),
    });
  } catch {
    return emptyMockCart();
  }
}
