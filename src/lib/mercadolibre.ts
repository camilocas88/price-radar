import type { Offer } from "./offers";
import { trustScore } from "./trust";

type MercadoLibreResult = {
  id: string;
  title: string;
  price: number;
  currency_id: string;
  permalink: string;
  condition?: "new" | "used" | string;
  shipping?: { free_shipping?: boolean };
  available_quantity?: number;
  seller?: { nickname?: string; official_store_id?: number | null };
  seller_address?: { city?: { name?: string } };
};

export type MercadoLibreSearchResponse = { results?: MercadoLibreResult[] };

export type MercadoLibreItemDetail = {
  id: string;
  shipping?: { free_shipping?: boolean; mode?: string; logistic_type?: string; store_pick_up?: boolean };
  warranty?: string | null;
};

type MercadoLibreShippingOptionsResponse = {
  options?: Array<{ cost?: number; currency_id?: string; shipping_method_id?: number; name?: string }>;
};

export type EnrichmentOptions = {
  fetchImpl?: typeof fetch;
  accessToken?: string;
  zipCode?: string;
  timeoutMs?: number;
};

export function normalizeMercadoLibreOffers(payload: MercadoLibreSearchResponse): Offer[] {
  return (payload.results ?? [])
    .filter((item) => item.currency_id === "COP" && Number.isFinite(item.price) && item.price > 0)
    .map((item) => {
      const freeShipping = item.shipping?.free_shipping === true;
      const officialStore = item.seller?.official_store_id != null;
      const score = trustScore({
        reputation: officialStore ? 78 : 62,
        protectedPayment: true,
        localWarranty: false,
        checkout: true,
        atypicalPrice: false,
        complete: Boolean(item.permalink && item.title),
        reviews: false,
      });

      return {
        id: `ml-${item.id}`,
        store: item.seller?.nickname ?? "Mercado Libre",
        classification: officialStore ? "Mejor compra verificada" : "Posible oferta",
        price: item.price,
        shipping: 0,
        taxes: 0,
        total: item.price,
        delivery: freeShipping ? "Envío gratis (sin fecha confirmada)" : "Costo y fecha por confirmar",
        warranty: "Por confirmar con el vendedor",
        updated: "consulta en tiempo real",
        kind: officialStore ? "Tienda oficial en Mercado Libre" : "Marketplace Mercado Libre",
        confirmation: [
          "Precio publicado",
          freeShipping ? "envío gratis publicado" : "envío por confirmar",
          item.available_quantity ? "disponibilidad referencial" : "disponibilidad sin confirmar",
          item.seller_address?.city?.name ? item.seller_address.city.name : null,
          item.condition === "new" ? "nuevo" : item.condition === "used" ? "usado" : null,
        ].filter(Boolean).join(" · "),
        score,
        estimated: !freeShipping,
        url: item.permalink,
      };
    });
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), timeoutMs);
    promise.then((value) => { clearTimeout(timer); resolve(value); }, (reason) => { clearTimeout(timer); reject(reason); });
  });
}

function itemIdFromOffer(offerId: string): string {
  return offerId.startsWith("ml-") ? offerId.slice(3) : offerId;
}

export async function fetchMercadoLibreItemDetail(itemId: string, options: EnrichmentOptions = {}): Promise<MercadoLibreItemDetail | null> {
  const { fetchImpl = fetch, accessToken } = options;
  const url = `https://api.mercadolibre.com/items/${encodeURIComponent(itemId)}?attributes=id,shipping,warranty`;
  const response = await fetchImpl(url, { headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined });
  if (!response.ok) return null;
  return (await response.json()) as MercadoLibreItemDetail;
}

export async function fetchMercadoLibreShippingCost(itemId: string, zipCode: string, options: EnrichmentOptions = {}): Promise<number | null> {
  const { fetchImpl = fetch, accessToken } = options;
  const url = `https://api.mercadolibre.com/items/${encodeURIComponent(itemId)}/shipping_options?zip_code=${encodeURIComponent(zipCode)}`;
  const response = await fetchImpl(url, { headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined });
  if (!response.ok) return null;
  const payload = (await response.json()) as MercadoLibreShippingOptionsResponse;
  const costs = (payload.options ?? [])
    .filter((option) => option.currency_id === "COP" && typeof option.cost === "number" && Number.isFinite(option.cost) && option.cost >= 0)
    .map((option) => option.cost as number);
  if (costs.length === 0) return null;
  return Math.min(...costs);
}

export async function enrichMercadoLibreOffers(offers: Offer[], options: EnrichmentOptions = {}): Promise<Offer[]> {
  const { timeoutMs = 1500, zipCode } = options;

  return Promise.all(offers.map(async (offer) => {
    const itemId = itemIdFromOffer(offer.id);

    const detail = await withTimeout(fetchMercadoLibreItemDetail(itemId, options), timeoutMs).catch(() => null);

    let shippingCost: number | null = null;
    if (zipCode && detail?.shipping?.free_shipping !== true) {
      shippingCost = await withTimeout(fetchMercadoLibreShippingCost(itemId, zipCode, options), timeoutMs).catch(() => null);
    }

    const confirmedFreeShipping = detail?.shipping?.free_shipping === true;
    const nextShipping = confirmedFreeShipping ? 0 : shippingCost ?? offer.shipping;
    const nextWarranty = typeof detail?.warranty === "string" && detail.warranty.trim() ? detail.warranty.trim() : offer.warranty;

    const shippingConfirmed = confirmedFreeShipping || typeof shippingCost === "number";
    const taxesConfirmed = false;

    const delivery = confirmedFreeShipping
      ? "Envío gratis confirmado por Mercado Libre"
      : typeof shippingCost === "number"
        ? `Envío desde ${new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(shippingCost)}`
        : offer.delivery;

    const confirmationParts = offer.confirmation.split(" · ").map((part) => {
      if (part === "envío por confirmar" && confirmedFreeShipping) return "envío gratis confirmado";
      if (part === "envío por confirmar" && typeof shippingCost === "number") return "envío con costo confirmado";
      if (part === "envío gratis publicado" && confirmedFreeShipping) return "envío gratis confirmado";
      return part;
    });
    if (!taxesConfirmed && !confirmationParts.includes("impuestos por confirmar")) confirmationParts.push("impuestos por confirmar");

    return {
      ...offer,
      shipping: nextShipping,
      total: offer.price + nextShipping + offer.taxes,
      delivery,
      warranty: nextWarranty,
      confirmation: confirmationParts.join(" · "),
      estimated: !(shippingConfirmed && taxesConfirmed),
    };
  }));
}
