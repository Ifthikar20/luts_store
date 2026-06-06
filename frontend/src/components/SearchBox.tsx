"use client";

import { Search, X } from "lucide-react";
import { cn } from "@/lib/format";

// Reusable controlled search input. The parent owns the value (so it can be
// debounced / synced to the URL); this component is purely presentational plus
// an optional submit handler for the Enter key.
export function SearchBox({
  value,
  onChange,
  onSubmit,
  placeholder = "Search looks, tags, styles…",
  autoFocus = false,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: (value: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
}) {
  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit?.(value);
      }}
      className={cn("relative", className)}
    >
      <Search className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate2" />
      <input
        type="search"
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label="Search products"
        className="w-full rounded-full border border-hairline bg-white py-3 pl-11 pr-11 text-sm text-graphite placeholder:text-slate2 shadow-soft transition-colors focus:border-sky focus:outline-none focus:ring-2 focus:ring-sky/30"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear search"
          className="absolute right-3 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full text-slate2 transition-colors hover:bg-cloud hover:text-graphite"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </form>
  );
}
