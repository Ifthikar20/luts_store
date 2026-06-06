"use client";

import Image from "next/image";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { Layers, Plus } from "lucide-react";
import type { Product } from "@/lib/types";
import { priceLabel } from "@/lib/format";
import { useCart } from "@/context/CartContext";

export function ProductCard({ product }: { product: Product }) {
  const reduced = useReducedMotion() ?? false;
  const { addItem, loading } = useCart();
  const variant = product.variants[0];

  async function onAdd(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (variant) await addItem(variant.id, 1);
  }

  return (
    <motion.article
      whileHover={reduced ? undefined : { y: -8 }}
      transition={{ type: "spring", stiffness: 300, damping: 24 }}
      className="group relative h-full"
    >
      <Link
        href={`/luts/${product.handle}`}
        className="glass glass-hover flex h-full flex-col overflow-hidden rounded-3xl"
      >
        {/* glow on hover */}
        <div
          aria-hidden
          className="pointer-events-none absolute -inset-px rounded-3xl opacity-0 transition-opacity duration-500 group-hover:opacity-100"
          style={{
            background:
              "radial-gradient(420px circle at 50% 0%, rgba(22,216,198,0.18), transparent 70%)",
          }}
        />
        <div className="relative aspect-[4/3] overflow-hidden">
          <Image
            src={product.featuredImage.url}
            alt={product.featuredImage.altText}
            fill
            sizes="(max-width: 768px) 100vw, 33vw"
            className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.06]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/10 to-transparent" />
          {product.featured && (
            <span className="absolute left-4 top-4 rounded-full bg-grade-teal-orange px-3 py-1 text-xs font-semibold text-ink">
              Featured
            </span>
          )}
          <span className="absolute right-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-ink/70 px-3 py-1 text-xs font-medium text-white/90 backdrop-blur">
            <Layers className="h-3.5 w-3.5" />
            {product.metafields.lutCount} LUTs
          </span>
        </div>

        <div className="relative flex flex-1 flex-col gap-3 p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-widest text-white/40">
                {product.productType}
              </p>
              <h3 className="mt-1 font-display text-lg font-semibold leading-snug text-white">
                {product.title}
              </h3>
            </div>
            <p className="shrink-0 font-display text-lg font-semibold text-grade-teal">
              {priceLabel(product.priceRange.min, product.priceRange.max)}
            </p>
          </div>

          <p className="line-clamp-2 text-sm text-white/55">
            {product.description}
          </p>

          <div className="mt-auto flex flex-wrap gap-1.5 pt-2">
            {product.metafields.formats.map((f) => (
              <span
                key={f}
                className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[11px] font-medium text-white/60"
              >
                {f}
              </span>
            ))}
          </div>

          <button
            type="button"
            onClick={onAdd}
            disabled={loading || !variant?.availableForSale}
            className="mt-1 inline-flex items-center justify-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/[0.1] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            Add to cart
          </button>
        </div>
      </Link>
    </motion.article>
  );
}
