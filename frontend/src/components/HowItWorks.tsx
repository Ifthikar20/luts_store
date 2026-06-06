"use client";

import { Download, MousePointerClick, ShoppingBag } from "lucide-react";
import { StaggerGroup, StaggerItem } from "./motion/Reveal";

const steps = [
  {
    icon: ShoppingBag,
    title: "Buy",
    body: "Pick a look or a bundle and check out securely. Instant access — no account gymnastics.",
  },
  {
    icon: Download,
    title: "Download .cube",
    body: "Grab your LUT files in .cube (and .3dl where included). Yours forever, with free updates.",
  },
  {
    icon: MousePointerClick,
    title: "Drag & drop",
    body: "Drop the LUT onto your timeline or a color node, dial the intensity, and you're graded.",
  },
];

export function HowItWorks() {
  return (
    <StaggerGroup className="grid gap-6 md:grid-cols-3">
      {steps.map((s, i) => (
        <StaggerItem
          key={s.title}
          className="glass relative overflow-hidden rounded-3xl p-7"
        >
          <span className="absolute right-5 top-4 font-display text-6xl font-bold text-white/[0.05]">
            {i + 1}
          </span>
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-grade-teal-orange text-ink">
            <s.icon className="h-6 w-6" />
          </span>
          <h3 className="mt-5 font-display text-xl font-semibold text-white">
            {s.title}
          </h3>
          <p className="mt-2 text-sm text-white/55">{s.body}</p>
        </StaggerItem>
      ))}
    </StaggerGroup>
  );
}
