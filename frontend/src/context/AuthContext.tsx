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
import { getSession, logout as apiLogout, socialLogin } from "@/lib/api";
import type { Customer, SocialProvider } from "@/lib/types";

// Auth is owned by the Django backend: signing in (Google redirect flow, Apple,
// or the dev mock) establishes an httpOnly SESSION cookie server-side. This
// context is pure UI state — on mount we hydrate via GET /api/auth/session.
interface AuthContextValue {
  customer: Customer | null;
  authenticated: boolean;
  loading: boolean;
  // Sign in with a verified provider credential (Google ID token / Apple
  // identity token; in dev a "mock:<email>" token).
  signIn: (provider: SocialProvider, credential: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const session = await getSession();
      setCustomer(session.customer ? { email: session.customer.email } : null);
    } catch {
      setCustomer(null);
    }
  }, []);

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

  const signIn = useCallback(
    async (provider: SocialProvider, credential: string) => {
      const user = await socialLogin(provider, credential);
      setCustomer({ email: user.email });
    },
    [],
  );

  const logout = useCallback(async () => {
    await apiLogout();
    setCustomer(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      customer,
      authenticated: customer !== null,
      loading,
      signIn,
      logout,
      refresh,
    }),
    [customer, loading, signIn, logout, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
