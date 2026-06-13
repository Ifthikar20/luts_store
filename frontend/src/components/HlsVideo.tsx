"use client";

import { useEffect, useRef } from "react";

/**
 * Adaptive-streaming preview player.
 *
 * Plays an HLS (`.m3u8`) source so the stream adapts to the viewer's bandwidth:
 *  - Safari / iOS play HLS natively — we just set `video.src`.
 *  - Other browsers lazy-load `hls.js` (only when an HLS source is present, so
 *    it never bloats pages without video) and attach it.
 *  - If `hls` is absent or unplayable, we fall back to the progressive `mp4`
 *    source, so older uploads (pre-transcode) and HLS failures still play.
 *
 * Muted + looping + autoplay, paused when scrolled offscreen to save CPU/data.
 */
export function HlsVideo({
  hls,
  mp4,
  poster,
  className,
}: {
  hls?: string | null;
  mp4?: string | null;
  poster?: string;
  className?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let hlsInstance: { destroy: () => void } | null = null;
    let cancelled = false;
    const canNativeHls =
      video.canPlayType("application/vnd.apple.mpegurl") !== "";

    if (hls && canNativeHls) {
      video.src = hls;
    } else if (hls) {
      // Dynamically import so hls.js ships only to pages that actually stream.
      import("hls.js")
        .then(({ default: Hls }) => {
          if (cancelled || !video) return;
          if (Hls.isSupported()) {
            const inst = new Hls({ enableWorker: true, lowLatencyMode: false });
            inst.loadSource(hls);
            inst.attachMedia(video);
            hlsInstance = inst;
          } else if (mp4) {
            video.src = mp4;
          }
        })
        .catch(() => {
          if (!cancelled && mp4) video.src = mp4;
        });
    } else if (mp4) {
      video.src = mp4;
    }

    // Pause when offscreen, resume when visible.
    const io =
      typeof IntersectionObserver !== "undefined"
        ? new IntersectionObserver(
            ([entry]) => {
              if (entry.isIntersecting) video.play().catch(() => {});
              else video.pause();
            },
            { threshold: 0.25 },
          )
        : null;
    io?.observe(video);

    return () => {
      cancelled = true;
      io?.disconnect();
      hlsInstance?.destroy();
    };
  }, [hls, mp4]);

  return (
    <video
      ref={videoRef}
      poster={poster}
      autoPlay
      muted
      loop
      playsInline
      preload="none"
      className={className}
    />
  );
}
