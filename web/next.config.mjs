import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..");

/**
 * O app web e o mesmo codigo do aplicativo, servido pelo Next.
 *
 * Nada aqui e reescrita da interface: App.tsx e src/ ficam na raiz do projeto e
 * sao importados de fora do diretorio do Next (externalDir). Os componentes vem
 * do react-native, e o alias os resolve para o react-native-web, que os desenha
 * como elementos do DOM. Os modulos do Expo que dependem de runtime nativo
 * entram por recortes, do mesmo jeito que na extensao.
 *
 * @type {import("next").NextConfig}
 */
const nextConfig = {
  reactStrictMode: true,
  // Com o app fora de web/, o rastreio de arquivos da Vercel precisa da raiz real.
  outputFileTracingRoot: repoRoot,
  experimental: {
    // Libera importar App.tsx e src/ de fora de web/.
    externalDir: true
  },
  transpilePackages: ["react-native-web", "@react-native-async-storage/async-storage"],
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "react-native$": "react-native-web",
      "react-native/Libraries/Image/AssetRegistry$": "react-native-web/dist/modules/AssetRegistry",
      // Modulos nativos do Expo que o app importa mas nao usa no navegador.
      "expo-status-bar$": resolve(here, "shims/expo-status-bar.tsx"),
      "expo-notifications$": resolve(here, "shims/expo-notifications.ts"),
      "expo-web-browser$": resolve(here, "shims/expo-web-browser.ts")
    };

    // O react-native-web publica .web.js para alguns modulos internos.
    config.resolve.extensions = [
      ".web.tsx",
      ".web.ts",
      ".web.jsx",
      ".web.js",
      ...config.resolve.extensions
    ];

    return config;
  }
};

export default nextConfig;
