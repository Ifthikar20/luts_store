"use client";

import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/format";

type Grade = "teal-orange" | "violet-magenta";

const gradients: Record<Grade, string> = {
  "teal-orange":
    "radial-gradient(circle at 30% 30%, rgba(22,216,198,0.55), transparent 60%), radial-gradient(circle at 70% 70%, rgba(255,138,61,0.45), transparent 60%)",
  "violet-magenta":
    "radial-gradient(circle at 30% 30%, rgba(139,92,246,0.5), transparent 60%), radial-gradient(circle at 70% 70%, rgba(236,72,153,0.45), transparent 60%)",
};

/**
 * Soft animated gradient blob for cinematic backgrounds. Heavily blurred and
 * non-interactive. Stops animating under prefers-reduced-motion.
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
        opacity: 0.45,
      }}
      animate={
        reduced
          ? undefined
          : {
              x: [0, 30, -20, 0],
              y: [0, -40, 20, 0],
              scale: [1, 1.12, 0.96, 1],
            }
      }
      transition={{
        duration: 18,
        ease: "easeInOut",
        repeat: Infinity,
        delay,
      }}
    />
  );
}
