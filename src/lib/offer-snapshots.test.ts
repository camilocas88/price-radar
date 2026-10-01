import { afterEach, describe, expect, it, vi } from "vitest";
import type { OfferContract } from "./offers";
import { buildSnapshotBatch, saveOfferSnapshots, type SnapshotWriter } from "./offer-snapshots";

const offer: OfferContract = {
  id: "ml-MCO1", store: "Tienda", classification: "Posible oferta",
  price: 5899000, shipping: 12000, taxes: 0, total: 5911000,
  delivery: "Por confirmar", warranty: "Por confirmar", updated: "ahora",
  kind: "Marketplace Mercado Libre", confirmation: "Precio publicado",
  score: 60, estimated: true, url: "https://www.mercadolibre.com.co/item",
  source: "mercadolibre", currency: "COP", availability: "unknown",
  priceConfirmation: "confirmed", shippingConfirmation: "confirmed", taxConfirmation: "unknown",
  checkedAt: "2026-09-30T03:00:00.000Z",
};
const query = "iPhone 17 Pro Max 256 GB nuevo";

afterEach(() => vi.unstubAllEnvs());

describe("buildSnapshotBatch", () => {
  it("mapea importes serializables, moneda, publicación y fecha del contrato", () => {
    const batch = buildSnapshotBatch(query, [offer]);
    expect(batch).toMatchObject({
      product: { canonicalKey: "apple|iphone 17 pro max|256|new", brand: "Apple", model: "iphone 17 pro max" },
      snapshots: [{ offerId: "ml-MCO1", source: "mercadolibre", price: "5899000.00", shipping: "12000.00", taxes: "0.00", currency: "COP", shippingConfirmation: "confirmed", taxConfirmation: "unknown", availability: "unknown" }],
    });
    expect(batch?.snapshots[0].capturedAt.toISOString()).toBe(offer.checkedAt);
    expect(JSON.parse(JSON.stringify(batch)).snapshots[0].capturedAt).toBe(offer.checkedAt);
  });

  it("reutiliza la misma clave para la misma variante y rechaza una consulta ambigua", () => {
    expect(buildSnapshotBatch("iPhone 17 Pro-Max 256GB sellado", [offer])?.product.canonicalKey).toBe(buildSnapshotBatch(query, [offer])?.product.canonicalKey);
    expect(buildSnapshotBatch("iPhone 17 Pro Max", [offer])).toBeNull();
    expect(buildSnapshotBatch(query, [])).toBeNull();
  });

  it("distingue envío cero desconocido de envío gratis confirmado", () => {
    const unknown = buildSnapshotBatch(query, [{ ...offer, shipping: 0, total: offer.price, shippingConfirmation: "unknown" }]);
    const confirmed = buildSnapshotBatch(query, [{ ...offer, shipping: 0, total: offer.price, shippingConfirmation: "confirmed" }]);
    expect(unknown?.snapshots[0]).toMatchObject({ shipping: "0.00", shippingConfirmation: "unknown", taxConfirmation: "unknown" });
    expect(confirmed?.snapshots[0]).toMatchObject({ shipping: "0.00", shippingConfirmation: "confirmed" });
  });
});

describe("saveOfferSnapshots", () => {
  it("no abre conexión ni escribe si falta DATABASE_URL", async () => {
    vi.stubEnv("DATABASE_URL", "");
    expect(await saveOfferSnapshots(query, [offer])).toBe(0);
  });

  it("crea o reutiliza producto y guarda un snapshot por oferta", async () => {
    const upsertProduct = vi.fn(async () => "product-1");
    const insertSnapshots = vi.fn(async () => 2);
    const writer: SnapshotWriter = { upsertProduct, insertSnapshots };
    const second = { ...offer, id: "ml-MCO2", price: 6000000, total: 6012000 };
    expect(await saveOfferSnapshots(query, [offer, second], writer)).toBe(2);
    expect(upsertProduct).toHaveBeenCalledOnce();
    expect(insertSnapshots).toHaveBeenCalledWith("product-1", [
      expect.objectContaining({ offerId: "ml-MCO1", price: "5899000.00" }),
      expect.objectContaining({ offerId: "ml-MCO2", price: "6000000.00" }),
    ]);
  });

  it("informa cero inserciones cuando el escritor omite un reintento duplicado", async () => {
    const writer: SnapshotWriter = {
      upsertProduct: vi.fn(async () => "product-1"),
      insertSnapshots: vi.fn(async () => 0),
    };
    expect(await saveOfferSnapshots(query, [offer], writer)).toBe(0);
  });

  it("no escribe cuando no hay ofertas", async () => {
    const writer: SnapshotWriter = { upsertProduct: vi.fn(), insertSnapshots: vi.fn() };
    expect(await saveOfferSnapshots(query, [], writer)).toBe(0);
    expect(writer.upsertProduct).not.toHaveBeenCalled();
  });
});
