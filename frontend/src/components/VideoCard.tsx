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
import { Play } from "lucide-react";
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
 *  - The muted clip plays even under prefers-reduced-motion (it's the section's
 *    content, not decorative motion); only the hover ZOOM animation is gated by
 *    reduced motion. If a browser blocks autoplay we surface a tap-to-play button.
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
  // Set if the browser refuses to autoplay — we then show a tap-to-play button.
  const [needsTap, setNeedsTap] = useState(false);
  // Set when the user explicitly taps play (overrides everything).
  const [forced, setForced] = useState(false);

  // Lazily reveal + play. NOTE: playback is NOT gated on reduced motion — the
  // clip is the content; only the hover zoom (below) respects reduced motion.
  const wantsPlay =
    forced || (playInView && inView) || (playOnHover && hovering);

  // Attach the source the first time we want to play.
  useEffect(() => {
    if (wantsPlay && !loadVideo) setLoadVideo(true);
  }, [wantsPlay, loadVideo]);

  // Observe viewport intersection.
  useEffect(() => {
    if (!playInView) return;
    const el = containerRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const obs = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { threshold: 0.25, rootMargin: "0px 0px -10% 0px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [playInView]);

  // Drive play/pause off the derived intent; surface a tap-to-play fallback if
  // the browser rejects autoplay (e.g. data-saver), and clear it on success.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (wantsPlay) {
      void v
        .play()
        .then(() => setNeedsTap(false))
        .catch(() => setNeedsTap(true));
    } else {
      v.pause();
    }
  }, [wantsPlay, loadVideo]);

  const tapToPlay = useCallback(() => {
    setForced(true);
    setLoadVideo(true);
    setNeedsTap(false);
    // Attempt immediately within the user gesture so the browser allows it.
    requestAnimationFrame(() => {
      void videoRef.current?.play().catch(() => setNeedsTap(true));
    });
  }, []);

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
      {loadVideo && (
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

      {/* Tap-to-play fallback if the browser blocked muted autoplay. */}
      {needsTap && (
        <button
          type="button"
          onClick={tapToPlay}
          aria-label="Play preview"
          className="absolute left-1/2 top-1/2 z-10 grid h-14 w-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-graphite shadow-lift backdrop-blur transition-transform hover:scale-105"
        >
          <Play className="h-6 w-6 translate-x-0.5 fill-current" />
        </button>
      )}

      {children}
    </motion.div>
  );
}
