import { describe, expect, it, vi } from "vitest";
import { checkMercadoLibreHealth, runSourceHealthChecks } from "./source-health";

const clock = () => new Date("2026-09-30T00:00:00.000Z");

function fakeNow(sequence: number[]): () => number {
  let index = 0;
  return () => sequence[Math.min(index++, sequence.length - 1)];
}

describe("checkMercadoLibreHealth", () => {
  it("clasifica como ok cuando la respuesta es rápida y 2xx", async () => {
    const fetchImpl = vi.fn(async () => new Response("{}", { status: 200 })) as unknown as typeof fetch;
    const result = await checkMercadoLibreHealth({ fetchImpl, now: fakeNow([0, 200]), clock });
    expect(result).toEqual({ source: "mercadolibre", status: "ok", latencyMs: 200, checkedAt: "2026-09-30T00:00:00.000Z" });
  });

  it("clasifica como degraded cuando la latencia queda entre 1500 y 3000 ms", async () => {
    const fetchImpl = vi.fn(async () => new Response("{}", { status: 200 })) as unknown as typeof fetch;
    const result = await checkMercadoLibreHealth({ fetchImpl, now: fakeNow([0, 2200]), clock });
    expect(result.status).toBe("degraded");
    expect(result.latencyMs).toBe(2200);
  });

  it("clasifica como degraded cuando la respuesta no es 2xx", async () => {
    const fetchImpl = vi.fn(async () => new Response("boom", { status: 503 })) as unknown as typeof fetch;
    const result = await checkMercadoLibreHealth({ fetchImpl, now: fakeNow([0, 400]), clock });
    expect(result.status).toBe("degraded");
    expect(result.message).toBe("HTTP 503");
  });

  it("clasifica como down cuando fetch lanza", async () => {
    const fetchImpl = vi.fn(async () => { throw new Error("network"); }) as unknown as typeof fetch;
    const result = await checkMercadoLibreHealth({ fetchImpl, now: fakeNow([0, 10]), clock });
    expect(result.status).toBe("down");
    expect(result.message).toBe("network");
  });

  it("clasifica como down cuando la llamada excede el timeout", async () => {
    const fetchImpl = vi.fn(() => new Promise<Response>(() => {})) as unknown as typeof fetch;
    const result = await checkMercadoLibreHealth({ fetchImpl, timeoutMs: 5, now: fakeNow([0, 10]), clock });
    expect(result.status).toBe("down");
    expect(result.message).toMatch(/timeout/);
  });
});

describe("runSourceHealthChecks", () => {
  it("devuelve un arreglo con un entry por conector configurado", async () => {
    const fetchImpl = vi.fn(async () => new Response("{}", { status: 200 })) as unknown as typeof fetch;
    const results = await runSourceHealthChecks({ fetchImpl, now: fakeNow([0, 100]), clock });
    expect(results).toHaveLength(1);
    expect(results[0].source).toBe("mercadolibre");
    expect(results[0].status).toBe("ok");
  });
});
