"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CompareLinkDraft } from "@/lib/compare-link";
import { compareLinkVariants } from "../../lib/link-variants";

type ComparedLink = { url: string; store: string; title: string; price: number; extraction: CompareLinkDraft["extraction"] };
type CompareLinkResponse = CompareLinkDraft & { error?: string };

const currency = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });

function batchKey(value: string): string {
  try {
    const parsed = new URL(value);
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return value;
  }
}

export function CompareLinkSection({ linkRequest }: { linkRequest?: { url: string; id: number } | null }) {
  const [url, setUrl] = useState("");
  const [draft, setDraft] = useState<CompareLinkDraft | null>(null);
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [referenceTitle, setReferenceTitle] = useState("");
  const [batchText, setBatchText] = useState("");
  const [pendingDrafts, setPendingDrafts] = useState<CompareLinkDraft[]>([]);
  const [batchErrors, setBatchErrors] = useState<string[]>([]);
  const [batchProgress, setBatchProgress] = useState<{ done: number; total: number } | null>(null);
  const [links, setLinks] = useState<ComparedLink[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const requestSequence = useRef(0);
  const assessed = useMemo(() => links.map((link) => ({ ...link, match: compareLinkVariants(referenceTitle, link.title) })), [links, referenceTitle]);
  const sorted = useMemo(() => assessed.filter((link) => link.match.status === "match").sort((left, right) => left.price - right.price), [assessed]);
  const notComparable = useMemo(() => assessed.filter((link) => link.match.status !== "match"), [assessed]);

  const inspectUrl = useCallback(async (value: string) => {
    if (!value.trim()) return;
    const sequence = ++requestSequence.current;
    setLoading(true);
    setDraft(null);
    setError("");
    setPendingDrafts([]);
    setBatchErrors([]);
    setBatchProgress(null);
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

  async function inspectBatch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const urls = batchText.split(/\r?\n/).map((value) => value.trim()).filter(Boolean);
    if (urls.length < 2 || urls.length > 6 || new Set(urls.map(batchKey)).size !== urls.length) {
      setError("Pega entre 2 y 6 enlaces distintos, uno por línea.");
      return;
    }
    const sequence = ++requestSequence.current;
    setLoading(true);
    setDraft(null);
    setPendingDrafts([]);
    setBatchErrors([]);
    setBatchProgress({ done: 0, total: urls.length });
    setError("");
    const drafts: CompareLinkDraft[] = [];
    const errors: string[] = [];
    const seen = new Set(links.map((link) => link.url));
    for (const [index, candidate] of urls.entries()) {
      try {
        const response = await fetch("/api/compare-link", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: candidate }),
        });
        const result = (await response.json()) as CompareLinkResponse;
        if (!response.ok) throw new Error(result.error ?? "No fue posible revisar el enlace.");
        if (seen.has(result.url)) throw new Error("Este enlace ya está en la comparación o repetido en el lote.");
        seen.add(result.url);
        drafts.push(result);
      } catch (reason) {
        errors.push(`${candidate}: ${reason instanceof Error ? reason.message : "No fue posible revisar el enlace."}`);
      }
      if (sequence !== requestSequence.current) return;
      setBatchProgress({ done: index + 1, total: urls.length });
    }
    setBatchErrors(errors);
    if (drafts.length > 0) {
      setDraft(drafts[0]);
      setPendingDrafts(drafts.slice(1));
      setTitle(drafts[0].title ?? "");
      setPrice(drafts[0].price?.toString() ?? "");
      setUrl(drafts[0].url);
    } else {
      setError("Ninguno de los enlaces pudo revisarse.");
    }
    setLoading(false);
  }

  function addLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft) return;
    const amount = Number(price);
    if (!referenceTitle.trim()) {
      setError("Escribe la variante exacta que quieres comparar, incluida capacidad y condición.");
      return;
    }
    if (!title.trim() || !Number.isFinite(amount) || amount <= 0) {
      setError("Confirma el título y un precio COP mayor que cero.");
      return;
    }
    if (links.some((link) => link.url === draft.url)) {
      setError("Este enlace ya está en la comparación.");
      return;
    }
    setLinks((current) => [...current, { url: draft.url, store: draft.store, title: title.trim(), price: amount, extraction: draft.extraction }]);
    const next = pendingDrafts[0];
    setPendingDrafts((current) => current.slice(1));
    setDraft(next ?? null);
    setUrl(next?.url ?? "");
    setTitle(next?.title ?? "");
    setPrice(next?.price?.toString() ?? "");
    setError("");
  }

  return (
    <section id="comparar-enlaces" className="mx-auto max-w-7xl px-5 pb-16 lg:px-8" aria-labelledby="compare-links-title">
      <div className="rounded-2xl border border-[#dbe6de] bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold text-[#197243]">COMPARACIÓN MULTI-TIENDA SIN MERCADO LIBRE</p>
        <h2 id="compare-links-title" className="mt-1 text-2xl font-semibold">Compara enlaces de productos</h2>
        <p className="mt-2 max-w-3xl text-sm text-[#637a6e]">
          Pega enlaces públicos de tiendas compatibles. Si el sitio bloquea la lectura, completa los datos del anuncio.
          Todos los precios son aportados o confirmados por ti, no verificados por Radar Precio. Solo variantes compatibles participan en el menor precio.
        </p>
        <p className="mt-2 text-xs text-[#637a6e]">La equivalencia automática de variantes cubre por ahora modelos de iPhone con capacidad y condición explícitas; otros productos quedan por revisar.</p>
        <label className="mt-5 block max-w-3xl text-sm font-medium">Variante exacta que quieres comparar
          <input value={referenceTitle} onChange={(event) => setReferenceTitle(event.target.value)} placeholder="iPhone 17 Pro Max 256 GB nuevo" maxLength={200} className="mt-1 w-full rounded-xl border border-[#cbd9cf] px-4 py-3 text-sm" />
        </label>
        <form onSubmit={inspect} className="mt-5 flex flex-col gap-3 sm:flex-row">
          <input
            type="url"
            aria-label="Enlace del producto"
            placeholder="https://mac-center.com/products/..."
            value={url}
            onChange={(event) => { requestSequence.current += 1; setUrl(event.target.value); setDraft(null); setPendingDrafts([]); setBatchProgress(null); setLoading(false); setError(""); }}
            required
            className="min-w-0 flex-1 rounded-xl border border-[#cbd9cf] px-4 py-3 text-sm"
          />
          <button type="submit" disabled={loading} className="rounded-xl bg-[#14532d] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60">
            {loading ? "Revisando…" : "Revisar enlace"}
          </button>
        </form>
        <p className="mt-2 text-xs text-[#637a6e]">Admite Mercado Libre, Alkosto, Ktronix, Éxito, Falabella, Mac Center e iShop Colombia. Solo HTTPS y datos públicos JSON-LD; no inicia sesión ni sigue redirecciones.</p>
        <form onSubmit={(event) => { void inspectBatch(event); }} className="mt-5 max-w-3xl">
          <label className="block text-sm font-medium">O pega varios enlaces, uno por línea (2–6)
            <textarea value={batchText} onChange={(event) => setBatchText(event.target.value)} rows={4} placeholder={"https://mac-center.com/products/...\nhttps://co.tiendasishop.com/products/..."} className="mt-1 w-full rounded-xl border border-[#cbd9cf] px-4 py-3 text-sm" />
          </label>
          <button type="submit" disabled={loading} className="mt-2 rounded-xl border border-[#14532d] px-5 py-2 text-sm font-semibold text-[#14532d] disabled:opacity-60">Revisar lote</button>
        </form>
        {batchProgress && <p role="status" aria-live="polite" className="mt-2 text-sm text-[#637a6e]">Revisados {batchProgress.done}/{batchProgress.total} enlaces.</p>}
        {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
        {batchErrors.length > 0 && <ul className="mt-3 text-sm text-red-700">{batchErrors.map((item) => <li key={item}>{item}</li>)}</ul>}
        {draft && (
          <form onSubmit={addLink} className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-5">
            <p className="font-semibold text-amber-950">Confirma el anuncio de {draft.store}</p>
            {pendingDrafts.length > 0 && <p className="mt-1 text-xs text-amber-900">Quedan {pendingDrafts.length} enlaces del lote por confirmar.</p>}
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
        {links.length > 0 && (
          <div className="mt-8">
            <h3 className="text-lg font-semibold">Enlaces aportados ({links.length})</h3>
            <p className="mt-1 text-sm text-[#637a6e]">{sorted.length} comparables y {notComparable.length} por revisar. El menor solo se calcula entre variantes compatibles de tus enlaces; no es el mejor precio del mercado ni un precio final.</p>
            {sorted.length < 2 && <p className="mt-2 text-sm text-[#637a6e]">Añade otro enlace de la misma variante para comparar precios.</p>}
            {sorted.length > 0 && <ol className="mt-4 grid gap-3 md:grid-cols-2">
              {sorted.map((link) => (
                <li key={link.url} className={`rounded-xl border p-4 ${sorted.length > 1 && link.price === sorted[0].price ? "border-[#197243] bg-[#f1faf3]" : "border-[#dbe6de]"}`}>
                  <p className="text-xs font-semibold text-[#197243]">{link.store} · APORTE NO VERIFICADO</p>
                  <p className="mt-1 text-xs text-[#637a6e]">{link.extraction === "json_ld" ? "JSON-LD público detectado; datos confirmados por ti" : "Título y precio completados por ti"}</p>
                  {sorted.length > 1 && <p className="mt-1 text-xs font-semibold text-[#14532d]">{link.price === sorted[0].price ? "MENOR PRECIO ENTRE TUS ENLACES" : `${currency.format(link.price - sorted[0].price)} más que el menor`}</p>}
                  <p className="mt-1 font-semibold">{link.title}</p>
                  <p className="mt-2 text-xl font-semibold">{currency.format(link.price)}</p>
                  <a href={link.url} target="_blank" rel="noopener noreferrer nofollow" className="mt-2 inline-block text-sm text-[#14532d] underline">Ver anuncio original</a>
                </li>
              ))}
            </ol>}
            {notComparable.length > 0 && <div className="mt-6">
              <h4 className="font-semibold">Enlaces excluidos del menor precio</h4>
              <ul className="mt-3 grid gap-3 md:grid-cols-2">
                {notComparable.map((link) => <li key={link.url} className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <p className="text-xs font-semibold text-amber-900">{link.store} · {link.match.status === "mismatch" ? "VARIANTE DISTINTA" : "VARIANTE POR REVISAR"}</p>
                  <p className="mt-1 font-semibold">{link.title}</p>
                  <p className="mt-1 text-sm">{currency.format(link.price)} · No entra en el cálculo.</p>
                  <a href={link.url} target="_blank" rel="noopener noreferrer nofollow" className="mt-2 inline-block text-sm text-[#14532d] underline">Ver anuncio original</a>
                </li>)}
              </ul>
            </div>}
          </div>
        )}
      </div>
    </section>
  );
}
