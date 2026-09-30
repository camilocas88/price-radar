import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const request = (body: unknown) => new NextRequest("http://localhost/api/compare-link", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

afterEach(() => vi.unstubAllGlobals());

describe("POST /api/compare-link", () => {
  it("rechaza entradas inválidas sin consultar la red", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const response = await POST(request({ url: "https://localhost/secret" }));
    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("limita el cuerpo aun sin Content-Length", async () => {
    const bytes = new TextEncoder().encode(JSON.stringify({ url: "x".repeat(5000) }));
    const stream = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(bytes); controller.close(); } });
    const response = await POST(new NextRequest("http://localhost/api/compare-link", {
      method: "POST", body: stream, duplex: "half",
    } as ConstructorParameters<typeof NextRequest>[1]));
    expect(response.status).toBe(413);
  });

  it("devuelve borrador manual cuando la fuente bloquea el enlace", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 403 })));
    const response = await POST(request({ url: "https://www.mercadolibre.com.co/item" }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ store: "Mercado Libre", extraction: "manual", missingFields: ["title", "price"] });
  });

  it("devuelve campos JSON-LD para confirmación humana, sin inventar envío", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response('<script type="application/ld+json">{"@type":"Product","name":"TV OLED","offers":{"price":2500000,"priceCurrency":"COP"}}</script>', { headers: { "content-type": "text/html" } })));
    const response = await POST(request({ url: "https://www.falabella.com.co/tv" }));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({ title: "TV OLED", price: 2500000, currency: "COP", extraction: "json_ld" });
    expect(body).not.toHaveProperty("shipping");
  });
});
