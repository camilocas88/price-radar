import { ExternalLink, ShieldCheck } from "lucide-react";
import type { Offer } from "@/lib/offers";
import { formatCop } from "@/lib/demo-data";

type OfferCardProps = {
  offer: Offer;
  highlighted: boolean;
};

export function OfferCard({ offer, highlighted }: OfferCardProps) {
  return (
    <article className={`rounded-2xl border bg-white p-5 ${highlighted ? "border-[#86c69b] ring-1 ring-[#d6f0dc]" : "border-[#dbe6de]"}`}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-4">
          <div className="grid size-12 shrink-0 place-items-center rounded-xl bg-[#edf8f0] font-semibold text-[#197243]">
            {offer.store.slice(0, 1)}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-semibold">{offer.store}</h3>
              <span className="rounded-full bg-[#eef1f5] px-2 py-0.5 text-xs font-medium text-[#52606f]">{offer.classification}</span>
            </div>
            <p className="mt-1 text-sm text-[#587065]">{offer.delivery} · {offer.warranty} · {offer.updated}</p>
            <p className="mt-2 text-xs text-[#6b8175]">{offer.kind} · {offer.confirmation}</p>
          </div>
        </div>
        <div className="sm:text-right">
          <p className="text-xl font-semibold">{formatCop(offer.total)}</p>
          <p className="mt-1 text-xs text-[#62786c]">
            Precio publicado {offer.estimated ? "con datos pendientes" : "con envío confirmado"}
          </p>
          <div className="mt-3 flex items-center gap-2 sm:justify-end">
            <span className="inline-flex gap-1 text-xs font-semibold text-[#197243]">
              <ShieldCheck size={14} />
              {offer.score}/100
            </span>
            <a
              className="inline-flex gap-1 rounded-lg bg-[#14532d] px-3 py-2 text-xs font-semibold text-white"
              href={offer.url ?? "#inicio"}
              target={offer.url ? "_blank" : undefined}
              rel={offer.url ? "noreferrer" : undefined}
            >
              Ver oferta <ExternalLink size={13} />
            </a>
          </div>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 border-t border-[#e7eee9] pt-3 text-xs text-[#60766a] sm:grid-cols-4">
        <span>Producto: {formatCop(offer.price)}</span>
        <span>Envío: {formatCop(offer.shipping)}</span>
        <span>Impuestos: {formatCop(offer.taxes)}</span>
        <span>{offer.estimated ? "Incluye datos por confirmar" : "Datos confirmados"}</span>
      </div>
    </article>
  );
}
