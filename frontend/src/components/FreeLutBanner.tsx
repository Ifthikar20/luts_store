"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Gift, X } from "lucide-react";
import { getFreeLut } from "@/lib/api";
import type { Product } from "@/lib/types";

/**
 * Promo banner for the weekly free LUT. Fetches the product tagged "free";
 * renders nothing if there isn't one. Dismissible — the dismissal is keyed to
 * the current free product's handle, so a NEW week's LUT re-shows the banner.
 */
export function FreeLutBanner() {
  const reduced = useReducedMotion() ?? false;
  const [lut, setLut] = useState<Product | null>(null);
  const [dismissed, setDismissed] = useState(true);
  // Pops in 5 seconds after landing (not immediately).
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    let active = true;
    getFreeLut().then((p) => {
      if (!active || !p) return;
      setLut(p);
      try {
        const key = `luts:free-banner-dismissed:${p.handle}`;
        setDismissed(window.localStorage.getItem(key) === "1");
      } catch {
        setDismissed(false);
      }
    });
    const timer = setTimeout(() => setRevealed(true), 5000);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, []);

  const dismiss = () => {
    if (!lut) return;
    setDismissed(true);
    try {
      window.localStorage.setItem(`luts:free-banner-dismissed:${lut.handle}`, "1");
    } catch {
      /* storage unavailable — banner just won't persist dismissal */
    }
  };

  // While the banner occupies the top strip, push the floating nav down via a
  // CSS variable (the nav's `top` reads --promo-h). Measured from the real
  // element (it can wrap to two lines on mobile); reset on hide/unmount so the
  // header springs back up.
  const visible = Boolean(lut && !dismissed && revealed);
  const barRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = document.documentElement;
    if (!visible) {
      root.style.setProperty("--promo-h", "0px");
      return;
    }
    const el = barRef.current;
    const apply = () =>
      root.style.setProperty("--promo-h", `${el?.offsetHeight ?? 44}px`);
    apply();
    const ro =
      el && typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(apply)
        : null;
    if (el && ro) ro.observe(el);
    return () => {
      ro?.disconnect();
      root.style.setProperty("--promo-h", "0px");
    };
  }, [visible]);

  return (
    <AnimatePresence>
      {lut && !dismissed && revealed && (
        <motion.div
          ref={barRef}
          initial={reduced ? { opacity: 0 } : { y: -72, opacity: 0 }}
          animate={reduced ? { opacity: 1 } : { y: 0, opacity: 1 }}
          exit={reduced ? { opacity: 0 } : { y: -72, opacity: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 24 }}
          // Owns the very top strip; the floating nav reads --promo-h and
          // shifts down below it while visible (set in the effect above).
          className="fixed inset-x-0 top-0 z-[60] overflow-hidden border-b border-hairline bg-white/95 shadow-soft backdrop-blur-xl"
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-gradient-to-r from-sky/10 via-[#8e5cff]/10 to-[#ff5e7e]/10"
          />
          {/* Sheen: a soft highlight that sweeps across the strip on a loop. */}
          {!reduced && (
            <motion.div
              aria-hidden
              className="pointer-events-none absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/40 to-transparent"
              initial={{ x: "-150%" }}
              animate={{ x: "350%" }}
              transition={{
                duration: 2.4,
                ease: "easeInOut",
                repeat: Infinity,
                repeatDelay: 3.5,
              }}
            />
          )}

          <div className="container-xl relative flex flex-wrap items-center justify-center gap-x-4 gap-y-2 py-2.5 pr-10 text-center text-sm">
            <span className="inline-flex items-center gap-2 font-medium text-graphite">
              <motion.span
                animate={
                  reduced
                    ? undefined
                    : { rotate: [0, -12, 12, -8, 8, 0], scale: [1, 1.15, 1] }
                }
                transition={{
                  duration: 1,
                  ease: "easeInOut",
                  repeat: Infinity,
                  repeatDelay: 2.5,
                }}
                className="inline-flex"
              >
                <Gift className="h-4 w-4 text-sky" />
              </motion.span>
              <span className="font-semibold">Free LUT of the week:</span>
              <motion.span
                key={lut.handle}
                initial={reduced ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25, duration: 0.5 }}
                className="font-semibold text-sky"
              >
                {lut.title}
              </motion.span>
            </span>
            <Link
              href={`/luts/${lut.handle}`}
              className="group inline-flex items-center gap-1 rounded-full bg-sky px-4 py-1.5 text-xs font-semibold text-white shadow-[0_2px_10px_rgba(0,113,227,0.3)] transition-colors hover:bg-sky-hover"
            >
              Get it free
              <span className="transition-transform duration-300 group-hover:translate-x-1">
                →
              </span>
            </Link>
          </div>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Dismiss"
            className="absolute right-3 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full text-slate2 transition-colors hover:bg-black/5 hover:text-graphite"
          >
            <X className="h-4 w-4" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
