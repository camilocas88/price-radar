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
  insertSnapshots: (productId: string, snapshots: SnapshotInput[]) => Promise<void>;
};

let prisma: PrismaClient | null = null;

function databaseWriter(databaseUrl: string): SnapshotWriter {
  if (!prisma) {
    const adapter = new PrismaPg({ connectionString: databaseUrl, connectionTimeoutMillis: 2000 });
    prisma = new PrismaClient({ adapter });
  }
  return {
    async upsertProduct(product) {
      const row = await prisma!.product.upsert({
        where: { canonicalKey: product.canonicalKey },
        create: product,
        update: {},
      });
      return row.id;
    },
    async insertSnapshots(productId, snapshots) {
      await prisma!.priceSnapshot.createMany({ data: snapshots.map((snapshot) => ({ ...snapshot, productId })) });
    },
  };
}

function decimal(value: number): string {
  if (!Number.isFinite(value) || value < 0 || value >= 1e16) throw new Error("Importe fuera de rango para snapshot");
  return value.toFixed(2);
}

export function buildSnapshotBatch(query: string, offers: OfferContract[]): SnapshotBatch | null {
  if (offers.length === 0) return null;
  const identity = normalizeProduct(query);
  if (!identity.brand || !identity.model || identity.storageGb === undefined || !identity.condition || identity.accessory) return null;
  const canonicalKey = `${identity.brand.toLowerCase()}|${identity.model}|${identity.storageGb}|${identity.condition}`;
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
  await destination.insertSnapshots(productId, batch.snapshots);
  return batch.snapshots.length;
}
