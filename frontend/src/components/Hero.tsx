"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Play } from "lucide-react";
import { HeroVideo } from "./HeroVideo";
import { HERO_VIDEO } from "@/lib/media";

const container = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1, delayChildren: 0.1 } },
};
const item = {
  hidden: { opacity: 0, y: 18 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] as const },
  },
};
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
    <section className="relative overflow-hidden bg-paper pb-16 pt-36 sm:pt-44">
      {/* Faint, light pastel wash for a touch of depth — never heavy. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-wash-light opacity-70"
      />

      <div className="container-xl relative">
        <motion.div
          variants={reduced ? undefined : container}
          initial={reduced ? false : "hidden"}
          animate={reduced ? undefined : "visible"}
          className="mx-auto max-w-3xl text-center"
        >
          <motion.div
            variants={item}
            className="flex flex-wrap items-center justify-center gap-3"
          >
            <Link href="/collections/cinematic" className="btn-grade">
              Shop LUTs
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/#looks-in-motion" className="btn-ghost">
              <Play className="h-4 w-4" />
              See it in motion
            </Link>
          </motion.div>
        </motion.div>

        {/* Large rounded media showcase — the Apple hero centrepiece. */}
        <motion.div
          variants={reduced ? undefined : media}
          initial={reduced ? false : "hidden"}
          animate={reduced ? undefined : "visible"}
          className="mx-auto mt-14 max-w-5xl"
        >
          <HeroVideo src={HERO_VIDEO.src} poster={HERO_VIDEO.poster} />
        </motion.div>
      </div>
    </section>
  );
}
