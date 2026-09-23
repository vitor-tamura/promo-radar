import { Linking, Platform } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { isExtension, openInTab } from "../platform/extension";

/**
 * Abre a oferta reaproveitando a sessao que ja existe no navegador do aparelho.
 *
 * O app nao guarda login nem senha de loja nenhuma: quem mantem os cookies e o
 * navegador do sistema. No Android a aba customizada e no iOS o SFSafariViewController
 * compartilham esses cookies, entao voce cai na pagina ja logado na sua conta,
 * com os cupons e precos que ela enxerga, sem sair do app.
 */
export const openOffer = async (url: string) => {
  // Na extensao o window.open partiria de um popup que fecha no mesmo instante;
  // a aba criada pelo proprio navegador nao depende da pagina que a pediu.
  if (isExtension) {
    await openInTab(url);
    return;
  }

  if (Platform.OS === "web") {
    await Linking.openURL(url);
    return;
  }

  try {
    await WebBrowser.openBrowserAsync(url, {
      // Sem isso a aba abriria isolada, sem a sessao do navegador.
      browserPackage: undefined,
      showTitle: true,
      enableBarCollapsing: true,
      dismissButtonStyle: "close"
    });
  } catch {
    // Se a aba customizada nao estiver disponivel, o navegador padrao resolve.
    await Linking.openURL(url);
  }
};

/**
 * Abre a oferta numa aba atras da atual, sem tirar o foco de onde voce esta.
 *
 * E o que o botao do meio faz em qualquer link, e na extensao ele resolve um
 * incomodo especifico: o popup e destruido assim que perde o foco, entao abrir
 * uma oferta em primeiro plano encerra a navegacao pela lista. Por tras, da para
 * marcar varias e olhar depois.
 *
 * So existe onde ha abas. No aparelho o gesto nao existe, e chamar aqui cai na
 * mesma abertura de sempre em vez de nao fazer nada.
 */
export const openOfferInBackground = async (url: string) => {
  if (isExtension) {
    await openInTab(url, { background: true });
    return;
  }

  if (Platform.OS === "web") {
    // Sem a extensao nao da para escolher o plano da aba: quem decide e o
    // navegador. O noopener evita que a pagina aberta alcance esta.
    globalThis.open?.(url, "_blank", "noopener,noreferrer");
    return;
  }

  await openOffer(url);
};
