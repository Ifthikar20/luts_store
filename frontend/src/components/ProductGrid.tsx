"use client";

import type { Product } from "@/lib/types";
import { ProductCard } from "./ProductCard";
import { StaggerGroup, StaggerItem } from "./motion/Reveal";
import { previewClipFor } from "@/lib/media";

export function ProductGrid({
  products,
  emptyMessage = "No looks found.",
  withVideoPreview = false,
  animated = true,
}: {
  products: Product[];
  emptyMessage?: string;
  /** When true, each card previews a (placeholder) muted clip on hover. */
  withVideoPreview?: boolean;
  /**
   * Scroll-reveal entrance stagger. Keep ON for static lists (homepage,
   * collections). Turn OFF for live-filtered grids (search): there, the list
   * changes as the user toggles filters, and the whileInView+once animation can
   * leave newly-matched cards stuck at opacity:0 while still occupying their
   * grid cell — i.e. visible empty gaps. A plain grid reflows instantly with no
   * holes and no re-animation on every filter change.
   */
  animated?: boolean;
}) {
  if (products.length === 0) {
    return (
      <div className="glass rounded-3xl px-8 py-16 text-center text-slate2">
        {emptyMessage}
      </div>
    );
  }

  const gridClass = "grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3";

  if (!animated) {
    return (
      <div className={gridClass}>
        {products.map((p, i) => (
          <article key={p.handle} className="h-full">
            <ProductCard
              product={p}
              previewSrc={withVideoPreview ? previewClipFor(i) : undefined}
            />
          </article>
        ))}
      </div>
    );
  }

  return (
    <StaggerGroup className={gridClass}>
      {products.map((p, i) => (
        <StaggerItem key={p.handle} as="article" className="h-full">
          <ProductCard
            product={p}
            previewSrc={withVideoPreview ? previewClipFor(i) : undefined}
          />
        </StaggerItem>
      ))}
    </StaggerGroup>
  );
}
