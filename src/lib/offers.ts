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
