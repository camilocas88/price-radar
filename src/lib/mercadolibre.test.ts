import { describe, expect, it, vi } from "vitest";
import { enrichMercadoLibreOffers, normalizeMercadoLibreOffers } from "./mercadolibre";

describe("normalizeMercadoLibreOffers", () => {
  it("normaliza precio COP y evita afirmar costos no confirmados", () => {
    const [offer] = normalizeMercadoLibreOffers({ results: [{
      id: "MCO1", title: "Teléfono", price: 1200000, currency_id: "COP", permalink: "https://example.test/MCO1",
      condition: "new", shipping: { free_shipping: true }, available_quantity: 1,
      seller: { nickname: "Tienda oficial", official_store_id: 2 }, seller_address: { city: { name: "Bogotá" } },
    }] });

    expect(offer).toMatchObject({
      total: 1200000, shipping: 0, taxes: 0, estimated: true,
      classification: "Mejor compra verificada", source: "mercadolibre", currency: "COP",
      availability: "unknown", priceConfirmation: "confirmed",
      shippingConfirmation: "estimated", taxConfirmation: "unknown",
    });
    expect(new Date(offer.checkedAt).toISOString()).toBe(offer.checkedAt);
    expect(offer.confirmation).toContain("disponibilidad referencial");
  });

  it("descarta precios que no están expresados en COP o son inválidos", () => {
    expect(normalizeMercadoLibreOffers({ results: [
      { id: "USD", title: "USD", price: 1, currency_id: "USD", permalink: "https://example.test/USD" },
      { id: "ZERO", title: "Cero", price: 0, currency_id: "COP", permalink: "https://example.test/ZERO" },
    ] })).toEqual([]);
  });
});

describe("enrichMercadoLibreOffers", () => {
  const baseOffer = normalizeMercadoLibreOffers({ results: [{
    id: "MCO42", title: "Teléfono", price: 1_500_000, currency_id: "COP", permalink: "https://example.test/MCO42",
    condition: "new", shipping: { free_shipping: false }, available_quantity: 3,
    seller: { nickname: "Vendedor", official_store_id: null }, seller_address: { city: { name: "Medellín" } },
  }] })[0];

  it("confirma envío gratis desde /items y no llama shipping_options", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/items/MCO42?")) return new Response(JSON.stringify({ id: "MCO42", shipping: { free_shipping: true }, warranty: "Garantía del vendedor: 6 meses" }), { status: 200 });
      throw new Error(`unexpected url: ${url}`);
    });

    const [enriched] = await enrichMercadoLibreOffers([baseOffer], { fetchImpl: fetchImpl as unknown as typeof fetch, zipCode: "110111" });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(enriched.shipping).toBe(0);
    expect(enriched.total).toBe(1_500_000);
    expect(enriched.warranty).toBe("Garantía del vendedor: 6 meses");
    expect(enriched.delivery).toContain("Envío gratis confirmado");
    expect(enriched.confirmation).toContain("impuestos por confirmar");
    expect(enriched.estimated).toBe(true);
    expect(enriched.shippingConfirmation).toBe("confirmed");
    expect(enriched.taxConfirmation).toBe("unknown");
  });

  it("usa la opción más barata de shipping_options cuando el envío no es gratis", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/items/MCO42?")) return new Response(JSON.stringify({ id: "MCO42", shipping: { free_shipping: false }, warranty: null }), { status: 200 });
      if (url.includes("/shipping_options")) return new Response(JSON.stringify({ options: [
        { cost: 25_000, currency_id: "COP", name: "Estándar" },
        { cost: 18_500, currency_id: "COP", name: "Económico" },
        { cost: 5, currency_id: "USD", name: "Ignorado por moneda" },
      ] }), { status: 200 });
      throw new Error(`unexpected url: ${url}`);
    });

    const [enriched] = await enrichMercadoLibreOffers([baseOffer], { fetchImpl: fetchImpl as unknown as typeof fetch, zipCode: "050001" });

    expect(enriched.shipping).toBe(18_500);
    expect(enriched.total).toBe(baseOffer.price + 18_500);
    expect(enriched.delivery).toContain("Envío desde");
    expect(enriched.confirmation).toContain("envío con costo confirmado");
    expect(enriched.estimated).toBe(true);
    expect(enriched.shippingConfirmation).toBe("confirmed");
  });

  it("retira el aviso de envío gratis si el detalle lo contradice", async () => {
    const [publishedFree] = normalizeMercadoLibreOffers({ results: [{
      id: "MCO43", title: "Teléfono", price: 1_500_000, currency_id: "COP",
      permalink: "https://example.test/MCO43", shipping: { free_shipping: true },
    }] });
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ id: "MCO43", shipping: { free_shipping: false } }), { status: 200 }));

    const [enriched] = await enrichMercadoLibreOffers([publishedFree], { fetchImpl: fetchImpl as unknown as typeof fetch });

    expect(enriched.shippingConfirmation).toBe("unknown");
    expect(enriched.delivery).toBe("Costo y fecha por confirmar");
    expect(enriched.confirmation).toContain("envío por confirmar");
    expect(enriched.confirmation).not.toContain("envío gratis publicado");
    expect(enriched.estimated).toBe(true);
  });

  it("reemplaza el aviso de envío gratis por el costo confirmado si hay ZIP", async () => {
    const [publishedFree] = normalizeMercadoLibreOffers({ results: [{
      id: "MCO44", title: "Teléfono", price: 1_500_000, currency_id: "COP",
      permalink: "https://example.test/MCO44", shipping: { free_shipping: true },
    }] });
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => String(input).includes("shipping_options")
      ? new Response(JSON.stringify({ options: [{ cost: 20_000, currency_id: "COP" }] }), { status: 200 })
      : new Response(JSON.stringify({ id: "MCO44", shipping: { free_shipping: false } }), { status: 200 }));

    const [enriched] = await enrichMercadoLibreOffers([publishedFree], { fetchImpl: fetchImpl as unknown as typeof fetch, zipCode: "110111" });

    expect(enriched.shipping).toBe(20_000);
    expect(enriched.shippingConfirmation).toBe("confirmed");
    expect(enriched.confirmation).toContain("envío con costo confirmado");
    expect(enriched.confirmation).not.toContain("envío gratis publicado");
  });

  it("degrada silenciosamente si /items falla y no hay ZIP", async () => {
    const fetchImpl = vi.fn(async () => new Response("boom", { status: 500 }));

    const [enriched] = await enrichMercadoLibreOffers([baseOffer], { fetchImpl: fetchImpl as unknown as typeof fetch });

    expect(enriched.shipping).toBe(baseOffer.shipping);
    expect(enriched.total).toBe(baseOffer.total);
    expect(enriched.estimated).toBe(true);
    expect(enriched.delivery).toBe(baseOffer.delivery);
    expect(enriched.shippingConfirmation).toBe("unknown");
  });
});
