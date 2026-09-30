import { describe, expect, it } from "vitest";
import { parseInitialQuery } from "./useOfferSearch";

describe("parseInitialQuery", () => {
  it("devuelve string vacío cuando no hay params", () => {
    expect(parseInitialQuery(null)).toBe("");
  });

  it("devuelve string vacío cuando query no existe", () => {
    expect(parseInitialQuery(new URLSearchParams(""))).toBe("");
  });

  it("trimea espacios alrededor del término", () => {
    expect(parseInitialQuery(new URLSearchParams("query=%20iphone%2017%20pro%20%20"))).toBe("iphone 17 pro");
  });

  it("respeta caracteres UTF-8 decodificados", () => {
    expect(parseInitialQuery(new URLSearchParams("query=televisor%20LG%2055"))).toBe("televisor LG 55");
  });
});
