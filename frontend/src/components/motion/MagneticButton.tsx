"use client";

import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
} from "framer-motion";
import Link from "next/link";
import {
  forwardRef,
  type MouseEvent,
  type ReactNode,
  useRef,
} from "react";
import { cn } from "@/lib/format";

type CommonProps = {
  children: ReactNode;
  className?: string;
  variant?: "grade" | "ghost";
};

/**
 * A button/link that subtly follows the cursor (magnetic effect) with spring
 * physics. Renders a Link when `href` is provided, otherwise a button.
 * Disables the magnetic motion under prefers-reduced-motion.
 */
function useMagnetic(strength = 0.3) {
  const reduced = useReducedMotion() ?? false;
  const ref = useRef<HTMLElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 250, damping: 18, mass: 0.4 });
  const sy = useSpring(y, { stiffness: 250, damping: 18, mass: 0.4 });

  function onMove(e: MouseEvent) {
    if (reduced || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const relX = e.clientX - (rect.left + rect.width / 2);
    const relY = e.clientY - (rect.top + rect.height / 2);
    x.set(relX * strength);
    y.set(relY * strength);
  }
  function reset() {
    x.set(0);
    y.set(0);
  }
  return { ref, sx, sy, onMove, reset };
}

const base =
  "relative inline-flex items-center justify-center gap-2 rounded-full px-7 py-3.5 text-sm font-semibold will-change-transform";

const variants = {
  grade:
    "text-ink bg-grade-teal-orange bg-[length:200%_200%] animate-gradient-pan shadow-[0_8px_40px_-8px_rgba(22,216,198,0.55)] hover:shadow-[0_10px_50px_-6px_rgba(255,138,61,0.6)]",
  ghost:
    "text-white border border-white/15 bg-white/[0.03] backdrop-blur-md hover:bg-white/[0.08] hover:border-white/25",
};

type ButtonProps = CommonProps & {
  href?: undefined;
  onClick?: () => void;
  type?: "button" | "submit";
};
type LinkProps = CommonProps & { href: string };

export const MagneticButton = forwardRef<HTMLElement, ButtonProps | LinkProps>(
  function MagneticButton(props, _ref) {
    const { children, className, variant = "grade" } = props;
    const { ref, sx, sy, onMove, reset } = useMagnetic();
    const cls = cn(base, variants[variant], className);

    if ("href" in props && props.href) {
      return (
        <motion.span
          ref={ref as React.Ref<HTMLSpanElement>}
          style={{ x: sx, y: sy }}
          onMouseMove={onMove}
          onMouseLeave={reset}
          className="inline-block"
          whileTap={{ scale: 0.96 }}
        >
          <Link href={props.href} className={cls}>
            {children}
          </Link>
        </motion.span>
      );
    }

    const { onClick, type = "button" } = props as ButtonProps;
    return (
      <motion.button
        ref={ref as React.Ref<HTMLButtonElement>}
        type={type}
        onClick={onClick}
        style={{ x: sx, y: sy }}
        onMouseMove={onMove}
        onMouseLeave={reset}
        whileTap={{ scale: 0.96 }}
        className={cls}
      >
        {children}
      </motion.button>
    );
  },
);
