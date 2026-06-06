"use client";

import type { Product } from "@/lib/types";
import { ProductCard } from "./ProductCard";
import { StaggerGroup, StaggerItem } from "./motion/Reveal";

export function ProductGrid({
  products,
  emptyMessage = "No looks found.",
}: {
  products: Product[];
  emptyMessage?: string;
}) {
  if (products.length === 0) {
    return (
      <div className="glass rounded-3xl px-8 py-16 text-center text-white/50">
        {emptyMessage}
      </div>
    );
  }
  return (
    <StaggerGroup className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {products.map((p) => (
        <StaggerItem key={p.handle} as="article" className="h-full">
          <ProductCard product={p} />
        </StaggerItem>
      ))}
    </StaggerGroup>
  );
}
