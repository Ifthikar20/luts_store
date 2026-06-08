"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Play } from "lucide-react";
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
const controls = {
  hidden: { opacity: 0, y: 14 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, delay: 0.55, ease: [0.22, 1, 0.36, 1] as const },
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

      <div className="container-xl relative">
        {/* Large rounded media showcase with frosted-glass controls floating on
            the playing video — the Apple hero centrepiece. */}
        <motion.div
          variants={reduced ? undefined : media}
          initial={reduced ? false : "hidden"}
          animate={reduced ? undefined : "visible"}
          className="relative mx-auto max-w-5xl"
        >
          <HeroVideo src={HERO_VIDEO.src} poster={HERO_VIDEO.poster} />

          {/* Soft scrim so the glass pills stay legible over bright frames. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 rounded-b-[28px] bg-gradient-to-t from-black/55 via-black/15 to-transparent sm:rounded-b-[40px]"
          />

          <motion.div
            variants={reduced ? undefined : controls}
            initial={reduced ? false : "hidden"}
            animate={reduced ? undefined : "visible"}
            className="absolute inset-x-0 bottom-5 flex flex-wrap items-center justify-center gap-3 px-4 sm:bottom-9"
          >
            <Link href="/collections/cinematic" className="btn-glass-strong">
              Shop LUTs
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/#looks-in-motion" className="btn-glass">
              <Play className="h-4 w-4" />
              See it in motion
            </Link>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
