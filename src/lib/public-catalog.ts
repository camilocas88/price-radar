import { createHash } from "node:crypto";
import { inspectCatalogLink, validateCompareUrl } from "./compare-link";
import { parseOfferContract } from "./offer-contract";
import type { OfferContract } from "./offers";

type SearchResult = { url?: unknown; title?: unknown };
type BraveResponse = { web?: { results?: SearchResult[] } };
const STOPWORDS = new Set(["para", "con", "sin", "del", "las", "los", "una", "uno", "por", "desde", "hasta", "color", "tipo"]);

export type CatalogSearch = {
  offers: OfferContract[];
  unpriced: Array<{ url: string; store: string }>;
  status: "ok" | "no_prices" | "not_configured" | "unavailable";
  detail: string;
};

const MAX_RESULTS = 10;
const MAX_PAGES = 8;
const SEARCHES = ["site:exito.com", "site:falabella.com.co/falabella-co/product", ""];

function isProductPage(url: string): boolean {
  const parsed = new URL(url);
  const host = parsed.hostname.replace(/^www\./, "");
  const path = parsed.pathname;
  if (host === "exito.com") return /\/p\/?$/i.test(path);
  if (host === "falabella.com.co") return /\/product\//i.test(path);
  if (host === "alkosto.com" || host === "ktronix.com") return /\/p(?:\/|$)/i.test(path);
  if (host === "mac-center.com" || host === "co.tiendasishop.com") return /\/products\//i.test(path);
  if (host === "mercadolibre.com.co") return /\/p\/|\/MCO-/i.test(path);
  return false;
}

function words(value: string): string[] {
  return value.toLocaleLowerCase("es-CO").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .split(/[^a-z0-9]+/).filter((word) => word.length > 2)
    .filter((word) => !STOPWORDS.has(word))
    .map((word) => word.endsWith("s") ? word.slice(0, -1) : word);
}

export function isRelatedProduct(query: string, title: string): boolean {
  const requested = words(query);
  const found = new Set(words(title));
  return requested.length > 0 && requested.every((word) => found.has(word));
}

export async function searchPublicCatalog(query: string, options: {
  key?: string;
  fetchImpl?: typeof fetch;
  now?: Date;
} = {}): Promise<CatalogSearch> {
  const key = options.key?.trim();
  if (!key) return { offers: [], unpriced: [], status: "not_configured", detail: "Configura BRAVE_SEARCH_API_KEY para descubrir productos de distintas tiendas." };
  const fetchImpl = options.fetchImpl ?? fetch;
  const searches = await Promise.all(SEARCHES.map(async (site): Promise<SearchResult[] | null> => {
    const endpoint = new URL("https://api.search.brave.com/res/v1/web/search");
    endpoint.searchParams.set("q", `${query} comprar precio Colombia ${site}`.trim());
    endpoint.searchParams.set("search_lang", "es");
    endpoint.searchParams.set("count", String(MAX_RESULTS));
    try {
      const response = await fetchImpl(endpoint, {
        headers: { Accept: "application/json", "X-Subscription-Token": key },
        cache: "no-store",
        signal: AbortSignal.timeout(6000),
      });
      if (!response.ok) return null;
      const payload = (await response.json()) as BraveResponse;
      return Array.isArray(payload.web?.results) ? payload.web.results : null;
    } catch {
      return null;
    }
  }));
  if (searches.every((results) => results === null)) {
    return { offers: [], unpriced: [], status: "unavailable", detail: "El buscador web no respondió. Revisa la clave o inténtalo de nuevo." };
  }

  const urls = new Map<string, { store: string; title?: string }>();
  for (const [index, results] of searches.entries()) {
    let fromSearch = 0;
    for (const result of results ?? []) {
      if (typeof result.url !== "string") continue;
      try {
        const validated = validateCompareUrl(result.url);
        if (!isProductPage(validated.url)) continue;
        if (!urls.has(validated.url)) {
          urls.set(validated.url, { store: validated.store, title: typeof result.title === "string" ? result.title : undefined });
          fromSearch += 1;
        }
      } catch {
        // Only explicitly supported retailer hosts can be fetched.
      }
      if (urls.size >= MAX_PAGES || fromSearch >= (index === 0 ? 4 : 2)) break;
    }
    if (urls.size >= MAX_PAGES) break;
  }

  const now = options.now ?? new Date();
  const inspected = await Promise.all([...urls].map(async ([url]) => inspectCatalogLink(url, fetchImpl, now)));
  const offers: OfferContract[] = [];
  const unpriced: CatalogSearch["unpriced"] = [];
  for (const item of inspected) {
    const source = new URL(item.url).hostname.replace(/^www\./, "").replace(/[^a-z0-9]/g, "_");
    let matchingOffers = 0;
    for (const published of item.offers.slice(0, 8)) {
      if (!isRelatedProduct(query, published.title)) continue;
      matchingOffers += 1;
      const identity = new URL(item.url);
      const offerId = createHash("sha256").update(`${identity.origin}${identity.pathname}|${published.seller ?? ""}`).digest("hex").slice(0, 16);
      offers.push(parseOfferContract({
      id: `web_${source}_${offerId}`,
      store: published.seller ? `${item.store} · ${published.seller}` : item.store,
      classification: "Posible oferta",
      price: published.price,
      shipping: 0,
      taxes: 0,
      total: published.price,
      delivery: "Envío por confirmar",
      warranty: "Garantía por confirmar",
      updated: "Precio consultado ahora",
      kind: published.title,
      confirmation: "Producto relacionado; verifica la variante",
      score: 50,
      estimated: true,
      url: item.url,
      source,
      currency: "COP",
      availability: "unknown",
      priceConfirmation: "confirmed",
      shippingConfirmation: "unknown",
      taxConfirmation: "unknown",
      checkedAt: now.toISOString(),
      }));
    }
    const discovered = urls.get(item.url);
    if (matchingOffers === 0 && isRelatedProduct(query, `${discovered?.title ?? ""} ${new URL(item.url).pathname}`)) {
      unpriced.push({ url: item.url, store: item.store });
    }
  }
  offers.sort((left, right) => left.price - right.price);
  if (urls.size > 0 && offers.length === 0) {
    return { offers, unpriced, status: "no_prices", detail: `Se encontraron ${urls.size} página(s) de tiendas, pero no se pudo verificar un precio COP para estos productos.` };
  }
  return { offers, unpriced, status: "ok", detail: `${offers.length} producto(s) con precio publicado en tiendas permitidas.` };
}
