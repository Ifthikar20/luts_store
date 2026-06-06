"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Play, Star } from "lucide-react";
import { GradientBlob } from "./motion/GradientBlob";
import { MagneticButton } from "./motion/MagneticButton";

const floatCards = [
  {
    img: "https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&w=600&q=80",
    label: "Nocturne",
    className: "left-0 top-6 w-44 rotate-[-7deg]",
    delay: 0.2,
  },
  {
    img: "https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=600&q=80",
    label: "Tropic",
    className: "right-2 top-0 w-40 rotate-[6deg]",
    delay: 0.35,
  },
  {
    img: "https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?auto=format&fit=crop&w=600&q=80",
    label: "Midnight Noir",
    className: "bottom-0 right-10 w-48 rotate-[-4deg]",
    delay: 0.5,
  },
];

const container = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12, delayChildren: 0.1 } },
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
  const reduced = useReducedMotion() ?? false;

  return (
    <section className="relative overflow-hidden pb-20 pt-36 sm:pt-44">
      <GradientBlob grade="teal-orange" className="-left-40 -top-20" size={620} />
      <GradientBlob
        grade="violet-magenta"
        className="-right-32 top-40"
        size={520}
        delay={3}
      />

      <div className="container-xl relative grid items-center gap-14 lg:grid-cols-[1.1fr_0.9fr]">
        <motion.div variants={container} initial="hidden" animate="visible">
          <motion.span
            variants={item}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-1.5 text-xs font-medium text-white/70 backdrop-blur"
          >
            <span className="flex">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className="h-3.5 w-3.5 fill-orange-grade text-orange-grade" />
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
            className="mt-6 max-w-xl text-lg text-white/60"
          >
            Cinematic LUTs engineered by colorists — drop a{" "}
            <code className="rounded bg-white/10 px-1.5 py-0.5 text-sm text-white/80">
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
            <MagneticButton href="/#before-after" variant="ghost">
              <Play className="h-4 w-4" />
              See it in action
            </MagneticButton>
          </motion.div>

          <motion.div
            variants={item}
            className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-3 text-sm text-white/45"
          >
            <span>52+ LUTs</span>
            <span className="h-1 w-1 rounded-full bg-white/30" />
            <span>.cube &amp; .3dl</span>
            <span className="h-1 w-1 rounded-full bg-white/30" />
            <span>Resolve · Premiere · FCP</span>
          </motion.div>
        </motion.div>

        {/* Floating LUT-card visual */}
        <div className="relative mx-auto hidden aspect-square w-full max-w-md lg:block">
          <motion.div
            initial={reduced ? false : { opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="absolute inset-6 overflow-hidden rounded-[2rem] border border-white/10"
          >
            <Image
              src="https://images.unsplash.com/photo-1506634572416-48cdfe530110?auto=format&fit=crop&w=900&q=80"
              alt="Graded cinematic still"
              fill
              priority
              sizes="400px"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-tr from-teal-grade/20 via-transparent to-orange-grade/25 mix-blend-overlay" />
          </motion.div>

          {floatCards.map((c) => (
            <motion.div
              key={c.label}
              initial={reduced ? false : { opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: c.delay }}
              className={`absolute ${c.className}`}
            >
              <motion.div
                animate={
                  reduced ? undefined : { y: [0, -10, 0] }
                }
                transition={{
                  duration: 5 + c.delay * 3,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
                className="glass overflow-hidden rounded-2xl p-1.5 shadow-2xl"
              >
                <div className="relative aspect-[4/3] overflow-hidden rounded-xl">
                  <Image
                    src={c.img}
                    alt={c.label}
                    fill
                    sizes="200px"
                    className="object-cover"
                  />
                </div>
                <p className="px-2 py-1.5 text-xs font-semibold text-white/85">
                  {c.label}
                </p>
              </motion.div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
