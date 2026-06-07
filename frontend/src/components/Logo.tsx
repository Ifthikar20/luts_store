import { cn } from "@/lib/format";

/**
 * Classical Luts.store logo: a fine double-ring medallion with lens "ticks" and
 * an italic serif "L" monogram, paired with a serif wordmark. Monochrome — it
 * inherits the current text color (graphite in the nav/footer), so it stays
 * elegant and timeless on the white theme. Serif type is rendered with the
 * system serif stack so it needs no font download.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 44 44"
      className={className}
      fill="none"
      role="img"
      aria-label="Luts.store"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="22" cy="22" r="20.5" stroke="currentColor" strokeWidth="1.25" />
      <circle
        cx="22"
        cy="22"
        r="15.5"
        stroke="currentColor"
        strokeWidth="0.75"
        opacity="0.45"
      />
      {/* lens ticks (N / E / S / W) bridging the two rings */}
      <g stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.8">
        <line x1="22" y1="1.5" x2="22" y2="6.5" />
        <line x1="22" y1="37.5" x2="22" y2="42.5" />
        <line x1="1.5" y1="22" x2="6.5" y2="22" />
        <line x1="37.5" y1="22" x2="42.5" y2="22" />
      </g>
      <text
        x="22"
        y="22"
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily='Georgia, "Times New Roman", serif'
        fontStyle="italic"
        fontSize="19"
        fill="currentColor"
      >
        L
      </text>
    </svg>
  );
}

export function Logo({
  className,
  wordmark = true,
}: {
  className?: string;
  wordmark?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5 text-graphite", className)}>
      <LogoMark className="h-8 w-8 shrink-0" />
      {wordmark && (
        <span
          className="text-[19px] font-semibold tracking-tight"
          style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
        >
          Luts<span className="text-slate2">.store</span>
        </span>
      )}
    </span>
  );
}
