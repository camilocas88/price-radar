import { NextRequest, NextResponse } from "next/server";
import { parseOfferContract } from "../../../lib/offer-contract";
import { saveOfferSnapshots } from "../../../lib/offer-snapshots";
import { classifySearchResults } from "../../../lib/product-matching";
import { searchPublicCatalog } from "../../../lib/public-catalog";
import {
  enrichMercadoLibreOffers,
  normalizeMercadoLibreOffers,
  type MercadoLibreSearchResponse,
} from "../../../lib/mercadolibre";

const MAX_QUERY_LENGTH = 120;

async function searchMercadoLibre(query: string) {
  const url = new URL("https://api.mercadolibre.com/sites/MCO/search");
  url.searchParams.set("q", query);
  url.searchParams.set("limit", "10");
  const accessToken = process.env.MERCADOLIBRE_ACCESS_TOKEN;
  const zipCode = process.env.MERCADOLIBRE_DEFAULT_ZIP_CODE?.trim() || undefined;
  try {
    const response = await fetch(url, {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(6000),
    });
    if (!response.ok) return {
      offers: [], needsReview: [], excludedCount: 0, status: "unavailable",
      detail: `Mercado Libre respondió HTTP ${response.status}.`,
      code: response.status === 401 || response.status === 403 ? "SOURCE_FORBIDDEN" : response.status === 429 ? "SOURCE_RATE_LIMITED" : "SOURCE_UNAVAILABLE",
      httpStatus: response.status === 401 || response.status === 403 || response.status === 429 ? 503 : 502,
    };
    const payload = (await response.json()) as MercadoLibreSearchResponse;
    if (!Array.isArray(payload?.results)) throw new Error("Respuesta inválida");
    const comparable = payload.results.filter((item) => item.currency_id === "COP" && Number.isFinite(item.price) && item.price > 0);
    const { matches, needsReview, excludedCount } = classifySearchResults(query, comparable);
    const baseOffers = normalizeMercadoLibreOffers({ results: matches });
    const offers = (await enrichMercadoLibreOffers(baseOffers, { accessToken, zipCode })).map(parseOfferContract);
    return { offers, needsReview, excludedCount, status: "ok", detail: `${offers.length} oferta(s) verificadas por API.` };
  } catch {
    return { offers: [], needsReview: [], excludedCount: 0, status: "unavailable", detail: "Mercado Libre no respondió.", code: "SOURCE_UNAVAILABLE", httpStatus: 502 };
  }
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("query")?.trim() ?? "";
  if (!query) return NextResponse.json({ error: "El término de búsqueda es obligatorio." }, { status: 400 });
  if (query.length > MAX_QUERY_LENGTH) return NextResponse.json({ error: "El término de búsqueda es demasiado largo." }, { status: 400 });

  const [web, ml] = await Promise.all([
    searchPublicCatalog(query, { key: process.env.BRAVE_SEARCH_API_KEY }),
    searchMercadoLibre(query),
  ]);
  const offers = [...web.offers, ...ml.offers];
  const sources = [
    { source: "web", status: web.status, detail: web.detail },
    { source: "mercadolibre", status: ml.status, detail: ml.detail },
  ];
  if (offers.length > 0) {
    try {
      await saveOfferSnapshots(query, offers);
    } catch {
      console.warn("price_snapshot_write_failed", { source: "multi", offerCount: offers.length });
    }
  }
  if (web.status !== "ok" && web.status !== "no_prices" && ml.status !== "ok") {
    return NextResponse.json({
      error: web.status === "not_configured"
        ? "La búsqueda web aún no está configurada y Mercado Libre no está disponible."
        : "Ninguna fuente de búsqueda respondió en este momento.",
      code: web.status === "not_configured" ? ml.code ?? "SEARCH_NOT_CONFIGURED" : "SOURCE_UNAVAILABLE",
      source: web.status === "not_configured" ? "mercadolibre" : "multi",
      sources,
    }, { status: web.status === "not_configured" ? ml.httpStatus ?? 503 : 503 });
  }
  return NextResponse.json({ offers, unpriced: web.unpriced, needsReview: ml.needsReview, excludedCount: ml.excludedCount, sources });
}
