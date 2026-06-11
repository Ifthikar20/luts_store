"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { motion } from "framer-motion";
import { Check, ChevronRight } from "lucide-react";
import type { Product } from "@/lib/types";
import { formatMoney } from "@/lib/format";
import { useCart } from "@/context/CartContext";
import { track } from "@/lib/analytics";
import { MagneticButton } from "./motion/MagneticButton";
import { BeforeAfterSlider } from "./BeforeAfterSlider";
import { ClaimFreeLut } from "./ClaimFreeLut";
import { ProductReviews } from "./ProductReviews";
import { Reveal } from "./motion/Reveal";

export function ProductDetail({ product }: { product: Product }) {
  const { addItem, loading } = useCart();
  const gallery =
    product.images.length > 0 ? product.images : [product.featuredImage];
  const [active, setActive] = useState(0);
  const [added, setAdded] = useState(false);
  const variant = product.variants[0];
  const isFree = Number.parseFloat(product.priceRange.min.amount) === 0;

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
          <h1 className="font-display text-4xl font-bold tracking-tightest text-graphite sm:text-5xl">
            {product.title}
          </h1>

          <p className="mt-5 font-display text-3xl font-semibold text-graphite">
            {isFree ? "Free" : formatMoney(product.priceRange.min)}
          </p>

          <p className="mt-6 leading-relaxed text-slate2">
            {product.bestFor && (
              <span className="font-semibold text-graphite">
                Best for {product.bestFor}.{" "}
              </span>
            )}
            {product.description}
          </p>

          {/* What's included — one concise line */}
          <div className="mt-8 border-t border-hairline pt-6">
            <h2 className="font-display text-sm font-semibold uppercase tracking-widest text-slate2">
              What&apos;s included
            </h2>
            <p className="mt-2 leading-relaxed text-slate2">
              <strong className="text-graphite">
                {product.metafields.lutCount} LUTs
              </strong>{" "}
              · {product.metafields.formats.join(", ")} · Works in{" "}
              {product.metafields.compatibleApps.join(", ")}
            </p>
          </div>

          {/* Inside the pack — every LUT by name with its coloring note. */}
          {product.includedLuts && product.includedLuts.length > 0 && (
            <div className="mt-6 border-t border-hairline pt-6">
              <h2 className="font-display text-sm font-semibold uppercase tracking-widest text-slate2">
                {product.productType === "Bundle"
                  ? "Inside the bundle"
                  : "Inside the pack"}
              </h2>
              <ul className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2">
                {product.includedLuts.map((lut) => (
                  <li key={lut.name} className="text-sm text-slate2">
                    <span className="font-semibold text-graphite">
                      {lut.name}
                    </span>{" "}
                    — {lut.tone}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Claim (free) or add to cart (paid) */}
          {isFree ? (
            <div className="mt-8 rounded-[28px] border border-hairline bg-cloud p-6">
              <ClaimFreeLut />
            </div>
          ) : (
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <MagneticButton variant="grade" onClick={onAdd}>
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
            </div>
          )}
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

      {/* See the look — real before/after slider and/or a motion preview,
          shown only when the product carries those assets. */}
      {(product.afterImage || product.previewVideo) && (
        <section className="mt-20">
          <h2 className="font-display text-2xl font-bold tracking-tight text-graphite sm:text-3xl">
            See the look
          </h2>
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            {product.afterImage && (
              <Reveal>
                <BeforeAfterSlider
                  image={product.beforeImage || product.featuredImage.url}
                  afterImage={product.afterImage}
                  alt={`${product.title} grade`}
                  label="Drag to compare"
                />
              </Reveal>
            )}
            {product.previewVideo && (
              <Reveal direction="left">
                <video
                  src={product.previewVideo}
                  poster={product.featuredImage.url}
                  autoPlay
                  muted
                  loop
                  playsInline
                  preload="none"
                  className="aspect-[16/10] w-full rounded-[28px] border border-hairline object-cover shadow-soft"
                />
              </Reveal>
            )}
          </div>
        </section>
      )}

      {/* Customer reviews */}
      <ProductReviews />
    </div>
  );
}
