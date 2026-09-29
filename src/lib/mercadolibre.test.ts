import { describe, expect, it } from "vitest";
import { normalizeMercadoLibreOffers } from "./mercadolibre";

describe("normalizeMercadoLibreOffers", () => {
  it("normaliza precio COP y evita afirmar costos no confirmados", () => {
    const [offer] = normalizeMercadoLibreOffers({ results: [{
      id: "MCO1", title: "Teléfono", price: 1200000, currency_id: "COP", permalink: "https://example.test/MCO1",
      condition: "new", shipping: { free_shipping: true }, available_quantity: 1,
      seller: { nickname: "Tienda oficial", official_store_id: 2 }, seller_address: { city: { name: "Bogotá" } },
    }] });

    expect(offer).toMatchObject({ total: 1200000, shipping: 0, taxes: 0, estimated: false, classification: "Mejor compra verificada" });
    expect(offer.confirmation).toContain("disponibilidad referencial");
  });

  it("descarta precios que no están expresados en COP o son inválidos", () => {
    expect(normalizeMercadoLibreOffers({ results: [
      { id: "USD", title: "USD", price: 1, currency_id: "USD", permalink: "https://example.test/USD" },
      { id: "ZERO", title: "Cero", price: 0, currency_id: "COP", permalink: "https://example.test/ZERO" },
    ] })).toEqual([]);
  });
});
