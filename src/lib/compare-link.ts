const STORES: Record<string, string> = {
  "mercadolibre.com.co": "Mercado Libre",
  "www.mercadolibre.com.co": "Mercado Libre",
  "alkosto.com": "Alkosto",
  "www.alkosto.com": "Alkosto",
  "ktronix.com": "Ktronix",
  "www.ktronix.com": "Ktronix",
  "exito.com": "Éxito",
  "www.exito.com": "Éxito",
  "falabella.com.co": "Falabella",
  "www.falabella.com.co": "Falabella",
  "mac-center.com": "Mac Center",
  "www.mac-center.com": "Mac Center",
  "co.tiendasishop.com": "iShop Colombia",
};

const MAX_URL_LENGTH = 2048;
const MAX_HTML_BYTES = 512_000;

export type CompareLinkDraft = {
  url: string;
  store: string;
  title?: string;
  price?: number;
  currency?: "COP";
  extraction: "json_ld" | "manual";
  missingFields: Array<"title" | "price">;
  notice?: string;
};

export class InvalidCompareUrl extends Error {}

export function validateCompareUrl(input: unknown): { url: string; store: string } {
  if (typeof input !== "string" || input.length > MAX_URL_LENGTH) {
    throw new InvalidCompareUrl("Ingresa una URL pública válida y corta.");
  }
  let parsed: URL;
  try {
    parsed = new URL(input.trim());
  } catch {
    throw new InvalidCompareUrl("Ingresa una URL pública válida.");
  }
  const store = STORES[parsed.hostname.toLowerCase()];
  if (parsed.protocol !== "https:" || !store || parsed.username || parsed.password || parsed.port) {
    throw new InvalidCompareUrl("Usa un enlace HTTPS de Mercado Libre, Alkosto, Ktronix, Éxito, Falabella, Mac Center o iShop Colombia, sin usuario ni puerto personalizado.");
  }
  parsed.hash = "";
  return { url: parsed.toString(), store };
}

function isProduct(value: Record<string, unknown>): boolean {
  const kinds = Array.isArray(value["@type"]) ? value["@type"] : [value["@type"]];
  return kinds.some((kind) => typeof kind === "string" && /(?:^|\/)Product$/i.test(kind));
}

function findProducts(value: unknown, depth = 0): Record<string, unknown>[] {
  if (depth > 5 || !value || typeof value !== "object") return [];
  if (Array.isArray(value)) return value.flatMap((entry) => findProducts(entry, depth + 1));
  const record = value as Record<string, unknown>;
  if (isProduct(record)) return [record];
  return ["@graph", "mainEntity"].flatMap((key) => findProducts(record[key], depth + 1));
}

function extractPrice(product: Record<string, unknown>): number | undefined {
  const offers = Array.isArray(product.offers) ? product.offers : product.offers ? [product.offers] : [];
  if (offers.length !== 1 || !offers[0] || typeof offers[0] !== "object") return undefined;
  const offer = offers[0] as Record<string, unknown>;
  if (offer.priceCurrency !== "COP") return undefined;
  if (typeof offer.priceValidUntil === "string" && Date.parse(offer.priceValidUntil) < Date.now()) return undefined;
  if (typeof offer.availability === "string" && /OutOfStock|Discontinued/i.test(offer.availability)) return undefined;
  const raw = offer.price;
  if (!(typeof raw === "number" || (typeof raw === "string" && /^\d+(?:\.\d+)?$/.test(raw)))) return undefined;
  const price = Number(raw);
  return Number.isFinite(price) && price > 0 ? price : undefined;
}

export function extractProductJsonLd(html: string): { title?: string; price?: number } {
  const scripts = html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi);
  for (const script of scripts) {
    if (!/\btype\s*=\s*["']application\/ld\+json["']/i.test(script[1])) continue;
    try {
      const products = findProducts(JSON.parse(script[2]));
      if (products.length !== 1) continue;
      const product = products[0];
      const title = typeof product.name === "string" ? product.name.trim().slice(0, 200) : "";
      const price = extractPrice(product);
      if (title || price !== undefined) return { ...(title ? { title } : {}), ...(price !== undefined ? { price } : {}) };
    } catch {
      // JSON-LD mal formado: no se intenta extraer datos del HTML libre.
    }
  }
  return {};
}

async function readLimitedHtml(response: Response): Promise<string | null> {
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_HTML_BYTES) return null;
  if (!response.body) return null;
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let html = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_HTML_BYTES) return null;
      html += decoder.decode(value, { stream: true });
    }
    return html + decoder.decode();
  } finally {
    await reader.cancel().catch(() => undefined);
  }
}

