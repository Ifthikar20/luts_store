"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Pause, Play } from "lucide-react";
import { cn } from "@/lib/format";
import { BeforeAfterSlider } from "./BeforeAfterSlider";

export interface BeforeAfterExample {
  label: string;
  alt: string;
  image: string;
}

const GAP = 20;

/**
 * Peek-style before/after slider: the active comparison sits centered with the
 * neighbouring slides bleeding in at the edges; advancing slides the track
 * horizontally. Click a peeking slide (or a pager dot) to focus it, and the
 * play/pause control auto-advances. Apple-style; reduced-motion aware.
 */
export function BeforeAfterCarousel({
  examples,
}: {
  examples: BeforeAfterExample[];
}) {
  const reduced = useReducedMotion() ?? false;
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);

  // Measure the viewport so we can center one slide and let neighbours peek.
  const viewportRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

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

  // On phones the active slide is near full-width; on larger screens it's
  // narrower so the previous/next slides peek in on each side.
  const peek = width >= 768;
  const slideWidth = width ? width * (peek ? 0.82 : 0.94) : 0;
  const centerOffset = width ? (width - slideWidth) / 2 : 0;
  const trackX = centerOffset - index * (slideWidth + GAP);

  return (
    <div className="mt-12">
      <div ref={viewportRef} className="overflow-hidden">
        <motion.div
          className="flex"
          style={{ gap: GAP }}
          animate={{ x: width ? trackX : 0 }}
          transition={
            reduced
              ? { duration: 0 }
              : { type: "spring", stiffness: 260, damping: 32 }
          }
        >
          {examples.map((ex, i) => {
            const active = i === index;
            return (
              <motion.div
                key={ex.label}
                className="shrink-0"
                style={{ width: slideWidth ? `${slideWidth}px` : "100%" }}
                animate={{
                  scale: reduced || active ? 1 : 0.92,
                  opacity: active ? 1 : 0.45,
                }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                aria-hidden={!active}
              >
                <div
                  className={cn(!active && "pointer-events-none")}
                  onClickCapture={(e) => {
                    // Clicking a peeking slide focuses it (instead of dragging).
                    if (!active) {
                      e.preventDefault();
                      e.stopPropagation();
                      setIndex(i);
                    }
                  }}
                >
                  <BeforeAfterSlider
                    image={ex.image}
                    alt={ex.alt}
                    label={ex.label}
                  />
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      </div>

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

      <p className="mt-4 text-center text-sm text-slate2">
        Shot on{" "}
        <span className="font-medium text-graphite">{examples[index].label}</span>
      </p>
    </div>
  );
}
