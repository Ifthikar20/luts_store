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
  AuthResponse,
  Cart,
  CartLineInput,
  Collection,
  CollectionWithProducts,
  DownloadItem,
  Facets,
  OrderConfirmation,
  Product,
  ProductQuery,
  ProductsResponse,
  User,
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

// The API origin (without the trailing /api) so we can resolve relative
// download paths the BFF returns (e.g. "/api/download/<token>").
export const API_ORIGIN = API_URL.replace(/\/api\/?$/, "");

const TIMEOUT_MS = 4000;

class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/* -------------------------------------------------------------------------- */
/* Auth token storage (in-memory + localStorage)                              */
/* -------------------------------------------------------------------------- */
// The token is held in a module-level variable for synchronous header
// injection and mirrored to localStorage so it survives reloads.
// PRODUCTION NOTE: a token readable by JS is vulnerable to XSS theft; prefer
// httpOnly cookies or Shopify Customer Accounts in production.
const TOKEN_KEY = "looks-lab:authToken";
let authToken: string | null = null;

export function getAuthToken(): string | null {
  if (authToken) return authToken;
  if (typeof window === "undefined") return null;
  try {
    authToken = window.localStorage.getItem(TOKEN_KEY);
  } catch {
    authToken = null;
  }
  return authToken;
}

export function setAuthToken(token: string | null) {
  authToken = token;
  if (typeof window === "undefined") return;
  try {
    if (token) window.localStorage.setItem(TOKEN_KEY, token);
    else window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage may be unavailable (private mode) — non-fatal */
  }
}

// Resolve a (possibly relative) download URL against the API origin so it can
// be opened directly in the browser.
export function resolveDownloadUrl(url: string): string {
  if (/^https?:\/\//.test(url)) return url;
  return `${API_ORIGIN}${url}`;
}

async function request<T>(
  path: string,
  init?: RequestInit & { timeoutMs?: number; auth?: boolean },
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    init?.timeoutMs ?? TIMEOUT_MS,
  );
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((init?.headers as Record<string, string>) ?? {}),
  };
  if (init?.auth) {
    const token = getAuthToken();
    if (token) headers.Authorization = `Token ${token}`;
  }
  try {
    const res = await fetch(`${API_URL}${path}`, {
      ...init,
      signal: controller.signal,
      headers,
      // Server Components: keep data fresh-ish but allow caching.
      next: { revalidate: 60 },
    });
    if (!res.ok) {
      let detail = `Request to ${path} failed: ${res.status}`;
      try {
        const body = await res.json();
        if (body?.detail) detail = body.detail;
      } catch {
        /* non-JSON error body — keep generic message */
      }
      throw new ApiError(detail, res.status);
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

// Build the querystring for GET /api/products from a ProductQuery. Empty /
// default values are omitted so URLs stay clean and caches stay warm.
function buildProductsQuery(params?: ProductQuery): string {
  const qs = new URLSearchParams();
  if (params?.collection) qs.set("collection", params.collection);
  if (params?.featured) qs.set("featured", "true");
  if (params?.search) qs.set("search", params.search);
  if (params?.sort && params.sort !== "featured") qs.set("sort", params.sort);
  if (params?.minPrice != null) qs.set("minPrice", String(params.minPrice));
  if (params?.maxPrice != null) qs.set("maxPrice", String(params.maxPrice));
  if (params?.tags && params.tags.length) qs.set("tags", params.tags.join(","));
  return qs.toString();
}

export async function getProducts(params?: ProductQuery): Promise<Product[]> {
  const query = buildProductsQuery(params);
  try {
    const data = await request<ProductsResponse>(
      `/products${query ? `?${query}` : ""}`,
    );
    return data.products;
  } catch {
    // DEV-ONLY fallback: mirror the API's filtering + sorting against the local
    // mock catalog so the UI keeps working when the BFF is unreachable. Never
    // authoritative — production always reflects the API response above.
    return filterMockProducts(params);
  }
}

// DEV-ONLY: client-side reimplementation of the backend discovery pipeline.
function filterMockProducts(params?: ProductQuery): Product[] {
  const minAmount = (p: Product) => Number.parseFloat(p.priceRange.min.amount);
  let list = mockProducts.slice();
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
        p.productType.toLowerCase().includes(q) ||
        p.tags.some((t) => t.toLowerCase().includes(q)),
    );
  }
  if (params?.minPrice != null)
    list = list.filter((p) => minAmount(p) >= params.minPrice!);
  if (params?.maxPrice != null)
    list = list.filter((p) => minAmount(p) <= params.maxPrice!);
  if (params?.tags && params.tags.length) {
    const wanted = new Set(params.tags.map((t) => t.toLowerCase()));
    list = list.filter((p) => p.tags.some((t) => wanted.has(t.toLowerCase())));
  }
  switch (params?.sort) {
    case "price-asc":
      return list.sort((a, b) => minAmount(a) - minAmount(b));
    case "price-desc":
      return list.sort((a, b) => minAmount(b) - minAmount(a));
    case "title-asc":
      return list.sort((a, b) => a.title.localeCompare(b.title));
    case "newest":
      return list.sort((a, b) => b.id.localeCompare(a.id));
    default:
      return list.sort(
        (a, b) => (a.featured ? 0 : 1) - (b.featured ? 0 : 1),
      );
  }
}

