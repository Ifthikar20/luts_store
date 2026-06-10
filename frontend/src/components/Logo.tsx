"use client";

import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib/format";

/**
 * Brand logo. Renders the uploaded artwork at frontend/public/main-logo.png
 * (served at /main-logo.png), scaled by height so any aspect ratio works. If
 * that file is missing, it gracefully falls back to the serif wordmark — so the
 * header is never broken. Drop your file at `frontend/public/main-logo.png`.
 */
export function Logo({
  className,
  // Kept for call-site compatibility; the image is the full logo regardless.
  wordmark: _wordmark = true,
}: {
  className?: string;
  wordmark?: boolean;
}) {
  const [errored, setErrored] = useState(false);

  if (errored) {
    return (
      <span
        className={cn("inline-flex items-center text-graphite", className)}
        style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
      >
        <span className="text-[19px] font-semibold tracking-tight">
          Luts<span className="text-slate2">.store</span>
        </span>
      </span>
    );
  }

  return (
    <span className={cn("inline-flex items-center", className)}>
      <Image
        src="/main-logo.png"
        alt="Luts.store"
        width={180}
        height={40}
        priority
        sizes="180px"
        className="h-8 w-auto sm:h-9"
        onError={() => setErrored(true)}
      />
    </span>
  );
}
