"use client";

import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/format";

type Grade = "teal-orange" | "violet-magenta";

// Very faint, light pastel washes for a subtle sense of depth on white pages.
// Restrained on purpose — Apple-style sites keep accents minimal.
const gradients: Record<Grade, string> = {
  "teal-orange":
    "radial-gradient(circle at 30% 30%, rgba(0,113,227,0.10), transparent 60%), radial-gradient(circle at 70% 70%, rgba(0,113,227,0.06), transparent 60%)",
  "violet-magenta":
    "radial-gradient(circle at 30% 30%, rgba(88,86,214,0.09), transparent 60%), radial-gradient(circle at 70% 70%, rgba(0,113,227,0.06), transparent 60%)",
};

/**
 * Soft, heavily-blurred light pastel wash for white backgrounds. Non-interactive
 * and very low opacity. Stops animating under prefers-reduced-motion.
 */
export function GradientBlob({
  grade = "teal-orange",
  className,
  size = 520,
  delay = 0,
}: {
  grade?: Grade;
  className?: string;
  size?: number;
  delay?: number;
}) {
  const reduced = useReducedMotion() ?? false;
  return (
    <motion.div
      aria-hidden
      className={cn("pointer-events-none absolute rounded-full blur-3xl", className)}
      style={{
        width: size,
        height: size,
        backgroundImage: gradients[grade],
        opacity: 0.8,
      }}
      animate={
        reduced
          ? undefined
          : {
              x: [0, 24, -16, 0],
              y: [0, -30, 16, 0],
              scale: [1, 1.08, 0.98, 1],
            }
      }
      transition={{
        duration: 22,
        ease: "easeInOut",
        repeat: Infinity,
        delay,
      }}
    />
  );
}
