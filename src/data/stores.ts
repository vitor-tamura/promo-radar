import { AlertSettings, StorePreference } from "../types";

/**
 * Catalogo dos e-commerces nacionais mais populares.
 *
 * Serve para duas coisas: filtrar de quais lojas voce quer receber alerta e
 * dizer quais lojas a varredura vai visitar uma a uma. A segunda existe porque
 * os agregadores indexam pouca loja — na pratica Magalu, Amazon, KaBuM, Fast
 * Shop e Webcontinental — e o resto recusa leitura automatizada no proprio site.
 * Sem a visita a pagina da loja, dois tercos deste catalogo nunca apareceriam.
 */
type StoreCatalogEntry = {
  id: string;
  name: string;
  /** Como a loja pode aparecer no nome do vendedor devolvido pelo agregador. */
  aliases: string[];
  enabledByDefault: boolean;
  /**
   * Pagina da loja no Promobit. E por ela que uma loja entra na varredura: a
   * maioria destes sites recusa leitura automatizada e os agregadores nao as
   * indexam, entao sem esta pagina a loja so apareceria por acaso.
   */
  promobitSlug: string;
};

export const storeCatalog: StoreCatalogEntry[] = [
  { id: "amazon", name: "Amazon", aliases: ["amazon", "amazonbr", "amazonbrasil"], enabledByDefault: true, promobitSlug: "amazon" },
  { id: "mercado-livre", name: "Mercado Livre", aliases: ["mercadolivre", "mercadolibre"], enabledByDefault: true, promobitSlug: "mercado-livre" },
  { id: "magalu", name: "Magazine Luiza", aliases: ["magazineluiza", "magalu", "magazinevoce"], enabledByDefault: true, promobitSlug: "magazine-luiza" },
  { id: "casas-bahia", name: "Casas Bahia", aliases: ["casasbahia"], enabledByDefault: true, promobitSlug: "casas-bahia" },
  { id: "ponto", name: "Ponto", aliases: ["ponto", "pontofrio"], enabledByDefault: true, promobitSlug: "ponto-frio" },
  { id: "extra", name: "Extra", aliases: ["extra", "extracom"], enabledByDefault: true, promobitSlug: "extra" },
  { id: "americanas", name: "Americanas", aliases: ["americanas", "lojasamericanas"], enabledByDefault: true, promobitSlug: "americanas" },
  { id: "submarino", name: "Submarino", aliases: ["submarino"], enabledByDefault: true, promobitSlug: "submarino" },
  { id: "shoptime", name: "Shoptime", aliases: ["shoptime"], enabledByDefault: true, promobitSlug: "shoptime" },
  { id: "carrefour", name: "Carrefour", aliases: ["carrefour"], enabledByDefault: true, promobitSlug: "carrefour" },
  { id: "shopee", name: "Shopee", aliases: ["shopee"], enabledByDefault: true, promobitSlug: "shopee" },
  { id: "aliexpress", name: "AliExpress", aliases: ["aliexpress"], enabledByDefault: false, promobitSlug: "aliexpress" },
  { id: "kabum", name: "KaBuM!", aliases: ["kabum"], enabledByDefault: true, promobitSlug: "kabum" },
  { id: "pichau", name: "Pichau", aliases: ["pichau", "pichauinformatica"], enabledByDefault: true, promobitSlug: "pichau" },
  { id: "terabyte", name: "TerabyteShop", aliases: ["terabyteshop", "terabyte"], enabledByDefault: true, promobitSlug: "terabyteshop" },
  { id: "fast-shop", name: "Fast Shop", aliases: ["fastshop"], enabledByDefault: true, promobitSlug: "fastshop" },
  { id: "netshoes", name: "Netshoes", aliases: ["netshoes"], enabledByDefault: true, promobitSlug: "netshoes" },
  { id: "centauro", name: "Centauro", aliases: ["centauro"], enabledByDefault: true, promobitSlug: "centauro" },
  { id: "kalunga", name: "Kalunga", aliases: ["kalunga"], enabledByDefault: true, promobitSlug: "kalunga" },
  { id: "leroy-merlin", name: "Leroy Merlin", aliases: ["leroymerlin"], enabledByDefault: true, promobitSlug: "leroy-merlin" },
  { id: "madeira-madeira", name: "MadeiraMadeira", aliases: ["madeiramadeira"], enabledByDefault: true, promobitSlug: "madeiramadeira" },
  { id: "webcontinental", name: "Webcontinental", aliases: ["webcontinental"], enabledByDefault: true, promobitSlug: "webcontinental" },
  { id: "girafa", name: "Girafa", aliases: ["girafa"], enabledByDefault: true, promobitSlug: "girafa" },
  { id: "havan", name: "Havan", aliases: ["havan"], enabledByDefault: true, promobitSlug: "havan" }
];

export const normalizeStoreName = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");

const aliasToStoreId = new Map<string, string>();
storeCatalog.forEach((store) => {
  aliasToStoreId.set(normalizeStoreName(store.name), store.id);
  store.aliases.forEach((alias) => aliasToStoreId.set(normalizeStoreName(alias), store.id));
});

/** Resolve o vendedor devolvido pelo agregador para uma loja do catalogo. */
export const resolveStoreId = (merchantName: string): string | undefined =>
  aliasToStoreId.get(normalizeStoreName(merchantName));

/**
 * Lojas ligadas, no formato que as fontes entendem. A preferencia guarda apenas
 * id e estado; o slug da pagina mora no catalogo.
 */
export const enabledStoreTargets = (preferences: StorePreference[]) => {
  const enabled = new Set(
    preferences.filter((store) => store.enabled).map((store) => store.id)
  );

  return storeCatalog
    .filter((store) => enabled.has(store.id))
    .map((store) => ({ name: store.name, promobitSlug: store.promobitSlug }));
};

export const defaultStorePreferences: StorePreference[] = storeCatalog.map((store) => ({
  id: store.id,
  name: store.name,
  enabled: store.enabledByDefault
}));

export const defaultSettings: AlertSettings = {
  discountTiers: [],
  notifyCoupons: true,
  notifyBuggedAds: true,
  autoScanEnabled: false,
  autoScanIntervalMinutes: 15,
  keywords: ["ssd", "notebook", "smart tv"],
  blockedTerms: ["usado", "recondicionado"],
  includeUnlistedStores: true,
  // Menor aliquota estadual; ajustavel na tela de alertas.
  icmsPercent: 17,
  // Acompanha o aparelho ate alguem dizer o contrario.
  theme: "system"
};
