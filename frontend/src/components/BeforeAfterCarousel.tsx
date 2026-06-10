"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Pause, Play } from "lucide-react";
import { cn } from "@/lib/format";
import { BeforeAfterSlider } from "./BeforeAfterSlider";

export interface BeforeAfterExample {
  label: string;
  alt: string;
  image: string;
}

/**
 * Single-panel before/after carousel: shows one comparison at a time, full
 * width, with a pager (elongated active dot) and a play/pause control that
 * auto-advances through the examples. Apple-style. Respects reduced motion.
 */
export function BeforeAfterCarousel({
  examples,
}: {
  examples: BeforeAfterExample[];
}) {
  const reduced = useReducedMotion() ?? false;
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);

  const next = useCallback(
    () => setIndex((i) => (i + 1) % examples.length),
    [examples.length],
  );

  useEffect(() => {
    if (!playing || reduced) return;
    const t = setInterval(next, 5000);
    return () => clearInterval(t);
  }, [playing, reduced, next]);

  if (examples.length === 0) return null;
  const active = examples[index];

  return (
    <div className="mx-auto mt-12 max-w-5xl">
      <AnimatePresence mode="wait">
        <motion.div
          key={active.label}
          initial={reduced ? false : { opacity: 0, scale: 0.985 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.985 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          <BeforeAfterSlider
            image={active.image}
            alt={active.alt}
            label={active.label}
          />
        </motion.div>
      </AnimatePresence>

      {/* Pager + play/pause control */}
      <div className="mt-6 flex items-center justify-center gap-3">
        <div className="flex items-center gap-2 rounded-full border border-hairline bg-white px-3.5 py-2.5 shadow-soft">
          {examples.map((ex, i) => (
            <button
              key={ex.label}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Show ${ex.label}`}
              aria-current={i === index}
              className={cn(
                "h-2 rounded-full transition-all duration-300",
                i === index
                  ? "w-7 bg-graphite"
                  : "w-2 bg-hairline hover:bg-slate2",
              )}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={() => setPlaying((p) => !p)}
          aria-label={playing ? "Pause" : "Play"}
          aria-pressed={playing}
          className="grid h-11 w-11 place-items-center rounded-full border border-hairline bg-white text-graphite shadow-soft transition-colors hover:bg-cloud"
        >
          {playing ? (
            <Pause className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4 translate-x-[1px] fill-current" />
          )}
        </button>
      </div>

      {/* Caption of the current example, for context. */}
      <p className="mt-4 text-center text-sm text-slate2">
        Shot on <span className="font-medium text-graphite">{active.label}</span>
      </p>
    </div>
  );
}
