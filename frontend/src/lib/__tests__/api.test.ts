import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { decodeEnvelope } from "../obfuscate";
import {
  API_URL,
  completeCheckout,
  createCheckout,
  getAuthToken,
  getMyDownloads,
  getProducts,
  getSession,
  login,
  mockCompleteLogin,
  resendDownloads,
  setAuthToken,
  shopifyLogin,
  shopifyLogout,
  subscribeNewsletter,
} from "@/lib/api";

// A minimal ok-Response stub. fetch is mocked so no network is ever touched.
function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

// Pull the URL string out of the most recent fetch call.
function lastFetchUrl(spy: ReturnType<typeof vi.fn>): string {
  const call = spy.mock.calls.at(-1);
  return String(call?.[0]);
}

function lastFetchInit(spy: ReturnType<typeof vi.fn>): RequestInit {
  const call = spy.mock.calls.at(-1);
  return (call?.[1] ?? {}) as RequestInit;
}

// Request bodies are sent through the obfuscation envelope; decode before
// asserting on the original payload.
function decodeBody(body: BodyInit | null | undefined): unknown {
  return JSON.parse(decodeEnvelope(String(body)));
}

let fetchSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  // Reset the in-memory auth token between tests.
  setAuthToken(null);
  fetchSpy = vi.fn();
  vi.stubGlobal("fetch", fetchSpy);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("getProducts querystring construction", () => {
  it("omits empty/default params for a clean URL", async () => {
    fetchSpy.mockResolvedValue(jsonResponse({ products: [] }));
    await getProducts();
    expect(lastFetchUrl(fetchSpy)).toBe(`${API_URL}/products`);
  });

  it("serializes every supported filter and joins tags with commas", async () => {
    fetchSpy.mockResolvedValue(jsonResponse({ products: [] }));
    await getProducts({
      collection: "cinematic",
      featured: true,
      search: "teal",
      sort: "price-asc",
      minPrice: 10,
      maxPrice: 99,
      tags: ["warm", "moody"],
    });
    const url = new URL(lastFetchUrl(fetchSpy));
    expect(url.pathname).toBe("/api/products");
    expect(url.searchParams.get("collection")).toBe("cinematic");
    expect(url.searchParams.get("featured")).toBe("true");
    expect(url.searchParams.get("search")).toBe("teal");
    expect(url.searchParams.get("sort")).toBe("price-asc");
    expect(url.searchParams.get("minPrice")).toBe("10");
    expect(url.searchParams.get("maxPrice")).toBe("99");
    expect(url.searchParams.get("tags")).toBe("warm,moody");
  });

  it("omits the default 'featured' sort key", async () => {
    fetchSpy.mockResolvedValue(jsonResponse({ products: [] }));
    await getProducts({ sort: "featured" });
    expect(lastFetchUrl(fetchSpy)).toBe(`${API_URL}/products`);
  });

  it("returns the products array from the response envelope", async () => {
    const products = [{ id: "gid://1", title: "Teal & Orange" }];
    fetchSpy.mockResolvedValue(jsonResponse({ products }));
    await expect(getProducts()).resolves.toEqual(products);
  });
});

describe("auth token storage + header injection", () => {
  it("persists the token to localStorage and reads it back", () => {
    setAuthToken("abc123");
    expect(getAuthToken()).toBe("abc123");
    expect(window.localStorage.getItem("looks-lab:authToken")).toBe("abc123");

    setAuthToken(null);
    expect(getAuthToken()).toBeNull();
    expect(window.localStorage.getItem("looks-lab:authToken")).toBeNull();
  });

  it("login stores the returned token", async () => {
    fetchSpy.mockResolvedValue(
      jsonResponse({ token: "tok-xyz", user: { id: 1, email: "a@b.com" } }),
    );
    const res = await login("a@b.com", "pw");
    expect(res.token).toBe("tok-xyz");
    expect(getAuthToken()).toBe("tok-xyz");

    const init = lastFetchInit(fetchSpy);
    expect(init.method).toBe("POST");
    expect(decodeBody(init.body)).toEqual({
      email: "a@b.com",
      password: "pw",
    });
  });

  it("injects the Authorization header on authed requests", async () => {
    setAuthToken("tok-secret");
    fetchSpy.mockResolvedValue(jsonResponse([]));
    await getMyDownloads();
    const headers = lastFetchInit(fetchSpy).headers as Record<string, string>;
    expect(headers.Authorization).toBe("Token tok-secret");
    expect(lastFetchUrl(fetchSpy)).toBe(`${API_URL}/me/downloads`);
  });

  it("omits the Authorization header when there is no token", async () => {
    fetchSpy.mockResolvedValue(jsonResponse([]));
    await getMyDownloads();
    const headers = lastFetchInit(fetchSpy).headers as Record<string, string>;
    expect(headers.Authorization).toBeUndefined();
  });
});

