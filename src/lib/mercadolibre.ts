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
