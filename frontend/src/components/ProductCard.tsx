"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Layers } from "lucide-react";
import type { Product } from "@/lib/types";
import { formatMoney } from "@/lib/format";
import { useCart } from "@/context/CartContext";
import { track } from "@/lib/analytics";

export function ProductCard({
  product,
  previewSrc,
}: {
  product: Product;
  /** Optional muted looping clip previewed on hover (lazy, reduced-motion safe). */
  previewSrc?: string;
}) {
  const reduced = useReducedMotion() ?? false;
  const { addItem } = useCart();
  const variant = product.variants[0];
  const href = `/luts/${product.handle}`;
  const isRange =
    product.priceRange.min.amount !== product.priceRange.max.amount;
  const isFree = Number.parseFloat(product.priceRange.min.amount) === 0;

  // Lazy hover-preview video: src is only attached after the first hover, and
  // never under prefers-reduced-motion.
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hovering, setHovering] = useState(false);
  const [loadVideo, setLoadVideo] = useState(false);
  const showPreview = !!previewSrc && !reduced;

  useEffect(() => {
    if (showPreview && hovering && !loadVideo) setLoadVideo(true);
  }, [showPreview, hovering, loadVideo]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (showPreview && hovering) void v.play().catch(() => {});
    else v.pause();
  }, [showPreview, hovering, loadVideo]);

  // Local pending state so ONLY this card's button shows "Adding…" — the cart's
  // global `loading` would flip every Buy button on the page at once (flicker).
  const [adding, setAdding] = useState(false);
  async function onAdd() {
    if (!variant || adding) return;
    track("add_to_cart", { handle: product.handle });
    setAdding(true);
    try {
      await addItem(variant.id, 1);
    } finally {
      setAdding(false);
    }
  }

  return (
    <motion.div
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      transition={{ type: "spring", stiffness: 300, damping: 24 }}
      className="group flex h-full flex-col rounded-[22px] bg-white p-6 shadow-soft transition-shadow duration-300 hover:shadow-lift"
    >
      {/* Eyebrow — orange "Featured" like Apple's "NEW", else the product type. */}
      {product.featured ? (
        <p className="text-xs font-semibold uppercase tracking-wide text-[#c1581f]">
          Featured
        </p>
      ) : (
        <p className="text-xs font-semibold uppercase tracking-wide text-slate2">
          {product.productType}
        </p>
      )}

      <Link href={href} className="mt-1">
        <h3 className="font-display text-2xl font-bold leading-tight tracking-tight text-graphite">
          {product.title}
        </h3>
      </Link>

      <Link
        href={href}
        className="relative mt-5 block aspect-[4/3] overflow-hidden rounded-2xl bg-cloud"
      >
        <Image
          src={product.featuredImage.url}
          alt={product.featuredImage.altText}
          fill
          sizes="(max-width: 768px) 100vw, 33vw"
          className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
        />
        {showPreview && loadVideo && (
          <video
            ref={videoRef}
            muted
            loop
            playsInline
            preload="none"
            poster={product.featuredImage.url}
            aria-hidden
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${
              hovering ? "opacity-100" : "opacity-0"
            }`}
          >
            <source src={previewSrc} type="video/mp4" />
          </video>
        )}
        <span className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-graphite shadow-soft backdrop-blur">
          <Layers className="h-3.5 w-3.5" />
          {product.metafields.lutCount} LUTs
        </span>
      </Link>

      {/* Format chips — the LUT equivalent of Apple's colour swatches. */}
      <div className="mt-4 flex flex-wrap gap-1.5">
        {product.metafields.formats.map((f) => (
          <span
            key={f}
            className="rounded-md border border-hairline bg-cloud px-2 py-0.5 text-[11px] font-medium text-slate2"
          >
            {f}
          </span>
        ))}
      </div>

      {/* Apple-style caption: bold use-case lead + characteristics. */}
      <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-slate2">
        {product.bestFor && (
          <span className="font-semibold text-graphite">
            Best for {product.bestFor}.{" "}
          </span>
        )}
        {product.description}
      </p>

      <div className="mt-auto flex items-center justify-between gap-3 pt-6">
        <p className="text-sm text-slate2">
          {isFree ? (
            <span className="font-display text-lg font-semibold text-emerald-600">
              Free
            </span>
          ) : (
            <>
              {isRange && "From "}
              <span className="font-display text-lg font-semibold text-graphite">
                {formatMoney(product.priceRange.min)}
              </span>
            </>
          )}
        </p>
        {isFree ? (
          // Free items skip the cart/Stripe — claim by email on the detail page.
          <Link
            href={href}
            className="inline-flex items-center justify-center rounded-full bg-sky px-6 py-2.5 text-sm font-semibold text-white shadow-[0_2px_10px_rgba(0,113,227,0.25)] transition-colors hover:bg-sky-hover"
          >
            Get it free
          </Link>
        ) : (
          <button
            type="button"
            onClick={onAdd}
            disabled={adding || !variant?.availableForSale}
            className="inline-flex items-center justify-center rounded-full bg-sky px-6 py-2.5 text-sm font-semibold text-white shadow-[0_2px_10px_rgba(0,113,227,0.25)] transition-colors hover:bg-sky-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {adding ? "Adding…" : "Buy"}
          </button>
        )}
      </div>
    </motion.div>
  );
}