export type CatalogPageOffer = { title: string; price: number; seller?: string };

export function extractCatalogOffersJsonLd(html: string, now = new Date()): CatalogPageOffer[] {
  for (const script of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)) {
    if (!/\btype\s*=\s*["']application\/ld\+json["']/i.test(script[1])) continue;
    try {
      const products = findProducts(JSON.parse(script[2]));
      if (products.length !== 1) continue;
      const product = products[0];
      const title = typeof product.name === "string" ? product.name.trim().slice(0, 200) : "";
      if (!title) continue;
      const rawOffers = Array.isArray(product.offers) ? product.offers : product.offers ? [product.offers] : [];
      const offers = rawOffers.flatMap((raw): CatalogPageOffer[] => {
        if (!raw || typeof raw !== "object") return [];
        const offer = raw as Record<string, unknown>;
        if (offer.priceCurrency !== "COP") return [];
        if (typeof offer.availability === "string" && /OutOfStock|Discontinued/i.test(offer.availability)) return [];
        if (typeof offer.priceValidUntil === "string" && offer.priceValidUntil.trim() && (!Number.isFinite(Date.parse(offer.priceValidUntil)) || Date.parse(offer.priceValidUntil) < now.getTime())) return [];
        const price = Number(offer.price);
        if (!Number.isFinite(price) || price <= 0 || !/^\d+(?:\.\d+)?$/.test(String(offer.price))) return [];
        const seller = typeof offer.seller === "string" ? offer.seller : offer.seller && typeof offer.seller === "object"
          ? (offer.seller as Record<string, unknown>).name : undefined;
        return [{ title, price, ...(typeof seller === "string" && seller.trim() ? { seller: seller.trim().slice(0, 100) } : {}) }];
      });
      if (offers.length > 0) return offers;
    } catch {
      // Only structured product data is accepted.
    }
  }
  return [];
}

export async function inspectCatalogLink(input: unknown, fetchImpl: typeof fetch = fetch, now = new Date()): Promise<{ url: string; store: string; offers: CatalogPageOffer[] }> {
  const { url, store } = validateCompareUrl(input);
  try {
    const response = await fetchImpl(url, {
      method: "GET", redirect: "manual", credentials: "omit",
      headers: { Accept: "text/html" }, signal: AbortSignal.timeout(5000), cache: "no-store",
    });
    if (!response.ok || !response.headers.get("content-type")?.toLowerCase().includes("text/html")) return { url, store, offers: [] };
    const html = await readLimitedHtml(response);
    return { url, store, offers: html === null ? [] : extractCatalogOffersJsonLd(html, now) };
  } catch {
    return { url, store, offers: [] };
  }
}

export async function inspectCompareLink(input: unknown, fetchImpl: typeof fetch = fetch): Promise<CompareLinkDraft> {
  const { url, store } = validateCompareUrl(input);
  const manual: CompareLinkDraft = {
    url, store, extraction: "manual", missingFields: ["title", "price"],
    notice: "La página no publicó datos estructurados accesibles. Completa los datos del anuncio y verifícalos en el sitio.",
  };
  try {
    const response = await fetchImpl(url, {
      method: "GET",
      redirect: "manual",
      credentials: "omit",
      headers: { Accept: "text/html" },
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
    });
    if (!response.ok || !response.headers.get("content-type")?.toLowerCase().includes("text/html")) return manual;
    const html = await readLimitedHtml(response);
    if (html === null) return manual;
    const product = extractProductJsonLd(html);
    if (!product.title && product.price === undefined) return manual;
    const missingFields: CompareLinkDraft["missingFields"] = [];
    if (!product.title) missingFields.push("title");
    if (product.price === undefined) missingFields.push("price");
    return {
      url, store, ...product,
      ...(product.price !== undefined ? { currency: "COP" as const } : {}),
      extraction: "json_ld",
      missingFields,
      notice: "Datos publicados en JSON-LD; confirma título, variante y precio en el anuncio antes de comparar.",
    };
  } catch {
    return manual;
  }
}
