export type OfferClassification =
  | "Mejor compra verificada"
  | "Importación"
  | "Posible oferta"
  | "Precio sospechosamente bajo";

export type Offer = {
  id: string;
  store: string;
  classification: OfferClassification;
  price: number;
  shipping: number;
  taxes: number;
  total: number;
  delivery: string;
  warranty: string;
  updated: string;
  kind: string;
  confirmation: string;
  score: number;
  estimated: boolean;
  url?: string;
};

export type OfferConfirmation = "confirmed" | "estimated" | "unknown";
export type OfferAvailability = "available" | "unavailable" | "unknown";

// Los datos demo siguen usando Offer; todo conector real entrega este contrato.
export type OfferContract = Offer & {
  source: string;
  currency: string;
  availability: OfferAvailability;
  priceConfirmation: OfferConfirmation;
  shippingConfirmation: OfferConfirmation;
  taxConfirmation: OfferConfirmation;
  checkedAt: string;
};
