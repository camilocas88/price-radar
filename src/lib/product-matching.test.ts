import { describe, expect, it } from "vitest";
import { normalizeProduct } from "./normalize";
import { classifySearchResults, compareProducts } from "./product-matching";

const requested = normalizeProduct("iPhone 17 Pro Max 256 GB nuevo");

describe("identidad comparable", () => {
  it("equipara nombres y unidades equivalentes", () => {
    expect(compareProducts(requested, normalizeProduct("Apple iPhone17 Pro Max 256GB Negro", "new"))).toEqual({ status: "match", reasons: [] });
    expect(compareProducts(normalizeProduct("iPhone 17 Pro Max 1 TB usado"), normalizeProduct("iPhone 17 Pro Max 1024 GB", "used"))).toEqual({ status: "match", reasons: [] });
  });

  it("no confunde Pro, Pro Max ni capacidades distintas", () => {
    expect(compareProducts(requested, normalizeProduct("iPhone 17 Pro 256 GB", "new"))).toMatchObject({ status: "mismatch", reasons: ["model_mismatch"] });
    expect(compareProducts(requested, normalizeProduct("iPhone 17 Pro Max 128 GB", "new"))).toMatchObject({ status: "mismatch", reasons: ["storage_mismatch"] });
    expect(compareProducts(requested, normalizeProduct("iPhone 17 Pro-Max 256 GB", "new"))).toEqual({ status: "match", reasons: [] });
  });

  it("distingue nuevo, usado y reacondicionado", () => {
    expect(compareProducts(requested, normalizeProduct("iPhone 17 Pro Max 256 GB", "used"))).toMatchObject({ status: "mismatch", reasons: ["condition_mismatch"] });
    expect(compareProducts(requested, normalizeProduct("iPhone 17 Pro Max 256 GB reacondicionado"))).toMatchObject({ status: "mismatch", reasons: ["condition_mismatch"] });
    expect(compareProducts(requested, normalizeProduct("iPhone 17 Pro Max 256 GB nuevo", "used"))).toMatchObject({ status: "review", reasons: ["missing_condition"] });
    expect(compareProducts(requested, normalizeProduct("iPhone 17 Pro Max 256 GB usado reacondicionado", "new"))).toMatchObject({ status: "review", reasons: ["missing_condition"] });
  });

  it("deja datos ausentes para revisión y aparta accesorios", () => {
    expect(compareProducts(requested, normalizeProduct("iPhone 17 Pro Max", "new"))).toMatchObject({ status: "review", reasons: ["missing_storage"] });
    expect(compareProducts(normalizeProduct("iPhone 17 Pro Max 256 GB"), normalizeProduct("iPhone 17 Pro Max 256 GB", "new"))).toMatchObject({ status: "review", reasons: ["missing_condition"] });
    expect(compareProducts(requested, normalizeProduct("Funda para iPhone 17 Pro Max 256 GB", "new"))).toMatchObject({ status: "mismatch", reasons: ["accessory"] });
    expect(compareProducts(requested, normalizeProduct("iPhone 17 Pro Max 256 GB pantalla OLED", "new"))).toEqual({ status: "match", reasons: [] });
    expect(compareProducts(requested, normalizeProduct("Pantalla para iPhone 17 Pro Max 256 GB", "new"))).toMatchObject({ status: "mismatch", reasons: ["accessory"] });
    expect(compareProducts(normalizeProduct("Funda iPhone 17 Pro Max 256 GB nuevo"), normalizeProduct("iPhone 17 Pro Max 256 GB", "new"))).toMatchObject({ status: "review", reasons: ["accessory"] });
  });

  it("separa resultados comparables, incompatibles y pendientes", () => {
    const results = [
      { id: "1", title: "iPhone 17 Pro Max 256GB", condition: "new" },
      { id: "2", title: "iPhone 17 Pro Max 128GB", condition: "new" },
      { id: "3", title: "iPhone 17 Pro Max", condition: "new" },
    ];
    const groups = classifySearchResults("iPhone 17 Pro Max 256 GB nuevo", results);
    expect(groups.matches.map((item) => item.id)).toEqual(["1"]);
    expect(groups.needsReview).toMatchObject([{ id: "3", reasons: ["missing_storage"] }]);
    expect(groups.excludedCount).toBe(1);
  });
});
