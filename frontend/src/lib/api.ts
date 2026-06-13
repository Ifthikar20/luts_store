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
  CheckoutCompleteResponse,
  CheckoutResponse,
  Collection,
  CollectionWithProducts,
  ContactInput,
  CustomerSession,
  DownloadItem,
  EngagementResponse,
  Facets,
  GoogleLoginResponse,
  MockCompleteResponse,
  OrderConfirmation,
  Product,
  ProductQuery,
  ProductsResponse,
  ResendDownloadsResponse,
  Review,
  ReviewsResponse,
  ShopifyLoginResponse,
  SocialProvider,
  User,
} from "./types";
import {
  emptyMockCart,
  mockCollections,
  mockCollectionWithProducts,
  mockProductByHandle,
  mockProducts,
} from "./mock";
import { executeRecaptcha } from "./recaptcha";
import { envelope } from "./obfuscate";

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api";

// The API origin (without the trailing /api) so we can resolve relative
// download paths the BFF returns (e.g. "/api/download/<token>").
export const API_ORIGIN = API_URL.replace(/\/api\/?$/, "");

const TIMEOUT_MS = 4000;

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

// NO CLIENT-SIDE CREDENTIALS: auth is owned entirely by the Django backend via
// an httpOnly SESSION cookie. The browser never sees or stores a token — calls
// that need the signed-in user just send `session: true` (credentials:include).
// One-time cleanup: drop the legacy localStorage token from older releases so
// no stale credential lingers in the browser.
const LEGACY_TOKEN_KEY = "looks-lab:authToken";

