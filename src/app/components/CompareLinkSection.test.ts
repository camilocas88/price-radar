// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CompareLinkSection } from "./CompareLinkSection";

let root: Root;
let container: HTMLDivElement;

beforeEach(async () => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  await act(async () => root.render(createElement(CompareLinkSection)));
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

async function change(input: HTMLInputElement, value: string) {
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

async function changeTextarea(input: HTMLTextAreaElement, value: string) {
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!;
    setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

async function submit(form: HTMLFormElement) {
  await act(async () => form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
}

describe("CompareLinkSection", () => {
  it("compara dos enlaces manuales ordenados, sin llamarlos verificados", async () => {
    const fetchMock = vi.fn(async (_: string, options: RequestInit) => {
      const { url } = JSON.parse(String(options.body)) as { url: string };
      return new Response(JSON.stringify({ url, store: "Mercado Libre", extraction: "manual", missingFields: ["title", "price"], notice: "Completa los datos." }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
    await change(container.querySelector('input[placeholder="iPhone 17 Pro Max 256 GB nuevo"]') as HTMLInputElement, "iPhone 17 Pro Max 256 GB nuevo");
    const urlInput = container.querySelector('input[type="url"]') as HTMLInputElement;
    for (const [url, title, price] of [
      ["https://www.mercadolibre.com.co/uno", "iPhone 17 Pro Max 256 GB nuevo", "2000000"],
      ["https://www.mercadolibre.com.co/dos", "iPhone 17 Pro Max 256 GB nuevo", "1500000"],
    ]) {
      await change(urlInput, url);
      await submit(container.querySelector("form")!);
      const form = container.querySelectorAll("form")[2];
      expect(form).toBeTruthy();
      const inputs = form.querySelectorAll("input");
      await change(inputs[0], title);
      await change(inputs[1], price);
      await submit(form);
    }
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(container.textContent).toContain("Enlaces aportados (2)");
    expect(container.textContent).toContain("APORTE NO VERIFICADO");
    const cards = container.querySelectorAll("ol li");
    expect(cards).toHaveLength(2);
    expect(cards[0].textContent).toContain("1.500.000");
    expect(cards[0].textContent).toContain("MENOR PRECIO ENTRE TUS ENLACES");
    expect(cards[1].textContent).toContain("2.000.000");
    expect(cards[1].textContent).toContain("500.000");
    expect(container.textContent).toContain("ni un precio final");
    expect(container.textContent).toContain("no es el mejor precio del mercado");
  });

  it("revisa automáticamente un enlace recibido desde el buscador principal", async () => {
    const url = "https://www.exito.com/iphone-18-pro-max-5gb-256gb-12gb-ram-negro-105210111-mp/p";
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ url, store: "Éxito", extraction: "manual", missingFields: ["title", "price"], notice: "Completa los datos." }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await act(async () => root.render(createElement(CompareLinkSection, { linkRequest: { url, id: 1 } })));
    expect(fetchMock).toHaveBeenCalledWith("/api/compare-link", expect.objectContaining({ body: JSON.stringify({ url }) }));
    expect((container.querySelector('input[type="url"]') as HTMLInputElement).value).toBe(url);
    expect(container.textContent).toContain("Confirma el anuncio de Éxito");
  });

  it("ignora una respuesta tardía si el usuario ya cambió el enlace", async () => {
    let resolve!: (response: Response) => void;
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>((done) => { resolve = done; })));
    const urlInput = container.querySelector('input[type="url"]') as HTMLInputElement;
    await change(urlInput, "https://www.alkosto.com/uno");
    await submit(container.querySelector("form")!);
    await change(urlInput, "https://www.alkosto.com/dos");
    await act(async () => resolve(new Response(JSON.stringify({ url: "https://www.alkosto.com/uno", store: "Alkosto", extraction: "manual", missingFields: ["title", "price"] }))));
    expect(container.querySelectorAll("form")).toHaveLength(2);
    expect(urlInput.value).toBe("https://www.alkosto.com/dos");
  });

  it("revisa un lote de dos tiendas y excluye una variante distinta del menor", async () => {
    const first = "https://mac-center.com/products/iphone-17";
    const second = "https://co.tiendasishop.com/products/iphone-16";
    vi.stubGlobal("fetch", vi.fn(async (_: string, options: RequestInit) => {
      const { url } = JSON.parse(String(options.body)) as { url: string };
      return new Response(JSON.stringify({ url, store: url === first ? "Mac Center" : "iShop Colombia", extraction: "json_ld", missingFields: [],
        title: url === first ? "iPhone 17 Pro Max 256 GB nuevo" : "iPhone 16 Pro Max 256 GB nuevo", price: url === first ? 6000000 : 4000000,
      }), { status: 200 });
    }));
    await change(container.querySelector('input[placeholder="iPhone 17 Pro Max 256 GB nuevo"]') as HTMLInputElement, "iPhone 17 Pro Max 256 GB nuevo");
    await changeTextarea(container.querySelector("textarea")!, `${first}\n${second}`);
    await submit(container.querySelectorAll("form")[1]);
    expect(container.textContent).toContain("Confirma el anuncio de Mac Center");
    await submit(container.querySelectorAll("form")[2]);
    expect(container.textContent).toContain("Confirma el anuncio de iShop Colombia");
    await submit(container.querySelectorAll("form")[2]);
    expect(container.textContent).toContain("Enlaces aportados (2)");
    expect(container.textContent).toContain("1 comparables y 1 por revisar");
    expect(container.textContent).toContain("VARIANTE DISTINTA");
    expect(container.textContent).not.toContain("MENOR PRECIO ENTRE TUS ENLACES");
    expect(container.textContent).toContain("JSON-LD público detectado; datos confirmados por ti");
    expect(container.textContent).not.toContain("Precio leído de JSON-LD");
  });

  it("continúa el lote si una tienda falla y limita la cantidad de enlaces", async () => {
    const first = "https://mac-center.com/products/iphone-17";
    const second = "https://co.tiendasishop.com/products/iphone-17";
    const fetchMock = vi.fn(async (_: string, options: RequestInit) => {
      const { url } = JSON.parse(String(options.body)) as { url: string };
      return url === first
        ? new Response(JSON.stringify({ error: "Enlace no disponible" }), { status: 400 })
        : new Response(JSON.stringify({ url, store: "iShop Colombia", extraction: "manual", missingFields: ["title", "price"] }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const textarea = container.querySelector("textarea")!;
    await changeTextarea(textarea, first);
    await submit(container.querySelectorAll("form")[1]);
    expect(container.textContent).toContain("entre 2 y 6 enlaces");
    expect(fetchMock).not.toHaveBeenCalled();
    await changeTextarea(textarea, `${first}\n${second}`);
    await submit(container.querySelectorAll("form")[1]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(container.textContent).toContain("Enlace no disponible");
    expect(container.textContent).toContain("Confirma el anuncio de iShop Colombia");
  });

  it("rechaza URLs equivalentes por fragmento antes de consultar", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await changeTextarea(container.querySelector("textarea")!, "https://mac-center.com/products/iphone#uno\nhttps://mac-center.com/products/iphone#dos");
    await submit(container.querySelectorAll("form")[1]);
    expect(container.textContent).toContain("entre 2 y 6 enlaces distintos");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("muestra progreso durante el lote, antes de terminar todas las consultas", async () => {
    let resolveSecond!: (response: Response) => void;
    let calls = 0;
    vi.stubGlobal("fetch", vi.fn(async (_: string, options: RequestInit) => {
      calls += 1;
      const { url } = JSON.parse(String(options.body)) as { url: string };
      if (calls === 2) return new Promise<Response>((resolve) => { resolveSecond = resolve; });
      return new Response(JSON.stringify({ url, store: "Mac Center", extraction: "manual", missingFields: ["title", "price"] }), { status: 200 });
    }));
    await changeTextarea(container.querySelector("textarea")!, "https://mac-center.com/products/uno\nhttps://co.tiendasishop.com/products/dos");
    await submit(container.querySelectorAll("form")[1]);
    expect(container.querySelector('[role="status"]')?.textContent).toContain("Revisados 1/2");
    await act(async () => resolveSecond(new Response(JSON.stringify({ url: "https://co.tiendasishop.com/products/dos", store: "iShop Colombia", extraction: "manual", missingFields: ["title", "price"] }), { status: 200 })));
    expect(container.querySelector('[role="status"]')?.textContent).toContain("Revisados 2/2");
  });
});
