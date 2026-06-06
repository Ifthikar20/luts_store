"use client";

// Client hook that owns the discovery state (search, sort, price, tags) and
// keeps it in sync with the URL querystring, refetching products + facets as it
// changes. Search and price inputs are debounced so typing doesn't spam the API
// or thrash the URL history.
//
// URL param contract (shared with the /search page and collection pages):
//   q        -> search text
//   sort     -> SortKey (omitted when "featured")
//   minPrice -> number
//   maxPrice -> number
//   tags     -> comma-separated
//   type     -> productType (single)

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { getFacets, getProducts } from "@/lib/api";
import type { Facets, Product, ProductQuery, SortKey } from "@/lib/types";

const SORT_KEYS: SortKey[] = [
  "featured",
  "price-asc",
  "price-desc",
  "title-asc",
  "newest",
];

export interface DiscoveryState {
  search: string;
  sort: SortKey;
  minPrice?: number;
  maxPrice?: number;
  tags: string[];
  productType?: string;
}

function parseSort(raw: string | null): SortKey {
  return raw && (SORT_KEYS as string[]).includes(raw)
    ? (raw as SortKey)
    : "featured";
}

function parseNum(raw: string | null): number | undefined {
  if (raw == null || raw.trim() === "") return undefined;
  const n = Number.parseFloat(raw);
  return Number.isNaN(n) ? undefined : n;
}

function stateFromParams(params: URLSearchParams): DiscoveryState {
  const tagsRaw = params.get("tags");
  return {
    search: params.get("q") ?? "",
    sort: parseSort(params.get("sort")),
    minPrice: parseNum(params.get("minPrice")),
    maxPrice: parseNum(params.get("maxPrice")),
    tags: tagsRaw
      ? tagsRaw.split(",").map((t) => t.trim()).filter(Boolean)
      : [],
    productType: params.get("type") ?? undefined,
  };
}

// Small debounce for value changes (search box + price sliders).
function useDebounced<T>(value: T, delay = 350): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

export function useProductQuery(options?: {
  collection?: string;
  initialProducts?: Product[];
  initialFacets?: Facets;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Seed state from the URL on first render so deep links work.
  const [state, setState] = useState<DiscoveryState>(() =>
    stateFromParams(new URLSearchParams(searchParams.toString())),
  );

  const [products, setProducts] = useState<Product[]>(
    options?.initialProducts ?? [],
  );
  const [facets, setFacets] = useState<Facets | null>(
    options?.initialFacets ?? null,
  );
  const [loading, setLoading] = useState(false);

  // Debounce the free-text + numeric inputs that change rapidly.
  const debouncedSearch = useDebounced(state.search);
  const debouncedMin = useDebounced(state.minPrice);
  const debouncedMax = useDebounced(state.maxPrice);

  // Push the (debounced) state into the URL querystring.
  useEffect(() => {
    const qs = new URLSearchParams();
    if (debouncedSearch) qs.set("q", debouncedSearch);
    if (state.sort !== "featured") qs.set("sort", state.sort);
    if (debouncedMin != null) qs.set("minPrice", String(debouncedMin));
    if (debouncedMax != null) qs.set("maxPrice", String(debouncedMax));
    if (state.tags.length) qs.set("tags", state.tags.join(","));
    if (state.productType) qs.set("type", state.productType);
    const next = qs.toString();
    if (next !== searchParams.toString()) {
      router.replace(next ? `${pathname}?${next}` : pathname, {
        scroll: false,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    debouncedSearch,
    debouncedMin,
    debouncedMax,
    state.sort,
    state.tags,
    state.productType,
  ]);

  // Skip the very first fetch when we were given server-rendered initial data
  // for the current (empty) query, so SSG/ISR output isn't immediately
  // clobbered by an identical client fetch.
  const hasInitial = useRef(
    Boolean(options?.initialProducts) &&
      stateIsPristine(
        stateFromParams(new URLSearchParams(searchParams.toString())),
      ),
  );

  // Refetch products whenever the effective query changes.
  useEffect(() => {
    if (hasInitial.current) {
      hasInitial.current = false;
      return;
    }
    let active = true;
    setLoading(true);
    const query: ProductQuery = {
      collection: options?.collection,
      search: debouncedSearch || undefined,
      sort: state.sort,
      minPrice: debouncedMin,
      maxPrice: debouncedMax,
      tags: state.tags.length ? state.tags : undefined,
    };
    getProducts(query)
      .then((result) => {
        if (active) setProducts(result);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    debouncedSearch,
    debouncedMin,
    debouncedMax,
    state.sort,
    state.tags,
    state.productType,
  ]);

  // Facets are scoped to the collection and don't change with the refine state,
  // so fetch them once (unless seeded from the server).
  useEffect(() => {
    if (options?.initialFacets) return;
    let active = true;
    getFacets(options?.collection).then((f) => {
      if (active) setFacets(f);
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options?.collection]);

  // --- mutators -----------------------------------------------------------
  const setSearch = useCallback(
    (search: string) => setState((s) => ({ ...s, search })),
    [],
  );
  const setSort = useCallback(
    (sort: SortKey) => setState((s) => ({ ...s, sort })),
    [],
  );
  const setPriceRange = useCallback(
    (minPrice?: number, maxPrice?: number) =>
      setState((s) => ({ ...s, minPrice, maxPrice })),
    [],
  );
  const toggleTag = useCallback(
    (tag: string) =>
      setState((s) => ({
        ...s,
        tags: s.tags.includes(tag)
          ? s.tags.filter((t) => t !== tag)
          : [...s.tags, tag],
      })),
    [],
  );
  const setProductType = useCallback(
    (productType?: string) =>
      setState((s) => ({
        ...s,
        productType: s.productType === productType ? undefined : productType,
      })),
    [],
  );
  const clearAll = useCallback(
    () =>
      setState((s) => ({
        search: s.search, // a "clear filters" action keeps the search term
        sort: s.sort,
        minPrice: undefined,
        maxPrice: undefined,
        tags: [],
        productType: undefined,
      })),
    [],
  );

  // The backend /api/products has no productType param (it's a distinct
  // concept from the ANY-match tags filter), so we apply that one facet
  // client-side over the fetched list. Everything else is server-filtered.
  const visibleProducts = state.productType
    ? products.filter((p) => p.productType === state.productType)
    : products;

  return {
    state,
    products: visibleProducts,
    facets,
    loading,
    setSearch,
    setSort,
    setPriceRange,
    toggleTag,
    setProductType,
    clearAll,
  };
}

function stateIsPristine(s: DiscoveryState): boolean {
  return (
    !s.search &&
    s.sort === "featured" &&
    s.minPrice == null &&
    s.maxPrice == null &&
    s.tags.length === 0 &&
    !s.productType
  );
}
