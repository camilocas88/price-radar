import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ResultsSection } from "./ResultsSection";

vi.mock("./OfferCard", () => ({ OfferCard: () => null }));

const props = {
  status: "success" as const,
  searchedQuery: "iPhone 17 Pro Max",
  offers: [],
  needsReview: [],
  excludedCount: 0,
  onlyVerified: false,
  watching: false,
  onToggleVerified: () => {},
  onToggleWatching: () => {},
};

describe("ResultsSection", () => {
  it("explica resultados ambiguos sin llamarlos ausencia de ofertas", () => {
    const html = renderToStaticMarkup(createElement(ResultsSection, {
      ...props,
      needsReview: [{ id: "MCO1", title: "iPhone 17 Pro Max 256 GB", reasons: ["missing_condition"] }],
    }));
    expect(html).toContain("requieren verificar la variante");
    expect(html).toContain("iPhone 17 Pro Max 256 GB");
    expect(html).not.toContain("No encontramos ofertas");
    expect(html).toContain("disabled");
  });

  it("distingue variantes excluidas de una búsqueda realmente vacía", () => {
    const excluded = renderToStaticMarkup(createElement(ResultsSection, { ...props, excludedCount: 2 }));
    expect(excluded).toContain("variantes distintas");
    const empty = renderToStaticMarkup(createElement(ResultsSection, props));
    expect(empty).toContain("No encontramos ofertas comparables");
  });
});
