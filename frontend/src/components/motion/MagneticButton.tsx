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
 *
 * Anti-flicker: pointer events live on a STATIONARY wrapper while only the inner
 * element translates. If the moving element itself owned the listeners, shifting
 * it toward the cursor could move its edge past the pointer → mouseleave →
 * reset → mouseenter → oscillation. The offset is also clamped so it never jumps
 * far enough to slip out from under the cursor.
 */
const clamp = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, v));

function useMagnetic(strength = 0.25, max = 12) {
  const reduced = useReducedMotion() ?? false;
  const ref = useRef<HTMLSpanElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 250, damping: 20, mass: 0.4 });
  const sy = useSpring(y, { stiffness: 250, damping: 20, mass: 0.4 });

  function onMove(e: MouseEvent) {
    if (reduced || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const relX = (e.clientX - (rect.left + rect.width / 2)) * strength;
    const relY = (e.clientY - (rect.top + rect.height / 2)) * strength;
    x.set(clamp(relX, -max, max));
    y.set(clamp(relY, -max, max));
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
    "text-white bg-sky shadow-[0_2px_10px_rgba(0,113,227,0.25)] transition-colors hover:bg-sky-hover",
  ghost:
    "text-graphite bg-haze transition-colors hover:bg-[#dcdce2]",
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
        <span
          ref={ref}
          onMouseMove={onMove}
          onMouseLeave={reset}
          className="inline-block"
        >
          <motion.span
            style={{ x: sx, y: sy }}
            className="inline-block will-change-transform"
            whileTap={{ scale: 0.96 }}
          >
            <Link href={props.href} className={cls}>
              {children}
            </Link>
          </motion.span>
        </span>
      );
    }

    const { onClick, type = "button" } = props as ButtonProps;
    return (
      <span
        ref={ref}
        onMouseMove={onMove}
        onMouseLeave={reset}
        className="inline-block"
      >
        <motion.button
          type={type}
          onClick={onClick}
          style={{ x: sx, y: sy }}
          whileTap={{ scale: 0.96 }}
          className={cls}
        >
          {children}
        </motion.button>
      </span>
    );
  },
);
