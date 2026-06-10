"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Gift, X } from "lucide-react";
import { getFreeLut } from "@/lib/api";
import type { Product } from "@/lib/types";

/**
 * Promo banner for the weekly free LUT. Fetches the product tagged "free";
 * renders nothing if there isn't one. Dismissible — the dismissal is keyed to
 * the current free product's handle, so a NEW week's LUT re-shows the banner.
 */
export function FreeLutBanner() {
  const [lut, setLut] = useState<Product | null>(null);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    let active = true;
    getFreeLut().then((p) => {
      if (!active || !p) return;
      setLut(p);
      try {
        const key = `luts:free-banner-dismissed:${p.handle}`;
        setDismissed(window.localStorage.getItem(key) === "1");
      } catch {
        setDismissed(false);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  if (!lut || dismissed) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      window.localStorage.setItem(`luts:free-banner-dismissed:${lut.handle}`, "1");
    } catch {
      /* storage unavailable — banner just won't persist dismissal */
    }
  };

  return (
    <div className="relative overflow-hidden border-b border-hairline bg-gradient-to-r from-sky/10 via-[#8e5cff]/10 to-[#ff5e7e]/10">
      <div className="container-xl flex flex-wrap items-center justify-center gap-x-4 gap-y-2 py-2.5 pr-10 text-center text-sm">
        <span className="inline-flex items-center gap-2 font-medium text-graphite">
          <Gift className="h-4 w-4 text-sky" />
          <span className="font-semibold">Free LUT of the week:</span>
          <span className="text-slate2">{lut.title}</span>
        </span>
        <Link
          href={`/luts/${lut.handle}`}
          className="inline-flex items-center rounded-full bg-sky px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-sky-hover"
        >
          Get it free →
        </Link>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="absolute right-3 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full text-slate2 transition-colors hover:bg-black/5 hover:text-graphite"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
