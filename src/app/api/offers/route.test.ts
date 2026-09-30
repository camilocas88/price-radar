import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const request = () => new NextRequest("http://localhost/api/offers?query=iphone");

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("GET /api/offers", () => {
  it("distingue una búsqueda válida sin resultados", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ results: [] }), { status: 200 })));
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ offers: [], source: "mercadolibre" });
  });

  it("conserva el enriquecimiento de ofertas cuando la fuente responde", async () => {
    vi.stubEnv("MERCADOLIBRE_DEFAULT_ZIP_CODE", "");
    const fetchMock = vi.fn().mockImplementation((url: URL | string) => {
      if (String(url).includes("/sites/MCO/search")) {
        return Promise.resolve(new Response(JSON.stringify({ results: [{ id: "MCO1", title: "Teléfono", price: 1000000, currency_id: "COP", permalink: "https://example.test/MCO1" }] }), { status: 200 }));
      }
      return Promise.resolve(new Response(JSON.stringify({ id: "MCO1", shipping: { free_shipping: true } }), { status: 200 }));
    });
    vi.stubGlobal("fetch", fetchMock);
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ offers: [{ id: "ml-MCO1", delivery: "Envío gratis confirmado por Mercado Libre" }], source: "mercadolibre" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("no confunde una respuesta incompleta con una búsqueda vacía", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({}), { status: 200 })));
    const response = await GET(request());
    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({ code: "SOURCE_UNAVAILABLE" });
  });

  it("informa acceso denegado sin convertirlo en una lista vacía", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "forbidden" }), { status: 403 })));
    const response = await GET(request());
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ code: "SOURCE_FORBIDDEN", source: "mercadolibre" });
  });

  it("distingue el límite de consultas", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 429 })));
    const response = await GET(request());
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ code: "SOURCE_RATE_LIMITED" });
  });

  it("informa un fallo de red como fuente no disponible", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    const response = await GET(request());
    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({ code: "SOURCE_UNAVAILABLE" });
  });
});
