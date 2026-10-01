import { normalizeProduct } from "./normalize";
import { compareProducts, type ProductMatch } from "./product-matching";

export function compareLinkVariants(referenceTitle: string, candidateTitle: string): ProductMatch {
  return compareProducts(normalizeProduct(referenceTitle), normalizeProduct(candidateTitle));
}
