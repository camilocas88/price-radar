import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL no configurado");

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
class RollbackSmoke extends Error {}

try {
  try {
    await prisma.$transaction(async (tx) => {
      const product = await tx.product.create({ data: { canonicalKey: `smoke-${crypto.randomUUID()}`, name: "DB smoke (rollback)" } });
      const base = {
        productId: product.id, offerId: "smoke", source: "smoke", price: "1.00", shipping: "0.00", taxes: "0.00", currency: "COP",
        priceConfirmation: "confirmed", shippingConfirmation: "unknown", taxConfirmation: "unknown", availability: "unknown",
      };
      const capturedAt = new Date("2026-09-30T00:00:00.000Z");
      await tx.priceSnapshot.createMany({ data: [{ ...base, capturedAt }], skipDuplicates: true });
      await tx.priceSnapshot.createMany({ data: [{ ...base, capturedAt }], skipDuplicates: true });
      await tx.priceSnapshot.createMany({ data: [{ ...base, price: "2.00", capturedAt: new Date("2026-10-01T00:00:00.000Z") }], skipDuplicates: true });
      const read = await tx.priceSnapshot.findMany({ where: { productId: product.id }, orderBy: { capturedAt: "asc" } });
      if (read.length !== 2 || read[0].price.toString() !== "1" || read[1].price.toString() !== "2") {
        throw new Error("La deduplicación o el historial no coincidieron");
      }
      throw new RollbackSmoke();
    });
  } catch (error) {
    if (!(error instanceof RollbackSmoke)) throw error;
  }
  process.stdout.write("DB smoke OK: reintento deduplicado, captura posterior conservada y transacción revertida\n");
} finally {
  await prisma.$disconnect();
}
