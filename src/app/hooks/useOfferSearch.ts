"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { demoOffers, demoProduct } from "../../lib/demo-data";
import type { Offer } from "../../lib/offers";
import { normalizeLinkInput } from "../../lib/link-input";

export type SearchStatus = "demo" | "loading" | "success" | "unavailable" | "link";

export type ReviewItem = { id: string; title: string; reasons: string[] };
type SearchPayload = { offers?: Offer[]; needsReview?: ReviewItem[]; excludedCount?: number; error?: string; code?: string };

export type OfferSearchState = {
  query: string;
  searchedQuery: string;
  status: SearchStatus;
  offers: Offer[];
  filteredOffers: Offer[];
  needsReview: ReviewItem[];
  excludedCount: number;
  error: string;
  linkRequest: { url: string; id: number } | null;
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
  const rawQuery = parseInitialQuery(searchParams);
  const initialLink = searchParams?.get("link")?.trim() || normalizeLinkInput(rawQuery) || "";
  const initialQuery = initialLink ? "" : rawQuery;
  const hasInitialQuery = initialQuery.length > 0;

  const routeKey = initialLink ? `link:${initialLink}` : `query:${initialQuery}`;
  const [draft, setDraft] = useState<{ routeKey: string; value: string } | null>(null);
  const query = draft?.routeKey === routeKey ? draft.value : initialLink || initialQuery || demoProduct.name;
  const setQuery = useCallback((value: string) => setDraft({ routeKey, value }), [routeKey]);
  const [searchedQuery, setSearchedQuery] = useState(hasInitialQuery ? initialQuery : "");
  const [status, setStatus] = useState<SearchStatus>(initialLink ? "link" : hasInitialQuery ? "loading" : "demo");
  const [offers, setOffers] = useState<Offer[]>([]);
  const [needsReview, setNeedsReview] = useState<ReviewItem[]>([]);
  const [excludedCount, setExcludedCount] = useState(0);
  const [error, setError] = useState("");
  const [linkRequest, setLinkRequest] = useState<{ url: string; id: number } | null>(initialLink ? { url: initialLink, id: 0 } : null);
  const [onlyVerified, setOnlyVerified] = useState(false);
  const [watching, setWatching] = useState(false);

  const lastFetched = useRef<string | null>(null);
  const requestSequence = useRef(0);
  const activeLink = useRef<string | null>(initialLink || null);
  const linkSequence = useRef(0);

  const routeToLink = useCallback((url: string) => {
    requestSequence.current += 1;
    lastFetched.current = null;
    activeLink.current = url;
    setDraft(null);
    setSearchedQuery("");
    setStatus("link");
    setOffers([]);
    setNeedsReview([]);
    setExcludedCount(0);
    setWatching(false);
    setError("");
    setLinkRequest({ url, id: ++linkSequence.current });
  }, []);

  const runSearch = useCallback(async (term: string) => {
    if (!term) return;
    const sequence = ++requestSequence.current;
    lastFetched.current = term;
    activeLink.current = null;
    setLinkRequest(null);
    setDraft(null);
    setSearchedQuery(term);
    setStatus("loading");
    setOffers([]);
    setNeedsReview([]);
    setExcludedCount(0);
    setWatching(false);
    setError("");
    try {
      const response = await fetch(`/api/offers?query=${encodeURIComponent(term)}`);
      const data = (await response.json()) as SearchPayload;
      if (!response.ok) throw new Error(data.error ?? "No fue posible consultar Mercado Libre.");
      if (sequence !== requestSequence.current) return;
      setOffers(data.offers ?? []);
      setNeedsReview(data.needsReview ?? []);
      setExcludedCount(data.excludedCount ?? 0);
      setStatus("success");
    } catch (reason) {
      if (sequence !== requestSequence.current) return;
      setError(reason instanceof Error ? reason.message : "No fue posible consultar Mercado Libre.");
      setStatus("unavailable");
    }
  }, []);

  const resetToDemo = useCallback(() => {
    requestSequence.current += 1;
    lastFetched.current = null;
    activeLink.current = null;
    setLinkRequest(null);
    setDraft(null);
    setSearchedQuery("");
    setOffers([]);
    setNeedsReview([]);
    setExcludedCount(0);
    setStatus("demo");
    setError("");
  }, []);

  useEffect(() => {
    if (initialLink) {
      if (activeLink.current !== initialLink) routeToLink(initialLink);
    } else if (hasInitialQuery && lastFetched.current !== initialQuery) {
      void runSearch(initialQuery);
    } else if (!hasInitialQuery && (lastFetched.current !== null || activeLink.current !== null)) {
      resetToDemo();
    }
  }, [hasInitialQuery, initialLink, initialQuery, resetToDemo, routeToLink, runSearch]);

  const submit = useCallback(() => {
    const term = query.trim();
    if (!term) return;
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    const link = normalizeLinkInput(term);
    if (link) {
      params.delete("query");
      params.set("link", link);
      if (initialLink !== link || rawQuery) router.push(`/?${params.toString()}`, { scroll: false });
      routeToLink(link);
      return;
    }
    params.delete("link");
    if (parseInitialQuery(params) !== term) {
      params.set("query", term);
      router.push(`/?${params.toString()}`, { scroll: false });
    }
    void runSearch(term);
  }, [initialLink, query, rawQuery, routeToLink, router, runSearch, searchParams]);

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
    needsReview,
    excludedCount,
    error,
    linkRequest,
    onlyVerified,
    watching,
    setQuery,
    setOnlyVerified,
    toggleWatching,
    submit,
  };
}
