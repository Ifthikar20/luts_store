"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { motion } from "framer-motion";
import { Check, ChevronRight, Layers, MonitorPlay, Package } from "lucide-react";
import type { Product } from "@/lib/types";
import { formatMoney } from "@/lib/format";
import { useCart } from "@/context/CartContext";
import { track } from "@/lib/analytics";
import { MagneticButton } from "./motion/MagneticButton";
import { Reveal } from "./motion/Reveal";

export function ProductDetail({ product }: { product: Product }) {
  const { addItem, loading, openCart } = useCart();
  const gallery =
    product.images.length > 0 ? product.images : [product.featuredImage];
  const [active, setActive] = useState(0);
  const [added, setAdded] = useState(false);
  const variant = product.variants[0];

  async function onAdd() {
    if (!variant) return;
    track("add_to_cart", { handle: product.handle });
    await addItem(variant.id, 1);
    setAdded(true);
    setTimeout(() => setAdded(false), 1800);
  }

  return (
    <div className="container-xl relative pt-36 sm:pt-44">
      <nav className="mb-8 flex items-center gap-1.5 text-sm text-slate2">
        <Link href="/" className="hover:text-graphite">
          Home
        </Link>
        <ChevronRight className="h-4 w-4" />
        {product.collections[0] && (
          <>
            <Link
              href={`/collections/${product.collections[0].handle}`}
              className="hover:text-graphite"
            >
              {product.collections[0].title}
            </Link>
            <ChevronRight className="h-4 w-4" />
          </>
        )}
        <span className="text-graphite">{product.title}</span>
      </nav>

      <div className="grid gap-12 lg:grid-cols-2">
        {/* Gallery */}
        <Reveal>
          <div className="sticky top-28">
            <motion.div
              key={active}
              initial={{ opacity: 0.4 }}
              animate={{ opacity: 1 }}
              className="relative aspect-[4/3] overflow-hidden rounded-[28px] border border-hairline shadow-soft"
            >
              <Image
                src={gallery[active].url}
                alt={gallery[active].altText}
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-cover"
              />
            </motion.div>
            {gallery.length > 1 && (
              <div className="mt-4 flex gap-3">
                {gallery.map((img, i) => (
                  <button
                    key={img.url}
                    type="button"
                    onClick={() => setActive(i)}
                    className={`relative h-20 w-24 shrink-0 overflow-hidden rounded-xl border transition-all ${
                      i === active
                        ? "border-sky ring-2 ring-sky/40"
                        : "border-hairline opacity-60 hover:opacity-100"
                    }`}
                    aria-label={`View image ${i + 1}`}
                  >
                    <Image
                      src={img.url}
                      alt={img.altText}
                      fill
                      sizes="96px"
                      className="object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
        </Reveal>

        {/* Info */}
        <Reveal direction="left">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky">
            {product.productType} · {product.vendor}
          </p>
          <h1 className="mt-3 font-display text-4xl font-bold tracking-tightest text-graphite sm:text-5xl">
            {product.title}
          </h1>

          <p className="mt-5 font-display text-3xl font-semibold text-graphite">
            {formatMoney(product.priceRange.min)}
          </p>

          <p className="mt-6 leading-relaxed text-slate2">{product.description}</p>

          {/* What's included */}
          <div className="mt-8 grid gap-3 rounded-[28px] border border-hairline bg-cloud p-6">
            <h2 className="font-display text-sm font-semibold uppercase tracking-widest text-slate2">
              What&apos;s included
            </h2>
            <div className="flex items-center gap-3 text-graphite">
              <Layers className="h-5 w-5 text-sky" />
              <span>
                <strong className="text-graphite">
                  {product.metafields.lutCount}
                </strong>{" "}
                LUTs in this pack
              </span>
            </div>
            <div className="flex items-center gap-3 text-graphite">
              <Package className="h-5 w-5 text-sky" />
              <span>
                Formats:{" "}
                <strong className="text-graphite">
                  {product.metafields.formats.join(", ")}
                </strong>
              </span>
            </div>
            <div className="flex items-start gap-3 text-graphite">
              <MonitorPlay className="mt-0.5 h-5 w-5 shrink-0 text-sky" />
              <span>
                Compatible with{" "}
                <strong className="text-graphite">
                  {product.metafields.compatibleApps.join(", ")}
                </strong>
              </span>
            </div>
          </div>

          {/* Add to cart */}
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <MagneticButton
              variant="grade"
              onClick={onAdd}
            >
              {added ? (
                <>
                  <Check className="h-4 w-4" /> Added
                </>
              ) : loading ? (
                "Adding…"
              ) : (
                "Add to cart"
              )}
            </MagneticButton>
            <button
              type="button"
              onClick={openCart}
              className="btn-ghost"
            >
              View cart
            </button>
          </div>
          {variant && !variant.availableForSale && (
            <p className="mt-3 text-sm text-red-600">
              Currently unavailable.
            </p>
          )}

          {product.tags.length > 0 && (
            <div className="mt-8 flex flex-wrap gap-2">
              {product.tags.map((t) => (
                <span
                  key={t}
                  className="rounded-full border border-hairline bg-cloud px-3 py-1 text-xs text-slate2"
                >
                  #{t}
                </span>
              ))}
            </div>
          )}
        </Reveal>
      </div>
    </div>
  );
}
