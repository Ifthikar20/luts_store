"use client";

import type { Product } from "@/lib/types";
import { ProductCard } from "./ProductCard";
import { StaggerGroup, StaggerItem } from "./motion/Reveal";
import { previewClipFor } from "@/lib/media";

export function ProductGrid({
  products,
  emptyMessage = "No looks found.",
  withVideoPreview = false,
}: {
  products: Product[];
  emptyMessage?: string;
  /** When true, each card previews a (placeholder) muted clip on hover. */
  withVideoPreview?: boolean;
}) {
  if (products.length === 0) {
    return (
      <div className="glass rounded-3xl px-8 py-16 text-center text-slate2">
        {emptyMessage}
      </div>
    );
  }
  return (
    <StaggerGroup className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
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
