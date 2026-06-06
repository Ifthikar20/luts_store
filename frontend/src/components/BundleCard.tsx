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
    <div className="glass relative overflow-hidden rounded-[40px]">
      <div className="grid items-stretch gap-0 md:grid-cols-2">
        <div className="relative min-h-[300px]">
          <Image
            src={bundle.featuredImage.url}
            alt={bundle.featuredImage.altText}
            fill
            sizes="(max-width: 768px) 100vw, 50vw"
            className="object-cover"
          />
        </div>

        <div className="flex flex-col justify-center gap-5 p-8 sm:p-10">
          <span className="inline-flex w-fit items-center gap-2 rounded-full bg-sky/10 px-3 py-1 text-xs font-semibold text-sky">
            <Sparkles className="h-3.5 w-3.5" />
            Best value
          </span>
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

          <div className="mt-2 flex flex-wrap items-center gap-5">
            <span className="font-display text-3xl font-bold text-graphite">
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
