"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowDownUp, Check, ChevronDown } from "lucide-react";
import type { SortKey } from "@/lib/types";
import { cn } from "@/lib/format";

const OPTIONS: { value: SortKey; label: string }[] = [
  { value: "featured", label: "Featured" },
  { value: "price-asc", label: "Price: Low to High" },
  { value: "price-desc", label: "Price: High to Low" },
  { value: "title-asc", label: "Title: A–Z" },
  { value: "newest", label: "Newest" },
];

// Animated, on-brand sort dropdown. Respects prefers-reduced-motion and closes
// on outside-click / Escape.
export function SortSelect({
  value,
  onChange,
}: {
  value: SortKey;
  onChange: (value: SortKey) => void;
}) {
  const reduced = useReducedMotion() ?? false;
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = OPTIONS.find((o) => o.value === value) ?? OPTIONS[0];

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="inline-flex items-center gap-2 rounded-full border border-hairline bg-white px-4 py-2.5 text-sm font-medium text-graphite shadow-soft transition-colors hover:bg-cloud"
      >
        <ArrowDownUp className="h-4 w-4 text-slate2" />
        <span className="hidden sm:inline text-slate2">Sort:</span>
        <span>{current.label}</span>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-slate2 transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.ul
            role="listbox"
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="glass absolute right-0 z-30 mt-2 w-56 overflow-hidden rounded-2xl p-1.5"
          >
            {OPTIONS.map((o) => (
              <li key={o.value}>
                <button
                  type="button"
                  role="option"
                  aria-selected={o.value === value}
                  onClick={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm transition-colors",
                    o.value === value
                      ? "bg-cloud text-graphite"
                      : "text-slate2 hover:bg-cloud hover:text-graphite",
                  )}
                >
                  {o.label}
                  {o.value === value && (
                    <Check className="h-4 w-4 text-sky" />
                  )}
                </button>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
