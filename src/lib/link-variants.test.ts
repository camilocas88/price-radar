import { describe, expect, it } from "vitest";
import { compareLinkVariants } from "./link-variants";

describe("compareLinkVariants", () => {
  const reference = "iPhone 17 Pro Max 256 GB nuevo";

  it("acepta la misma variante aunque cambie el color", () => {
    expect(compareLinkVariants(reference, "iPhone 17 Pro Max 256GB nuevo azul")).toEqual({ status: "match", reasons: [] });
  });

  it("rechaza modelo, capacidad, condición y accesorios diferentes", () => {
    expect(compareLinkVariants(reference, "iPhone 17 Pro 256 GB nuevo").status).toBe("mismatch");
    expect(compareLinkVariants(reference, "iPhone 17 Pro Max 512 GB nuevo").status).toBe("mismatch");
    expect(compareLinkVariants(reference, "iPhone 17 Pro Max 256 GB usado").status).toBe("mismatch");
    expect(compareLinkVariants(reference, "Funda iPhone 17 Pro Max 256 GB nuevo").status).toBe("mismatch");
  });

  it("mantiene en revisión títulos sin condición o variante completa", () => {
    expect(compareLinkVariants(reference, "iPhone 17 Pro Max 256 GB").status).toBe("review");
    expect(compareLinkVariants("iPhone 17 Pro Max", reference).status).toBe("review");
  });
});
