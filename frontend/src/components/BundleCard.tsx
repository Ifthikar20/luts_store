"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Check, Sparkles } from "lucide-react";
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

  const perks = [
    `${bundle.metafields.lutCount} hand-built looks`,
    `Drag-and-drop ${bundle.metafields.formats.join(" / ")} — no plugins`,
    `Works in ${bundle.metafields.compatibleApps.slice(0, 3).join(", ")}${
      bundle.metafields.compatibleApps.length > 3 ? " + more" : ""
    }`,
    "One-time purchase — yours forever",
  ];

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
          {/* Eyebrow — orange "Best value" (like Apple's NEW) + savings chip. */}
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
          <p className="text-slate2">{bundle.description}</p>

          <ul className="space-y-2.5">
            {perks.map((perk) => (
              <li key={perk} className="flex items-start gap-3 text-sm text-graphite">
                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-sky text-white">
                  <Check className="h-3 w-3" />
                </span>
                {perk}
              </li>
            ))}
          </ul>

          <div className="mt-2 flex flex-col gap-1">
            <div className="flex items-baseline gap-3">
              {hasDiscount && (
                <span className="font-display text-xl font-medium text-slate2 line-through decoration-slate2/40 decoration-2">
                  {formatMoney(bundle.compareAtPrice!)}
                </span>
              )}
              <span className="font-display text-4xl font-bold text-graphite">
                {formatMoney(price)}
              </span>
            </div>
            {hasDiscount && (
              <motion.span
                initial={reduced ? false : { scale: 0, rotate: -8 }}
                whileInView={reduced ? undefined : { scale: 1, rotate: -2 }}
                viewport={{ once: true, amount: 0.6 }}
                transition={{
                  type: "spring",
                  stiffness: 420,
                  damping: 12,
                  delay: 0.45,
                }}
                className="mt-1 inline-flex w-fit items-center gap-1.5 rounded-full bg-emerald-500 px-3.5 py-1.5 text-sm font-bold text-white shadow-[0_8px_22px_rgba(16,185,129,0.4)]"
              >
                <Sparkles className="h-4 w-4" />
                You&rsquo;re saving{" "}
                {formatMoney({
                  amount: saveAmount.toFixed(2),
                  currencyCode: price.currencyCode,
                })}
                !
              </motion.span>
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