export function clearLegacyAuthToken(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(LEGACY_TOKEN_KEY);
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
  init?: RequestInit & {
    timeoutMs?: number;
    // session: send the httpOnly session cookie (credentials:'include') so the
    // Django backend recognizes the logged-in browser. Used by auth, checkout
    // and the download library.
    session?: boolean;
  },
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
  // Obfuscate JSON request bodies (see lib/obfuscate.ts — DevTools deterrent,
  // not a security boundary; the backend unwraps transparently).
  const body =
    typeof init?.body === "string" ? envelope(init.body) : init?.body;
  try {
    const res = await fetch(`${API_URL}${path}`, {
      ...init,
      body,
      signal: controller.signal,
      headers,
      // Send cookies for session-based (Shopify Customer Accounts) requests.
      ...(init?.session ? { credentials: "include" as const } : {}),
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
    // DEV-ONLY fallback so the UI renders standalone: the raw mock fixture
    // list, deliberately UNFILTERED. All filtering/sorting/pricing is business
    // logic that lives only in the backend — never reimplemented here.
    return mockProducts;
  }
}

// GET /api/facets — optionally scoped to a collection. Facets are computed only
// by the backend; with it unreachable the filter rail just renders empty.
export async function getFacets(collection?: string): Promise<Facets> {
  const query = collection
    ? `?collection=${encodeURIComponent(collection)}`
    : "";
  try {
    return await request<Facets>(`/facets${query}`);
  } catch {
    return { priceRange: { min: 0, max: 0 }, tags: [], productTypes: [] };
  }
}

export async function getProduct(handle: string): Promise<Product | null> {
  try {
    return await request<Product>(`/products/${encodeURIComponent(handle)}`);
  } catch {
    return mockProductByHandle(handle);
  }
}

// This week's free LUT (the product tagged "free"), or null if none published.
export async function getFreeLut(): Promise<Product | null> {
  try {
    return await request<Product>("/free-lut");
  } catch {
    return null;
  }
}

// Claim the weekly free LUT by email (no payment). Returns the order id, which
// resolves on /thank-you?order=<id> exactly like a paid order. Errors propagate.
export async function claimFreeLut(email: string): Promise<{ orderId: string }> {
  return request<{ orderId: string }>("/free-lut/claim", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
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
/* Checkout (guest, login-free) — surface REAL errors (no mock fallback).     */
/* The backend decides the mode: Shopify (real) or mock (in-app demo).        */
/* -------------------------------------------------------------------------- */

// Begin checkout for a cart. Optional guest email is forwarded to the BFF.
// Returns {mode, checkoutUrl}: callers navigate to checkoutUrl for "shopify"
// or route to it in-app for "mock". Errors propagate so the UI can show them.
export async function createCheckout(
  cartId: string,
  email?: string,
): Promise<CheckoutResponse> {
  // session:true — checkout requires sign-in and the httpOnly Django session
  // cookie is the only credential the browser ever holds.
  return request<CheckoutResponse>("/checkout", {
    method: "POST",
    session: true,
    body: JSON.stringify(email ? { cartId, email } : { cartId }),
  });
}

// Complete a MOCK checkout (demo-only). Returns {orderId} for the thank-you
// page. Errors propagate so the demo checkout can surface them.
export async function completeCheckout(
  cartId: string,
  email: string,
): Promise<CheckoutCompleteResponse> {
  return request<CheckoutCompleteResponse>("/checkout/complete", {
    method: "POST",
    body: JSON.stringify({ cartId, email }),
  });
}

/* -------------------------------------------------------------------------- */
/* Auth — SESSION-ONLY. These surface REAL errors (no mock-success fallback). */
/* The thrown Error's message is the API's generic, non-enumerating detail.   */
/* -------------------------------------------------------------------------- */

// Begin Google sign-in. The DJANGO BACKEND owns the whole OAuth flow: mode
// "google" -> navigate the browser to `authorizeUrl` (Google's sign-in screen;
// the backend callback sets the httpOnly session and bounces back to
// `returnTo`). mode "mock" -> the SPA shows the demo email field instead.
// session:true so the state stashed by the backend rides the session cookie.
export async function googleLogin(
  returnTo = "/account",
): Promise<GoogleLoginResponse> {
  return request<GoogleLoginResponse>(
    `/auth/google/login?returnTo=${encodeURIComponent(returnTo)}`,
    { method: "GET", session: true },
  );
}

// Sign in with Google/Apple. `credential` is the provider identity token (or a
// "mock:<email>" token in dev). The backend verifies it and establishes the
// httpOnly Django session (session:true persists the cookie); nothing
// credential-like is ever stored client-side.
export async function socialLogin(
  provider: SocialProvider,
  credential: string,
): Promise<User> {
  const recaptchaToken = await executeRecaptcha("login");
  const res = await request<{ user: User }>(`/auth/${provider}`, {
    method: "POST",
    session: true,
    body: JSON.stringify({ credential, recaptchaToken }),
  });
  return res.user;
}

export async function logout(): Promise<void> {
  try {
    // Clears the httpOnly Django session, however the user signed in.
    await request<{ ok: boolean }>("/auth/session/logout", {
      method: "POST",
      session: true,
    });
  } finally {
    // Hygiene: drop the token older releases kept in localStorage.
    clearLegacyAuthToken();
  }
}

/* -------------------------------------------------------------------------- */
/* Shopify Customer Accounts portal (session-based, OPTIONAL login)           */
/* -------------------------------------------------------------------------- */
// These power the account/library portal via a server-side Django SESSION
// (httpOnly cookie) — NOT a localStorage token. Every call sends the cookie
// with credentials:'include'. Guest checkout + login-free downloads are
// unaffected by any of this. The backend decides "shopify" (real OAuth) vs
// "mock" (local demo) based on whether Shopify credentials are configured.

// Begin login. mode "shopify": navigate the browser to `authorizeUrl` (hosted
// Shopify login). mode "mock": the SPA shows a demo email field that calls
// mockCompleteLogin. `returnTo` is where the callback sends the user afterward.
export async function shopifyLogin(
  returnTo = "/account",
): Promise<ShopifyLoginResponse> {
  return request<ShopifyLoginResponse>(
    `/auth/shopify/login?returnTo=${encodeURIComponent(returnTo)}`,
    { method: "GET", session: true },
  );
}

/* Reviews — real, per-product. Creation is gated server-side on a verified    */
/* purchase, so these surface REAL errors (401 not signed in, 403 not a buyer).*/

// Public list + aggregate. session:true so `canReview` reflects the logged-in
// buyer (sends the session cookie); falls back to an empty set on error.
export async function getReviews(handle: string): Promise<ReviewsResponse> {
  try {
    return await request<ReviewsResponse>(
      `/products/${encodeURIComponent(handle)}/reviews`,
      { method: "GET", session: true },
    );
  } catch {
    return { average: 0, count: 0, reviews: [], canReview: false };
  }
}

// Create/update the signed-in buyer's review. Errors (401/403/400) propagate.
export async function createReview(
  handle: string,
  input: { rating: number; title?: string; body: string; name?: string },
): Promise<{ review: Review }> {
  const recaptchaToken = await executeRecaptcha("review");
  return request<{ review: Review }>(
    `/products/${encodeURIComponent(handle)}/reviews/create`,
    { method: "POST", session: true, body: JSON.stringify({ ...input, recaptchaToken }) },
  );
}

// Current session: who (if anyone) is logged in. Used to hydrate AuthContext.
export async function getSession(): Promise<CustomerSession> {
  return request<CustomerSession>("/auth/session", {
    method: "GET",
    session: true,
  });
}

// MOCK ONLY: simulate the Shopify OAuth result locally (404s in real mode).
// Establishes the session for the given email and returns the customer.
export async function mockCompleteLogin(
  email: string,
): Promise<MockCompleteResponse> {
  return request<MockCompleteResponse>("/auth/shopify/mock-complete", {
    method: "POST",
    session: true,
    body: JSON.stringify({ email }),
  });
}

// Clear the server-side session.
export async function shopifyLogout(): Promise<void> {
  await request<{ ok: boolean }>("/auth/shopify/logout", {
    method: "POST",
    session: true,
  });
}

/* -------------------------------------------------------------------------- */
/* Download library + order confirmation                                      */
/* -------------------------------------------------------------------------- */

// The download library relies on the httpOnly Django SESSION cookie
// (credentials:'include') — the same credential as every signed-in call.
export async function getMyDownloads(): Promise<DownloadItem[]> {
  return request<DownloadItem[]>("/me/downloads", {
    method: "GET",
    session: true,
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

/* -------------------------------------------------------------------------- */
/* Phase 5: engagement (newsletter + contact)                                 */
/* -------------------------------------------------------------------------- */

// Subscribe an email to the newsletter. NON-ENUMERATING: the API always returns
// the same generic 200 whether or not the address already existed, so callers
// should surface res.detail verbatim and never infer subscription state.
export async function subscribeNewsletter(
  email: string,
): Promise<EngagementResponse> {
  return request<EngagementResponse>("/newsletter", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

// Submit the contact form. Stores a message server-side and best-effort emails
// the support inbox; returns a generic 200 on success (400 on validation).
export async function submitContact(
  input: ContactInput,
): Promise<EngagementResponse> {
  return request<EngagementResponse>("/contact", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

// Resend the most recent order's download links to an email. NON-ENUMERATING:
// the API always returns the same generic message regardless of whether the
// email has purchases, so the UI must show that message verbatim. No auth.
export async function resendDownloads(
  email: string,
): Promise<ResendDownloadsResponse> {
  return request<ResendDownloadsResponse>("/orders/resend-downloads", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}
