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
    const urlInput = container.querySelector('input[type="url"]') as HTMLInputElement;
    for (const [url, title, price] of [
      ["https://www.mercadolibre.com.co/uno", "iPhone 256 GB", "2000000"],
      ["https://www.mercadolibre.com.co/dos", "iPhone 256 GB", "1500000"],
    ]) {
      await change(urlInput, url);
      await submit(container.querySelector("form")!);
      const form = container.querySelectorAll("form")[1];
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
    expect(cards[1].textContent).toContain("2.000.000");
    expect(container.textContent).toContain("no es precio final");
  });

  it("ignora una respuesta tardía si el usuario ya cambió el enlace", async () => {
    let resolve!: (response: Response) => void;
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>((done) => { resolve = done; })));
    const urlInput = container.querySelector('input[type="url"]') as HTMLInputElement;
    await change(urlInput, "https://www.alkosto.com/uno");
    await submit(container.querySelector("form")!);
    await change(urlInput, "https://www.alkosto.com/dos");
    await act(async () => resolve(new Response(JSON.stringify({ url: "https://www.alkosto.com/uno", store: "Alkosto", extraction: "manual", missingFields: ["title", "price"] }))));
    expect(container.querySelectorAll("form")).toHaveLength(1);
    expect(urlInput.value).toBe("https://www.alkosto.com/dos");
  });
});
