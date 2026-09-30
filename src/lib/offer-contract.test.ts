import { describe, expect, it } from "vitest";
import { parseOfferContract } from "./offer-contract";
import type { OfferContract } from "./offers";

const offer: OfferContract = {
  id: "feed-1",
  store: "Tienda de prueba",
  classification: "Posible oferta",
  price: 99.5,
  shipping: 4.5,
  taxes: 0,
  total: 104,
  delivery: "Por confirmar",
  warranty: "Por confirmar",
  updated: "consulta en tiempo real",
  kind: "Feed autorizado",
  confirmation: "Precio publicado",
  score: 50,
  estimated: true,
  source: "feed_autorizado",
  currency: "USD",
  availability: "unknown",
  priceConfirmation: "confirmed",
  shippingConfirmation: "unknown",
  taxConfirmation: "unknown",
  checkedAt: "2026-09-30T01:00:00.000Z",
};

describe("contrato común de ofertas", () => {
  it("acepta otra moneda válida sin convertirla implícitamente a COP", () => {
    expect(parseOfferContract(offer)).toEqual(offer);
  });

  it("rechaza moneda inválida, importe inconsistente y fecha no ISO", () => {
    expect(() => parseOfferContract({ ...offer, currency: "usd" })).toThrow();
    expect(() => parseOfferContract({ ...offer, currency: "ZZZ" })).toThrow();
    expect(() => parseOfferContract({ ...offer, total: 105 })).toThrow();
    expect(() => parseOfferContract({ ...offer, checkedAt: "ayer" })).toThrow();
  });

  it("no completa como confirmados los campos ausentes o desconocidos", () => {
    expect(() => parseOfferContract({ ...offer, shippingConfirmation: undefined })).toThrow();
    expect(() => parseOfferContract({ ...offer, availability: undefined })).toThrow();
    expect(() => parseOfferContract({ ...offer, taxConfirmation: undefined })).toThrow();
    expect(parseOfferContract(offer)).toMatchObject({
      availability: "unknown",
      shippingConfirmation: "unknown",
      taxConfirmation: "unknown",
    });
  });
});
