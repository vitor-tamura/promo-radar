import { MarketOffer } from "../../types";

/**
 * aggregator: compara varias lojas de uma vez (Buscape, Zoom).
 * store: busca direto no site da loja (Amazon, KaBuM).
 * curator: comunidade que garimpa promocao, cupom e erro de preco (Promobit).
 */
export type ProviderKind = "aggregator" | "store" | "curator";

/** Uma consulta que o provider sabe fazer, com o rotulo mostrado no progresso. */
export type SearchTaskSpec = {
  query: string;
  label: string;
};

export type SearchProvider = {
  key: string;
  /** Nome exibido como fonte da oferta. */
  name: string;
  kind: ProviderKind;
  /**
   * False para fontes que dependem de acesso direto: no navegador a politica de
   * origem bloqueia a chamada e nao ha proxy que devolva a resposta utilizavel.
   */
  availableOnWeb: boolean;
  /** Cada provider decide como transformar as palavras-chave em consultas. */
  buildTasks: (keywords: string[]) => SearchTaskSpec[];
  /**
   * Consultas de uma busca dirigida a um produto so. Quem nao define cai em
   * buildTasks com o termo sozinho; quem tem busca propria (o curador, que no
   * feed normal navega por categoria) troca de rota aqui.
   */
  buildFocusTasks?: (term: string) => SearchTaskSpec[];
  search: (query: string) => Promise<MarketOffer[]>;
};

const NEXT_DATA_OPEN = '<script id="__NEXT_DATA__" type="application/json">';
const NEXT_DATA_CLOSE = "</script>";

/**
 * Recorta o JSON que o Next.js embute na pagina. O HTML tem centenas de KB,
 * entao localizar por indice evita rodar regex sobre o documento inteiro.
 */
export const readNextData = (html: string): unknown => {
  const start = html.indexOf(NEXT_DATA_OPEN);
  if (start === -1) {
    return undefined;
  }

  const jsonStart = start + NEXT_DATA_OPEN.length;
  const end = html.indexOf(NEXT_DATA_CLOSE, jsonStart);
  if (end === -1) {
    return undefined;
  }

  try {
    return JSON.parse(html.slice(jsonStart, end));
  } catch {
    return undefined;
  }
};

const HTML_ENTITIES: Record<string, string> = {
  quot: '"',
  apos: "'",
  amp: "&",
  lt: "<",
  gt: ">",
  nbsp: " "
};

const MAX_CODE_POINT = 0x10ffff;

/**
 * Titulos chegam com entidades HTML escapadas tanto no JSON quanto no markup, e
 * cada fonte prefere uma forma: o Mercado Livre escreve a aspa de polegada como
 * &#x27; (hexadecimal), outras como &#39; (decimal) ou &apos;. As duas formas
 * numericas entram por uma regra so, em vez de virarem lista.
 *
 * Nomeadas e numericas sao trocadas na mesma passada de proposito: decodificar
 * &amp; antes faria "&amp;#39;", que descreve o texto literal "&#39;", virar uma
 * aspa.
 */
export const decodeEntities = (value: string) =>
  value.replace(/&(?:([a-z]+)|#(x[\da-f]+|\d+));/gi, (match, name?: string, code?: string) => {
    if (name) {
      return HTML_ENTITIES[name.toLowerCase()] ?? match;
    }

    if (!code) {
      return match;
    }

    const point = code[0]?.toLowerCase() === "x" ? parseInt(code.slice(1), 16) : Number(code);

    return Number.isFinite(point) && point > 0 && point <= MAX_CODE_POINT
      ? String.fromCodePoint(point)
      : match;
  });

/** Converte "1.614,90" (e variantes com R$) para 1614.9. */
export const parseBrlNumber = (value: string | undefined): number | undefined => {
  if (!value) {
    return undefined;
  }

  const digits = value.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
  const parsed = Number(digits);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
};

/**
 * Lojas exibem o valor da parcela em markup parecido com o do preco anterior, e
 * agregadores as vezes trazem 0,01 como placeholder. So aceitamos como "preco de"
 * o que for maior que o atual e ainda plausivel.
 */
export const sanitizeListPrice = (listPrice: number | undefined, price: number) => {
  if (!listPrice || listPrice <= price || listPrice > price * 5) {
    return undefined;
  }

  return listPrice;
};

/** Consulta por palavra-chave: o padrao para lojas e agregadores. */
export const keywordTasks = (providerName: string) => (keywords: string[]): SearchTaskSpec[] =>
  keywords.map((keyword) => ({ query: keyword, label: `${providerName}: ${keyword}` }));
