"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";

// A field of small graded frames that scatter in and snap together into one
// larger picture — visualising "many looks, one bundle". Plays once when the
// card scrolls into view; respects prefers-reduced-motion.
const PHOTOS = [
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
  "photo-1418065460487-3e41a6c84dc5",
  "photo-1419242902214-272b3f66ee7a",
  "photo-1469474968028-56623f02e42e",
  "photo-1470071459604-3b5ec3a7fe05",
  "photo-1502082553048-f009c37129b9",
  "photo-1507525428034-b723cf961d3e",
  "photo-1512790182412-b19e6d62bc39",
  "photo-1524504388940-b1c1722653e1",
  "photo-1533750349088-cd871a92f312",
  "photo-1536440136628-849c177e76a1",
  "photo-1490750967868-88aa4486c946",
  "photo-1500530855697-b586d89ba3ee",
].map((id) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=400&q=70`);

// CSS "grades" applied over the frames. Re-using a frame under a different
// grade is exactly what a LUT does (one shot, many looks), and it lets the
// mosaic show far more looks than there are source photos.
const GRADES = [
  "none",
  "saturate(1.45) contrast(1.08)",
  "hue-rotate(-18deg) saturate(1.25) contrast(1.05)",
  "hue-rotate(14deg) contrast(1.15) brightness(1.05)",
  "sepia(0.38) contrast(1.08) brightness(1.04)",
  "saturate(0.55) contrast(1.22)",
  "grayscale(0.9) contrast(1.18) brightness(1.06)",
  "hue-rotate(42deg) saturate(0.85) brightness(0.98)",
  "hue-rotate(-40deg) saturate(1.1) brightness(0.95) contrast(1.1)",
  "sepia(0.2) saturate(1.35) hue-rotate(-8deg)",
  "contrast(1.25) brightness(0.92) saturate(1.15)",
  "hue-rotate(160deg) saturate(0.7) contrast(1.1)",
];

// 55 tiles (11×5): every source frame appears under different grades, so the
// wall reads as 50+ distinct looks.
const TILE_COUNT = 55;
const TILES = Array.from({ length: TILE_COUNT }, (_, i) => ({
  src: PHOTOS[i % PHOTOS.length],
  filter: GRADES[(i * 7 + Math.floor(i / PHOTOS.length) * 5) % GRADES.length],
}));

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
        visible: { transition: { staggerChildren: reduced ? 0 : 0.02 } },
      }}
      className="grid h-full min-h-[340px] w-full grid-cols-11 grid-rows-5 gap-1 p-1.5"
    >
      {TILES.map((tile, i) => (
        <motion.div
          key={`${tile.src}-${i}`}
          custom={offsetFor(i)}
          variants={tileVariants}
          className="relative overflow-hidden rounded-[8px] bg-cloud"
        >
          <Image
            src={tile.src}
            alt=""
            fill
            sizes="(max-width: 768px) 9vw, 5vw"
            className="object-cover"
            style={tile.filter === "none" ? undefined : { filter: tile.filter }}
          />
        </motion.div>
      ))}
    </motion.div>
  );
}
