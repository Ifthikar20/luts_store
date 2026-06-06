"use client";

import type { ReactNode } from "react";
import { useReducedMotion } from "framer-motion";
import { cn } from "@/lib/format";

/**
 * Infinite horizontal marquee. Duplicates its children so the CSS translateX
 * loop (defined in tailwind.config.ts) is seamless. Pauses under
 * prefers-reduced-motion (animation is neutralised globally in globals.css too).
 */
export function Marquee({
  children,
  className,
  reverse = false,
}: {
  children: ReactNode;
  className?: string;
  reverse?: boolean;
}) {
  const reduced = useReducedMotion() ?? false;
  return (
    <div
      className={cn(
        "group relative flex w-full overflow-hidden",
        // fade edges
        "[mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]",
        className,
      )}
    >
      <div
        className={cn(
          "flex min-w-full shrink-0 items-center gap-10",
          !reduced && "animate-marquee group-hover:[animation-play-state:paused]",
        )}
        style={reverse ? { animationDirection: "reverse" } : undefined}
      >
        {children}
      </div>
      {!reduced && (
        <div
          aria-hidden
          className="flex min-w-full shrink-0 items-center gap-10 animate-marquee group-hover:[animation-play-state:paused]"
          style={reverse ? { animationDirection: "reverse" } : undefined}
        >
          {children}
        </div>
      )}
    </div>
  );
}
