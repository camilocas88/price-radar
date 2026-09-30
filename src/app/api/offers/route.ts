import { NextRequest, NextResponse } from "next/server";
import { parseOfferContract } from "../../../lib/offer-contract";
import { classifySearchResults } from "../../../lib/product-matching";
import {
  enrichMercadoLibreOffers,
  normalizeMercadoLibreOffers,
  type MercadoLibreSearchResponse,
} from "../../../lib/mercadolibre";

const MAX_QUERY_LENGTH = 120;

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("query")?.trim() ?? "";
  if (!query) return NextResponse.json({ error: "El término de búsqueda es obligatorio." }, { status: 400 });
  if (query.length > MAX_QUERY_LENGTH) return NextResponse.json({ error: "El término de búsqueda es demasiado largo." }, { status: 400 });

  const url = new URL("https://api.mercadolibre.com/sites/MCO/search");
  url.searchParams.set("q", query);
  url.searchParams.set("limit", "10");

  try {
    const accessToken = process.env.MERCADOLIBRE_ACCESS_TOKEN;
    const zipCode = process.env.MERCADOLIBRE_DEFAULT_ZIP_CODE?.trim() || undefined;
    const response = await fetch(url, {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      cache: "no-store",
    });
    if (response.status === 401 || response.status === 403) {
      return NextResponse.json({ error: "La búsqueda de Mercado Libre no está autorizada en este momento.", code: "SOURCE_FORBIDDEN", source: "mercadolibre" }, { status: 503 });
    }
    if (response.status === 429) {
      return NextResponse.json({ error: "Mercado Libre limitó temporalmente las consultas.", code: "SOURCE_RATE_LIMITED", source: "mercadolibre" }, { status: 503 });
    }
    if (!response.ok) {
      return NextResponse.json({ error: "Mercado Libre no respondió la búsqueda.", code: "SOURCE_UNAVAILABLE", source: "mercadolibre" }, { status: 502 });
    }
    const payload = (await response.json()) as MercadoLibreSearchResponse;
    if (!Array.isArray(payload?.results)) {
      return NextResponse.json({ error: "Mercado Libre devolvió una respuesta inesperada.", code: "SOURCE_UNAVAILABLE", source: "mercadolibre" }, { status: 502 });
    }
    const comparableCurrency = payload.results.filter((item) => item.currency_id === "COP" && Number.isFinite(item.price) && item.price > 0);
    const { matches, needsReview, excludedCount } = classifySearchResults(query, comparableCurrency);
    const baseOffers = normalizeMercadoLibreOffers({ results: matches });
    const offers = (await enrichMercadoLibreOffers(baseOffers, { accessToken, zipCode })).map(parseOfferContract);
    return NextResponse.json({ offers, source: "mercadolibre", needsReview, excludedCount });
  } catch {
    return NextResponse.json({ error: "No fue posible consultar Mercado Libre.", code: "SOURCE_UNAVAILABLE", source: "mercadolibre" }, { status: 502 });
  }
}
