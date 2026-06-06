"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Loader2, Lock, ShieldCheck } from "lucide-react";
import { completeCheckout, getCart } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import type { Cart } from "@/lib/types";
import { Reveal } from "@/components/motion/Reveal";
import { MagneticButton } from "@/components/motion/MagneticButton";

// Lightweight email check — the API is authoritative, this is just UX.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function CheckoutContent() {
  const router = useRouter();
  const params = useSearchParams();
  const cartId = params.get("cart");

  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [touched, setTouched] = useState(false);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!cartId) {
      setError("No cart reference was provided.");
      setLoading(false);
      return;
    }
    let active = true;
    (async () => {
      const data = await getCart(cartId);
      if (!active) return;
      setCart(data);
      if (!data) setError("We couldn't find that cart.");
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [cartId]);

  const emailValid = EMAIL_RE.test(email.trim());

  async function pay() {
    if (!cartId || !emailValid || paying) {
      setTouched(true);
      return;
    }
    setPaying(true);
    setError(null);
    try {
      const { orderId } = await completeCheckout(cartId, email.trim());
      router.push(`/thank-you?order=${encodeURIComponent(orderId)}`);
    } catch {
      setError("Payment couldn't be completed. Please try again.");
      setPaying(false);
    }
  }

  if (loading) {
    return (
      <div className="container-xl grid min-h-[60vh] place-items-center pt-36">
        <Loader2 className="h-6 w-6 animate-spin text-white/40" />
      </div>
    );
  }

  if (error && !cart) {
    return (
      <div className="container-xl pt-36 pb-28 sm:pt-44">
        <Reveal className="mx-auto max-w-md">
          <div className="glass flex flex-col items-center gap-5 rounded-3xl px-8 py-16 text-center">
            <p className="text-lg text-white/60">{error}</p>
            <Link href="/cart" className="btn-grade">
              Back to cart
            </Link>
          </div>
        </Reveal>
      </div>
    );
  }

  const lines = cart?.lines ?? [];

  return (
    <div className="container-xl pt-36 pb-28 sm:pt-44">
      <Reveal>
        <Link
          href="/cart"
          className="mb-6 inline-flex items-center gap-2 text-sm text-white/55 transition-colors hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" /> Back to cart
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-display text-4xl font-bold tracking-tight text-white sm:text-5xl">
            Checkout
          </h1>
          <span className="rounded-full border border-orange-grade/40 bg-orange-grade/10 px-3 py-1 text-xs font-semibold text-orange-grade">
            Demo checkout
          </span>
        </div>
        <p className="mt-3 max-w-xl text-white/55">
          This is a demonstration checkout — no real payment is taken. Enter an
          email to receive your download links. No account required.
        </p>
      </Reveal>

      <div className="mt-12 grid gap-10 lg:grid-cols-[1fr_1fr]">
        {/* Guest details + pay */}
        <Reveal>
          <div className="glass rounded-3xl p-6 sm:p-8">
            <h2 className="font-display text-lg font-semibold text-white">
              Your details
            </h2>
            <label
              htmlFor="checkout-email"
              className="mt-5 block text-sm text-white/55"
            >
              Email for your downloads
            </label>
            <input
              id="checkout-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => setTouched(true)}
              placeholder="you@example.com"
              aria-invalid={touched && !emailValid}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder:text-white/40 backdrop-blur-xl transition-colors focus:border-white/25 focus:bg-white/[0.06] focus:outline-none"
            />
            {touched && !emailValid && (
              <p className="mt-2 text-sm text-red-300/90" role="alert">
                Enter a valid email address.
              </p>
            )}

            <div className="mt-7">
              <MagneticButton
                variant="grade"
                onClick={pay}
                className="w-full justify-center"
              >
                {paying ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Processing…
                  </>
                ) : (
                  <>
                    <Lock className="h-4 w-4" />
                    Pay {cart && formatMoney(cart.cost.total)}
                  </>
                )}
              </MagneticButton>
            </div>

            {error && (
              <p className="mt-3 text-center text-sm text-red-300/90" role="alert">
                {error}
              </p>
            )}

            <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-xs text-white/35">
              <ShieldCheck className="h-3.5 w-3.5" />
              Login-free — your download links work straight away.
            </p>
          </div>
        </Reveal>

        {/* Order summary */}
        <Reveal direction="left">
          <div className="glass rounded-3xl p-6 sm:p-8">
            <h2 className="font-display text-lg font-semibold text-white">
              Order summary
            </h2>
            <ul className="mt-5 space-y-4">
              {lines.map((line) => (
                <li key={line.id} className="flex items-center gap-4">
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl">
                    <Image
                      src={line.merchandise.product.featuredImage.url}
                      alt={line.merchandise.product.featuredImage.altText}
                      fill
                      sizes="64px"
                      className="object-cover"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-white">
                      {line.merchandise.product.title}
                    </p>
                    <p className="text-sm text-white/45">×{line.quantity}</p>
                  </div>
                  <p className="shrink-0 font-display font-semibold text-white">
                    {formatMoney(line.merchandise.price)}
                  </p>
                </li>
              ))}
            </ul>

            <dl className="mt-6 space-y-3 border-t border-white/10 pt-5 text-sm">
              <div className="flex justify-between text-white/55">
                <dt>Subtotal</dt>
                <dd>{cart && formatMoney(cart.cost.subtotal)}</dd>
              </div>
              <div className="flex justify-between text-base font-semibold text-white">
                <dt>Total</dt>
                <dd>{cart && formatMoney(cart.cost.total)}</dd>
              </div>
            </dl>
          </div>
        </Reveal>
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense
      fallback={
        <div className="container-xl grid min-h-[60vh] place-items-center pt-36">
          <Loader2 className="h-6 w-6 animate-spin text-white/40" />
        </div>
      }
    >
      <CheckoutContent />
    </Suspense>
  );
}
