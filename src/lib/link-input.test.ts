import { describe, expect, it } from "vitest";
import { normalizeLinkInput } from "./link-input";

describe("normalizeLinkInput", () => {
  it("detecta la URL de Éxito aportada por el usuario", () => {
    expect(normalizeLinkInput(" https://www.exito.com/iphone-18-pro-max-5gb-256gb-12gb-ram-negro-105210111-mp/p ")).toBe("https://www.exito.com/iphone-18-pro-max-5gb-256gb-12gb-ram-negro-105210111-mp/p");
  });
  it("completa www con HTTPS y deja que el endpoint rechace esquemas no admitidos", () => {
    expect(normalizeLinkInput("www.exito.com/producto")).toBe("https://www.exito.com/producto");
    expect(normalizeLinkInput("http://www.exito.com/producto")).toBe("http://www.exito.com/producto");
    expect(normalizeLinkInput("ftp://www.exito.com/producto")).toBe("ftp://www.exito.com/producto");
  });
  it("mantiene las consultas de texto en la búsqueda", () => {
    expect(normalizeLinkInput("iPhone 18 Pro Max 256 GB")).toBeNull();
  });
});
