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
  // Cor da barra do sistema no PWA instalado. Sao duas porque a escolha e do
  // sistema ate o app montar; dali em diante ele reescreve a meta com o tema
  // que estiver valendo, inclusive um fixado pelo usuario.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F7FAF9" },
    { media: "(prefers-color-scheme: dark)", color: "#0B1220" }
  ],
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
