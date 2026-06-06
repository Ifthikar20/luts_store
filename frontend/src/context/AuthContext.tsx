"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  getSession,
  mockCompleteLogin,
  shopifyLogin,
  shopifyLogout,
} from "@/lib/api";
import type { Customer, ShopifyLoginResponse } from "@/lib/types";

// Session-based auth for the OPTIONAL Shopify Customer Accounts portal.
//
// This context holds NO token. The logged-in state lives in a server-side
// Django session (httpOnly cookie); we hydrate it on mount via /api/auth/session
// and mutate it through the BFF endpoints. Guest checkout and the login-free
// downloads do not depend on any of this.
interface AuthContextValue {
  customer: Customer | null;
  authenticated: boolean;
  // True while we hydrate the session from the cookie on first load.
  loading: boolean;
  // Begin login. REAL mode redirects the browser to hosted Shopify login;
  // MOCK mode returns {mode:"mock"} so the caller can show the demo email step.
  login: (returnTo?: string) => Promise<ShopifyLoginResponse>;
  // MOCK-only: complete the demo sign-in for an email and refresh the session.
  completeMockLogin: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  // Re-read /api/auth/session (e.g. after returning from the OAuth redirect).
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const session = await getSession();
      setCustomer(session.authenticated ? session.customer : null);
    } catch {
      // Network/backend hiccup -> treat as logged out (non-fatal).
      setCustomer(null);
    }
  }, []);

  // Hydrate the session from the httpOnly cookie on mount.
  useEffect(() => {
    let active = true;
    (async () => {
      await refresh();
      if (active) setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [refresh]);

  // Start the login flow. In REAL (shopify) mode we hand off the browser to the
  // hosted Shopify login page; in MOCK mode we return the response so the caller
  // can show the demo email step. The returned value lets the login page branch.
  const login = useCallback(
    async (returnTo = "/account"): Promise<ShopifyLoginResponse> => {
      const res = await shopifyLogin(returnTo);
      if (res.mode === "shopify" && res.authorizeUrl) {
        window.location.assign(res.authorizeUrl);
      }
      return res;
    },
    [],
  );

  const completeMockLogin = useCallback(
    async (email: string) => {
      const res = await mockCompleteLogin(email);
      setCustomer(res.customer);
    },
    [],
  );

  const logout = useCallback(async () => {
    await shopifyLogout();
    setCustomer(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      customer,
      authenticated: customer !== null,
      loading,
      login,
      completeMockLogin,
      logout,
      refresh,
    }),
    [customer, loading, login, completeMockLogin, logout, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
