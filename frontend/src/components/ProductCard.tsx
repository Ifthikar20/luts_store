"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Layers, Plus } from "lucide-react";
import type { Product } from "@/lib/types";
import { priceLabel } from "@/lib/format";
import { useCart } from "@/context/CartContext";

export function ProductCard({
  product,
  previewSrc,
}: {
  product: Product;
  /** Optional muted looping clip previewed on hover (lazy, reduced-motion safe). */
  previewSrc?: string;
}) {
  const reduced = useReducedMotion() ?? false;
  const { addItem, loading } = useCart();
  const variant = product.variants[0];

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

  async function onAdd(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (variant) await addItem(variant.id, 1);
  }

  return (
    <motion.article
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      whileHover={reduced ? undefined : { y: -8 }}
      transition={{ type: "spring", stiffness: 300, damping: 24 }}
      className="group relative h-full"
    >
      <Link
        href={`/luts/${product.handle}`}
        className="glass glass-hover flex h-full flex-col overflow-hidden rounded-[28px]"
      >
        <div className="relative aspect-[4/3] overflow-hidden">
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
          {product.featured && (
            <span className="absolute left-4 top-4 rounded-full bg-sky px-3 py-1 text-xs font-semibold text-white shadow-soft">
              Featured
            </span>
          )}
          <span className="absolute right-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-graphite shadow-soft backdrop-blur">
            <Layers className="h-3.5 w-3.5" />
            {product.metafields.lutCount} LUTs
          </span>
        </div>

        <div className="relative flex flex-1 flex-col gap-3 p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-widest text-slate2">
                {product.productType}
              </p>
              <h3 className="mt-1 font-display text-lg font-semibold leading-snug text-graphite">
                {product.title}
              </h3>
            </div>
            <p className="shrink-0 font-display text-lg font-semibold text-graphite">
              {priceLabel(product.priceRange.min, product.priceRange.max)}
            </p>
          </div>

          <p className="line-clamp-2 text-sm text-slate2">
            {product.description}
          </p>

          <div className="mt-auto flex flex-wrap gap-1.5 pt-2">
            {product.metafields.formats.map((f) => (
              <span
                key={f}
                className="rounded-md border border-hairline bg-cloud px-2 py-0.5 text-[11px] font-medium text-slate2"
              >
                {f}
              </span>
            ))}
          </div>

          <button
            type="button"
            onClick={onAdd}
            disabled={loading || !variant?.availableForSale}
            className="mt-1 inline-flex items-center justify-center gap-2 rounded-full bg-haze px-4 py-2.5 text-sm font-semibold text-graphite transition-colors hover:bg-[#dcdce2] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            Add to cart
          </button>
        </div>
      </Link>
    </motion.article>
  );
}
