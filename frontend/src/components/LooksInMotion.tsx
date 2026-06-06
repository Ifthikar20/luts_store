"use client";

import { VideoCard } from "./VideoCard";
import { StaggerGroup, StaggerItem } from "./motion/Reveal";
import { BENTO_CLIPS, type BentoClip } from "@/lib/media";

// Map a bento "span" to its grid footprint. The grid is 4 columns on desktop so
// mixed sizes tile like a gallery of graded clips.
const spanClass: Record<BentoClip["span"], string> = {
  big: "md:col-span-2 md:row-span-2",
  wide: "md:col-span-2",
  tall: "md:row-span-2",
  normal: "",
};

export function LooksInMotion() {
  return (
    <StaggerGroup
      className="grid auto-rows-[180px] grid-cols-2 gap-4 sm:auto-rows-[210px] md:grid-cols-4"
      stagger={0.06}
    >
      {BENTO_CLIPS.map((c) => (
        <StaggerItem key={c.id} className={spanClass[c.span]}>
          <VideoCard
            src={c.src}
            poster={c.poster}
            alt={`${c.title} — ${c.mood}`}
          >
            <div className="pointer-events-none absolute inset-x-0 bottom-0 p-5">
              <p className="font-display text-lg font-semibold text-white drop-shadow">
                {c.title}
              </p>
              <p className="mt-0.5 text-xs text-white/70">{c.mood}</p>
            </div>
          </VideoCard>
        </StaggerItem>
      ))}
    </StaggerGroup>
  );
}