// GET /api/facets — optionally scoped to a collection. Falls back (dev-only) to
// computing facets from the local mock catalog.
export async function getFacets(collection?: string): Promise<Facets> {
  const query = collection
    ? `?collection=${encodeURIComponent(collection)}`
    : "";
  try {
    return await request<Facets>(`/facets${query}`);
  } catch {
    return computeMockFacets(collection);
  }
}

// DEV-ONLY: mirror the backend facets computation over the mock catalog.
function computeMockFacets(collection?: string): Facets {
  const scope = collection
    ? mockProducts.filter((p) =>
        p.collections.some((c) => c.handle === collection),
      )
    : mockProducts;
  const prices = scope.map((p) => Number.parseFloat(p.priceRange.min.amount));
  const tagCounts = new Map<string, number>();
  const typeCounts = new Map<string, number>();
  for (const p of scope) {
    for (const t of p.tags) tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
    if (p.productType)
      typeCounts.set(p.productType, (typeCounts.get(p.productType) ?? 0) + 1);
  }
  const toSorted = (m: Map<string, number>) =>
    [...m.entries()]
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
  return {
    priceRange: {
      min: prices.length ? Math.min(...prices) : 0,
      max: prices.length ? Math.max(...prices) : 0,
    },
    tags: toSorted(tagCounts),
    productTypes: toSorted(typeCounts),
  };
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

/* -------------------------------------------------------------------------- */
/* Auth — these surface REAL errors (no silent mock-success fallback).        */
/* The thrown Error's message is the API's generic, non-enumerating detail.   */
/* -------------------------------------------------------------------------- */

export async function register(
  email: string,
  password: string,
): Promise<AuthResponse> {
  const res = await request<AuthResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  setAuthToken(res.token);
  return res;
}

export async function login(
  email: string,
  password: string,
): Promise<AuthResponse> {
  const res = await request<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  setAuthToken(res.token);
  return res;
}

export async function logout(): Promise<void> {
  try {
    await request<{ status: string }>("/auth/logout", {
      method: "POST",
      auth: true,
    });
  } finally {
    // Always clear the local token, even if the server call fails.
    setAuthToken(null);
  }
}

export async function getMe(): Promise<User | null> {
  if (!getAuthToken()) return null;
  try {
    return await request<User>("/auth/me", { method: "GET", auth: true });
  } catch (err) {
    // An invalid/expired token -> drop it so the UI shows logged-out state.
    if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
      setAuthToken(null);
    }
    return null;
  }
}

/* -------------------------------------------------------------------------- */
/* Download library + order confirmation                                      */
/* -------------------------------------------------------------------------- */

export async function getMyDownloads(): Promise<DownloadItem[]> {
  return request<DownloadItem[]>("/me/downloads", {
    method: "GET",
    auth: true,
  });
}

// Confirm an order/checkout. Pass the order id (real Shopify order) or, in mock
// mode, a cart id (the placeholder checkoutUrl ends with the cart id).
export async function confirmOrder(
  idOrToken: string,
): Promise<OrderConfirmation> {
  return request<OrderConfirmation>(
    `/orders/${encodeURIComponent(idOrToken)}`,
    { method: "GET" },
  );
}
