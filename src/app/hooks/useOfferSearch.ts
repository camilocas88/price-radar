"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { demoOffers, demoProduct } from "../../lib/demo-data";
import type { Offer } from "../../lib/offers";

export type SearchStatus = "demo" | "loading" | "success" | "unavailable";

type SearchPayload = { offers?: Offer[]; error?: string; code?: string };

export type OfferSearchState = {
  query: string;
  searchedQuery: string;
  status: SearchStatus;
  offers: Offer[];
  filteredOffers: Offer[];
  error: string;
  onlyVerified: boolean;
  watching: boolean;
  setQuery: (value: string) => void;
  setOnlyVerified: (value: boolean) => void;
  toggleWatching: () => void;
  submit: () => void;
};

export function parseInitialQuery(params: URLSearchParams | { get: (key: string) => string | null } | null): string {
  if (!params) return "";
  const raw = params.get("query");
  return raw ? raw.trim() : "";
}

export function useOfferSearch(): OfferSearchState {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialQuery = parseInitialQuery(searchParams);
  const hasInitialQuery = initialQuery.length > 0;

  const [query, setQuery] = useState(hasInitialQuery ? initialQuery : demoProduct.name);
  const [searchedQuery, setSearchedQuery] = useState(hasInitialQuery ? initialQuery : "");
  const [status, setStatus] = useState<SearchStatus>(hasInitialQuery ? "loading" : "demo");
  const [offers, setOffers] = useState<Offer[]>([]);
  const [error, setError] = useState("");
  const [onlyVerified, setOnlyVerified] = useState(false);
  const [watching, setWatching] = useState(false);

  const lastFetched = useRef<string | null>(null);

  const runSearch = useCallback(async (term: string) => {
    if (!term) return;
    lastFetched.current = term;
    setSearchedQuery(term);
    setStatus("loading");
    setOffers([]);
    setWatching(false);
    setError("");
    try {
      const response = await fetch(`/api/offers?query=${encodeURIComponent(term)}`);
      const data = (await response.json()) as SearchPayload;
      if (!response.ok) throw new Error(data.error ?? "No fue posible consultar Mercado Libre.");
      setOffers(data.offers ?? []);
      setStatus("success");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No fue posible consultar Mercado Libre.");
      setStatus("unavailable");
    }
  }, []);

  useEffect(() => {
    if (hasInitialQuery && lastFetched.current !== initialQuery) {
      void runSearch(initialQuery);
    }
  }, [hasInitialQuery, initialQuery, runSearch]);

  const submit = useCallback(() => {
    const term = query.trim();
    if (!term) return;
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.set("query", term);
    router.replace(`/?${params.toString()}`, { scroll: false });
    if (lastFetched.current !== term) void runSearch(term);
  }, [query, router, runSearch, searchParams]);

  const filteredOffers = useMemo(() => {
    const current = status === "demo" ? demoOffers : status === "success" ? offers : [];
    return onlyVerified ? current.filter((offer) => offer.classification === "Mejor compra verificada") : current;
  }, [offers, onlyVerified, status]);

  const toggleWatching = useCallback(() => setWatching((previous) => !previous), []);

  return {
    query,
    searchedQuery,
    status,
    offers,
    filteredOffers,
    error,
    onlyVerified,
    watching,
    setQuery,
    setOnlyVerified,
    toggleWatching,
    submit,
  };
}
