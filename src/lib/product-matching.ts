import { normalizeProduct, type ProductIdentity } from "./normalize";

export type MatchReason =
  | "accessory"
  | "brand_mismatch"
  | "model_mismatch"
  | "storage_mismatch"
  | "condition_mismatch"
  | "missing_brand"
  | "missing_model"
  | "missing_storage"
  | "missing_condition";

export type ProductMatch = { status: "match" | "mismatch" | "review"; reasons: MatchReason[] };

export function compareProducts(requested: ProductIdentity, found: ProductIdentity): ProductMatch {
  if (requested.accessory) return { status: "review", reasons: ["accessory"] };
  const mismatches: MatchReason[] = [];
  if (found.accessory) mismatches.push("accessory");
  if (requested.brand && found.brand && requested.brand !== found.brand) mismatches.push("brand_mismatch");
  if (requested.model && found.model && requested.model !== found.model) mismatches.push("model_mismatch");
  if (requested.storageGb !== undefined && found.storageGb !== undefined && requested.storageGb !== found.storageGb) mismatches.push("storage_mismatch");
  if (requested.condition && found.condition && requested.condition !== found.condition) mismatches.push("condition_mismatch");
  if (mismatches.length) return { status: "mismatch", reasons: mismatches };

  const missing: MatchReason[] = [];
  if (!requested.brand || !found.brand) missing.push("missing_brand");
  if (!requested.model || !found.model) missing.push("missing_model");
  if (requested.storageGb === undefined || found.storageGb === undefined) missing.push("missing_storage");
  if (!requested.condition || !found.condition) missing.push("missing_condition");
  return missing.length ? { status: "review", reasons: missing } : { status: "match", reasons: [] };
}

type SearchItem = { id: string; title: string; condition?: string };

export function classifySearchResults<T extends SearchItem>(query: string, results: T[]) {
  const requested = normalizeProduct(query);
  const matches: T[] = [];
  const needsReview: Array<{ id: string; title: string; reasons: MatchReason[] }> = [];
  let excludedCount = 0;

  for (const result of results) {
    const match = compareProducts(requested, normalizeProduct(result.title, result.condition));
    if (match.status === "match") matches.push(result);
    else if (match.status === "review") needsReview.push({ id: result.id, title: result.title, reasons: match.reasons });
    else excludedCount += 1;
  }

  return { matches, needsReview, excludedCount };
}
