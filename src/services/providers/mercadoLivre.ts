import { MarketOffer } from "../../types";
import { fetchPageHtml } from "../httpClient";
import { decodeEntities, parseBrlNumber, sanitizeListPrice, SearchProvider, SearchTaskSpec } from "./types";

/**
 * Mercado Livre pela vitrine de ofertas.
 *
 * A busca por palavra (lista.mercadolivre.com.br) responde com a pagina de
 * "trafego suspeito" para qualquer cliente que nao seja um navegador de verdade,
 * inclusive atraves do leitor, entao nao da para consultar termo por termo. A
 * vitrine de ofertas, ao contrario, abre normalmente e aceita filtro de categoria
 * e pagina: cada oferta ali ja vem com preco cheio e percentual anunciados pela
 * propria loja, que e a base de comparacao mais confiavel que existe.
 */
const BASE_URL = "https://www.mercadolivre.com.br/ofertas";
const PROVIDER_NAME = "Mercado Livre";
const STORE_NAME = "Mercado Livre";

/** Paginas da vitrine geral quando nenhuma tag aponta para uma categoria. */
const DEFAULT_PAGES = 2;
/** Cada cartao da vitrine abre com esta sequencia de classes. */
const CARD_SPLIT = /<div class="andes-card poly-card/g;

type MercadoCategory = {
  /** Id de categoria do proprio site, usado no parametro category. */
  id: string;
  label: string;
  terms: string[];
};

/** Secoes da vitrine e as palavras do usuario que apontam para cada uma. */
const categories: MercadoCategory[] = [
  {
    id: "MLB1648",
    label: "Informatica",
    terms: ["ssd", "hd", "nvme", "notebook", "pc", "computador", "monitor", "teclado", "mouse", "placa", "processador", "memoria", "ram", "impressora", "roteador"]
  },
  {
    id: "MLB1051",
    label: "Celulares",
    terms: ["celular", "smartphone", "iphone", "galaxy", "motorola", "xiaomi", "redmi", "tablet", "fone", "carregador"]
  },
  {
    id: "MLB1000",
    label: "Eletronicos",
    terms: ["tv", "televis", "som", "soundbar", "headset", "projetor", "camera", "drone", "smartwatch"]
  },
  {
    id: "MLB1144",
    label: "Games",
    terms: ["game", "jogo", "console", "playstation", "ps5", "xbox", "nintendo", "switch", "controle"]
  },
  {
    id: "MLB5726",
    label: "Eletrodomesticos",
    terms: ["geladeira", "fogao", "lava", "maquina", "microondas", "ar condicionado", "air fryer", "fritadeira", "aspirador", "cafeteira", "liquidificador"]
  },
  {
    id: "MLB1574",
    label: "Casa",
    terms: ["cadeira", "mesa", "sofa", "cama", "colchao", "armario", "panela", "ferramenta"]
  }
];

const buildUrl = (query: string) => {
  const [kind, value] = query.split(":");

  return kind === "category"
    ? `${BASE_URL}?category=${encodeURIComponent(value ?? "")}`
    : `${BASE_URL}?page=${encodeURIComponent(value ?? "1")}`;
};

const readTitle = (block: string) =>
  block.match(/class="poly-component__title"[^>]*>([^<]{8,})</)?.[1];

const readUrl = (block: string) =>
  block.match(/<a href="(https:\/\/[^"]+)"[^>]*class="poly-component__title"/)?.[1] ??
  block.match(/<a href="(https:\/\/[^"]+)"/)?.[1];

/**
 * O proprio site descreve o valor por extenso no aria-label do bloco de moeda
 * ("799 reais", "1499 reais com 90 centavos"). E mais estavel que remontar o
 * numero pelos spans de inteiro e centavos, que vem aninhados junto com o
 * simbolo da moeda e fecham em pontos diferentes conforme o cartao.
 */
