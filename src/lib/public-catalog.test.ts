import { describe, expect, it, vi } from "vitest";
import { isRelatedProduct, searchPublicCatalog } from "./public-catalog";

const page = (name: string, price: string, extra = "") => new Response(
  `<script type="application/ld+json">{"@type":"Product","name":"${name}","offers":{"@type":"Offer","price":"${price}","priceCurrency":"COP"${extra}}}</script>`,
  { headers: { "content-type": "text/html" } },
);

describe("public catalog discovery", () => {
  it("matches generic categories, not only phones", () => {
    expect(isRelatedProduct("carpas", "Carpa familiar para 4 personas")).toBe(true);
    expect(isRelatedProduct("carpa para 4 personas", "Carpa familiar 4 personas")).toBe(true);
    expect(isRelatedProduct("carpas", "Funda impermeable para zapatos")).toBe(false);
  });

  it("requires a search key instead of inventing products", async () => {
    const fetchImpl = vi.fn();
    expect(await searchPublicCatalog("carpas", { fetchImpl })).toMatchObject({ status: "not_configured", offers: [] });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("omits Brave's unsupported country=CO while keeping Colombian search intent", async () => {
    const searched: URL[] = [];
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      searched.push(new URL(String(input)));
      return Response.json({ web: { results: [] } });
    });
    await searchPublicCatalog("carpas", { key: "test", fetchImpl });
    expect(searched).toHaveLength(3);
    for (const url of searched) {
      expect(url.searchParams.has("country")).toBe(false);
      expect(url.searchParams.get("search_lang")).toBe("es");
      expect(url.searchParams.get("q")).toContain("carpas comprar precio Colombia");
    }
  });

  it("skips category pages so they do not consume the retailer product slots", async () => {
    const inspected: string[] = [];
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.startsWith("https://api.search.brave.com/")) return Response.json({ web: { results: [
        { url: "https://www.exito.com/t/carpas" },
        { url: "https://www.exito.com/jardin-y-aire-libre/camping/carpas" },
        { url: "https://www.exito.com/carpa-familiar/p" },
        { url: "https://www.falabella.com.co/falabella-co/category/cat670983/Carpas" },
        { url: "https://www.falabella.com.co/falabella-co/product/123/Carpa-Familiar/123" },
      ] } });
      inspected.push(url);
      return page("Carpa familiar", "120000");
    });
    const result = await searchPublicCatalog("carpas", { key: "test", fetchImpl });
    expect(result.offers).toHaveLength(2);
    expect(inspected).toEqual([
      "https://www.exito.com/carpa-familiar/p",
      "https://www.falabella.com.co/falabella-co/product/123/Carpa-Familiar/123",
    ]);
  });

  it("discovers and reads prices for carpas from two stores", async () => {
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.startsWith("https://api.search.brave.com/")) return Response.json({ web: { results: [
        { url: "https://www.exito.com/carpa-familiar/p" },
        { url: "https://www.alkosto.com/carpa-camping/p" },
        { url: "https://localhost/admin" },
      ] } });
      if (url.includes("exito.com")) return page("Carpa familiar 4 personas", "199900");
      return page("Carpa camping 2 personas", "149900");
    });
    const result = await searchPublicCatalog("carpas", { key: "test", fetchImpl, now: new Date("2026-09-30T12:00:00Z") });
    expect(result.status).toBe("ok");
    expect(result.offers).toHaveLength(2);
    expect(result.offers.map((offer) => offer.store)).toEqual(["Alkosto", "Éxito"]);
    expect(result.offers.map((offer) => offer.price)).toEqual([149900, 199900]);
    expect(result.offers.every((offer) => offer.estimated && offer.shippingConfirmation === "unknown")).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(5);
  });

  it("excludes expired, non-COP and unrelated products", async () => {
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.startsWith("https://api.search.brave.com/")) return Response.json({ web: { results: [
        { url: "https://www.exito.com/carpa/p" },
        { url: "https://www.alkosto.com/zapatos/p" },
      ] } });
      if (url.includes("exito.com")) return page("Carpa familiar", "100000", ',"priceValidUntil":"2020-01-01"');
      return page("Zapatos deportivos", "150000");
    });
    expect(await searchPublicCatalog("carpas", { key: "test", fetchImpl })).toMatchObject({ offers: [], status: "no_prices", unpriced: [
      { store: "Éxito", url: "https://www.exito.com/carpa/p" },
    ] });
  });
});
