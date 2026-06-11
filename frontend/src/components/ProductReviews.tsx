"use client";

import { useMemo, useState } from "react";
import { Star } from "lucide-react";

type Review = {
  id: string;
  name: string;
  rating: number; // 1–5
  date: string; // ISO, for sorting
  dateLabel: string; // human label, e.g. "last year"
  title: string;
  body: string;
  verified?: boolean;
  source?: string;
};

// Sample reviews. There is no reviews API yet, so these are seeded placeholders
// shown under every product — swap for real, per-product data when available.
const REVIEWS: Review[] = [
  {
    id: "r1",
    name: "Rowan",
    rating: 5,
    date: "2025-04-18",
    dateLabel: "last year",
    title: "Good and very interested guide",
    body: "Good and very interested guide, learned a lot about it and it’s very easy to use the camera now, didn’t had any idea how it works etc now it’s easier.",
    verified: true,
    source: "Review collected via store invitation",
  },
  {
    id: "r2",
    name: "Maya",
    rating: 5,
    date: "2025-06-02",
    dateLabel: "11 months ago",
    title: "Instant filmic look",
    body: "Dragged one LUT onto my DJI Osmo footage and it just clicked — richer contrast and gorgeous skin tones with zero extra grading. Huge time saver.",
    verified: true,
    source: "Review collected via store invitation",
  },
  {
    id: "r3",
    name: "Daniel",
    rating: 5,
    date: "2025-08-21",
    dateLabel: "9 months ago",
    title: "Works everywhere",
    body: "Installed them in Premiere and DaVinci Resolve without any trouble. The .cube files are clean and consistent across all my cameras.",
    verified: true,
  },
  {
    id: "r4",
    name: "Priya",
    rating: 5,
    date: "2025-10-09",
    dateLabel: "7 months ago",
    title: "Best money I’ve spent on color",
    body: "Tried a lot of LUT packs and most are too heavy. These are subtle and natural — they enhance the footage instead of fighting it.",
    verified: true,
    source: "Review collected via store invitation",
  },
  {
    id: "r5",
    name: "Tom",
    rating: 5,
    date: "2025-12-14",
    dateLabel: "5 months ago",
    title: "Cinematic in one drag",
    body: "Exactly what the store promises. My iPhone clips finally look like they belong next to my mirrorless shots. Highly recommend.",
    verified: true,
  },
  {
    id: "r6",
    name: "Elena",
    rating: 5,
    date: "2026-02-27",
    dateLabel: "3 months ago",
    title: "Easy and beautiful",
    body: "Super easy to use and the results are beautiful straight out of the box. A little tweak to exposure and it’s perfect every time.",
    verified: true,
    source: "Review collected via store invitation",
  },
];

function Stars({ rating, className = "" }: { rating: number; className?: string }) {
  return (
    <div className={`flex items-center gap-0.5 ${className}`} aria-hidden>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`h-4 w-4 ${
            i <= Math.round(rating)
              ? "fill-amber-400 text-amber-400"
              : "fill-transparent text-slate-300"
          }`}
        />
      ))}
    </div>
  );
}

type SortKey = "recent" | "highest" | "lowest";

export function ProductReviews() {
  const [sort, setSort] = useState<SortKey>("recent");

  const reviews = useMemo(() => {
    const list = [...REVIEWS];
    switch (sort) {
      case "highest":
        return list.sort((a, b) => b.rating - a.rating);
      case "lowest":
        return list.sort((a, b) => a.rating - b.rating);
      default:
        return list.sort((a, b) => b.date.localeCompare(a.date));
    }
  }, [sort]);

  const count = REVIEWS.length;
  const average = useMemo(
    () => REVIEWS.reduce((sum, r) => sum + r.rating, 0) / count,
    [count],
  );

  return (
    <section className="mt-20 border-t border-hairline pt-12">
      <h2 className="font-display text-2xl font-bold tracking-tight text-graphite sm:text-3xl">
        Customer Reviews
      </h2>

      {/* Summary */}
      <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="flex items-center gap-3">
          <span className="font-display text-4xl font-bold text-graphite">
            {average.toFixed(1)}
          </span>
          <div>
            <Stars rating={average} />
            <p className="mt-1 text-sm text-slate2">
              {count} review{count === 1 ? "" : "s"}
            </p>
          </div>
        </div>
        <span className="rounded-full border border-hairline bg-cloud px-3 py-1 text-xs font-medium text-slate2">
          Verified
        </span>

        <div className="ml-auto flex items-center gap-2 text-sm text-slate2">
          <label htmlFor="review-sort">Sort reviews by</label>
          <select
            id="review-sort"
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="rounded-lg border border-hairline bg-white px-3 py-1.5 text-graphite focus:outline-none focus:ring-2 focus:ring-sky/40"
          >
            <option value="recent">Most recent</option>
            <option value="highest">Highest rating</option>
            <option value="lowest">Lowest rating</option>
          </select>
        </div>
      </div>

      {/* List */}
      <ul className="mt-10 space-y-8">
        {reviews.map((r) => (
          <li key={r.id} className="border-t border-hairline pt-8 first:border-t-0 first:pt-0">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-cloud text-sm font-semibold text-graphite">
                {r.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="font-semibold text-graphite">{r.name}</span>
                  {r.verified && (
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                      Verified
                    </span>
                  )}
                  <span className="ml-auto text-xs text-slate2">{r.dateLabel}</span>
                </div>
                <Stars rating={r.rating} className="mt-2" />
                <h3 className="mt-3 font-semibold text-graphite">{r.title}</h3>
                <p className="mt-1.5 leading-relaxed text-slate2">{r.body}</p>
                {r.source && (
                  <p className="mt-3 text-xs italic text-slate-400">{r.source}</p>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
