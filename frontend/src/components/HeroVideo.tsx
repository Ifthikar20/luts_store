"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";

/**
 * Full-bleed cinematic hero background.
 *
 * Behaviour:
 *  - Renders the poster image immediately (also the LCP-friendly fallback).
 *  - Under prefers-reduced-motion: poster ONLY, no <video>, no autoplay.
 *  - Otherwise: a muted, looping, playsInline, autoPlay <video> fades in once it
 *    can render, and is PAUSED when scrolled out of view (IntersectionObserver)
 *    to save battery/CPU. A dark gradient scrim keeps hero copy legible.
 */
export function HeroVideo({
  src,
  poster,
}: {
  src: string;
  poster: string;
}) {
  const reduced = useReducedMotion() ?? false;
  const videoRef = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);

  // Pause when offscreen, resume when visible (perf). Skip under reduced motion.
  useEffect(() => {
    if (reduced) return;
    const v = videoRef.current;
    if (!v || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) void v.play().catch(() => {});
        else v.pause();
      },
      { threshold: 0.1 },
    );
    io.observe(v);
    return () => io.disconnect();
  }, [reduced]);

  return (
    <div aria-hidden className="absolute inset-0 overflow-hidden">
      {/* Poster — immediate paint + reduced-motion fallback. */}
      <Image
        src={poster}
        alt=""
        fill
        priority
        sizes="100vw"
        className={`object-cover transition-opacity duration-1000 ${
          ready && !reduced ? "opacity-0" : "opacity-100"
        }`}
      />

      {!reduced && (
        <video
          ref={videoRef}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          poster={poster}
          onLoadedData={() => setReady(true)}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 ${
            ready ? "opacity-100" : "opacity-0"
          }`}
        >
          <source src={src} type="video/mp4" />
        </video>
      )}

      {/* Cinematic scrims: darken bottom + sides, plus a subtle grade tint. */}
      <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/70 to-ink/40" />
      <div className="absolute inset-0 bg-gradient-to-r from-ink/80 via-transparent to-ink/60" />
      <div className="absolute inset-0 bg-gradient-to-tr from-teal-grade/10 via-transparent to-orange-grade/15 mix-blend-overlay" />
    </div>
  );
}
