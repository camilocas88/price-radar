export type ProductCondition = "new" | "used" | "refurbished";

export type ProductIdentity = {
  brand?: string;
  model?: string;
  storage?: string;
  storageGb?: number;
  condition?: ProductCondition;
  color?: string;
  accessory: boolean;
};

function conditionSignals(text: string): Set<ProductCondition> {
  const values = new Set<ProductCondition>();
  if (/\b(?:nuevo|nueva|new|sellado|sealed)\b/.test(text)) values.add("new");
  if (/\b(?:usado|usada|used|segunda mano)\b/.test(text)) values.add("used");
  if (/\b(?:reacondicionado|reacondicionada|refurbished|renewed)\b/.test(text)) values.add("refurbished");
  return values;
}

export function normalizeProduct(text: string, declaredCondition?: string): ProductIdentity {
  const value = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[-_]/g, " ");
  const brand = /\b(?:iphone|apple)\b/.test(value) ? "Apple"
    : /\bsamsung\b/.test(value) ? "Samsung"
      : /\bmotorola\b/.test(value) ? "Motorola"
        : /\b(?:xiaomi|redmi)\b/.test(value) ? "Xiaomi"
          : undefined;
  const modelMatch = value.match(/\biphone\s*(\d{1,2})(?:\s*(pro\s*max|pro|plus|mini))?\b/);
  const model = modelMatch
    ? `iphone ${modelMatch[1]}${modelMatch[2] ? ` ${modelMatch[2].replace(/\s+/g, " ")}` : ""}`
    : undefined;
  const capacities = [...value.matchAll(/\b(\d{1,4})\s*(gb|tb)\b/g)]
    .filter((match) => !/^\s*(?:de\s+)?ram\b/.test(value.slice((match.index ?? 0) + match[0].length)))
    .map((match) => Number(match[1]) * (match[2] === "tb" ? 1024 : 1));
  const uniqueCapacities = [...new Set(capacities)];
  const storageGb = uniqueCapacities.length === 1 ? uniqueCapacities[0] : undefined;
  const conditions = conditionSignals(value);
  if (declaredCondition) {
    for (const candidate of conditionSignals(declaredCondition.toLowerCase())) conditions.add(candidate);
  }
  const condition = conditions.size === 1 ? [...conditions][0] : undefined;

  return {
    brand,
    model,
    storageGb,
    storage: storageGb === undefined ? undefined : storageGb >= 1024 && storageGb % 1024 === 0
      ? `${storageGb / 1024} TB` : `${storageGb} GB`,
    condition,
    color: ["negro", "black", "blanco", "azul", "titanio"].find((color) => value.includes(color)),
    accessory: /\b(?:funda|estuche|protector|case|cargador|charger|repuesto)\b/.test(value)
      || /\b(?:pantalla|display|screen)\s+(?:de|para)\s+iphone\b/.test(value),
  };
}
