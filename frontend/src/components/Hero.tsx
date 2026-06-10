"use client";

import { motion, useReducedMotion } from "framer-motion";
import { HeroVideo } from "./HeroVideo";
import { HERO_VIDEO } from "@/lib/media";

const media = {
  hidden: { opacity: 0, y: 32, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.9, ease: [0.22, 1, 0.36, 1] as const },
  },
};

export function Hero() {
  const reduced = useReducedMotion() ?? false;
  return (
    <section className="relative overflow-hidden bg-paper pb-20 pt-32 sm:pt-40">
      {/* Faint, light pastel wash for a touch of depth — never heavy. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-wash-light opacity-70"
      />

      <div className="relative">
        {/* Large rounded media showcase — full-bleed to the viewport so it's
            the dominant hero centrepiece. */}
        <motion.div
          variants={reduced ? undefined : media}
          initial={reduced ? false : "hidden"}
          animate={reduced ? undefined : "visible"}
          className="relative left-1/2 w-screen max-w-[1800px] -translate-x-1/2 px-4 sm:px-6"
        >
          <HeroVideo sources={HERO_VIDEO.sources} poster={HERO_VIDEO.poster} />
        </motion.div>
      </div>
    </section>
  );
}
