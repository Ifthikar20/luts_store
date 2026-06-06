"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  addCartLine,
  createCart,
  getCart,
  removeCartLine,
  updateCartLine,
} from "@/lib/api";
import type { Cart } from "@/lib/types";

const STORAGE_KEY = "looks-lab:cartId";

interface CartContextValue {
  cart: Cart | null;
  count: number;
  loading: boolean;
  isOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  toggleCart: () => void;
  addItem: (merchandiseId: string, quantity?: number) => Promise<void>;
  updateItem: (lineId: string, quantity: number) => Promise<void>;
  removeItem: (lineId: string) => Promise<void>;
}

const CartContext = createContext<CartContextValue | null>(null);

// We only persist the cart ID in localStorage — never line/price data, which is
// always re-fetched from the authoritative API.
function readStoredId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}
function writeStoredId(id: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (id) window.localStorage.setItem(STORAGE_KEY, id);
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* storage may be unavailable (private mode) — non-fatal */
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const cartIdRef = useRef<string | null>(null);

  // Rehydrate the cart from a persisted ID on mount.
  useEffect(() => {
    const id = readStoredId();
    if (!id) return;
    cartIdRef.current = id;
    let active = true;
    (async () => {
      setLoading(true);
      const existing = await getCart(id);
      if (active && existing) setCart(existing);
      else if (active) {
        // stale/invalid id — clear it
        writeStoredId(null);
        cartIdRef.current = null;
      }
      if (active) setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  const ensureCart = useCallback(async (): Promise<string> => {
    if (cartIdRef.current) return cartIdRef.current;
    const fresh = await createCart();
    cartIdRef.current = fresh.id;
    writeStoredId(fresh.id);
    setCart(fresh);
    return fresh.id;
  }, []);

  const addItem = useCallback(
    async (merchandiseId: string, quantity = 1) => {
      setLoading(true);
      try {
        const id = await ensureCart();
        const next = await addCartLine(id, { merchandiseId, quantity });
        setCart(next);
        setIsOpen(true);
      } finally {
        setLoading(false);
      }
    },
    [ensureCart],
  );

  const updateItem = useCallback(async (lineId: string, quantity: number) => {
    if (!cartIdRef.current) return;
    setLoading(true);
    try {
      const next =
        quantity <= 0
          ? await removeCartLine(cartIdRef.current, lineId)
          : await updateCartLine(cartIdRef.current, lineId, quantity);
      setCart(next);
    } finally {
      setLoading(false);
    }
  }, []);

  const removeItem = useCallback(async (lineId: string) => {
    if (!cartIdRef.current) return;
    setLoading(true);
    try {
      const next = await removeCartLine(cartIdRef.current, lineId);
      setCart(next);
    } finally {
      setLoading(false);
    }
  }, []);

  const value = useMemo<CartContextValue>(
    () => ({
      cart,
      count: cart?.totalQuantity ?? 0,
      loading,
      isOpen,
      openCart: () => setIsOpen(true),
      closeCart: () => setIsOpen(false),
      toggleCart: () => setIsOpen((o) => !o),
      addItem,
      updateItem,
      removeItem,
    }),
    [cart, loading, isOpen, addItem, updateItem, removeItem],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within <CartProvider>");
  return ctx;
}
