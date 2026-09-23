/**
 * Recorte do expo-web-browser para o app web.
 *
 * A aba customizada e recurso de aplicativo nativo. No navegador o openOffer
 * abre o link pelo Linking antes de chegar aqui; ainda assim a funcao faz o
 * certo caso seja chamada, em vez de falhar calada.
 */
export const openBrowserAsync = async (url: string) => {
  globalThis.open?.(url, "_blank", "noopener,noreferrer");
  return { type: "opened" as const };
};

export const dismissBrowser = async () => undefined;
