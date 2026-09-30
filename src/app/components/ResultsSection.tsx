"use client";

import { Bell, SlidersHorizontal } from "lucide-react";
import type { Offer } from "@/lib/offers";
import type { SearchStatus } from "@/app/hooks/useOfferSearch";
import { demoProduct } from "@/lib/demo-data";
import { OfferCard } from "./OfferCard";
import { SkeletonList } from "./SkeletonList";

type ResultsSectionProps = {
  status: SearchStatus;
  searchedQuery: string;
  offers: Offer[];
  onlyVerified: boolean;
  watching: boolean;
  onToggleVerified: (value: boolean) => void;
  onToggleWatching: () => void;
};

export function ResultsSection({
  status,
  searchedQuery,
  offers,
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
      ? "MERCADO LIBRE · RESULTADOS EN TIEMPO REAL"
      : isLoading
        ? "CONSULTANDO MERCADO LIBRE"
        : "FUENTE NO DISPONIBLE";
  const description = isDemo
    ? "256 GB · Negro titanio · Nuevo · Bogotá"
    : isLive
      ? "El precio es publicado. Envío, garantía y disponibilidad solo se afirman cuando la API los expone."
      : isLoading
        ? "Esperando respuesta de la fuente oficial."
        : "Mercado Libre no respondió con ofertas utilizables; vuelve a intentar cuando la fuente esté disponible.";

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
          disabled={!isLive}
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
          {isLoading && <SkeletonList count={3} />}
          {isLive && offers.length === 0 && (
            <p className="rounded-2xl border border-[#dbe6de] bg-white p-5 text-sm text-[#637a6e]">
              No encontramos ofertas con precio en COP para esta búsqueda.
            </p>
          )}
          {status === "unavailable" && (
            <p className="rounded-2xl border border-[#dbe6de] bg-white p-5 text-sm text-[#637a6e]">
              La fuente no está disponible. No hay resultados reales para mostrar ahora.
            </p>
          )}
          {!isLoading && offers.map((offer, index) => (
            <OfferCard key={offer.id} offer={offer} highlighted={index === 0} />
          ))}
        </div>
      </div>
    </section>
  );
}
