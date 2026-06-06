"use client";

import Image from "next/image";
import { Check, Sparkles } from "lucide-react";
import type { Product } from "@/lib/types";
import { formatMoney } from "@/lib/format";
import { useCart } from "@/context/CartContext";
import { MagneticButton } from "./motion/MagneticButton";

export function BundleCard({ bundle }: { bundle: Product }) {
  const { addItem, loading } = useCart();
  const variant = bundle.variants[0];

  const perks = [
    `${bundle.metafields.lutCount} LUTs across every signature look`,
    `Delivered in ${bundle.metafields.formats.join(" + ")}`,
    `Works in ${bundle.metafields.compatibleApps.slice(0, 3).join(", ")}${
      bundle.metafields.compatibleApps.length > 3 ? " + more" : ""
    }`,
    "Free lifetime updates",
  ];

  return (
    <div className="glass relative overflow-hidden rounded-4xl p-1">
      <div className="grid items-stretch gap-0 overflow-hidden rounded-[1.7rem] md:grid-cols-2">
        <div className="relative min-h-[280px]">
          <Image
            src={bundle.featuredImage.url}
            alt={bundle.featuredImage.altText}
            fill
            sizes="(max-width: 768px) 100vw, 50vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-transparent to-ink md:bg-gradient-to-l" />
        </div>

        <div className="flex flex-col justify-center gap-5 p-8 sm:p-10">
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-violet-grade/40 bg-violet-grade/10 px-3 py-1 text-xs font-semibold text-violet-grade">
            <Sparkles className="h-3.5 w-3.5" />
            Best value
          </span>
          <h3 className="font-display text-3xl font-bold leading-tight text-white sm:text-4xl">
            {bundle.title}
          </h3>
          <p className="text-white/65">{bundle.description}</p>

          <ul className="space-y-2.5">
            {perks.map((perk) => (
              <li key={perk} className="flex items-start gap-3 text-sm text-white/80">
                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-grade-violet-magenta text-ink">
                  <Check className="h-3 w-3" />
                </span>
                {perk}
              </li>
            ))}
          </ul>

          <div className="mt-2 flex flex-wrap items-center gap-5">
            <span className="font-display text-3xl font-bold text-white">
              {formatMoney(bundle.priceRange.min)}
            </span>
            {variant && (
              <MagneticButton
                variant="grade"
                onClick={() => addItem(variant.id, 1)}
              >
                {loading ? "Adding…" : "Get the bundle"}
              </MagneticButton>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
