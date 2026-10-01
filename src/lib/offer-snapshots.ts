import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import type { OfferContract } from "./offers";
import { normalizeProduct } from "./normalize";

export type SnapshotInput = {
  offerId: string;
  source: string;
  price: string;
  shipping: string;
  taxes: string;
  currency: string;
  priceConfirmation: OfferContract["priceConfirmation"];
  shippingConfirmation: OfferContract["shippingConfirmation"];
  taxConfirmation: OfferContract["taxConfirmation"];
  availability: OfferContract["availability"];
  capturedAt: Date;
};

export type SnapshotBatch = {
  product: { canonicalKey: string; name: string; brand: string; model: string };
  snapshots: SnapshotInput[];
};

export type SnapshotWriter = {
  upsertProduct: (product: SnapshotBatch["product"]) => Promise<string>;
  insertSnapshots: (productId: string, snapshots: SnapshotInput[]) => Promise<number>;
};

let prisma: PrismaClient | null = null;

export function getSnapshotDatabase(databaseUrl = process.env.DATABASE_URL?.trim()): PrismaClient | null {
  if (!databaseUrl) return null;
  if (!prisma) {
    const adapter = new PrismaPg({ connectionString: databaseUrl, connectionTimeoutMillis: 2000 });
    prisma = new PrismaClient({ adapter });
  }
  return prisma;
}

function databaseWriter(databaseUrl: string): SnapshotWriter {
  const database = getSnapshotDatabase(databaseUrl)!;
  return {
    async upsertProduct(product) {
      const row = await database.product.upsert({
        where: { canonicalKey: product.canonicalKey },
        create: product,
        update: {},
      });
      return row.id;
    },
    async insertSnapshots(productId, snapshots) {
      const result = await database.priceSnapshot.createMany({ data: snapshots.map((snapshot) => ({ ...snapshot, productId })), skipDuplicates: true });
      return result.count;
    },
  };
}

function decimal(value: number): string {
  if (!Number.isFinite(value) || value < 0 || value >= 1e16) throw new Error("Importe fuera de rango para snapshot");
  return value.toFixed(2);
}

export function canonicalProductKey(query: string): string | null {
  const identity = normalizeProduct(query);
  if (!identity.brand || !identity.model || identity.storageGb === undefined || !identity.condition || identity.accessory) return null;
  return `${identity.brand.toLowerCase()}|${identity.model}|${identity.storageGb}|${identity.condition}`;
}

export function buildSnapshotBatch(query: string, offers: OfferContract[]): SnapshotBatch | null {
  if (offers.length === 0) return null;
  const canonicalKey = canonicalProductKey(query);
  if (!canonicalKey) return null;
  const identity = normalizeProduct(query);
  if (!identity.brand || !identity.model) return null;
  return {
    product: { canonicalKey, name: query.trim(), brand: identity.brand, model: identity.model },
    snapshots: offers.map((offer) => ({
      offerId: offer.id,
      source: offer.source,
      price: decimal(offer.price),
      shipping: decimal(offer.shipping),
      taxes: decimal(offer.taxes),
      currency: offer.currency,
      priceConfirmation: offer.priceConfirmation,
      shippingConfirmation: offer.shippingConfirmation,
      taxConfirmation: offer.taxConfirmation,
      availability: offer.availability,
      capturedAt: new Date(offer.checkedAt),
    })),
  };
}

export async function saveOfferSnapshots(query: string, offers: OfferContract[], writer?: SnapshotWriter): Promise<number> {
  if (offers.length === 0) return 0;
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!writer && !databaseUrl) return 0;
  const batch = buildSnapshotBatch(query, offers);
  if (!batch) return 0;
  const destination = writer ?? databaseWriter(databaseUrl!);
  const productId = await destination.upsertProduct(batch.product);
  return destination.insertSnapshots(productId, batch.snapshots);
}
