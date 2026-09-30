// @vitest-environment jsdom
import { act, createElement, useEffect, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseInitialQuery, useOfferSearch, type OfferSearchState } from "./useOfferSearch";

const navigation = vi.hoisted(() => ({
  current: "",
  listeners: new Set<() => void>(),
  pushes: [] as string[],
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: (url: string) => {
      navigation.pushes.push(url);
      navigation.current = new URL(url, "http://localhost").search.slice(1);
      for (const listener of navigation.listeners) listener();
    },
  }),
  useSearchParams: () => {
    const [, rerender] = useState(0);
    useEffect(() => {
      const listener = () => rerender((previous) => previous + 1);
      navigation.listeners.add(listener);
      return () => { navigation.listeners.delete(listener); };
    }, []);
    return new URLSearchParams(navigation.current);
  },
}));

let latest: OfferSearchState;
let root: Root;
let container: HTMLDivElement;

function Probe() {
  const state = useOfferSearch();
  useEffect(() => { latest = state; }, [state]);
  return null;
}

beforeEach(() => {
  navigation.current = "";
  navigation.listeners.clear();
  navigation.pushes.length = 0;
  container = document.createElement("div");
  root = createRoot(container);
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

afterEach(async () => {
  await act(async () => { root.unmount(); });
  vi.unstubAllGlobals();
});

async function navigate(query: string) {
  await act(async () => {
    navigation.current = `query=${encodeURIComponent(query)}`;
    for (const listener of navigation.listeners) listener();
  });
}

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

describe("useOfferSearch", () => {
  it("sincroniza campo, URL y resultados al navegar atrás y adelante", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ offers: [], needsReview: [], excludedCount: 0 }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    navigation.current = "query=iphone%2017";
    await act(async () => { root.render(createElement(Probe)); });
    expect(latest.query).toBe("iphone 17");
    expect(latest.searchedQuery).toBe("iphone 17");

    await act(async () => { latest.setQuery("iphone 18"); });
    await act(async () => { latest.submit(); });
    expect(navigation.pushes).toEqual(["/?query=iphone+18"]);
    expect(latest.query).toBe("iphone 18");
    expect(latest.searchedQuery).toBe("iphone 18");

    await navigate("iphone 17");
    expect(latest.query).toBe("iphone 17");
    expect(latest.searchedQuery).toBe("iphone 17");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("ignora una respuesta tardía de una búsqueda anterior y conserva pendientes", async () => {
    let resolveOld!: (response: Response) => void;
    const fetchMock = vi.fn((url: string) => url.includes("anterior")
      ? new Promise<Response>((resolve) => { resolveOld = resolve; })
      : Promise.resolve(new Response(JSON.stringify({ offers: [], needsReview: [{ id: "MCO1", title: "Variante", reasons: ["missing_storage"] }], excludedCount: 2 }), { status: 200 })));
    vi.stubGlobal("fetch", fetchMock);
    navigation.current = "query=anterior";
    await act(async () => { root.render(createElement(Probe)); });

    await navigate("nuevo");
    expect(latest.query).toBe("nuevo");
    expect(latest.needsReview).toHaveLength(1);
    expect(latest.excludedCount).toBe(2);

    await act(async () => { resolveOld(new Response(JSON.stringify({ offers: [], needsReview: [], excludedCount: 0 }), { status: 200 })); });
    expect(latest.searchedQuery).toBe("nuevo");
    expect(latest.needsReview).toHaveLength(1);
  });
});
