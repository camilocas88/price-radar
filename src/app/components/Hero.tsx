import { Sparkles } from "lucide-react";
import type { SearchStatus } from "@/app/hooks/useOfferSearch";
import { demoProduct } from "@/lib/demo-data";

type HeroProps = {
  status: SearchStatus;
  searchedQuery: string;
  offersCount: number;
};

export function Hero({ status, searchedQuery, offersCount }: HeroProps) {
  const isDemo = status === "demo";
  const isLive = status === "success";
  const displayQuery = isDemo ? demoProduct.name : searchedQuery;
  const summaryHeadline = isDemo
    ? "Ejemplo listo para explorar"
    : isLive
      ? "Resultados en tiempo real"
      : status === "loading"
        ? "Consultando fuente oficial"
        : "Fuente temporalmente no disponible";
  const sourceLabel = isDemo
    ? "Demo"
    : isLive
      ? "Mercado Libre"
      : status === "loading"
        ? "Consultando"
        : "No disponible";

  return (
    <div className="grid gap-10 lg:grid-cols-[1.1fr_.9fr] lg:items-end">
      <div>
        <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#cce5d4] bg-[#edf8f0] px-3 py-1 text-xs font-semibold text-[#166534]">
          <Sparkles size={14} /> Radar de compras para Colombia
        </p>
        <h1 className="max-w-3xl text-5xl font-semibold leading-[.98] tracking-[-.05em] sm:text-6xl">
          Encuentra la mejor compra. <span className="text-[#197243]">No solo el menor precio.</span>
        </h1>
        <p className="mt-6 max-w-xl text-lg leading-8 text-[#557064]">
          Comparamos precio publicado, entrega, garantía y señales de confianza sin ocultar lo que no está confirmado.
        </p>
      </div>
      <div className="rounded-3xl bg-[#14532d] p-6 text-white shadow-xl shadow-green-950/15">
        <p className="text-sm text-green-100">{summaryHeadline}</p>
        <p className="mt-2 text-2xl font-medium">{displayQuery}</p>
        <div className="mt-5 flex justify-between border-t border-white/15 pt-4 text-sm">
          <span>Ofertas comparadas</span>
          <b>{offersCount}</b>
        </div>
        <div className="mt-2 flex justify-between text-sm">
          <span>Fuente</span>
          <b>{sourceLabel}</b>
        </div>
      </div>
    </div>
  );
}
