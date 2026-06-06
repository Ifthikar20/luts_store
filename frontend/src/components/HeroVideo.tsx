"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";

/**
 * Apple-style hero media showcase: a large rounded-corner card that autoplays a
 * muted, looping clip while in view.
 *
 * Behaviour:
 *  - Renders the poster image immediately (also the LCP-friendly fallback).
 *  - Under prefers-reduced-motion: poster ONLY, no <video>, no autoplay.
 *  - Otherwise: a muted, looping, playsInline, autoPlay <video> fades in once it
 *    can render, and is PAUSED when scrolled out of view (IntersectionObserver)
 *    to save battery/CPU.
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
    <div className="relative aspect-[16/9] w-full overflow-hidden rounded-[28px] bg-cloud shadow-lift sm:rounded-[40px]">
      {/* Poster — immediate paint + reduced-motion fallback. */}
      <Image
        src={poster}
        alt=""
        fill
        priority
        sizes="(max-width: 1024px) 100vw, 1100px"
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
    </div>
  );
}
