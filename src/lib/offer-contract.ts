import { z } from "zod";
import type { OfferContract } from "./offers";

const currencies = new Set(Intl.supportedValuesOf("currency"));
const confirmation = z.enum(["confirmed", "estimated", "unknown"]);

export const offerContractSchema: z.ZodType<OfferContract> = z.object({
  id: z.string().min(1),
  store: z.string().min(1),
  classification: z.enum(["Mejor compra verificada", "Importación", "Posible oferta", "Precio sospechosamente bajo"]),
  price: z.number().finite().nonnegative(),
  shipping: z.number().finite().nonnegative(),
  taxes: z.number().finite().nonnegative(),
  total: z.number().finite().nonnegative(),
  delivery: z.string().min(1),
  warranty: z.string().min(1),
  updated: z.string().min(1),
  kind: z.string().min(1),
  confirmation: z.string(),
  score: z.number().finite().min(0).max(100),
  estimated: z.boolean(),
  url: z.url().optional(),
  source: z.string().regex(/^[a-z][a-z0-9_]*$/),
  currency: z.string().regex(/^[A-Z]{3}$/).refine((currency) => currencies.has(currency), "Moneda ISO 4217 no soportada"),
  availability: z.enum(["available", "unavailable", "unknown"]),
  priceConfirmation: confirmation,
  shippingConfirmation: confirmation,
  taxConfirmation: confirmation,
  checkedAt: z.iso.datetime({ offset: true }),
}).superRefine((offer, context) => {
  if (Math.abs(offer.total - (offer.price + offer.shipping + offer.taxes)) > 0.01) {
    context.addIssue({ code: "custom", path: ["total"], message: "El total no coincide con los importes en la moneda declarada" });
  }
});

export function parseOfferContract(candidate: unknown): OfferContract {
  return offerContractSchema.parse(candidate);
}
