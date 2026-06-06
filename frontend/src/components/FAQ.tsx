"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Plus } from "lucide-react";
import { useState } from "react";

const FAQS = [
  {
    q: "What exactly do I get when I buy a pack?",
    a: "An instant download containing .cube (and where noted, .3dl) LUT files. No subscriptions, no watermarks — the files are yours forever, including free updates to that pack.",
  },
  {
    q: "Which apps do these LUTs work in?",
    a: "Any editor or color tool that supports standard 3D LUTs: Premiere Pro, DaVinci Resolve, Final Cut Pro, LumaFusion, Photoshop and more. Each product lists its tested apps under “What's included”.",
  },
  {
    q: "How do I apply a LUT?",
    a: "Add a color/LUT layer in your editor, load the .cube file, and dial the intensity to taste. It really is one drag — most editors apply it in a single step.",
  },
  {
    q: "Do LUTs work with log and standard footage?",
    a: "Our cinematic packs are built for Rec.709 by default, with notes for converting log footage first. Bundles include a Rec.709 set so you can grade straight out of camera.",
  },
  {
    q: "What's your refund policy?",
    a: "Because LUTs are instantly delivered digital goods, sales are final — but if a file is corrupt or won't load, contact us and we'll make it right immediately.",
  },
];

export function FAQ() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="mx-auto max-w-3xl divide-y divide-white/10 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.02]">
      {FAQS.map((item, i) => {
        const isOpen = open === i;
        return (
          <div key={item.q}>
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : i)}
              className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
              aria-expanded={isOpen}
            >
              <span className="font-display text-lg font-medium text-white">
                {item.q}
              </span>
              <motion.span
                animate={{ rotate: isOpen ? 45 : 0 }}
                transition={{ duration: 0.2 }}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-white/15 text-white/80"
              >
                <Plus className="h-4 w-4" />
              </motion.span>
            </button>
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                  className="overflow-hidden"
                >
                  <p className="px-6 pb-6 text-white/60">{item.a}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
