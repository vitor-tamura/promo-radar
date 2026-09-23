import { MarketOffer } from "../../types";
import { fetchJson } from "../httpClient";
import { decodeEntities, sanitizeListPrice } from "./types";

/**
 * Busca do Promobit.
 *
 * A pagina /buscar monta o resultado no navegador: o HTML entregue vem vazio, so
 * com o termo. Quem responde de verdade e a API publica que a propria pagina
 * consulta, e ela devolve num pedido so as ofertas ativas e os cupons que casam
 * com o termo. E por aqui que a curadoria deixa de depender de categoria e passa
 * a atender tag por tag.
 */
const SEARCH_API = "https://api.promobit.com.br/search";
const SITE_URL = "https://www.promobit.com.br";
const IMAGE_HOST = "https://i.promobit.com.br";
const PROVIDER_NAME = "Promobit";

/** O site usa 0,01 como marcador de "sem preco proprio" em selecoes e cupons. */
const PLACEHOLDER_PRICE = 1;

type SearchTag = { name?: string; type?: string };

/**
 * A API responde em snake_case; a pagina embute os mesmos campos em camelCase.
 * Sao duas rotas para o mesmo dado, e cada uma tem seu adaptador.
 */
type SearchOffer = {
  offer_id?: number;
  offer_title?: string;
  offer_price?: number;
  offer_old_price?: number;
  offer_price_type?: string;
  offer_photo?: string;
  offer_slug?: string;
  offer_coupon?: string | null;
  offer_published?: string;
  offer_likes?: number;
  offer_tags?: SearchTag[];
  offer_status_name?: string;
  store_name?: string;
  category_name?: string;
  subcategory_name?: string;
};

type SearchCoupon = {
  coupon_id?: number;
  coupon_code?: string;
  coupon_title?: string;
  coupon_discount?: string;
  coupon_url?: string;
  coupon_status_name?: string;
  store_name?: string;
  store_image?: string;
};

type SearchResponse = {
  active_offers?: SearchOffer[];
  coupons?: SearchCoupon[];
};

/** A comunidade sinaliza erro de preco no proprio titulo da oferta. */
const PRICE_ERROR_PATTERN = /erro\s+de\s+pre|pre[cç]o\s+bugad|bug\s+de\s+pre|pre[cç]o\s+errad/i;

export const looksLikePriceError = (title: string) => PRICE_ERROR_PATTERN.test(title);

/** O selo "APP" marca preco ou cupom que so vale dentro do aplicativo da loja. */
export const isAppOnly = (tags: SearchTag[] | undefined) =>
  Boolean(tags?.some((tag) => tag.name?.trim().toUpperCase() === "APP"));

const toOffer = (raw: SearchOffer): MarketOffer | undefined => {
  const title = raw.offer_title ? decodeEntities(raw.offer_title.trim()) : "";
  const rawPrice = raw.offer_price ?? 0;
  const hasRealPrice = rawPrice >= PLACEHOLDER_PRICE;
  const price = hasRealPrice ? rawPrice : 0;

  if (!title || (!hasRealPrice && !raw.offer_coupon)) {
    return undefined;
  }

  // "A partir de" nao descreve o item exibido: o preco cheio nao vale como base.
  const isStartingAt = raw.offer_price_type === "STARTING_AT" || !hasRealPrice;

  return {
    productKey: `promobit:${raw.offer_id ?? title.toLowerCase().slice(0, 60)}`,
    title,
    store: raw.store_name?.trim() || PROVIDER_NAME,
    price,
    listPrice: isStartingAt ? undefined : sanitizeListPrice(raw.offer_old_price, price),
    url: raw.offer_slug ? `${SITE_URL}/oferta/${raw.offer_slug}/` : SITE_URL,
    imageUrl: raw.offer_photo ? `${IMAGE_HOST}${raw.offer_photo}` : undefined,
    provider: PROVIDER_NAME,
    category: raw.subcategory_name ?? raw.category_name,
    coupon: raw.offer_coupon ?? undefined,
    communityVotes: raw.offer_likes,
    publishedAt: raw.offer_published,
    priceError: looksLikePriceError(title),
    appOnly: isAppOnly(raw.offer_tags)
    // Sem curated: o resultado ja veio filtrado pelo termo, e marcar como
    // curadoria faria a oferta furar o filtro de palavras-chave sem precisar.
  };
};

const toCouponOffer = (raw: SearchCoupon): MarketOffer | undefined => {
  const title = raw.coupon_title ? decodeEntities(raw.coupon_title.trim()) : "";
  const code = raw.coupon_code?.trim();

  if (!title) {
    return undefined;
  }

  return {
    productKey: `promobit-coupon:${raw.coupon_id ?? title.toLowerCase().slice(0, 60)}`,
    title,
    store: raw.store_name?.trim() || PROVIDER_NAME,
    // Cupom nao tem preco proprio: o desconto se aplica no carrinho.
    price: 0,
    url: raw.coupon_url ? `${SITE_URL}${raw.coupon_url}` : `${SITE_URL}/cupons/`,
    imageUrl: raw.store_image ?? undefined,
    provider: PROVIDER_NAME,
    category: "Cupons",
    // Promocao sem codigo se aplica sozinha na loja; o rotulo explica o desconto.
    coupon: code || undefined,
    couponLabel: raw.coupon_discount?.trim()
  };
};

const isApproved = (status: string | undefined) => !status || status === "APPROVED";

/**
 * Ofertas e cupons que casam com o termo. As expiradas (finished_offers) ficam de
 * fora: a API as devolve aos milhares e nenhuma leva a um preco que ainda existe.
 */
export const searchPromobit = async (term: string): Promise<MarketOffer[]> => {
  const payload = await fetchJson<SearchResponse>(
    `${SEARCH_API}?q=${encodeURIComponent(term)}`
  );

  const offers = (payload.active_offers ?? [])
    .filter((offer) => isApproved(offer.offer_status_name))
    .map(toOffer);

  const coupons = (payload.coupons ?? [])
    .filter((coupon) => isApproved(coupon.coupon_status_name))
    .map(toCouponOffer);

  return [...offers, ...coupons].filter((offer): offer is MarketOffer => Boolean(offer));
};
