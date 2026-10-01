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
    expect(empty).toContain("No encontramos productos con precio verificado");
  });

  it("muestra páginas descubiertas sin presentarlas como ofertas con precio", () => {
    const html = renderToStaticMarkup(createElement(ResultsSection, {
      ...props,
      sources: [{ source: "web", status: "no_prices", detail: "Sin precio" }],
      unpriced: [{ store: "Éxito", url: "https://www.exito.com/carpa/p" }],
    }));
    expect(html).toContain("Páginas encontradas sin precio verificado");
    expect(html).toContain("https://www.exito.com/carpa/p");
    expect(html).toContain("no se pudo verificar un precio vigente");
  });
});
