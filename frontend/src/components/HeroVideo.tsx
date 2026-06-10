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
 *  - `sources` are tried in order by the browser — a 404/failing source falls
 *    through to the next, so a self-hosted /hero.mp4 wins when present and the
 *    remote sample is only the last resort.
 *  - The muted clip plays even under prefers-reduced-motion (it's content, not
 *    decorative motion); it is PAUSED when scrolled out of view to save CPU.
 *  - If a browser blocks autoplay (data-saver, etc.) a tap-to-play button shows.
 *  - If EVERY source fails to load, the poster simply stays — no broken UI.
 */
export function HeroVideo({
  sources,
  poster,
}: {
  sources: readonly string[];
  poster: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [needsTap, setNeedsTap] = useState(false);

  // Pause when offscreen, resume when visible (perf).
  useEffect(() => {
    const v = videoRef.current;
    if (!v || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (failed) return;
        if (entry.isIntersecting)
          void v.play().then(() => setNeedsTap(false)).catch(() => setNeedsTap(true));
        else v.pause();
      },
      { threshold: 0.1 },
    );
    io.observe(v);
    return () => io.disconnect();
  }, [failed]);

  const tapToPlay = () => {
    void videoRef.current
      ?.play()
      .then(() => setNeedsTap(false))
      .catch(() => setNeedsTap(true));
  };

  return (
    <div className="relative aspect-[16/9] w-full overflow-hidden rounded-[28px] bg-cloud shadow-lift sm:rounded-[40px]">
      {/* Poster — immediate paint + autoplay-blocked / all-sources-failed fallback. */}
      <Image
        src={poster}
        alt=""
        fill
        priority
        sizes="(max-width: 1024px) 100vw, 1100px"
        className={`object-cover transition-opacity duration-1000 ${
          ready && !failed ? "opacity-0" : "opacity-100"
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
        // Fires on the <video> only after ALL <source> candidates fail.
        onError={() => setFailed(true)}
        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 ${
          ready && !failed ? "opacity-100" : "opacity-0"
        }`}
      >
        {sources.map((src) => (
          // A failing source automatically falls through to the next sibling.
          <source key={src} src={src} type="video/mp4" onError={() => {}} />
        ))}
      </video>

      {needsTap && !failed && (
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
