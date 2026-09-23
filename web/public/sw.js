/**
 * Service worker do aplicativo web.
 *
 * Guarda o casco do app para que ele abra sem rede: o feed da ultima varredura
 * mora no armazenamento do navegador, entao abrir offline ainda mostra as
 * ofertas encontradas antes. Preco nunca e guardado aqui — a busca as fontes
 * passa longe do cache, e uma resposta velha seria pior que nenhuma.
 */

const CACHE = "promo-radar-v1";

/** O casco: a pagina e os icones. O resto entra conforme for sendo pedido. */
const SHELL = ["/", "/manifest.webmanifest", "/icons/icon192.png", "/icons/icon512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      // Um icone que falhe nao pode abortar a instalacao inteira.
      .then((cache) => Promise.allSettled(SHELL.map((path) => cache.add(path))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

const isStaticAsset = (url) => url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/");

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  // Outra origem (imagem de produto da loja) e a busca as fontes ficam fora:
  // preco e estoque mudam, e o proprio radar ja decide quando reconsultar.
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) {
    return;
  }

  // Arquivo do build tem hash no nome, entao o que esta no cache e exatamente o
  // que foi pedido. Vale porque este worker so e registrado em producao: os
  // nomes sem hash que o modo de desenvolvimento serve ficariam presos aqui.
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ??
          fetch(request).then((response) => {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
            return response;
          })
      )
    );
    return;
  }

  // A pagina vem da rede quando ha rede, para uma publicacao nova chegar na hora.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put("/", copy));
          return response;
        })
        .catch(() => caches.match("/").then((cached) => cached ?? Response.error()))
    );
  }
});
