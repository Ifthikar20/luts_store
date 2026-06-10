"use client";

import Image from "next/image";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { GripVertical } from "lucide-react";

/**
 * Interactive before/after comparison — for stills or VIDEO.
 *
 * Modes:
 *  - Video: pass `video` and a single muted looping clip plays as the graded
 *    "after"; the clipped "before" half is the SAME playing video washed out
 *    via backdrop-filter (flat/log look) — one element, so the halves are
 *    always perfectly in sync.
 *  - Real grade: pass `afterImage` (the actual graded frame); both stills show
 *    as-is.
 *  - Simulated: just `image`; a CSS filter approximates the LUT.
 *
 * `autoSlide` sweeps the handle back and forth on its own until the user
 * touches it (drag/keyboard), then yields control. Disabled under
 * prefers-reduced-motion. Fully keyboard accessible via the range input.
 */
export function BeforeAfterSlider({
  image,
  afterImage,
  video,
  alt,
  label,
  autoSlide = false,
}: {
  image: string;
  /** The real graded frame. When given, no CSS filter is applied. */
  afterImage?: string;
  /** Muted looping clip — enables the video before/after mode. */
  video?: string;
  alt: string;
  label?: string;
  /** Sweep the handle automatically until the user interacts. */
  autoSlide?: boolean;
}) {
  const reduced = useReducedMotion() ?? false;
  const isVideo = Boolean(video);
  const hasReal = Boolean(afterImage);
  const afterSrc = afterImage || image;
  const afterFilter =
    hasReal || isVideo
      ? undefined
      : "contrast(1.15) saturate(1.25) brightness(1.02) sepia(0.12) hue-rotate(-6deg)";
  const beforeFilter = hasReal
    ? undefined
    : "saturate(0.55) contrast(0.92) brightness(0.98)";
  const rangeId = useId();
  const [pos, setPos] = useState(55);
  const [interacted, setInteracted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const dragging = useRef(false);

  const setFromClientX = useCallback((clientX: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pct = ((clientX - rect.left) / rect.width) * 100;
    setPos(Math.min(100, Math.max(0, pct)));
  }, []);

  // Auto-sweep the handle (sine ease between ~22% and ~86%) until the user
  // takes over. Skipped entirely under prefers-reduced-motion.
  useEffect(() => {
    if (!autoSlide || reduced || interacted) return;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      setPos(54 + 32 * Math.sin((now - start) / 1600));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [autoSlide, reduced, interacted]);

  // Video: play while visible, pause offscreen (saves CPU/battery).
  useEffect(() => {
    const v = videoRef.current;
    if (!v || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) void v.play().catch(() => {});
        else v.pause();
      },
      { threshold: 0.15 },
    );
    io.observe(v);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative aspect-[16/10] w-full select-none overflow-hidden rounded-[28px] border border-hairline shadow-soft"
      onPointerDown={(e) => {
        dragging.current = true;
        setInteracted(true);
        (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
        setFromClientX(e.clientX);
      }}
      onPointerMove={(e) => dragging.current && setFromClientX(e.clientX)}
      onPointerUp={() => (dragging.current = false)}
      onPointerLeave={() => (dragging.current = false)}
    >
      {/* AFTER (graded) — full media underneath */}
      {isVideo ? (
        <video
          ref={videoRef}
          src={video}
          poster={image}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          aria-label={`${alt} — graded`}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <Image
          src={afterSrc}
          alt={`${alt} — graded`}
          fill
          sizes="(max-width: 1024px) 100vw, 50vw"
          className="object-cover"
          style={afterFilter ? { filter: afterFilter } : undefined}
          priority={false}
        />
      )}
      <span className="pointer-events-none absolute bottom-4 right-4 z-10 rounded-full bg-sky px-3 py-1 text-xs font-semibold text-white shadow-soft">
        After
      </span>
      {label && (
        <span className="pointer-events-none absolute left-4 top-4 z-10 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-graphite shadow-soft backdrop-blur">
          {label}
        </span>
      )}

      {/* BEFORE (flat/ungraded) — clipped to the left of the handle */}
      <div
        className="absolute inset-0 overflow-hidden"
        style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
      >
        {isVideo ? (
          // Wash out the SAME playing video underneath (flat/log look) — no
          // second video element, so the halves can never drift out of sync.
          <div
            aria-hidden
            className="absolute inset-0 bg-white/5"
            style={{
              backdropFilter: "saturate(0.4) contrast(0.88) brightness(1.06)",
              WebkitBackdropFilter:
                "saturate(0.4) contrast(0.88) brightness(1.06)",
            }}
          />
        ) : (
          <Image
            src={image}
            alt={`${alt} — original`}
            fill
            sizes="(max-width: 1024px) 100vw, 50vw"
            className="object-cover"
            style={beforeFilter ? { filter: beforeFilter } : undefined}
          />
        )}
        <span className="pointer-events-none absolute bottom-4 left-4 rounded-full bg-ink/70 px-3 py-1 text-xs font-semibold text-white/90 backdrop-blur">
          Before
        </span>
      </div>

      {/* Handle */}
      <div
        className="absolute inset-y-0 z-20 w-0.5 -translate-x-1/2 bg-white/90 shadow-[0_0_20px_rgba(255,255,255,0.5)]"
        style={{ left: `${pos}%` }}
      >
        <div className="absolute left-1/2 top-1/2 grid h-11 w-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-white/40 bg-ink/80 text-white backdrop-blur">
          <GripVertical className="h-5 w-5" />
        </div>
      </div>

      {/* Accessible control */}
      <label className="sr-only" htmlFor={rangeId}>
        Reveal graded {isVideo ? "video" : "image"}
      </label>
      <input
        id={rangeId}
        type="range"
        min={0}
        max={100}
        value={Math.round(pos)}
        onChange={(e) => {
          setInteracted(true);
          setPos(Number(e.target.value));
        }}
        className="absolute inset-x-0 bottom-0 z-30 h-full w-full cursor-ew-resize opacity-0"
        aria-label="Before and after comparison slider"
      />
    </div>
  );
}
