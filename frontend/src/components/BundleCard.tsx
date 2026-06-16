"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { Product } from "@/lib/types";
import { formatMoney } from "@/lib/format";
import { useCart } from "@/context/CartContext";
import { track } from "@/lib/analytics";
import { BundleMosaic } from "./BundleMosaic";
import { CountUp } from "./CountUp";

export function BundleCard({ bundle }: { bundle: Product }) {
  const reduced = useReducedMotion() ?? false;
  const { addItem } = useCart();
  // Local pending so this button doesn't flicker when other Buy buttons (which
  // share the cart's global `loading`) are clicked elsewhere on the page.
  const [adding, setAdding] = useState(false);
  const variant = bundle.variants[0];

  const price = bundle.priceRange.min;
  const priceAmount = Number.parseFloat(price.amount);
  const compareAmount = bundle.compareAtPrice
    ? Number.parseFloat(bundle.compareAtPrice.amount)
    : null;
  const hasDiscount =
    compareAmount !== null &&
    !Number.isNaN(compareAmount) &&
    compareAmount > priceAmount;
  const saveAmount = hasDiscount ? compareAmount - priceAmount : 0;
  const savePercent = hasDiscount
    ? Math.round((saveAmount / compareAmount) * 100)
    : 0;

  return (
    <motion.div
      // Quick, one-directional slide-in (no scale, no spring bounce) so the
      // card — and the button inside it — settles instantly and stably instead
      // of wobbling on entrance.
      initial={reduced ? false : { opacity: 0, x: -28 }}
      whileInView={reduced ? undefined : { opacity: 1, x: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="overflow-hidden rounded-[28px] bg-white shadow-lift ring-1 ring-emerald-500/10"
    >
      <div className="grid items-stretch gap-0 md:grid-cols-2">
        <div className="relative bg-cloud">
          <BundleMosaic />
          <div className="pointer-events-none absolute bottom-4 left-4 flex items-baseline gap-1.5 rounded-full bg-white/85 px-4 py-2 shadow-lift ring-1 ring-black/5 backdrop-blur">
            <CountUp
              to={55}
              className="font-display text-2xl font-bold leading-none text-graphite"
            />
            <span className="text-xs font-semibold uppercase tracking-wide text-slate2">
              looks
            </span>
          </div>
        </div>

        <div className="flex flex-col justify-center gap-5 p-8 sm:p-10">
          <div className="flex items-center gap-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#c1581f]">
              Best value
            </p>
            {hasDiscount && (
              <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-600">
                Save {savePercent}%
              </span>
            )}
          </div>

          <h3 className="font-display text-3xl font-bold leading-tight tracking-tight text-graphite sm:text-4xl">
            {bundle.title}
          </h3>
          <p className="leading-relaxed text-slate2">
            {bundle.bestFor && (
              <span className="font-semibold text-graphite">
                Best for {bundle.bestFor}.{" "}
              </span>
            )}
            {bundle.description}
          </p>

          <div className="flex items-baseline gap-3">
            {hasDiscount && (
              <span className="font-display text-xl font-medium text-slate2 line-through decoration-slate2/40 decoration-2">
                {formatMoney(bundle.compareAtPrice!)}
              </span>
            )}
            <span className="font-display text-4xl font-bold text-graphite">
              {formatMoney(price)}
            </span>
            {hasDiscount && (
              <span className="text-sm font-semibold text-emerald-600">
                Save{" "}
                {formatMoney({
                  amount: saveAmount.toFixed(2),
                  currencyCode: price.currencyCode,
                })}
              </span>
            )}
          </div>

          {variant && (
            <button
              type="button"
              onClick={async () => {
                if (adding) return;
                track("add_to_cart", { handle: bundle.handle });
                setAdding(true);
                try {
                  await addItem(variant.id, 1);
                } finally {
                  setAdding(false);
                }
              }}
              disabled={adding || !variant.availableForSale}
              className="btn-grade mt-1 w-fit px-7 py-3 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {adding ? "Adding…" : "Get the bundle"}
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
