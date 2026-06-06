"use client";

import { Loader2 } from "lucide-react";
import type { Facets, Product } from "@/lib/types";
import { useProductQuery } from "@/lib/useProductQuery";
import { FilterPanel } from "./FilterPanel";
import { SortSelect } from "./SortSelect";
import { SearchBox } from "./SearchBox";
import { ProductGrid } from "./ProductGrid";

// Shared discovery layout: filter sidebar + sort control + animated results
// grid, all driven by the URL-synced useProductQuery hook. Used by the /search
// page and the collection pages.
export function DiscoveryView({
  collection,
  initialProducts,
  initialFacets,
  showSearch = false,
  searchPlaceholder,
  emptyMessage = "No looks match your filters yet.",
}: {
  collection?: string;
  initialProducts?: Product[];
  initialFacets?: Facets;
  showSearch?: boolean;
  searchPlaceholder?: string;
  emptyMessage?: string;
}) {
  const {
    state,
    products,
    facets,
    loading,
    setSearch,
    setSort,
    setPriceRange,
    toggleTag,
    setProductType,
    clearAll,
  } = useProductQuery({ collection, initialProducts, initialFacets });

  return (
    <div>
      {showSearch && (
        <div className="mb-8 max-w-2xl">
          <SearchBox
            value={state.search}
            onChange={setSearch}
            placeholder={searchPlaceholder}
            autoFocus
          />
        </div>
      )}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[260px_1fr]">
        <aside>
          <FilterPanel
            facets={facets}
            state={state}
            onPriceChange={setPriceRange}
            onToggleTag={toggleTag}
            onSetProductType={setProductType}
            onClear={clearAll}
          />
        </aside>

        <div>
          <div className="mb-6 flex items-center justify-between gap-4">
            <p className="flex items-center gap-2 text-sm text-white/50">
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {products.length} result{products.length === 1 ? "" : "s"}
            </p>
            <SortSelect value={state.sort} onChange={setSort} />
          </div>

          <ProductGrid products={products} emptyMessage={emptyMessage} />
        </div>
      </div>
    </div>
  );
}
