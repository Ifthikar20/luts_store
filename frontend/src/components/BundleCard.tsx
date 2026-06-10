"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { Product } from "@/lib/types";
import { formatMoney } from "@/lib/format";
import { useCart } from "@/context/CartContext";
import { track } from "@/lib/analytics";
import { BundleMosaic } from "./BundleMosaic";

export function BundleCard({ bundle }: { bundle: Product }) {
  const reduced = useReducedMotion() ?? false;
  const { addItem, loading } = useCart();
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
      initial={reduced ? false : { opacity: 0, scale: 0.85, y: 28 }}
      whileInView={reduced ? undefined : { opacity: 1, scale: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ type: "spring", stiffness: 220, damping: 17 }}
      className="overflow-hidden rounded-[28px] bg-white shadow-lift ring-1 ring-emerald-500/10"
    >
      <div className="grid items-stretch gap-0 md:grid-cols-2">
        <div className="relative bg-cloud">
          <BundleMosaic />
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
          <p className="leading-relaxed text-slate2">{bundle.description}</p>

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
              onClick={() => {
                track("add_to_cart", { handle: bundle.handle });
                void addItem(variant.id, 1);
              }}
              disabled={loading || !variant.availableForSale}
              className="btn-grade mt-1 w-fit px-7 py-3 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Adding…" : "Get the bundle"}
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
