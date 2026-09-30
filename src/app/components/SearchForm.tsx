"use client";

import { Search } from "lucide-react";
import type { FormEvent } from "react";

type SearchFormProps = {
  query: string;
  loading: boolean;
  error: string;
  onQueryChange: (value: string) => void;
  onSubmit: () => void;
};

export function SearchForm({ query, loading, error, onQueryChange, onSubmit }: SearchFormProps) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit();
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="mt-12 rounded-2xl border border-[#dbe6de] bg-white p-2 shadow-sm">
        <div className="flex items-center gap-3">
          <Search className="ml-3 text-[#4e665a]" size={21} />
          <input
            aria-label="Buscar producto"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            className="min-w-0 flex-1 bg-transparent py-4 text-base outline-none"
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded-xl bg-[#14532d] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
          >
            {loading ? "Buscando…" : "Buscar"}
          </button>
        </div>
      </form>
      <p className="mt-3 text-xs text-[#64796d]">
        Búsqueda mediante la API oficial de Mercado Libre Colombia, sujeta a autorización y disponibilidad; no se automatizan logins ni se extrae HTML.
      </p>
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-700">
          Fuente no disponible: {error} No se muestran ofertas demo como respuesta a esta búsqueda.
          {" "}<a href="#comparar-enlaces" className="font-semibold underline">Puedes comparar enlaces de productos abajo.</a>
        </p>
      )}
    </>
  );
}
