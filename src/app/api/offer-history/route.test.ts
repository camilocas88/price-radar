import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";
import { HistoryUnavailableError, readOfferHistory } from "../../../lib/offer-history";

vi.mock("../../../lib/offer-history", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../lib/offer-history")>()),
  readOfferHistory: vi.fn(),
}));

const request = (params: string) => new NextRequest(`http://localhost/api/offer-history?${params}`);
afterEach(() => vi.mocked(readOfferHistory).mockReset());

describe("GET /api/offer-history", () => {
  it("valida modo, límite y consulta", async () => {
    expect((await GET(request("query=iphone&mode=bad"))).status).toBe(400);
    expect((await GET(request("query=iphone&limit=0"))).status).toBe(400);
    expect((await GET(request("mode=history"))).status).toBe(400);
  });

  it("devuelve respuesta explícita cuando no hay DB", async () => {
    vi.mocked(readOfferHistory).mockRejectedValueOnce(new HistoryUnavailableError("La base de datos no está configurada."));
    const response = await GET(request("query=iPhone%2017%20Pro%20Max%20256%20GB%20nuevo"));
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ code: "DATABASE_UNAVAILABLE" });
  });

  it("delega la lectura paginada sin alterar el contrato", async () => {
    vi.mocked(readOfferHistory).mockResolvedValueOnce({ productKey: "key", mode: "history", offers: [], nextCursor: null, truncated: false });
    const response = await GET(request("query=iPhone%2017%20Pro%20Max%20256%20GB%20nuevo&mode=history&limit=10&cursor=s1"));
    expect(response.status).toBe(200);
    expect(readOfferHistory).toHaveBeenCalledWith("iPhone 17 Pro Max 256 GB nuevo", "history", 10, "s1");
  });
});
