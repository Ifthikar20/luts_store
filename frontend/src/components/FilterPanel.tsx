"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { SlidersHorizontal, X } from "lucide-react";
import type { Facets } from "@/lib/types";
import type { DiscoveryState } from "@/lib/useProductQuery";
import { cn } from "@/lib/format";

// Glassmorphism filter sidebar: price min/max, tag checkboxes (ANY-match),
// productType pills, and a clear-all. Collapsible on mobile with an animated
// disclosure; always visible on lg+.
export function FilterPanel({
  facets,
  state,
  onPriceChange,
  onToggleTag,
  onSetProductType,
  onClear,
}: {
  facets: Facets | null;
  state: DiscoveryState;
  onPriceChange: (min?: number, max?: number) => void;
  onToggleTag: (tag: string) => void;
  onSetProductType: (type?: string) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);

  const activeCount =
    state.tags.length +
    (state.productType ? 1 : 0) +
    (state.minPrice != null ? 1 : 0) +
    (state.maxPrice != null ? 1 : 0);

  return (
    <div className="lg:sticky lg:top-28">
      {/* Mobile toggle */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="mb-4 flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-medium text-white/80 backdrop-blur-xl lg:hidden"
      >
        <span className="inline-flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-white/50" />
          Filters
          {activeCount > 0 && (
            <span className="grid h-5 min-w-5 place-items-center rounded-full bg-grade-teal-orange px-1 text-[11px] font-bold text-ink">
              {activeCount}
            </span>
          )}
        </span>
        <span className="text-white/40">{open ? "Hide" : "Show"}</span>
      </button>

      {/* Mobile: animated disclosure. Desktop: always shown. */}
      <div className="hidden lg:block">
        <FilterBody
          facets={facets}
          state={state}
          activeCount={activeCount}
          onPriceChange={onPriceChange}
          onToggleTag={onToggleTag}
          onSetProductType={onSetProductType}
          onClear={onClear}
        />
      </div>
      <div className="lg:hidden">
        <MobileDisclosure open={open}>
          <FilterBody
            facets={facets}
            state={state}
            activeCount={activeCount}
            onPriceChange={onPriceChange}
            onToggleTag={onToggleTag}
            onSetProductType={onSetProductType}
            onClear={onClear}
          />
        </MobileDisclosure>
      </div>
    </div>
  );
}

function MobileDisclosure({
  open,
  children,
}: {
  open: boolean;
  children: React.ReactNode;
}) {
  const reduced = useReducedMotion() ?? false;
  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          initial={reduced ? { opacity: 0 } : { height: 0, opacity: 0 }}
          animate={reduced ? { opacity: 1 } : { height: "auto", opacity: 1 }}
          exit={reduced ? { opacity: 0 } : { height: 0, opacity: 0 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="overflow-hidden"
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function FilterBody({
  facets,
  state,
  activeCount,
  onPriceChange,
  onToggleTag,
  onSetProductType,
  onClear,
}: {
  facets: Facets | null;
  state: DiscoveryState;
  activeCount: number;
  onPriceChange: (min?: number, max?: number) => void;
  onToggleTag: (tag: string) => void;
  onSetProductType: (type?: string) => void;
  onClear: () => void;
}) {
  return (
    <div className="glass space-y-7 rounded-3xl p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-sm font-semibold uppercase tracking-[0.18em] text-white/70">
          Filters
        </h2>
        {activeCount > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="inline-flex items-center gap-1 text-xs font-medium text-white/50 transition-colors hover:text-white"
          >
            <X className="h-3.5 w-3.5" />
            Clear all
          </button>
        )}
      </div>

      <PriceFilter
        facets={facets}
        min={state.minPrice}
        max={state.maxPrice}
        onChange={onPriceChange}
      />

      {facets?.productTypes && facets.productTypes.length > 1 && (
        <section>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-white/45">
            Type
          </h3>
          <div className="flex flex-wrap gap-2">
            {facets.productTypes.map((t) => {
              const active = state.productType === t.value;
              return (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => onSetProductType(t.value)}
                  aria-pressed={active}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                    active
                      ? "border-transparent bg-grade-teal-orange text-ink"
                      : "border-white/12 bg-white/[0.03] text-white/70 hover:bg-white/[0.08] hover:text-white",
                  )}
                >
                  {t.value}
                  <span className="ml-1.5 opacity-60">{t.count}</span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {facets?.tags && facets.tags.length > 0 && (
        <section>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-white/45">
            Tags
          </h3>
          <ul className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
            {facets.tags.map((tag) => {
              const checked = state.tags.includes(tag.value);
              return (
                <li key={tag.value}>
                  <label className="flex cursor-pointer items-center justify-between rounded-xl px-2.5 py-1.5 text-sm text-white/75 transition-colors hover:bg-white/[0.04]">
                    <span className="inline-flex items-center gap-2.5">
                      <span
                        className={cn(
                          "grid h-[18px] w-[18px] place-items-center rounded-md border transition-colors",
                          checked
                            ? "border-transparent bg-grade-teal-orange"
                            : "border-white/20 bg-transparent",
                        )}
                      >
                        {checked && (
                          <svg
                            viewBox="0 0 12 12"
                            className="h-3 w-3 text-ink"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <path d="M2.5 6.5l2.5 2.5 4.5-5" />
                          </svg>
                        )}
                      </span>
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={checked}
                        onChange={() => onToggleTag(tag.value)}
                      />
                      {tag.value}
                    </span>
                    <span className="text-xs text-white/35">{tag.count}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}

// Local, debounced numeric price inputs. The parent debounce in useProductQuery
// covers the network, but local state keeps the inputs responsive while typing.
function PriceFilter({
  facets,
  min,
  max,
  onChange,
}: {
  facets: Facets | null;
  min?: number;
  max?: number;
  onChange: (min?: number, max?: number) => void;
}) {
  const [minInput, setMinInput] = useState(min != null ? String(min) : "");
  const [maxInput, setMaxInput] = useState(max != null ? String(max) : "");

  // Keep local inputs in sync when state is reset externally (e.g. clear-all).
  useEffect(() => {
    setMinInput(min != null ? String(min) : "");
  }, [min]);
  useEffect(() => {
    setMaxInput(max != null ? String(max) : "");
  }, [max]);

  const commit = (rawMin: string, rawMax: string) => {
    const parse = (v: string) => {
      const n = Number.parseFloat(v);
      return v.trim() === "" || Number.isNaN(n) ? undefined : n;
    };
    onChange(parse(rawMin), parse(rawMax));
  };

  const bounds = facets?.priceRange;

  return (
    <section>
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-white/45">
        Price
        {bounds && (
          <span className="ml-2 font-normal normal-case tracking-normal text-white/30">
            ${Math.floor(bounds.min)}–${Math.ceil(bounds.max)}
          </span>
        )}
      </h3>
      <div className="flex items-center gap-2.5">
        <PriceInput
          label="Min"
          value={minInput}
          onValue={(v) => {
            setMinInput(v);
            commit(v, maxInput);
          }}
        />
        <span className="text-white/30">–</span>
        <PriceInput
          label="Max"
          value={maxInput}
          onValue={(v) => {
            setMaxInput(v);
            commit(minInput, v);
          }}
        />
      </div>
    </section>
  );
}

function PriceInput({
  label,
  value,
  onValue,
}: {
  label: string;
  value: string;
  onValue: (value: string) => void;
}) {
  return (
    <div className="relative flex-1">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-white/35">
        $
      </span>
      <input
        type="number"
        inputMode="decimal"
        min={0}
        placeholder={label}
        value={value}
        aria-label={`${label} price`}
        onChange={(e) => onValue(e.target.value)}
        className="w-full rounded-xl border border-white/10 bg-white/[0.03] py-2 pl-6 pr-2 text-sm text-white placeholder:text-white/35 focus:border-white/25 focus:outline-none"
      />
    </div>
  );
}
