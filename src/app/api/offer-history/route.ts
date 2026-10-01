import { NextRequest, NextResponse } from "next/server";
import { HistoryUnavailableError, InvalidHistoryQueryError, readOfferHistory, type HistoryMode } from "../../../lib/offer-history";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("query")?.trim() ?? "";
  const mode = request.nextUrl.searchParams.get("mode") ?? "current";
  const rawLimit = request.nextUrl.searchParams.get("limit") ?? "20";
  const cursor = request.nextUrl.searchParams.get("cursor") ?? undefined;
  if (!query || query.length > 120 || !["current", "history"].includes(mode) || !/^\d+$/.test(rawLimit) || Number(rawLimit) < 1 || Number(rawLimit) > 50 || (cursor !== undefined && (mode !== "history" || cursor.length > 64 || !/^[a-zA-Z0-9_-]+$/.test(cursor)))) {
    return NextResponse.json({ error: "Parámetros de historial inválidos." }, { status: 400 });
  }
  try {
    return NextResponse.json(await readOfferHistory(query, mode as HistoryMode, Number(rawLimit), cursor));
  } catch (error) {
    if (error instanceof InvalidHistoryQueryError) return NextResponse.json({ error: error.message }, { status: 400 });
    if (error instanceof HistoryUnavailableError) return NextResponse.json({ error: error.message, code: "DATABASE_UNAVAILABLE" }, { status: 503 });
    console.warn("offer_history_read_failed");
    return NextResponse.json({ error: "No fue posible consultar el historial." }, { status: 503 });
  }
}
