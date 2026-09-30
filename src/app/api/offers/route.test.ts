import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";
import { saveOfferSnapshots } from "../../../lib/offer-snapshots";

vi.mock("../../../lib/offer-snapshots", () => ({ saveOfferSnapshots: vi.fn(async () => 0) }));

const request = (query = "iphone") => new NextRequest(`http://localhost/api/offers?query=${encodeURIComponent(query)}`);

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.mocked(saveOfferSnapshots).mockClear();
});

describe("GET /api/offers", () => {
  it("distingue una búsqueda válida sin resultados", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ results: [] }), { status: 200 })));
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ offers: [], source: "mercadolibre", needsReview: [], excludedCount: 0 });
  });

  it("conserva el enriquecimiento de ofertas cuando la fuente responde", async () => {
    vi.stubEnv("MERCADOLIBRE_DEFAULT_ZIP_CODE", "");
    const fetchMock = vi.fn().mockImplementation((url: URL | string) => {
      if (String(url).includes("/sites/MCO/search")) {
        return Promise.resolve(new Response(JSON.stringify({ results: [{ id: "MCO1", title: "iPhone 17 Pro Max 256 GB", condition: "new", price: 1000000, currency_id: "COP", permalink: "https://example.test/MCO1" }] }), { status: 200 }));
      }
      return Promise.resolve(new Response(JSON.stringify({ id: "MCO1", shipping: { free_shipping: true } }), { status: 200 }));
    });
    vi.stubGlobal("fetch", fetchMock);
    const response = await GET(request("iPhone 17 Pro Max 256 GB nuevo"));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ offers: [{
      id: "ml-MCO1", delivery: "Envío gratis confirmado por Mercado Libre",
      source: "mercadolibre", currency: "COP", availability: "unknown",
      priceConfirmation: "confirmed", shippingConfirmation: "confirmed", taxConfirmation: "unknown",
    }], source: "mercadolibre" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(saveOfferSnapshots).toHaveBeenCalledWith("iPhone 17 Pro Max 256 GB nuevo", [expect.objectContaining({ id: "ml-MCO1" })]);
  });

  it("solo compara variantes inequívocas y deja las ambiguas para revisión", async () => {
    const fetchMock = vi.fn().mockImplementation((url: URL | string) => {
      if (String(url).includes("/sites/MCO/search")) return Promise.resolve(new Response(JSON.stringify({ results: [
        { id: "MCO1", title: "iPhone 17 Pro Max 256 GB", condition: "new", price: 1000000, currency_id: "COP", permalink: "https://example.test/1" },
        { id: "MCO2", title: "iPhone 17 Pro Max 128 GB", condition: "new", price: 800000, currency_id: "COP", permalink: "https://example.test/2" },
        { id: "MCO3", title: "iPhone 17 Pro Max", condition: "new", price: 900000, currency_id: "COP", permalink: "https://example.test/3" },
        { id: "MCO4", title: "iPhone 17 Pro Max", condition: "new", price: 100, currency_id: "USD", permalink: "https://example.test/4" },
      ] }), { status: 200 }));
      return Promise.resolve(new Response(null, { status: 404 }));
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(request("iPhone 17 Pro Max 256 GB nuevo"));
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.offers.map((offer: { id: string }) => offer.id)).toEqual(["ml-MCO1"]);
    expect(payload.needsReview).toMatchObject([{ id: "MCO3", reasons: ["missing_storage"] }]);
    expect(payload.excludedCount).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("no confunde una respuesta incompleta con una búsqueda vacía", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({}), { status: 200 })));
    const response = await GET(request());
    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({ code: "SOURCE_UNAVAILABLE" });
  });

  it("rechaza una oferta que no cumple el contrato en el límite del endpoint", async () => {
    const fetchMock = vi.fn().mockImplementation((url: URL | string) => {
      if (String(url).includes("/sites/MCO/search")) {
        return Promise.resolve(new Response(JSON.stringify({ results: [{
          id: "MCO2", title: "iPhone 17 Pro Max 256 GB", condition: "new", price: 1000000, currency_id: "COP", permalink: "url-invalida",
        }] }), { status: 200 }));
      }
      return Promise.resolve(new Response(null, { status: 404 }));
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(request("iPhone 17 Pro Max 256 GB nuevo"));
    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({ code: "SOURCE_UNAVAILABLE", source: "mercadolibre" });
  });

  it("informa acceso denegado sin convertirlo en una lista vacía", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "forbidden" }), { status: 403 })));
    const response = await GET(request());
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ code: "SOURCE_FORBIDDEN", source: "mercadolibre" });
    expect(saveOfferSnapshots).not.toHaveBeenCalled();
  });

  it("mantiene la respuesta válida si guardar snapshots falla", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.mocked(saveOfferSnapshots).mockRejectedValueOnce(new Error("database offline"));
    vi.stubGlobal("fetch", vi.fn().mockImplementation((url: URL | string) => {
      if (String(url).includes("/sites/MCO/search")) return Promise.resolve(new Response(JSON.stringify({ results: [{
        id: "MCO1", title: "iPhone 17 Pro Max 256 GB", condition: "new", price: 1000000,
        currency_id: "COP", permalink: "https://example.test/1",
      }] }), { status: 200 }));
      return Promise.resolve(new Response(null, { status: 404 }));
    }));
    const response = await GET(request("iPhone 17 Pro Max 256 GB nuevo"));
    expect(response.status).toBe(200);
    expect((await response.json()).offers).toHaveLength(1);
    expect(warn).toHaveBeenCalledWith("price_snapshot_write_failed", { source: "mercadolibre", offerCount: 1 });
    warn.mockRestore();
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
