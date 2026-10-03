// Service worker do Treino da Semana — guarda os arquivos do app para abrir sem
// internet. NÃO mexe no localStorage (treino, histórico e preferências ficam
// intactos). Estratégia: cache primeiro (abre na hora, mesmo com sinal ruim).
//
// A VERSÃO abaixo é gerada pelo comando:  node tools/atualizar-sw.js
// Rode-o sempre que mudar QUALQUER arquivo da lista ASSETS; sem isso o celular
// continuaria com os arquivos antigos. (tests/8-pwa.test.js falha se esquecer.)

const VERSION = "treino-a14f3ad2ef2c"; // @versao-automatica
const ASSETS = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "css/styles.css",
  "js/data/workouts.js",
  "js/storage.js",
  "js/history.js",
  "js/goals.js",
  "js/edit.js",
  "js/backup.js",
  "js/sortable.js",
  "js/icons.js",
  "js/theme.js",
  "js/timer.js",
  "js/app.js",
  "js/pwa.js",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-maskable-512.png",
  "icons/apple-touch-icon.png",
  "icons/favicon-32.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(VERSION)
      // cache: "reload" pula o cache HTTP do navegador: guarda a versão nova de verdade
      .then((cache) => cache.addAll(ASSETS.map((u) => new Request(u, { cache: "reload" }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("treino-") && k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  if (new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(
    caches.open(VERSION).then(async (cache) => {
      let hit = await cache.match(req, { ignoreSearch: true });
      if (!hit && req.mode === "navigate") hit = await cache.match("index.html");
      return hit || fetch(req);
    })
  );
});
