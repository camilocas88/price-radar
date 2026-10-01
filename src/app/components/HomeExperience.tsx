"use client";

import { useOfferSearch } from "@/app/hooks/useOfferSearch";
import { Hero } from "./Hero";
import { CompareLinkSection } from "./CompareLinkSection";
import { Nav } from "./Nav";
import { ResultsSection } from "./ResultsSection";
import { SearchForm } from "./SearchForm";
import { StatusStrip } from "./StatusStrip";

export function HomeExperience() {
  const search = useOfferSearch();

  return (
    <main className="min-h-screen bg-[#f6f8f6] text-[#10251d]">
      <Nav />
      <section id="inicio" className="mx-auto max-w-7xl px-5 pb-12 pt-12 lg:px-8 lg:pt-20">
        <Hero
          status={search.status}
          searchedQuery={search.searchedQuery}
          offersCount={search.filteredOffers.length}
        />
        <SearchForm
          query={search.query}
          loading={search.status === "loading"}
          error={search.error}
          onQueryChange={search.setQuery}
          onSubmit={search.submit}
        />
      </section>
      <CompareLinkSection linkRequest={search.linkRequest} />
      <StatusStrip />
      {search.status !== "link" && (
        <ResultsSection
          status={search.status}
          searchedQuery={search.searchedQuery}
          offers={search.filteredOffers}
          needsReview={search.needsReview}
          excludedCount={search.excludedCount}
          sources={search.sources}
          unpriced={search.unpriced}
          onlyVerified={search.onlyVerified}
          watching={search.watching}
          onToggleVerified={search.setOnlyVerified}
          onToggleWatching={search.toggleWatching}
        />
      )}
      <footer className="border-t border-[#dbe6de] px-5 py-8 text-center text-xs text-[#637a6e]">
        Radar Precio · Búsqueda web y Mercado Libre; precios publicados por las tiendas · Colombia
      </footer>
    </main>
  );
}
