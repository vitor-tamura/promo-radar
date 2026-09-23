import { NextRequest } from "next/server";

/**
 * Proxy de leitura do app web.
 *
 * No navegador a politica de origem barra o fetch direto nas lojas, e o leitor
 * publico que o app usa como alternativa cobra dezenas de segundos por pagina e
 * nem sempre devolve o JSON embutido. Aqui a busca sai do servidor da Vercel,
 * onde essa politica nao existe: a loja responde como responderia ao aplicativo
 * instalado, e o app web passa a alcancar as mesmas fontes que a extensao.
 *
 * So repassa leitura de pagina publica: GET, http(s), sem cookie e sem corpo.
 */

/** Uma pagina de loja leva alguns segundos; o teto evita segurar a funcao a toa. */
const UPSTREAM_TIMEOUT_MS = 25000;
export const maxDuration = 30;

const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

/**
 * Dominios que o radar consulta. Sem essa lista a rota viraria um proxy aberto,
 * que qualquer um na internet poderia apontar para onde quisesse usando o seu
 * deploy como fachada.
 */
const ALLOWED_HOSTS = [
  "buscape.com.br",
  "zoom.com.br",
  "amazon.com.br",
  "kabum.com.br",
  "grupokabum.com.br",
  "mercadolivre.com.br",
  "promobit.com.br",
  "economia.awesomeapi.com.br"
];

const isAllowed = (host: string) =>
  ALLOWED_HOSTS.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));

const deny = (status: number, message: string) =>
  new Response(message, { status, headers: { "content-type": "text/plain; charset=utf-8" } });

export async function GET(request: NextRequest) {
  const target = request.nextUrl.searchParams.get("url");

  if (!target) {
    return deny(400, "Faltou o parametro url.");
  }

  let parsed: URL;
  try {
    parsed = new URL(target);
  } catch {
    return deny(400, "URL invalida.");
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return deny(400, "So http e https.");
  }

  if (!isAllowed(parsed.hostname)) {
    return deny(403, `Dominio fora da lista do radar: ${parsed.hostname}`);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

  try {
    const upstream = await fetch(parsed.toString(), {
      headers: {
        "User-Agent": BROWSER_USER_AGENT,
        "Accept-Language": "pt-BR,pt;q=0.9",
        Accept: request.headers.get("x-promo-accept") ?? "text/html,application/xhtml+xml"
      },
      signal: controller.signal,
      redirect: "follow",
      // A resposta e sempre a mesma para todo mundo; o cache da borda evita
      // repetir a mesma pagina a cada varredura de cada visitante.
      next: { revalidate: 60 }
    });

    const body = await upstream.text();

    return new Response(body, {
      status: upstream.status,
      headers: {
        "content-type": upstream.headers.get("content-type") ?? "text/plain; charset=utf-8",
        "cache-control": "public, max-age=0, s-maxage=60"
      }
    });
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";

    return deny(
      aborted ? 504 : 502,
      aborted ? "A fonte demorou demais para responder." : "Nao consegui alcancar a fonte."
    );
  } finally {
    clearTimeout(timeoutId);
  }
}
