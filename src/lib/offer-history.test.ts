import { afterEach, describe, expect, it, vi } from "vitest";
import { getSnapshotDatabase } from "./offer-snapshots";
import { HistoryUnavailableError, InvalidHistoryQueryError, readOfferHistory } from "./offer-history";

vi.mock("./offer-snapshots", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./offer-snapshots")>()),
  getSnapshotDatabase: vi.fn(),
}));

const row = (id: string, price: string, capturedAt: string) => ({
  id, productId: "p1", source: "mercadolibre", offerId: "MCO1",
  price: { toString: () => price }, shipping: { toString: () => "0" }, taxes: { toString: () => "0" },
  currency: "COP", priceConfirmation: "confirmed", shippingConfirmation: "unknown",
  taxConfirmation: "unknown", availability: "unknown", capturedAt: new Date(capturedAt),
});
const query = "iPhone 17 Pro Max 256 GB nuevo";

afterEach(() => vi.mocked(getSnapshotDatabase).mockReset());

describe("readOfferHistory", () => {
  it("distingue DB ausente y variante ambigua", async () => {
    vi.mocked(getSnapshotDatabase).mockReturnValue(null);
    await expect(readOfferHistory(query, "history", 20)).rejects.toBeInstanceOf(HistoryUnavailableError);
    await expect(readOfferHistory("iPhone", "history", 20)).rejects.toBeInstanceOf(InvalidHistoryQueryError);
  });

  it("serializa importes y pagina sin repetir el cursor", async () => {
    const findMany = vi.fn().mockResolvedValue([
      row("s3", "3000000", "2026-10-01T00:00:00.000Z"),
      row("s2", "2000000", "2026-09-30T00:00:00.000Z"),
    ]);
    vi.mocked(getSnapshotDatabase).mockReturnValue({
      product: { findUnique: vi.fn().mockResolvedValue({ id: "p1" }) },
      priceSnapshot: { findUnique: vi.fn().mockResolvedValue({ productId: "p1" }), findMany },
    } as never);
    const result = await readOfferHistory(query, "history", 1, "s1");
    expect(result).toMatchObject({ productKey: "apple|iphone 17 pro max|256|new", mode: "history", nextCursor: "s3", offers: [{ price: "3000000", capturedAt: "2026-10-01T00:00:00.000Z" }] });
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ cursor: { id: "s1" }, skip: 1, take: 2 }));
  });

  it("consulta la última captura por publicación y rechaza cursor ajeno", async () => {
    const findMany = vi.fn().mockResolvedValue([row("s3", "3000000", "2026-10-01T00:00:00.000Z")]);
    const findUnique = vi.fn().mockResolvedValue({ productId: "p2" });
    vi.mocked(getSnapshotDatabase).mockReturnValue({
      product: { findUnique: vi.fn().mockResolvedValue({ id: "p1" }) },
      priceSnapshot: { findUnique, findMany },
    } as never);
    await expect(readOfferHistory(query, "history", 20, "foreign")).rejects.toBeInstanceOf(InvalidHistoryQueryError);
    const current = await readOfferHistory(query, "current", 20);
    expect(current.nextCursor).toBeNull();
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ distinct: ["source", "offerId"], take: 21 }));
  });
});
