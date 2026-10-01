"use client";

import { Bell, SlidersHorizontal } from "lucide-react";
import type { Offer } from "@/lib/offers";
import type { ReviewItem, SearchStatus, SourceState, UnpricedLink } from "@/app/hooks/useOfferSearch";
import { demoProduct } from "../../lib/demo-data";
import { OfferCard } from "./OfferCard";
import { SkeletonList } from "./SkeletonList";

type ResultsSectionProps = {
  status: SearchStatus;
  searchedQuery: string;
  offers: Offer[];
  needsReview: ReviewItem[];
  excludedCount: number;
  sources?: SourceState[];
  unpriced?: UnpricedLink[];
  onlyVerified: boolean;
  watching: boolean;
  onToggleVerified: (value: boolean) => void;
  onToggleWatching: () => void;
};

export function ResultsSection({
  status,
  searchedQuery,
  offers,
  needsReview,
  excludedCount,
  sources = [],
  unpriced = [],
  onlyVerified,
  watching,
  onToggleVerified,
  onToggleWatching,
}: ResultsSectionProps) {
  const isDemo = status === "demo";
  const isLive = status === "success";
  const isLoading = status === "loading";
  const heading = isDemo ? demoProduct.name : searchedQuery;
  const resultLabel = isDemo
    ? "RESULTADOS DEMO"
    : isLive
      ? "PRODUCTOS EN TIENDAS · PRECIOS PUBLICADOS"
      : isLoading
        ? "CONSULTANDO FUENTES"
        : "FUENTE NO DISPONIBLE";
  const description = isDemo
    ? "256 GB · Negro titanio · Nuevo · Bogotá"
    : isLive
      ? "Productos relacionados ordenados por precio publicado; pueden ser modelos distintos. Verifica cada variante, envío y cargos en la tienda."
      : isLoading
        ? "Buscando páginas de producto y verificando precios publicados."
        : "No hay una fuente de búsqueda disponible en este momento.";

  return (
    <section className="mx-auto max-w-7xl px-5 py-14 lg:px-8">
      <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="text-sm font-semibold text-[#197243]">{resultLabel}</p>
          <h2 className="mt-1 text-3xl font-semibold">{heading}</h2>
          <p className="mt-2 max-w-2xl text-sm text-[#637a6e]">{description}</p>
        </div>
        <button
          type="button"
          disabled={!isLive || offers.length === 0}
          onClick={onToggleWatching}
          className={`inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50 ${
            watching ? "border-[#14532d] bg-[#edf8f0] text-[#14532d]" : "border-[#cbd9cf] bg-white"
          }`}
        >
          <Bell size={17} />
          {watching ? "En seguimiento" : "Seguir precio"}
        </button>
      </div>
      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        <aside className="rounded-2xl border border-[#dbe6de] bg-white p-5">
          <div className="mb-5 flex gap-2 font-semibold">
            <SlidersHorizontal size={17} />
            Filtros
          </div>
          <label className="flex cursor-pointer items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={onlyVerified}
              onChange={(event) => onToggleVerified(event.target.checked)}
              className="size-4 accent-[#14532d]"
            />
            Solo tienda oficial
          </label>
          <p className="mt-6 border-t border-[#e7eee9] pt-5 text-xs leading-5 text-[#637a6e]">
            Una tienda oficial es una señal, no una garantía de entrega.
          </p>
        </aside>
        <div className="space-y-3">
          {(isLive || status === "unavailable") && sources.length > 0 && (
            <div role="status" className="rounded-2xl border border-[#dbe6de] bg-white p-4 text-sm text-[#526b5e]">
              {sources.map((source) => <p key={source.source}>{source.source === "web" ? "Búsqueda web" : "Mercado Libre"}: {source.detail}</p>)}
            </div>
          )}
          {isLoading && <SkeletonList count={3} />}
          {isLive && needsReview.length > 0 && (
            <div role="status" className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950">
              <p className="font-semibold">{needsReview.length} resultado(s) requieren verificar la variante.</p>
              <p className="mt-1">Algunas publicaciones no informan modelo, capacidad o condición. Afina la búsqueda o verifica el anuncio antes de comparar precios.</p>
              <ul className="mt-3 list-disc space-y-1 pl-5">
                {needsReview.slice(0, 5).map((item) => <li key={item.id}>{item.title}</li>)}
              </ul>
            </div>
          )}
          {isLive && offers.length === 0 && needsReview.length === 0 && excludedCount > 0 && (
            <p className="rounded-2xl border border-[#dbe6de] bg-white p-5 text-sm text-[#637a6e]">
              Encontramos artículos, pero son variantes distintas de la buscada y no se comparan entre sí.
            </p>
          )}
          {isLive && offers.length === 0 && needsReview.length === 0 && excludedCount === 0 && (
            <p className="rounded-2xl border border-[#dbe6de] bg-white p-5 text-sm text-[#637a6e]">
              {sources.some((source) => source.source === "web" && source.status === "no_prices")
                ? "Se encontraron páginas de tiendas, pero no se pudo verificar un precio vigente en COP. Puedes abrir un enlace de producto y revisarlo manualmente."
                : "No encontramos productos con precio verificado en COP para esta búsqueda."}
            </p>
          )}
          {status === "unavailable" && (
            <p className="rounded-2xl border border-[#dbe6de] bg-white p-5 text-sm text-[#637a6e]">
              La fuente no está disponible. No hay resultados reales para mostrar ahora.
            </p>
          )}
          {!isLoading && offers.map((offer, index) => (
            <OfferCard key={offer.id} offer={offer} highlighted={isDemo && index === 0} />
          ))}
          {isLive && unpriced.length > 0 && (
            <div className="rounded-2xl border border-[#dbe6de] bg-white p-5 text-sm">
              <p className="font-semibold">Páginas encontradas sin precio verificado</p>
              <p className="mt-1 text-[#637a6e]">Revísalas en la tienda; no entran al orden por precio.</p>
              <ul className="mt-3 list-disc space-y-1 pl-5">
                {unpriced.slice(0, 5).map((item) => <li key={item.url}><a className="text-[#14532d] underline" href={item.url} target="_blank" rel="noreferrer">{item.store}</a></li>)}
              </ul>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
