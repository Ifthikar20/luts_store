"use client";

import { motion } from "framer-motion";
import { ArrowRight, Play, Star } from "lucide-react";
import { GradientBlob } from "./motion/GradientBlob";
import { MagneticButton } from "./motion/MagneticButton";
import { HeroVideo } from "./HeroVideo";
import { HERO_VIDEO } from "@/lib/media";

const container = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12, delayChildren: 0.15 } },
};
const item = {
  hidden: { opacity: 0, y: 26 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] as const },
  },
};

export function Hero() {
  return (
    <section className="relative isolate flex min-h-[92vh] items-center overflow-hidden pb-24 pt-36 sm:pt-44">
      {/* Full-bleed cinematic video background (poster fallback + reduced motion). */}
      <HeroVideo src={HERO_VIDEO.src} poster={HERO_VIDEO.poster} />

      {/* Animated gradient blobs float above the video for depth. */}
      <GradientBlob
        grade="teal-orange"
        className="-left-40 top-10 z-[1]"
        size={620}
      />
      <GradientBlob
        grade="violet-magenta"
        className="-right-32 bottom-0 z-[1]"
        size={520}
        delay={3}
      />

      <div className="container-xl relative z-[2]">
        <motion.div
          variants={container}
          initial="hidden"
          animate="visible"
          className="max-w-3xl"
        >
          <motion.span
            variants={item}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-1.5 text-xs font-medium text-white/75 backdrop-blur"
          >
            <span className="flex">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  className="h-3.5 w-3.5 fill-orange-grade text-orange-grade"
                />
              ))}
            </span>
            Loved by 12,000+ editors
          </motion.span>

          <motion.h1
            variants={item}
            className="mt-6 font-display text-5xl font-bold leading-[1.02] tracking-tight text-white sm:text-6xl lg:text-7xl"
          >
            Color grade in{" "}
            <span className="text-grade-teal">one drag.</span>
          </motion.h1>

          <motion.p
            variants={item}
            className="mt-6 max-w-xl text-lg text-white/70"
          >
            Cinematic LUTs engineered by colorists — drop a{" "}
            <code className="rounded bg-white/10 px-1.5 py-0.5 text-sm text-white/90">
              .cube
            </code>{" "}
            onto your timeline and your footage looks like film. No guesswork,
            no endless wheels.
          </motion.p>

          <motion.div variants={item} className="mt-9 flex flex-wrap gap-3">
            <MagneticButton href="/collections/cinematic" variant="grade">
              Browse the looks
              <ArrowRight className="h-4 w-4" />
            </MagneticButton>
            <MagneticButton href="/#looks-in-motion" variant="ghost">
              <Play className="h-4 w-4" />
              See looks in motion
            </MagneticButton>
          </motion.div>

          <motion.div
            variants={item}
            className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-3 text-sm text-white/50"
          >
            <span>52+ LUTs</span>
            <span className="h-1 w-1 rounded-full bg-white/30" />
            <span>.cube &amp; .3dl</span>
            <span className="h-1 w-1 rounded-full bg-white/30" />
            <span>Resolve · Premiere · FCP</span>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
