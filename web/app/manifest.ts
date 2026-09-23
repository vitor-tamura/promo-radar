import type { MetadataRoute } from "next";

/**
 * Manifesto do aplicativo web.
 *
 * E o que faz "Adicionar a tela de inicio" instalar o radar como aplicativo no
 * celular: abre em tela cheia, sem barra de endereco, com icone proprio e na
 * mesma origem, entao o historico de precos e as preferencias guardados no
 * navegador seguem sendo os mesmos.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Promo Radar",
    short_name: "Promo Radar",
    description:
      "Radar de promocao, cupom e erro de preco nas lojas brasileiras, com historico de precos no proprio aparelho.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#F7FAF9",
    theme_color: "#F7FAF9",
    lang: "pt-BR",
    categories: ["shopping", "utilities"],
    icons: [
      { src: "/icons/icon192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }
    ]
  };
}
