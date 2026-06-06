"use client";

import Image from "next/image";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/format";

/**
 * A card that shows a poster image and lazily plays a short, muted, looping
 * clip (before/after grade feel) on hover and while in view.
 *
 * Performance + a11y:
 *  - The <video> starts with NO `src` and `preload="none"`. The real source is
 *    only attached once the card is hovered or scrolled into view, so we never
 *    download video the user can't see.
 *  - An IntersectionObserver plays/pauses the clip as it enters/leaves the
 *    viewport (and hover forces play on pointer devices).
 *  - Under prefers-reduced-motion we render the static poster only and never
 *    attach a video source or autoplay.
 */
export function VideoCard({
  src,
  poster,
  alt,
  className,
  rounded = "rounded-3xl",
  children,
  /** Disable hover-to-play (e.g. touch-first contexts). In-view still plays. */
  playOnHover = true,
  /** When false, only hover triggers playback (used for hover-preview cards). */
  playInView = true,
  priorityPoster = false,
}: {
  src: string;
  poster: string;
  alt: string;
  className?: string;
  rounded?: string;
  children?: ReactNode;
  playOnHover?: boolean;
  playInView?: boolean;
  priorityPoster?: boolean;
}) {
  const reduced = useReducedMotion() ?? false;
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  // Once true, we attach the real <source>. Latches so we don't thrash the src.
  const [loadVideo, setLoadVideo] = useState(false);
  const [inView, setInView] = useState(false);
  const [hovering, setHovering] = useState(false);

  // Lazily reveal + play, respecting reduced motion.
  const wantsPlay = !reduced && ((playInView && inView) || (playOnHover && hovering));

  // Attach the source the first time we want to play.
  useEffect(() => {
    if (wantsPlay && !loadVideo) setLoadVideo(true);
  }, [wantsPlay, loadVideo]);

  // Observe viewport intersection (skip entirely under reduced motion).
  useEffect(() => {
    if (reduced || !playInView) return;
    const el = containerRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const obs = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { threshold: 0.35 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [reduced, playInView]);

  // Drive play/pause off the derived intent.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (wantsPlay) {
      // play() can reject if the element is removed mid-flight — swallow it.
      void v.play().catch(() => {});
    } else {
      v.pause();
    }
  }, [wantsPlay, loadVideo]);

  const onEnter = useCallback(() => setHovering(true), []);
  const onLeave = useCallback(() => setHovering(false), []);

  return (
    <motion.div
      ref={containerRef}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onFocus={onEnter}
      onBlur={onLeave}
      whileHover={reduced ? undefined : { y: -6 }}
      transition={{ type: "spring", stiffness: 300, damping: 24 }}
      className={cn(
        "group relative h-full overflow-hidden border border-white/10 bg-ink-100",
        rounded,
        className,
      )}
    >
      {/* Poster — always rendered; sits beneath the video and is the
          reduced-motion fallback. */}
      <Image
        src={poster}
        alt={alt}
        fill
        sizes="(max-width: 768px) 100vw, 50vw"
        priority={priorityPoster}
        className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
      />

      {/* Video overlays the poster once loaded; fades in when actually playing. */}
      {!reduced && loadVideo && (
        <video
          ref={videoRef}
          muted
          loop
          playsInline
          preload="none"
          poster={poster}
          aria-hidden
          className={cn(
            "absolute inset-0 h-full w-full object-cover transition-opacity duration-500",
            wantsPlay ? "opacity-100" : "opacity-0",
          )}
        >
          <source src={src} type="video/mp4" />
        </video>
      )}

      {/* Cinematic scrim so any overlaid text stays legible. */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink via-ink/25 to-transparent" />
      {/* Hover glow ring. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        style={{
          boxShadow:
            "inset 0 0 0 1px rgba(255,255,255,0.18), inset 0 -60px 80px -40px rgba(22,216,198,0.25)",
        }}
      />

      {children}
    </motion.div>
  );
}
