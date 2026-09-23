import AsyncStorage from "@react-native-async-storage/async-storage";
import { PriceRange } from "../ui/PriceFilter";
import { Deal } from "../types";

const SEARCH_KEY = "@promo-radar/search";

/**
 * Passado esse tempo o resultado guardado descreve precos que ja mudaram. O
 * termo digitado continua valendo — ele nao envelhece — entao so a lista de
 * ofertas e descartada, e a busca volta pronta para ser disparada de novo.
 */
const MAX_RESULT_AGE_MS = 6 * 60 * 60 * 1000;

export type SavedSearch = {
  /** O que esta escrito no campo, que recorta o feed enquanto se digita. */
  draft: string;
  /** Produto da ultima varredura dirigida, quando houve uma. */
  focusTerm?: string;
  focusDeals: Deal[];
  /** Intervalo de preco em vigor no feed. */
  priceRange: PriceRange;
  savedAt: number;
};

/**
 * A busca em andamento, guardada fora da memoria do componente.
 *
 * Na extensao o popup e destruido toda vez que perde o foco — clicar numa oferta
 * ja basta. Sem isto, voltar ao popup significaria digitar o termo de novo e
 * esperar outra varredura, que e justamente o trabalho que a busca dirigida
 * acabou de fazer. Guardado aqui, o popup reabre onde estava, e a aba expandida
 * ("Abrir em aba") enxerga a mesma busca, porque as duas superficies leem o
 * mesmo armazenamento.
 */
export const saveSearch = async (search: Omit<SavedSearch, "savedAt">) => {
  try {
    // Nada escolhido nao e estado a guardar: e o estado inicial.
    const vazio =
      !search.draft.trim() &&
      !search.focusTerm &&
      search.priceRange.min === undefined &&
      search.priceRange.max === undefined;

    if (vazio) {
      await AsyncStorage.removeItem(SEARCH_KEY);
      return;
    }

    const payload: SavedSearch = { ...search, savedAt: Date.now() };
    await AsyncStorage.setItem(SEARCH_KEY, JSON.stringify(payload));
  } catch {
    // Guardar a busca e conveniencia: falhar aqui nao pode atrapalhar a tela.
  }
};

export const loadSearch = async (): Promise<SavedSearch | undefined> => {
  try {
    const raw = await AsyncStorage.getItem(SEARCH_KEY);
    if (!raw) {
      return undefined;
    }

    const cached = JSON.parse(raw) as SavedSearch;

    if (typeof cached.draft !== "string") {
      return undefined;
    }

    const stale = Date.now() - cached.savedAt > MAX_RESULT_AGE_MS;

    return {
      ...cached,
      // Sem as ofertas nao ha o que a faixa de resultado anuncie, entao o termo
      // dirigido cai junto e a tela volta ao feed normal com o texto no campo.
      focusTerm: stale ? undefined : cached.focusTerm,
      focusDeals: stale || !Array.isArray(cached.focusDeals) ? [] : cached.focusDeals,
      // O intervalo nao envelhece: ele descreve o que voce quer ver, nao um preco.
      priceRange: cached.priceRange ?? {}
    };
  } catch {
    return undefined;
  }
};

export const clearSavedSearch = async () => {
  try {
    await AsyncStorage.removeItem(SEARCH_KEY);
  } catch {
    // Idem: limpar e sempre melhor esforco.
  }
};
