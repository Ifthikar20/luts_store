"use client";

import { useEffect, useRef } from "react";
import { animate, useInView, useReducedMotion } from "framer-motion";

// A number that ticks up from 0 to `to` the first time it scrolls into view.
// Respects prefers-reduced-motion (renders the final value with no animation).
export function CountUp({
  to,
  duration = 1.4,
  className,
}: {
  to: number;
  duration?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const reduced = useReducedMotion() ?? false;

  useEffect(() => {
    const el = ref.current;
    if (!el || !inView) return;
    if (reduced) {
      el.textContent = String(to);
      return;
    }
    const controls = animate(0, to, {
      duration,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => {
        el.textContent = String(Math.round(v));
      },
    });
    return () => controls.stop();
  }, [inView, reduced, to, duration]);

  // SSR / pre-view renders 0 (or the final value when motion is reduced).
  return (
    <span ref={ref} className={className}>
      {reduced ? to : 0}
    </span>
  );
}
