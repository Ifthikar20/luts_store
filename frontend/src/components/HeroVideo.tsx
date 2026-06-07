"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Play } from "lucide-react";

/**
 * Apple-style hero media showcase: a large rounded-corner card that autoplays a
 * muted, looping clip while in view.
 *
 * Behaviour:
 *  - Renders the poster image immediately (also the LCP-friendly fallback).
 *  - The muted clip plays even under prefers-reduced-motion (it's content, not
 *    decorative motion); it is PAUSED when scrolled out of view to save CPU.
 *  - If a browser blocks autoplay (data-saver, etc.) a tap-to-play button shows.
 */
export function HeroVideo({
  src,
  poster,
}: {
  src: string;
  poster: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);
  const [needsTap, setNeedsTap] = useState(false);

  // Pause when offscreen, resume when visible (perf).
  useEffect(() => {
    const v = videoRef.current;
    if (!v || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting)
          void v.play().then(() => setNeedsTap(false)).catch(() => setNeedsTap(true));
        else v.pause();
      },
      { threshold: 0.1 },
    );
    io.observe(v);
    return () => io.disconnect();
  }, []);

  const tapToPlay = () => {
    void videoRef.current
      ?.play()
      .then(() => setNeedsTap(false))
      .catch(() => setNeedsTap(true));
  };

  return (
    <div className="relative aspect-[16/9] w-full overflow-hidden rounded-[28px] bg-cloud shadow-lift sm:rounded-[40px]">
      {/* Poster — immediate paint + autoplay-blocked fallback. */}
      <Image
        src={poster}
        alt=""
        fill
        priority
        sizes="(max-width: 1024px) 100vw, 1100px"
        className={`object-cover transition-opacity duration-1000 ${
          ready ? "opacity-0" : "opacity-100"
        }`}
      />

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

      {needsTap && (
        <button
          type="button"
          onClick={tapToPlay}
          aria-label="Play preview"
          className="absolute left-1/2 top-1/2 z-10 grid h-16 w-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-graphite shadow-lift backdrop-blur transition-transform hover:scale-105"
        >
          <Play className="h-7 w-7 translate-x-0.5 fill-current" />
        </button>
      )}
    </div>
  );
}
