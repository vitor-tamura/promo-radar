"use client";

import { useEffect, useState } from "react";
import App from "../../App";
import { configureServerProxy } from "../../src/services/httpClient";

/** Rota da propria origem que repete a busca do lado do servidor. */
const SERVER_PROXY_PATH = "/api/fetch";

/**
 * O app so monta no navegador.
 *
 * O react-native-web mede elementos e le o tamanho da janela ja no primeiro
 * render; renderizar isso no servidor devolveria uma marcacao que nao bate com a
 * do cliente. Renderizar depois de montar custa um quadro e evita a divergencia
 * inteira.
 */
export function PromoRadarApp() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Antes do primeiro render do app: e o que tira as buscas de dentro do
    // navegador e as coloca na funcao do servidor, sem restricao de origem.
    configureServerProxy(SERVER_PROXY_PATH);
    setMounted(true);
  }, []);

  /**
   * O service worker guarda o casco do app. Sem ele o atalho na tela de inicio
   * abriria uma pagina em branco toda vez que o celular ficasse sem sinal.
   *
   * So em producao, e isso nao e preferencia: o cache serve os arquivos de
   * /_next/static/ direto, o que e seguro porque o build poe um hash no nome de
   * cada um. Em desenvolvimento o Next serve "page.js" sem hash, entao a mesma
   * regra congelaria a primeira versao carregada e nenhuma alteracao apareceria
   * mais no navegador.
   */
  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    if (process.env.NODE_ENV !== "production") {
      // Quem ja rodou uma build de producao nesta origem tem um worker instalado
      // servindo bundle velho; sem remove-lo, o modo de desenvolvimento fica preso.
      navigator.serviceWorker
        .getRegistrations()
        .then((registrations) => registrations.forEach((registration) => registration.unregister()))
        .catch(() => undefined);

      return;
    }

    // Depois do load: registrar durante a montagem disputa banda com o bundle.
    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    };

    if (document.readyState === "complete") {
      register();
      return;
    }

    window.addEventListener("load", register);
    return () => window.removeEventListener("load", register);
  }, []);

  if (!mounted) {
    return null;
  }

  return <App />;
}
