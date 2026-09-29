import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Radar Precio | Compara con confianza",
  description: "Radar de compras para Colombia.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es-CO" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
