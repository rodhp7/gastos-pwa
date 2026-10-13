const CACHE_NAME = "nexo-v67-iphone-icono";
const APP_SHELL = [
  "./", "./index.html", "./config.js", "./date-utils.js", "./app.js", "./finance-core.js", "./supabase-config.js", "./auth.js",
  "./styles.css", "./manifest.json", "./icons/icon-192.png",
  "./icons/icon-512.png", "./icons/apple-touch-icon.png"
];

/* El código de la app (HTML, JS y CSS) se pide primero a la red y solo se
   recurre a la copia guardada si no hay conexión. Con la estrategia anterior
   —caché primero— un usuario seguía ejecutando la versión antigua después de
   publicar una corrección, porque su copia local nunca se volvía a consultar.
   Los iconos y demás recursos estáticos sí se sirven desde la caché, que es
   donde esa estrategia sí conviene: no cambian y así cargan al instante. */
const RECURSOS_DE_CODIGO = /\.(?:html|js|css)$/i;

function esCodigoDeApp(request) {
  if (request.mode === "navigate") return true;
  const url = new URL(request.url);
  return url.origin === self.location.origin && RECURSOS_DE_CODIGO.test(url.pathname);
}

function guardarEnCache(request, response) {
  if (!response || !response.ok || response.type === "opaque") return response;
  const copia = response.clone();
  caches.open(CACHE_NAME).then(function (cache) { cache.put(request, copia); });
  return response;
}

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function (cache) { return cache.addAll(APP_SHELL); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (key) { return key !== CACHE_NAME; })
          .map(function (key) { return caches.delete(key); })
      );
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (event) {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  if (esCodigoDeApp(event.request)) {
    event.respondWith(
      fetch(event.request)
        .then(function (response) { return guardarEnCache(event.request, response); })
        .catch(function () {
          return caches.match(event.request).then(function (cached) {
            return cached || caches.match("./index.html");
          });
        })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(function (cached) {
      if (cached) return cached;
      return fetch(event.request)
        .then(function (response) { return guardarEnCache(event.request, response); })
        .catch(function () { return caches.match("./index.html"); });
    })
  );
});
