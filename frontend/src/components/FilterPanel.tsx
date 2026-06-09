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
    <div className="lg:sticky lg:top-24 lg:max-h-[calc(100vh_-_7rem)] lg:overflow-y-auto lg:overscroll-contain lg:pr-1">
      {/* Mobile toggle */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="mb-4 flex w-full items-center justify-between rounded-2xl border border-hairline bg-white px-4 py-3 text-sm font-medium text-graphite shadow-soft lg:hidden"
      >
        <span className="inline-flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-slate2" />
          Filters
          {activeCount > 0 && (
            <span className="grid h-5 min-w-5 place-items-center rounded-full bg-sky px-1 text-[11px] font-bold text-white">
              {activeCount}
            </span>
          )}
        </span>
        <span className="text-slate2">{open ? "Hide" : "Show"}</span>
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
        <h2 className="font-display text-sm font-semibold uppercase tracking-[0.18em] text-graphite">
          Filters
        </h2>
        {activeCount > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="inline-flex items-center gap-1 text-xs font-medium text-slate2 transition-colors hover:text-graphite"
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
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate2">
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
                      ? "border-transparent bg-sky text-white"
                      : "border-hairline bg-white text-slate2 hover:bg-cloud hover:text-graphite",
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
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate2">
            Tags
          </h3>
          <ul className="space-y-1.5">
            {facets.tags.map((tag) => {
              const checked = state.tags.includes(tag.value);
              return (
                <li key={tag.value}>
                  <label className="flex cursor-pointer items-center justify-between rounded-xl px-2.5 py-1.5 text-sm text-graphite transition-colors hover:bg-cloud">
                    <span className="inline-flex items-center gap-2.5">
                      <span
                        className={cn(
                          "grid h-[18px] w-[18px] place-items-center rounded-md border transition-colors",
                          checked
                            ? "border-transparent bg-sky"
                            : "border-hairline bg-white",
                        )}
                      >
                        {checked && (
                          <svg
                            viewBox="0 0 12 12"
                            className="h-3 w-3 text-white"
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
                    <span className="text-xs text-slate2">{tag.count}</span>
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
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate2">
        Price
        {bounds && (
          <span className="ml-2 font-normal normal-case tracking-normal text-slate2">
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
        <span className="text-slate2">–</span>
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
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate2">
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
        className="w-full rounded-xl border border-hairline bg-white py-2 pl-6 pr-2 text-sm text-graphite placeholder:text-slate2 focus:border-sky focus:outline-none focus:ring-2 focus:ring-sky/30"
      />
    </div>
  );
}
