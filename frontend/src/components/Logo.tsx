import { cn } from "@/lib/format";

/**
 * Wordmark logo: "Luts.shop" set in the app's sans (Inter) at a slim medium
 * weight — a clean, all-black geometric mark, no image asset required.
 */
export function Logo({
  className,
  // Kept for call-site compatibility.
  wordmark: _wordmark = true,
}: {
  className?: string;
  wordmark?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center text-[20px] font-medium leading-none tracking-tight text-black sm:text-[22px]",
        className,
      )}
    >
      Luts.shop
    </span>
  );
}
