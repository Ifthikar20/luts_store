"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Lock, Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { createCheckout } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import { Reveal } from "@/components/motion/Reveal";

export default function CartPage() {
  const router = useRouter();
  const { cart, updateItem, removeItem, loading } = useCart();
  const [redirecting, setRedirecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lines = cart?.lines ?? [];

  // Checkout: the BFF decides the mode and owns the authoritative checkout.
  // - "stripe"/"shopify": full-page redirect to the hosted checkout (absolute URL).
  // - "mock":             in-app demo checkout ("/checkout?cart=...") via the router.
  // We never compute prices or build a checkout on the client.
  async function checkout() {
    if (!cart?.id || redirecting) return;
    setRedirecting(true);
    setError(null);
    try {
      const { mode, checkoutUrl } = await createCheckout(cart.id);
      if (mode === "mock") {
        router.push(checkoutUrl);
      } else {
        window.location.assign(checkoutUrl);
      }
    } catch {
      setError("We couldn't start checkout just now. Please try again.");
      setRedirecting(false);
    }
  }

  return (
    <div className="container-xl pt-36 pb-28 sm:pt-44">
      <Reveal>
        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-2 text-sm text-slate2 transition-colors hover:text-graphite"
        >
          <ArrowLeft className="h-4 w-4" /> Continue shopping
        </Link>
        <h1 className="font-display text-4xl font-bold tracking-tightest text-graphite sm:text-5xl">
          Your cart
        </h1>
      </Reveal>

      {lines.length === 0 ? (
        <div className="glass mt-12 flex flex-col items-center justify-center gap-5 rounded-3xl px-8 py-20 text-center">
          <span className="grid h-16 w-16 place-items-center rounded-full border border-hairline bg-cloud">
            <ShoppingBag className="h-7 w-7 text-slate2" />
          </span>
          <p className="text-lg text-slate2">Your cart is empty.</p>
          <Link href="/collections/cinematic" className="btn-grade">
            Browse the looks
          </Link>
        </div>
      ) : (
        <div className="mt-12 grid gap-10 lg:grid-cols-[1.6fr_1fr]">
          {/* Line items */}
          <ul className="space-y-4">
            {lines.map((line) => (
              <li
                key={line.id}
                className="glass flex gap-5 rounded-3xl p-4 sm:p-5"
              >
                <Link
                  href={`/luts/${line.merchandise.product.handle}`}
                  className="relative h-28 w-28 shrink-0 overflow-hidden rounded-2xl sm:h-32 sm:w-32"
                >
                  <Image
                    src={line.merchandise.product.featuredImage.url}
                    alt={line.merchandise.product.featuredImage.altText}
                    fill
                    sizes="128px"
                    className="object-cover"
                  />
                </Link>
                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <Link
                        href={`/luts/${line.merchandise.product.handle}`}
                        className="font-display text-lg font-semibold text-graphite hover:text-sky"
                      >
                        {line.merchandise.product.title}
                      </Link>
                      <p className="text-sm text-slate2">
                        {line.merchandise.title}
                      </p>
                    </div>
                    <p className="shrink-0 font-display text-lg font-semibold text-graphite">
                      {formatMoney(line.merchandise.price)}
                    </p>
                  </div>

                  <div className="mt-auto flex items-center justify-between pt-4">
                    <div className="flex items-center gap-1 rounded-full border border-hairline p-1">
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => updateItem(line.id, line.quantity - 1)}
                        className="grid h-8 w-8 place-items-center rounded-full text-slate2 hover:bg-cloud disabled:opacity-40"
                        aria-label="Decrease quantity"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <span className="min-w-7 text-center text-sm text-graphite">
                        {line.quantity}
                      </span>
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => updateItem(line.id, line.quantity + 1)}
                        className="grid h-8 w-8 place-items-center rounded-full text-slate2 hover:bg-cloud disabled:opacity-40"
                        aria-label="Increase quantity"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => removeItem(line.id)}
                      className="inline-flex items-center gap-2 text-sm text-slate2 transition-colors hover:text-graphite"
                    >
                      <Trash2 className="h-4 w-4" /> Remove
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          {/* Summary */}
          <div className="lg:sticky lg:top-28 lg:self-start">
            <div className="glass rounded-3xl p-6">
              <h2 className="font-display text-lg font-semibold text-graphite">
                Order summary
              </h2>
              <dl className="mt-5 space-y-3 text-sm">
                <div className="flex justify-between text-slate2">
                  <dt>Subtotal</dt>
                  <dd>{cart && formatMoney(cart.cost.subtotal)}</dd>
                </div>
                <div className="flex justify-between text-slate2">
                  <dt>Taxes</dt>
                  <dd>Calculated at checkout</dd>
                </div>
                <div className="my-3 h-px bg-hairline" />
                <div className="flex justify-between text-base font-semibold text-graphite">
                  <dt>Total</dt>
                  <dd>{cart && formatMoney(cart.cost.total)}</dd>
                </div>
              </dl>

              <button
                type="button"
                onClick={checkout}
                disabled={redirecting || loading}
                className="btn-grade mt-6 w-full disabled:opacity-60"
              >
                <Lock className="h-4 w-4" />
                {redirecting ? "Starting checkout…" : "Proceed to checkout"}
              </button>
              {error && (
                <p className="mt-3 text-center text-sm text-red-600" role="alert">
                  {error}
                </p>
              )}
              <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-xs text-slate2">
                <Lock className="h-3 w-3" />
                Secure checkout. Prices confirmed server-side. No account needed.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
