"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CompareLinkDraft } from "@/lib/compare-link";

type ComparedLink = { url: string; store: string; title: string; price: number };
type CompareLinkResponse = CompareLinkDraft & { error?: string };

const currency = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });

export function CompareLinkSection({ linkRequest }: { linkRequest?: { url: string; id: number } | null }) {
  const [url, setUrl] = useState("");
  const [draft, setDraft] = useState<CompareLinkDraft | null>(null);
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [links, setLinks] = useState<ComparedLink[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const requestSequence = useRef(0);
  const sorted = useMemo(() => [...links].sort((left, right) => left.price - right.price), [links]);

  const inspectUrl = useCallback(async (value: string) => {
    if (!value.trim()) return;
    const sequence = ++requestSequence.current;
    setLoading(true);
    setDraft(null);
    setError("");
    try {
      const response = await fetch("/api/compare-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: value.trim() }),
      });
      const result = (await response.json()) as CompareLinkResponse;
      if (!response.ok) throw new Error(result.error ?? "No fue posible revisar el enlace.");
      if (sequence !== requestSequence.current) return;
      setDraft(result);
      setTitle(result.title ?? "");
      setPrice(result.price?.toString() ?? "");
    } catch (reason) {
      if (sequence !== requestSequence.current) return;
      setError(reason instanceof Error ? reason.message : "No fue posible revisar el enlace.");
    } finally {
      if (sequence === requestSequence.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!linkRequest) return;
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      setUrl(linkRequest.url);
      void inspectUrl(linkRequest.url);
      document.getElementById("comparar-enlaces")?.scrollIntoView?.({ behavior: "smooth", block: "start" });
    });
    return () => { active = false; };
  }, [inspectUrl, linkRequest]);

  function inspect(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void inspectUrl(url);
  }

  function addLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft) return;
    const amount = Number(price);
    if (!title.trim() || !Number.isFinite(amount) || amount <= 0) {
      setError("Confirma el título y un precio COP mayor que cero.");
      return;
    }
    if (links.some((link) => link.url === draft.url)) {
      setError("Este enlace ya está en la comparación.");
      return;
    }
    setLinks((current) => [...current, { url: draft.url, store: draft.store, title: title.trim(), price: amount }]);
    setDraft(null);
    setUrl("");
    setTitle("");
    setPrice("");
    setError("");
  }

  return (
    <section id="comparar-enlaces" className="mx-auto max-w-7xl px-5 pb-16 lg:px-8" aria-labelledby="compare-links-title">
      <div className="rounded-2xl border border-[#dbe6de] bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold text-[#197243]">ALTERNATIVA SIN BÚSQUEDA AUTOMÁTICA</p>
        <h2 id="compare-links-title" className="mt-1 text-2xl font-semibold">Compara enlaces de productos</h2>
        <p className="mt-2 max-w-3xl text-sm text-[#637a6e]">
          Pega enlaces públicos de tiendas compatibles. Si el sitio bloquea la lectura, completa los datos del anuncio.
          Todos los precios son aportados o confirmados por ti, no verificados por Radar Precio.
        </p>
        <form onSubmit={inspect} className="mt-5 flex flex-col gap-3 sm:flex-row">
          <input
            type="url"
            aria-label="Enlace del producto"
            placeholder="https://www.mercadolibre.com.co/..."
            value={url}
            onChange={(event) => { requestSequence.current += 1; setUrl(event.target.value); setDraft(null); setLoading(false); setError(""); }}
            required
            className="min-w-0 flex-1 rounded-xl border border-[#cbd9cf] px-4 py-3 text-sm"
          />
          <button type="submit" disabled={loading} className="rounded-xl bg-[#14532d] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60">
            {loading ? "Revisando…" : "Revisar enlace"}
          </button>
        </form>
        <p className="mt-2 text-xs text-[#637a6e]">Admite Mercado Libre, Alkosto, Ktronix, Éxito y Falabella. Solo HTTPS y datos públicos JSON-LD; no inicia sesión ni sigue redirecciones.</p>
        {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
        {draft && (
          <form onSubmit={addLink} className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-5">
            <p className="font-semibold text-amber-950">Confirma el anuncio de {draft.store}</p>
            <p className="mt-1 text-sm text-amber-900">{draft.notice}</p>
            <p className="mt-1 text-xs text-amber-900">Verifica también la variante. Envío, impuestos, inventario y garantía no se comparan aquí.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-medium">Título o variante
                <input value={title} onChange={(event) => setTitle(event.target.value)} required maxLength={200} className="mt-1 w-full rounded-lg border border-amber-300 bg-white px-3 py-2" />
              </label>
              <label className="text-sm font-medium">Precio publicado (COP)
                <input type="number" min="1" step="1" value={price} onChange={(event) => setPrice(event.target.value)} required className="mt-1 w-full rounded-lg border border-amber-300 bg-white px-3 py-2" />
              </label>
            </div>
            <button type="submit" className="mt-4 rounded-lg bg-[#14532d] px-4 py-2 text-sm font-semibold text-white">Añadir a la comparación</button>
          </form>
        )}
        {sorted.length > 0 && (
          <div className="mt-8">
            <h3 className="text-lg font-semibold">Enlaces aportados ({sorted.length})</h3>
            <p className="mt-1 text-sm text-[#637a6e]">Ordenados por precio publicado en COP. El menor solo se calcula entre tus enlaces; no es el mejor precio del mercado ni un precio final.</p>
            {sorted.length < 2 && <p className="mt-2 text-sm text-[#637a6e]">Añade otro enlace para comparar.</p>}
            <ol className="mt-4 grid gap-3 md:grid-cols-2">
              {sorted.map((link) => (
                <li key={link.url} className={`rounded-xl border p-4 ${sorted.length > 1 && link.price === sorted[0].price ? "border-[#197243] bg-[#f1faf3]" : "border-[#dbe6de]"}`}>
                  <p className="text-xs font-semibold text-[#197243]">{link.store} · APORTE NO VERIFICADO</p>
                  {sorted.length > 1 && <p className="mt-1 text-xs font-semibold text-[#14532d]">{link.price === sorted[0].price ? "MENOR PRECIO ENTRE TUS ENLACES" : `${currency.format(link.price - sorted[0].price)} más que el menor`}</p>}
                  <p className="mt-1 font-semibold">{link.title}</p>
                  <p className="mt-2 text-xl font-semibold">{currency.format(link.price)}</p>
                  <a href={link.url} target="_blank" rel="noopener noreferrer nofollow" className="mt-2 inline-block text-sm text-[#14532d] underline">Ver anuncio original</a>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </section>
  );
}