describe("checkout endpoints (guest, login-free)", () => {
  it("createCheckout POSTs {cartId} to /checkout and returns {mode,checkoutUrl}", async () => {
    fetchSpy.mockResolvedValue(
      jsonResponse({ mode: "mock", checkoutUrl: "/checkout?cart=c1" }),
    );
    const res = await createCheckout("c1");
    expect(res).toEqual({ mode: "mock", checkoutUrl: "/checkout?cart=c1" });
    expect(lastFetchUrl(fetchSpy)).toBe(`${API_URL}/checkout`);
    const init = lastFetchInit(fetchSpy);
    expect(init.method).toBe("POST");
    expect(decodeBody(init.body)).toEqual({ cartId: "c1" });
  });

  it("createCheckout includes the email only when provided", async () => {
    fetchSpy.mockResolvedValue(
      jsonResponse({ mode: "shopify", checkoutUrl: "https://shop/checkout" }),
    );
    await createCheckout("c1", "guest@example.com");
    expect(decodeBody(lastFetchInit(fetchSpy).body)).toEqual({
      cartId: "c1",
      email: "guest@example.com",
    });
  });

  it("completeCheckout POSTs {cartId,email} to /checkout/complete -> {orderId}", async () => {
    fetchSpy.mockResolvedValue(jsonResponse({ orderId: "ord_123" }));
    const res = await completeCheckout("c1", "guest@example.com");
    expect(res).toEqual({ orderId: "ord_123" });
    expect(lastFetchUrl(fetchSpy)).toBe(`${API_URL}/checkout/complete`);
    const init = lastFetchInit(fetchSpy);
    expect(init.method).toBe("POST");
    expect(decodeBody(init.body)).toEqual({
      cartId: "c1",
      email: "guest@example.com",
    });
  });

  it("createCheckout surfaces API errors (no mock fallback)", async () => {
    fetchSpy.mockResolvedValue(
      jsonResponse({ detail: "Cart is empty." }, 400),
    );
    await expect(createCheckout("c1")).rejects.toThrow("Cart is empty.");
  });
});

describe("Shopify Customer Accounts portal (session-based, credentials:include)", () => {
  it("shopifyLogin GETs /auth/shopify/login with returnTo and sends cookies", async () => {
    fetchSpy.mockResolvedValue(
      jsonResponse({ mode: "shopify", authorizeUrl: "https://shopify.com/x" }),
    );
    const res = await shopifyLogin("/account");
    expect(res).toEqual({
      mode: "shopify",
      authorizeUrl: "https://shopify.com/x",
    });
    const url = new URL(lastFetchUrl(fetchSpy));
    expect(url.pathname).toBe("/api/auth/shopify/login");
    expect(url.searchParams.get("returnTo")).toBe("/account");
    expect(lastFetchInit(fetchSpy).credentials).toBe("include");
  });

  it("getSession GETs /auth/session with credentials include", async () => {
    fetchSpy.mockResolvedValue(
      jsonResponse({ authenticated: true, customer: { email: "a@b.com" } }),
    );
    const res = await getSession();
    expect(res.authenticated).toBe(true);
    expect(res.customer).toEqual({ email: "a@b.com" });
    expect(lastFetchUrl(fetchSpy)).toBe(`${API_URL}/auth/session`);
    expect(lastFetchInit(fetchSpy).credentials).toBe("include");
  });

  it("mockCompleteLogin POSTs the email to /auth/shopify/mock-complete with cookies", async () => {
    fetchSpy.mockResolvedValue(
      jsonResponse({ customer: { email: "demo@example.com" } }),
    );
    const res = await mockCompleteLogin("demo@example.com");
    expect(res.customer.email).toBe("demo@example.com");
    expect(lastFetchUrl(fetchSpy)).toBe(`${API_URL}/auth/shopify/mock-complete`);
    const init = lastFetchInit(fetchSpy);
    expect(init.method).toBe("POST");
    expect(init.credentials).toBe("include");
    expect(decodeBody(init.body)).toEqual({ email: "demo@example.com" });
  });

  it("shopifyLogout POSTs /auth/shopify/logout with credentials include", async () => {
    fetchSpy.mockResolvedValue(jsonResponse({ ok: true }));
    await shopifyLogout();
    expect(lastFetchUrl(fetchSpy)).toBe(`${API_URL}/auth/shopify/logout`);
    const init = lastFetchInit(fetchSpy);
    expect(init.method).toBe("POST");
    expect(init.credentials).toBe("include");
  });

  it("getMyDownloads sends the session cookie (credentials include)", async () => {
    fetchSpy.mockResolvedValue(jsonResponse([]));
    await getMyDownloads();
    expect(lastFetchInit(fetchSpy).credentials).toBe("include");
  });
});

describe("engagement endpoints hit the right paths", () => {
  it("subscribeNewsletter POSTs to /newsletter with the email", async () => {
    fetchSpy.mockResolvedValue(jsonResponse({ status: "ok", detail: "Thanks" }));
    await subscribeNewsletter("fan@example.com");
    expect(lastFetchUrl(fetchSpy)).toBe(`${API_URL}/newsletter`);
    const init = lastFetchInit(fetchSpy);
    expect(init.method).toBe("POST");
    expect(decodeBody(init.body)).toEqual({ email: "fan@example.com" });
  });

  it("resendDownloads POSTs to /orders/resend-downloads with the email", async () => {
    fetchSpy.mockResolvedValue(jsonResponse({ status: "ok", detail: "Sent" }));
    await resendDownloads("buyer@example.com");
    expect(lastFetchUrl(fetchSpy)).toBe(`${API_URL}/orders/resend-downloads`);
    const init = lastFetchInit(fetchSpy);
    expect(init.method).toBe("POST");
    expect(decodeBody(init.body)).toEqual({
      email: "buyer@example.com",
    });
  });
});
