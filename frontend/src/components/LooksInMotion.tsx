"use client";

import { VideoCard } from "./VideoCard";
import { StaggerGroup, StaggerItem } from "./motion/Reveal";
import { BENTO_CLIPS, type BentoClip } from "@/lib/media";

// Map a bento "span" to its grid footprint. With one `big` (2×2) tile and the
// rest `wide` (2×1), five clips tile a 4-column × 3-row grid with no gaps — and
// on the 2-column mobile grid the big tile spans full width, so nothing is left
// hanging on its own.
const spanClass: Record<BentoClip["span"], string> = {
  big: "col-span-2 md:row-span-2",
  wide: "md:col-span-2",
  tall: "md:row-span-2",
  normal: "",
};

export function LooksInMotion() {
  return (
    <StaggerGroup
      className="grid auto-rows-[200px] grid-cols-2 gap-4 sm:auto-rows-[230px] md:grid-cols-4"
      stagger={0.06}
    >
      {BENTO_CLIPS.map((c) => (
        <StaggerItem key={c.id} className={spanClass[c.span]}>
          <VideoCard
            src={c.src}
            poster={c.poster}
            alt={`${c.title} — ${c.mood}`}
            rounded="rounded-[24px]"
          >
            <div className="pointer-events-none absolute inset-x-0 bottom-0 p-5">
              <p className="font-display text-lg font-semibold text-white drop-shadow">
                {c.title}
              </p>
              <p className="mt-0.5 text-xs text-white/80">{c.mood}</p>
            </div>
          </VideoCard>
        </StaggerItem>
      ))}
    </StaggerGroup>
  );
}
