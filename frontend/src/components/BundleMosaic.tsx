"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";

// A field of small graded frames that scatter in and snap together into one
// larger picture — visualising "many looks, one bundle". Plays once when the
// card scrolls into view; respects prefers-reduced-motion.
const TILES = [
  "photo-1492691527719-9d1e07e534b4",
  "photo-1470770841072-f978cf4d019e",
  "photo-1449824913935-59a10b8d2000",
  "photo-1485846234645-a62644f84728",
  "photo-1500534623283-312aade485b7",
  "photo-1444723121867-7a241cacace9",
  "photo-1503023345310-bd7c1de61c7d",
  "photo-1440404653325-ab127d49abc1",
  "photo-1480714378408-67cf0d13bc1b",
  "photo-1506905925346-21bda4d32df4",
  "photo-1542038784456-1ea8e935640e",
  "photo-1500051638674-ff996a0ec29e",
].map((id) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=400&q=70`);

// Deterministic pseudo-random (stable across SSR/CSR — avoids hydration drift).
const rand = (n: number) => {
  const r = Math.sin(n * 99.73) * 10000;
  return r - Math.floor(r);
};

const offsetFor = (i: number) => ({
  x: (rand(i) - 0.5) * 260,
  y: (rand(i + 7) - 0.5) * 260,
  rotate: (rand(i + 3) - 0.5) * 50,
});

export function BundleMosaic() {
  const reduced = useReducedMotion() ?? false;

  const tileVariants = {
    hidden: (c: { x: number; y: number; rotate: number }) =>
      reduced
        ? { opacity: 0 }
        : { opacity: 0, x: c.x, y: c.y, rotate: c.rotate, scale: 0.4 },
    visible: {
      opacity: 1,
      x: 0,
      y: 0,
      rotate: 0,
      scale: 1,
      transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] as const },
    },
  };

  return (
    <motion.div
      aria-hidden
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.3 }}
      variants={{
        hidden: {},
        visible: { transition: { staggerChildren: reduced ? 0 : 0.05 } },
      }}
      className="grid h-full min-h-[320px] w-full grid-cols-4 grid-rows-3 gap-1.5 p-1.5"
    >
      {TILES.map((src, i) => (
        <motion.div
          key={src}
          custom={offsetFor(i)}
          variants={tileVariants}
          className="relative overflow-hidden rounded-[10px] bg-cloud"
        >
          <Image
            src={src}
            alt=""
            fill
            sizes="(max-width: 768px) 25vw, 13vw"
            className="object-cover"
          />
        </motion.div>
      ))}
    </motion.div>
  );
}
