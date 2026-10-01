import { canonicalProductKey, getSnapshotDatabase } from "./offer-snapshots";

export type HistoryMode = "current" | "history";

export type HistoricalOffer = {
  id: string;
  source: string;
  offerId: string;
  price: string;
  shipping: string;
  taxes: string;
  currency: string;
  priceConfirmation: string;
  shippingConfirmation: string;
  taxConfirmation: string;
  availability: string;
  capturedAt: string;
};

export type OfferHistory = {
  productKey: string;
  mode: HistoryMode;
  offers: HistoricalOffer[];
  nextCursor: string | null;
  truncated: boolean;
};

export class HistoryUnavailableError extends Error {}
export class InvalidHistoryQueryError extends Error {}

export async function readOfferHistory(query: string, mode: HistoryMode, limit: number, cursor?: string): Promise<OfferHistory> {
  const productKey = canonicalProductKey(query);
  if (!productKey || !Number.isInteger(limit) || limit < 1 || limit > 50 || (cursor && mode !== "history")) {
    throw new InvalidHistoryQueryError("Indica una variante inequívoca y un límite de 1 a 50.");
  }
  const database = getSnapshotDatabase();
  if (!database) throw new HistoryUnavailableError("La base de datos no está configurada.");
  const product = await database.product.findUnique({ where: { canonicalKey: productKey }, select: { id: true } });
  if (!product) return { productKey, mode, offers: [], nextCursor: null, truncated: false };

  if (cursor) {
    const anchor = await database.priceSnapshot.findUnique({ where: { id: cursor }, select: { productId: true } });
    if (!anchor || anchor.productId !== product.id) throw new InvalidHistoryQueryError("El cursor no pertenece a este producto.");
  }

  const rows = await database.priceSnapshot.findMany({
    where: { productId: product.id },
    orderBy: [{ capturedAt: "desc" }, { id: "desc" }],
    ...(mode === "current" ? { distinct: ["source", "offerId"] as const } : {}),
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    take: limit + 1,
  });
  const page = rows.slice(0, limit);
  return {
    productKey,
    mode,
    offers: page.map((row) => ({
      id: row.id,
      source: row.source,
      offerId: row.offerId,
      price: row.price.toString(),
      shipping: row.shipping.toString(),
      taxes: row.taxes.toString(),
      currency: row.currency,
      priceConfirmation: row.priceConfirmation,
      shippingConfirmation: row.shippingConfirmation,
      taxConfirmation: row.taxConfirmation,
      availability: row.availability,
      capturedAt: row.capturedAt.toISOString(),
    })),
    nextCursor: mode === "history" && rows.length > limit ? page.at(-1)!.id : null,
    truncated: mode === "current" && rows.length > limit,
  };
}
