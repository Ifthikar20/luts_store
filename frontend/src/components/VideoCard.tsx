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
 * Apple-style media showcase card. Shows a poster image and AUTOPLAYS a short,
 * muted, looping clip while the card is in view (the way Apple autoplays its
 * product clips), with a gentle hover lift.
 *
 * Performance + a11y:
 *  - The <video> starts with NO `src` and `preload="none"`. The real source is
 *    only attached once the card is scrolled into view (or hovered), so we never
 *    download video the user can't see. This lazy-load contract is what the
 *    VideoCard test asserts (no eager <video>/src on the initial render).
 *  - An IntersectionObserver plays/pauses the clip as it enters/leaves the
 *    viewport; offscreen cards are paused to save battery/CPU.
 *  - Under prefers-reduced-motion we render the static poster ONLY and never
 *    attach a video source or autoplay.
 */
export function VideoCard({
  src,
  poster,
  alt,
  className,
  rounded = "rounded-[28px]",
  children,
  /** Disable hover-to-play (e.g. touch-first contexts). In-view still plays. */
  playOnHover = true,
  /** When false, only hover triggers playback (used for hover-preview cards). */
  playInView = true,
  priorityPoster = false,
  /** Render a subtle bottom scrim so overlaid text stays legible. */
  overlay = true,
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
  overlay?: boolean;
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
      whileHover={reduced ? undefined : { scale: 1.02 }}
      transition={{ type: "spring", stiffness: 260, damping: 26 }}
      className={cn(
        "group relative h-full overflow-hidden bg-cloud shadow-soft transition-shadow duration-500 hover:shadow-lift",
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
        className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
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

      {/* Subtle bottom scrim so any overlaid label text stays legible. */}
      {overlay && (
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/45 via-black/0 to-transparent" />
      )}

      {children}
    </motion.div>
  );
}
