import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Promo Radar",
  description:
    "Radar de promocao, cupom e erro de preco nas lojas brasileiras: Amazon, KaBuM, Mercado Livre, Magalu, Casas Bahia e mais.",
  manifest: "/manifest.webmanifest",
  applicationName: "Promo Radar",
  appleWebApp: {
    // Sem isso o iPhone abre o atalho dentro do Safari, com barra de endereco.
    capable: true,
    title: "Promo Radar",
    statusBarStyle: "default"
  },
  icons: {
    icon: "/icons/icon192.png",
    apple: "/icons/icon192.png"
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // A tela tem listas longas e campos de texto: o zoom do navegador atrapalha
  // mais do que ajuda, mas bloquea-lo de vez prejudicaria quem precisa dele.
  maximumScale: 5,
  themeColor: "#F7FAF9",
  // O app desenha ate a borda; o recuo das areas seguras vem do proprio layout.
  viewportFit: "cover"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
