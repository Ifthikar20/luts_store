"use client";

import { motion, useReducedMotion } from "framer-motion";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/**
 * Lightweight per-route fade/slide. Keyed on pathname so navigations re-trigger
 * the entrance. Skipped under prefers-reduced-motion.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion() ?? false;
  const pathname = usePathname();
  if (reduced) return <>{children}</>;
  return (
    <motion.div
      key={pathname}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
