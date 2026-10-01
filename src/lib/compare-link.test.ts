import { describe, expect, it, vi } from "vitest";
import { extractProductJsonLd, inspectCompareLink, validateCompareUrl } from "./compare-link";

const productHtml = `<html><script type="application/ld+json">{"@context":"https://schema.org","@type":"Product","name":"iPhone 17 Pro Max 256 GB","offers":{"@type":"Offer","price":"5899000","priceCurrency":"COP"}}</script></html>`;

describe("validateCompareUrl", () => {
  it("acepta un comercio permitido y elimina el fragmento", () => {
    expect(validateCompareUrl("https://www.alkosto.com/iphone?x=1#ficha")).toEqual({ url: "https://www.alkosto.com/iphone?x=1", store: "Alkosto" });
    expect(validateCompareUrl("https://mac-center.com/products/iphone-17").store).toBe("Mac Center");
    expect(validateCompareUrl("https://co.tiendasishop.com/products/iphone-17").store).toBe("iShop Colombia");
  });

  it.each([
    "http://www.alkosto.com/iphone", "https://evil.example/", "https://www.alkosto.com.evil.example/",
    "https://user:pass@www.alkosto.com/", "https://www.alkosto.com:8080/",
    "https://127.0.0.1/", "https://localhost/", "file:///etc/passwd", "no es una URL",
    "https://mac-center.com.evil.example/item", "https://tiendasishop.com/item",
  ])("rechaza antes del fetch: %s", (url) => {
    expect(() => validateCompareUrl(url)).toThrow();
  });
});

describe("JSON-LD Product", () => {
  it("extrae solo precio COP de un Product único", () => {
    expect(extractProductJsonLd(productHtml)).toEqual({ title: "iPhone 17 Pro Max 256 GB", price: 5899000 });
    expect(extractProductJsonLd(productHtml.replace('"COP"', '"USD"'))).toEqual({ title: "iPhone 17 Pro Max 256 GB" });
  });

  it("no interpreta HTML libre ni múltiples ofertas ambiguas", () => {
    expect(extractProductJsonLd('<div data-price="5">Producto</div>')).toEqual({});
    expect(extractProductJsonLd(productHtml.replace('"offers":{"@type":"Offer","price":"5899000","priceCurrency":"COP"}', '"offers":[{"price":"5","priceCurrency":"COP"},{"price":"6","priceCurrency":"COP"}]'))).toEqual({ title: "iPhone 17 Pro Max 256 GB" });
  });

  it("encuentra Product en @graph", () => {
    const html = '<script type="application/ld+json">{"@graph":[{"@type":"BreadcrumbList"},{"@type":"Product","name":"TV OLED"}]}</script>';
    expect(extractProductJsonLd(html)).toEqual({ title: "TV OLED" });
  });
});

describe("inspectCompareLink", () => {
  it("lee solo HTML público con fetch acotado y deja campos sin verificar", async () => {
    const fetchMock = vi.fn(async () => new Response(productHtml, { headers: { "content-type": "text/html" } }));
    const result = await inspectCompareLink("https://www.alkosto.com/iphone", fetchMock);
    expect(result).toMatchObject({ extraction: "json_ld", title: "iPhone 17 Pro Max 256 GB", price: 5899000, currency: "COP", missingFields: [] });
    expect(fetchMock).toHaveBeenCalledWith("https://www.alkosto.com/iphone", expect.objectContaining({ redirect: "manual", credentials: "omit", method: "GET" }));
  });

  it("no consulta URLs no permitidas", async () => {
    const fetchMock = vi.fn();
    await expect(inspectCompareLink("https://localhost/private", fetchMock)).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([403, 302])("degrada HTTP %i a borrador manual sin seguir redirecciones", async (status) => {
    const fetchMock = vi.fn(async () => new Response(null, { status, headers: status === 302 ? { location: "https://localhost/" } : {} }));
    expect(await inspectCompareLink("https://www.mercadolibre.com.co/item", fetchMock)).toMatchObject({ extraction: "manual", missingFields: ["title", "price"] });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("degrada contenido no HTML, HTML excesivo y error de red", async () => {
    const url = "https://www.exito.com/item";
    expect((await inspectCompareLink(url, vi.fn(async () => new Response("{}", { headers: { "content-type": "application/json" } })))).extraction).toBe("manual");
    expect((await inspectCompareLink(url, vi.fn(async () => new Response("x", { headers: { "content-type": "text/html", "content-length": "512001" } })))).extraction).toBe("manual");
    expect((await inspectCompareLink(url, vi.fn(async () => new Response("x".repeat(512001), { headers: { "content-type": "text/html" } })))).extraction).toBe("manual");
    expect((await inspectCompareLink(url, vi.fn(async () => { throw new Error("blocked"); }))).extraction).toBe("manual");
  });
});
