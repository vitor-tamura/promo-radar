import { MarketOffer, ProviderResult, ScanProgress } from "../types";
import { describeError, isWeb, hasServerProxy } from "./httpClient";
import { amazonProvider } from "./providers/amazonStore";
import { kabumProvider } from "./providers/kabumStore";
import { mercadoLivreProvider } from "./providers/mercadoLivre";
import { aggregatorProviders } from "./providers/priceAggregator";
import { promobitProvider } from "./providers/promobit";
import { SearchProvider, SearchTaskSpec } from "./providers/types";

/**
 * Teto de seguranca, nao um recorte do que voce pediu: existe para uma lista
 * colada sem querer nao virar centenas de requisicoes. Toda tag abaixo disso
 * vira busca em todas as fontes.
 */
const MAX_QUERIES_PER_SCAN = 24;
/**
 * Consultas simultaneas. O gargalo e a espera da rede, nao a CPU, entao um punhado
 * de pedidos em paralelo encurta a varredura sem atropelar as fontes.
 */
const CONCURRENCY = 6;

export type MarketSearchResult = {
  offers: MarketOffer[];
  providers: ProviderResult[];
};

export type MarketSearchRequest = {
  /** Tags configuradas em Alertas. Cada uma vira consulta em todas as fontes. */
  keywords: string[];
  /**
   * Busca dirigida a um produto: substitui as tags por este termo e manda todas
   * as fontes procurarem so por ele.
   */
  focusTerm?: string;
  onProgress?: (progress: ScanProgress) => void;
};

/**
 * Agregadores cobrem as lojas que bloqueiam acesso direto; as lojas diretas
 * trazem preco de primeira mao com o valor cheio anunciado; a curadoria traz
 * promocao, cupom e erro de preco garimpados pela comunidade.
 */
const allProviders: SearchProvider[] = [
  ...aggregatorProviders,
  amazonProvider,
  kabumProvider,
  mercadoLivreProvider,
  promobitProvider
];

export const allProviderCount = allProviders.length;

/**
 * No navegador sem servidor proprio a politica de origem barra as fontes que
 * dependem de acesso direto. Com o proxy da propria origem (o app publicado na
 * Vercel) a chamada sai do servidor e todas voltam a valer.
 */
export const activeProviders = () =>
  allProviders.filter((provider) => !isWeb || hasServerProxy() || provider.availableOnWeb);

type SearchTask = {
  provider: SearchProvider;
  query: string;
  label: string;
};

const cleanTerms = (terms: string[]) =>
  terms.map((term) => term.trim()).filter(Boolean).slice(0, MAX_QUERIES_PER_SCAN);

/**
 * Intercala as consultas por rodada em vez de esgotar uma fonte antes de comecar
 * a proxima: com muitas tags, a primeira rodada ja devolve resultado de todas as
 * fontes, e uma fonte lenta no fim da fila nao segura as outras.
 */
const interleave = (groups: SearchTask[][]): SearchTask[] => {
  const longest = groups.reduce((max, group) => Math.max(max, group.length), 0);
  const ordered: SearchTask[] = [];

  for (let index = 0; index < longest; index += 1) {
    groups.forEach((group) => {
      const task = group[index];
      if (task) {
        ordered.push(task);
      }
    });
  }

  return ordered;
};

const buildTasks = ({ keywords, focusTerm }: MarketSearchRequest): SearchTask[] => {
  const term = focusTerm?.trim();

  const specsFor = (provider: SearchProvider): SearchTaskSpec[] =>
    term
      ? (provider.buildFocusTasks ?? ((value: string) => provider.buildTasks([value])))(term)
      : provider.buildTasks(cleanTerms(keywords));

  return interleave(
    activeProviders().map((provider) =>
      specsFor(provider).map((spec) => ({ provider, ...spec }))
    )
  );
};

/**
 * Mantem uma oferta por produto, preferindo a de menor preco. Ofertas da propria
 * loja e do agregador convivem: o dedup por chave de produto nao as mistura,
 * entao o mesmo item pode aparecer com o preco de cada fonte.
 */
const dedupeOffers = (offers: MarketOffer[]) => {
  const byProduct = new Map<string, MarketOffer>();

  offers.forEach((offer) => {
    const current = byProduct.get(offer.productKey);
    if (!current || offer.price < current.price) {
      byProduct.set(offer.productKey, offer);
    }
  });

  return [...byProduct.values()];
};

export const searchMarket = async (request: MarketSearchRequest): Promise<MarketSearchResult> => {
  const { onProgress } = request;
  const tasks = buildTasks(request);
  const providers: ProviderResult[] = [];
  const collected: MarketOffer[] = [];
  let completed = 0;
  let cursor = 0;

  onProgress?.({ current: 0, total: tasks.length, label: "Preparando varredura" });

  const runNext = async (): Promise<void> => {
    const taskIndex = cursor;
    cursor += 1;

    const task = tasks[taskIndex];
    if (!task) {
      return;
    }

    const startedAt = Date.now();
    onProgress?.({ current: completed, total: tasks.length, label: task.label });

    try {
      const offers = await task.provider.search(task.query);
      collected.push(...offers);
      providers.push({
        provider: task.provider.name,
        query: task.query,
        status: offers.length > 0 ? "ok" : "empty",
        offers: offers.length,
        durationMs: Date.now() - startedAt
      });
    } catch (error) {
      providers.push({
        provider: task.provider.name,
        query: task.query,
        status: "failed",
        offers: 0,
        durationMs: Date.now() - startedAt,
        error: describeError(error)
      });
    } finally {
      completed += 1;
      onProgress?.({ current: completed, total: tasks.length, label: task.label });
    }

    await runNext();
  };

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, tasks.length) }, () => runNext()));

  return { offers: dedupeOffers(collected), providers };
};
