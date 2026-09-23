import { MarketOffer, ProviderResult, ScanProgress } from "../types";
import { describeError, isWeb, hasServerProxy } from "./httpClient";
import { amazonProvider } from "./providers/amazonStore";
import { kabumProvider } from "./providers/kabumStore";
import { mercadoLivreProvider } from "./providers/mercadoLivre";
import { aggregatorProviders } from "./providers/priceAggregator";
import { promobitProvider } from "./providers/promobit";
import { SearchProvider, SearchTaskSpec, StoreTarget } from "./providers/types";

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
/**
 * Quantas consultas simultaneas cada fonte aguenta.
 *
 * Varrer as lojas escolhidas coloca mais de vinte pedidos na fila, quase todos
 * para o mesmo site. Sem este teto eles saem em rajada, o site responde 429 e as
 * lojas do fim da fila somem da varredura — o problema que a varredura por loja
 * veio resolver. O limite global continua valendo: ele reparte o resto do tempo
 * entre as outras fontes enquanto uma espera a vez.
 */
const CONCURRENCY_PER_PROVIDER = 2;
/** Pausa antes de reavaliar a fila quando so restam tarefas de uma fonte ocupada. */
const QUEUE_RETRY_MS = 250;

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
  /**
   * Lojas que voce ligou em Lojas. A fonte que varre por loja pede a pagina de
   * cada uma: e o unico caminho para as que nao aparecem sozinhas.
   */
  stores?: StoreTarget[];
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

/**
 * Varrer loja por loja significa mais de vinte pedidos ao mesmo site. Sai direto
 * no aplicativo e na extensao, e pela funcao do servidor no app publicado. Sem
 * nenhum dos dois resta o leitor publico, que corta o excesso com 429 — a
 * varredura viraria uma parede de falhas, e as lojas continuariam de fora.
 */
const canScanStores = () => !isWeb || hasServerProxy();

const buildTasks = ({ keywords, focusTerm, stores = [] }: MarketSearchRequest): SearchTask[] => {
  const term = focusTerm?.trim();
  const storeTargets = canScanStores() ? stores : [];

  /**
   * Busca dirigida nao varre loja: quem procura um produto quer o produto, e a
   * vitrine de vinte lojas so atrasaria a resposta.
   */
  const specsFor = (provider: SearchProvider): SearchTaskSpec[] => {
    if (term) {
      return (provider.buildFocusTasks ?? ((value: string) => provider.buildTasks([value])))(term);
    }

    return [
      ...provider.buildTasks(cleanTerms(keywords)),
      ...(storeTargets.length > 0 ? (provider.buildStoreTasks?.(storeTargets) ?? []) : [])
    ];
  };

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

  const pending = [...tasks];
  const inFlight = new Map<string, number>();

  onProgress?.({ current: 0, total: tasks.length, label: "Preparando varredura" });

  /** Primeira tarefa cuja fonte ainda tem vaga; a ordem intercalada faz o resto. */
  const takeNext = () => {
    const index = pending.findIndex(
      (task) => (inFlight.get(task.provider.key) ?? 0) < CONCURRENCY_PER_PROVIDER
    );

    return index === -1 ? undefined : pending.splice(index, 1)[0];
  };

  const runNext = async (): Promise<void> => {
    const task = takeNext();

    if (!task) {
      // Nada elegivel: ou a fila acabou, ou o que sobrou e de uma fonte lotada.
      if (pending.length === 0) {
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, QUEUE_RETRY_MS));
      return runNext();
    }

    inFlight.set(task.provider.key, (inFlight.get(task.provider.key) ?? 0) + 1);

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
      inFlight.set(task.provider.key, (inFlight.get(task.provider.key) ?? 1) - 1);
      completed += 1;
      onProgress?.({ current: completed, total: tasks.length, label: task.label });
    }

    await runNext();
  };

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, tasks.length) }, () => runNext()));

  return { offers: dedupeOffers(collected), providers };
};
