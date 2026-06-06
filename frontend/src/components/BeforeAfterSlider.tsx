"use client";

import Image from "next/image";
import { useCallback, useRef, useState } from "react";
import { GripVertical } from "lucide-react";

/**
 * Interactive before/after comparison. The "after" image is color-graded via a
 * CSS filter to simulate applying a LUT, so we only need one source image.
 * Fully keyboard accessible via the range input.
 */
export function BeforeAfterSlider({
  image,
  alt,
}: {
  image: string;
  alt: string;
}) {
  const [pos, setPos] = useState(55);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const setFromClientX = useCallback((clientX: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pct = ((clientX - rect.left) / rect.width) * 100;
    setPos(Math.min(100, Math.max(0, pct)));
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative aspect-[16/10] w-full select-none overflow-hidden rounded-[28px] border border-hairline shadow-soft"
      onPointerDown={(e) => {
        dragging.current = true;
        (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
        setFromClientX(e.clientX);
      }}
      onPointerMove={(e) => dragging.current && setFromClientX(e.clientX)}
      onPointerUp={() => (dragging.current = false)}
      onPointerLeave={() => (dragging.current = false)}
    >
      {/* AFTER (graded) — full image underneath */}
      <Image
        src={image}
        alt={`${alt} — graded`}
        fill
        sizes="(max-width: 1024px) 100vw, 50vw"
        className="object-cover"
        style={{
          filter:
            "contrast(1.15) saturate(1.25) brightness(1.02) sepia(0.12) hue-rotate(-6deg)",
        }}
        priority={false}
      />
      <span className="pointer-events-none absolute bottom-4 right-4 z-10 rounded-full bg-sky px-3 py-1 text-xs font-semibold text-white shadow-soft">
        After
      </span>

      {/* BEFORE (flat/ungraded) — clipped to the left of the handle */}
      <div
        className="absolute inset-0 overflow-hidden"
        style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
      >
        <Image
          src={image}
          alt={`${alt} — original`}
          fill
          sizes="(max-width: 1024px) 100vw, 50vw"
          className="object-cover"
          style={{ filter: "saturate(0.55) contrast(0.92) brightness(0.98)" }}
        />
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
      <label className="sr-only" htmlFor="ba-range">
        Reveal graded image
      </label>
      <input
        id="ba-range"
        type="range"
        min={0}
        max={100}
        value={pos}
        onChange={(e) => setPos(Number(e.target.value))}
        className="absolute inset-x-0 bottom-0 z-30 h-full w-full cursor-ew-resize opacity-0"
        aria-label="Before and after comparison slider"
      />
    </div>
  );
}
