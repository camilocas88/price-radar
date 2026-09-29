import { NextRequest, NextResponse } from "next/server";
import { normalizeMercadoLibreOffers, type MercadoLibreSearchResponse } from "@/lib/mercadolibre";

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
    const response = await fetch(url, {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      next: { revalidate: 60 },
    });
    if (!response.ok) return NextResponse.json({ error: "Mercado Libre no respondió la búsqueda." }, { status: 502 });
    const payload = (await response.json()) as MercadoLibreSearchResponse;
    return NextResponse.json({ offers: normalizeMercadoLibreOffers(payload), source: "mercadolibre" });
  } catch {
    return NextResponse.json({ error: "No fue posible consultar Mercado Libre." }, { status: 502 });
  }
}
