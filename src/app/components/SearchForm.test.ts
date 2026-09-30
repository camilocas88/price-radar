// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { SearchForm } from "./SearchForm";

describe("SearchForm", () => {
  it("pegar una URL reemplaza el texto demo sin seleccionarlo", async () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    const onQueryChange = vi.fn();
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    await act(async () => root.render(createElement(SearchForm, {
      query: "iPhone 17 Pro Max", loading: false, error: "", onQueryChange, onSubmit: () => {},
    })));
    const input = container.querySelector("input")!;
    const event = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(event, "clipboardData", { value: { getData: () => "https://www.exito.com/producto/p" } });
    await act(async () => input.dispatchEvent(event));
    expect(event.defaultPrevented).toBe(true);
    expect(onQueryChange).toHaveBeenCalledWith("https://www.exito.com/producto/p");
    await act(async () => root.unmount());
  });
});
