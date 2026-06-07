"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Aperture, Play } from "lucide-react";
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
          <motion.span
            variants={item}
            className="inline-flex items-center gap-2 rounded-full border border-hairline bg-white px-4 py-1.5 text-xs font-medium text-slate2 shadow-soft"
          >
            <Aperture className="h-3.5 w-3.5 text-sky" />
            For log &amp; flat footage
          </motion.span>

          <motion.h1
            variants={item}
            className="mt-7 font-display text-5xl font-bold leading-[1.04] tracking-tightest text-graphite sm:text-6xl lg:text-7xl"
          >
            Color grade in one drag.
          </motion.h1>

          <motion.p
            variants={item}
            className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-slate2 sm:text-xl"
          >
            Hand-built{" "}
            <code className="rounded-md bg-cloud px-1.5 py-0.5 text-base text-graphite">
              .cube
            </code>{" "}
            LUTs for log footage. Drag one onto your clip — and it just looks
            right.
          </motion.p>

          <motion.div
            variants={item}
            className="mt-9 flex flex-wrap items-center justify-center gap-3"
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

          <motion.div
            variants={item}
            className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-slate2"
          >
            <span>Resolve, Premiere &amp; Final Cut</span>
            <span className="h-1 w-1 rounded-full bg-hairline" />
            <span>.cube &amp; .3dl</span>
            <span className="h-1 w-1 rounded-full bg-hairline" />
            <span>Buy once</span>
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