const readAmount = (label: string | undefined) => {
  const parts = label?.match(/([\d.]+)\s*reais(?:\s*com\s*(\d{1,2})\s*centavos)?/i);

  return parts ? parseBrlNumber(`${parts[1]},${parts[2] ?? "00"}`) : undefined;
};

const readPrice = (block: string) =>
  readAmount(block.match(/poly-price__amount[^>]*aria-label="([^"]+)"/)?.[1]);

/** O preco anterior sai riscado e rotulado como "Antes: ...". */
const readListPrice = (block: string) =>
  readAmount(block.match(/andes-money-amount--previous[^>]*aria-label="([^"]+)"/)?.[1]);

/**
 * O id do produto esta no caminho da URL. A query carrega o codigo da campanha
 * ("pdp_filters=deal:MLB779362-1"), igual para varias ofertas do mesmo dia: ler a
 * URL inteira faria produtos diferentes dividirem a mesma chave, e um apagaria o
 * outro na deduplicacao.
 */
const readProductId = (url: string | undefined) =>
  url?.split("?")[0]?.match(/(MLB-?\d{6,})/)?.[1]?.replace("-", "");

const toOffer = (block: string): MarketOffer | undefined => {
  const title = readTitle(block);
  const price = readPrice(block);

  if (!title || !price) {
    return undefined;
  }

  const url = readUrl(block);
  const productId = readProductId(url);
  const rating = block.match(/Classifica[^\d]{0,20}([\d,.]+) de 5 estrelas/)?.[1];

  return {
    productKey: productId
      ? `mercadolivre:${productId}`
      : `mercadolivre:${title.toLowerCase().slice(0, 60)}`,
    title: decodeEntities(title.trim()),
    store: STORE_NAME,
    price,
    listPrice: sanitizeListPrice(readListPrice(block), price),
    // O fragmento da URL carrega o rastreio da vitrine e nao leva a lugar nenhum.
    url: url?.split("#")[0] ?? BASE_URL,
    imageUrl: block.match(/poly-component__picture"[^>]*src="(https:\/\/[^"]+)"/)?.[1],
    provider: PROVIDER_NAME,
    rating: parseBrlNumber(rating),
    freeShipping: /Chegar[^<]{0,12}gr[aá]tis|Frete gr[aá]tis/i.test(block),
    // Vitrine de ofertas do dia: e promocao por definicao, como a curadoria.
    curated: true
  };
};

/** Escolhe as secoes da vitrine a partir das tags configuradas. */
const pickCategories = (keywords: string[]): SearchTaskSpec[] => {
  const normalized = keywords.map((keyword) => keyword.toLowerCase().trim()).filter(Boolean);
  const matched = categories.filter((category) =>
    normalized.some((keyword) => category.terms.some((term) => keyword.includes(term) || term.includes(keyword)))
  );

  if (matched.length === 0) {
    return Array.from({ length: DEFAULT_PAGES }, (_, index) => ({
      query: `page:${index + 1}`,
      label: `${PROVIDER_NAME}: ofertas do dia`
    }));
  }

  return matched.map((category) => ({
    query: `category:${category.id}`,
    label: `${PROVIDER_NAME}: ${category.label}`
  }));
};

export const mercadoLivreProvider: SearchProvider = {
  key: "mercado-livre",
  name: PROVIDER_NAME,
  kind: "store",
  // A vitrine e HTML publico, mas o fetch do navegador esbarra na origem; o leitor
  // (ou o proxy da propria origem, no app publicado) devolve a pagina inteira.
  availableOnWeb: true,
  buildTasks: pickCategories,
  // A vitrine nao aceita termo de busca, entao a varredura dirigida traz as
  // mesmas secoes e o filtro por produto acontece depois, sobre os titulos.
  buildFocusTasks: (term) => pickCategories([term]),
  search: async (query) => {
    const html = await fetchPageHtml(buildUrl(query));

    return html
      .split(CARD_SPLIT)
      .slice(1)
      .map(toOffer)
      .filter((offer): offer is MarketOffer => Boolean(offer));
  }
};
