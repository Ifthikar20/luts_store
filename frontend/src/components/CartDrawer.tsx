"use client";

import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Minus, Plus, ShoppingBag, Trash2, X } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { formatMoney } from "@/lib/format";

export function CartDrawer() {
  const { cart, isOpen, closeCart, updateItem, removeItem, loading } = useCart();
  const lines = cart?.lines ?? [];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            key="overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeCart}
            className="fixed inset-0 z-[60] bg-black/30 backdrop-blur-sm"
          />
          <motion.aside
            key="drawer"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 34 }}
            className="fixed inset-y-0 right-0 z-[70] flex w-full max-w-md flex-col border-l border-hairline bg-white"
            role="dialog"
            aria-label="Shopping cart"
          >
            <div className="flex items-center justify-between border-b border-hairline px-6 py-5">
              <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-graphite">
                <ShoppingBag className="h-5 w-5" />
                Your cart
              </h2>
              <button
                type="button"
                onClick={closeCart}
                className="grid h-9 w-9 place-items-center rounded-full border border-hairline text-slate2 hover:bg-cloud"
                aria-label="Close cart"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              {lines.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
                  <span className="grid h-16 w-16 place-items-center rounded-full border border-hairline bg-cloud">
                    <ShoppingBag className="h-7 w-7 text-slate2" />
                  </span>
                  <p className="text-slate2">Your cart is empty.</p>
                  <button
                    type="button"
                    onClick={closeCart}
                    className="btn-ghost"
                  >
                    Keep browsing
                  </button>
                </div>
              ) : (
                <ul className="space-y-4">
                  {lines.map((line) => (
                    <li
                      key={line.id}
                      className="flex gap-4 rounded-2xl border border-hairline bg-white p-3"
                    >
                      <Link
                        href={`/luts/${line.merchandise.product.handle}`}
                        onClick={closeCart}
                        className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl"
                      >
                        <Image
                          src={line.merchandise.product.featuredImage.url}
                          alt={line.merchandise.product.featuredImage.altText}
                          fill
                          sizes="80px"
                          className="object-cover"
                        />
                      </Link>
                      <div className="flex min-w-0 flex-1 flex-col">
                        <p className="truncate font-medium text-graphite">
                          {line.merchandise.product.title}
                        </p>
                        <p className="text-xs text-slate2">
                          {line.merchandise.title}
                        </p>
                        <p className="mt-1 text-sm font-semibold text-graphite">
                          {formatMoney(line.merchandise.price)}
                        </p>
                        <div className="mt-auto flex items-center justify-between pt-2">
                          <div className="flex items-center gap-2 rounded-full border border-hairline">
                            <button
                              type="button"
                              disabled={loading}
                              onClick={() =>
                                updateItem(line.id, line.quantity - 1)
                              }
                              className="grid h-7 w-7 place-items-center rounded-full text-slate2 hover:bg-cloud disabled:opacity-40"
                              aria-label="Decrease quantity"
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </button>
                            <span className="min-w-5 text-center text-sm text-graphite">
                              {line.quantity}
                            </span>
                            <button
                              type="button"
                              disabled={loading}
                              onClick={() =>
                                updateItem(line.id, line.quantity + 1)
                              }
                              className="grid h-7 w-7 place-items-center rounded-full text-slate2 hover:bg-cloud disabled:opacity-40"
                              aria-label="Increase quantity"
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          <button
                            type="button"
                            disabled={loading}
                            onClick={() => removeItem(line.id)}
                            className="grid h-8 w-8 place-items-center rounded-full text-slate2 hover:bg-cloud hover:text-graphite"
                            aria-label="Remove item"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {lines.length > 0 && cart && (
              <div className="border-t border-hairline px-6 py-5">
                <div className="mb-1 flex justify-between text-sm text-slate2">
                  <span>Subtotal</span>
                  <span>{formatMoney(cart.cost.subtotal)}</span>
                </div>
                <div className="mb-4 flex justify-between text-base font-semibold text-graphite">
                  <span>Total</span>
                  <span>{formatMoney(cart.cost.total)}</span>
                </div>
                <Link
                  href="/cart"
                  onClick={closeCart}
                  className="btn-grade w-full"
                >
                  View cart & checkout
                </Link>
                <p className="mt-3 text-center text-xs text-slate2">
                  Taxes calculated at checkout.
                </p>
              </div>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
