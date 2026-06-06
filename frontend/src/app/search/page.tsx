import type { Metadata } from "next";
import { Suspense } from "react";
import { GradientBlob } from "@/components/motion/GradientBlob";
import { Reveal } from "@/components/motion/Reveal";
import { DiscoveryView } from "@/components/DiscoveryView";

export const metadata: Metadata = {
  title: "Search",
  description:
    "Search the full library of cinematic, drone, mobile, and film-emulation LUT packs.",
};

// /search reads ?q= (and optional sort/price/tag filters) from the URL. The
// DiscoveryView consumes useSearchParams, so it must live inside <Suspense> for
// the App Router build (otherwise the page can't be prerendered).
export default function SearchPage() {
  return (
    <div className="relative overflow-hidden">
      <GradientBlob grade="violet-magenta" className="-left-32 top-10" size={500} />
      <GradientBlob
        grade="teal-orange"
        className="-right-40 top-72"
        size={460}
        delay={4}
      />

      <div className="container-xl relative pt-36 sm:pt-44">
        <Reveal>
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-grade-teal">
            Discover
          </p>
          <h1 className="font-display text-4xl font-bold tracking-tight text-white sm:text-6xl">
            Search the library
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-white/55">
            Find the look by name, tag, or style — then refine by price and
            category.
          </p>
        </Reveal>
      </div>

      <div className="container-xl relative py-12 sm:py-16">
        <Suspense fallback={<SearchFallback />}>
          <DiscoveryView
            showSearch
            searchPlaceholder="Search looks, tags, styles…"
            emptyMessage="No looks match your search. Try a different term or clear your filters."
          />
        </Suspense>
      </div>
    </div>
  );
}

function SearchFallback() {
  return (
    <div className="glass rounded-3xl px-8 py-16 text-center text-white/50">
      Loading search…
    </div>
  );
}
