"use client";

import Image from "next/image";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import type { Collection } from "@/lib/types";

export function CategoryCard({ collection }: { collection: Collection }) {
  const reduced = useReducedMotion() ?? false;
  return (
    <motion.div
      whileHover={reduced ? undefined : { y: -6 }}
      transition={{ type: "spring", stiffness: 300, damping: 22 }}
      className="h-full"
    >
      <Link
        href={`/collections/${collection.handle}`}
        className="group relative flex h-full min-h-[280px] flex-col justify-end overflow-hidden rounded-[28px] p-6 shadow-soft transition-shadow duration-500 hover:shadow-lift"
      >
        <Image
          src={collection.image}
          alt={collection.title}
          fill
          sizes="(max-width: 768px) 100vw, 50vw"
          className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-black/5" />
        <div className="relative">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-2xl font-semibold tracking-tight text-white">
              {collection.title}
            </h3>
            <span className="grid h-9 w-9 place-items-center rounded-full bg-white/20 text-white backdrop-blur transition-colors group-hover:bg-white group-hover:text-graphite">
              <ArrowUpRight className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-2 max-w-sm text-sm text-white/80">
            {collection.description}
          </p>
          <p className="mt-3 text-xs uppercase tracking-widest text-white/65">
            {collection.productCount} pack
            {collection.productCount === 1 ? "" : "s"}
          </p>
        </div>
      </Link>
    </motion.div>
  );
}
