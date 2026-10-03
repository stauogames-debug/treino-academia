// PWA: manifest, ícones, service worker (sw.js) e registro (js/pwa.js).
// O jsdom não roda service worker de verdade; aqui provamos o que dá para
// provar sem celular: arquivos e metadados corretos, lista de cache completa e
// atualizada, comportamento do sw.js num ambiente simulado, e que nada disso
// atrapalha o app nem toca nos dados. Instalar e abrir offline: teste à mão.
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { test, withApp, ROOT } = require("./harness");
const tool = require(path.join(ROOT, "tools/atualizar-sw.js"));

const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const exists = (f) => fs.existsSync(path.join(ROOT, f));
const INDEX = read("index.html");
const SW = read("sw.js");
const PWA = read("js/pwa.js");
const MANIFEST = JSON.parse(read("manifest.webmanifest"));
const ASSETS = tool.lerAssets(SW);

function png(f) {
  const b = fs.readFileSync(path.join(ROOT, f));
  assert.equal(b.slice(1, 4).toString(), "PNG", f + " não é PNG");
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20), colorType: b[25] };
}
const tem = (colorType) => colorType === 4 || colorType === 6; // com canal alfa (transparência)

// ---------- manifest ----------
test("pwa: manifest tem nome, modo standalone, caminhos relativos e cores do app", () => {
  assert.equal(MANIFEST.name, "Treino da Semana");
  assert.ok(MANIFEST.short_name && MANIFEST.short_name.length <= 12, "nome curto para a tela inicial");
  assert.equal(MANIFEST.display, "standalone");
  assert.equal(MANIFEST.lang, "pt-BR");
  assert.equal(MANIFEST.start_url, "./");
  assert.equal(MANIFEST.scope, "./");
  const meta = /<meta name="theme-color" content="(#[0-9A-Fa-f]{6})"/.exec(INDEX);
  assert.ok(meta, "meta theme-color no index.html");
  assert.equal(MANIFEST.theme_color.toLowerCase(), meta[1].toLowerCase());
  assert.equal(MANIFEST.background_color.toLowerCase(), meta[1].toLowerCase());
});

test("pwa: ícones do manifest existem, têm o tamanho declarado e há um 'maskable'", () => {
  const purposes = [];
  for (const ic of MANIFEST.icons) {
    assert.ok(exists(ic.src), "arquivo não existe: " + ic.src);
    assert.ok(!ic.src.startsWith("/") && !/^https?:/.test(ic.src), "caminho precisa ser relativo: " + ic.src);
    const [w, h] = ic.sizes.split("x").map(Number);
    const p = png(ic.src);
    assert.deepEqual([p.w, p.h], [w, h], ic.src);
    assert.equal(ic.type, "image/png");
    purposes.push(ic.purpose);
  }
  assert.ok(MANIFEST.icons.some((i) => i.sizes === "192x192" && i.purpose === "any"), "192 'any'");
  assert.ok(MANIFEST.icons.some((i) => i.sizes === "512x512" && i.purpose === "any"), "512 'any'");
  assert.ok(purposes.includes("maskable"), "ícone maskable");
});

test("pwa: ícones sangrados (maskable e Apple) não têm transparência; o apple-touch-icon é 180x180", () => {
  const mask = MANIFEST.icons.find((i) => i.purpose === "maskable");
  assert.equal(tem(png(mask.src).colorType), false, "maskable precisa preencher tudo (sem cantos transparentes)");
  const a = png("icons/apple-touch-icon.png");
  assert.deepEqual([a.w, a.h], [180, 180]);
  assert.equal(tem(a.colorType), false, "o iPhone pinta transparência de preto");
  assert.deepEqual([png("icons/favicon-32.png").w, png("icons/favicon-32.png").h], [32, 32]);
});

// ---------- index.html ----------
test("pwa: index.html liga manifest, ícones e o registro do service worker (sem quebrar a ordem dos scripts)", () => {
  assert.match(INDEX, /<link rel="manifest" href="manifest\.webmanifest">/);
  assert.match(INDEX, /<link rel="apple-touch-icon" href="icons\/apple-touch-icon\.png">/);
  assert.match(INDEX, /<link rel="icon"[^>]*href="icons\/favicon-32\.png"/);
  assert.match(INDEX, /apple-mobile-web-app-capable/);
  assert.match(INDEX, /mobile-web-app-capable/);
  const scripts = [...INDEX.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(scripts[scripts.length - 1], "js/pwa.js", "pwa.js por último: se falhar, o app já carregou");
  assert.ok(scripts.indexOf("js/app.js") < scripts.indexOf("js/pwa.js"));
  assert.ok(scripts.indexOf("js/timer.js") < scripts.indexOf("js/app.js"), "ordem existente preservada");
});

// ---------- lista de cache ----------
test("pwa: sw.js lista, em caminhos relativos, TODOS os arquivos que o app usa e todos existem", () => {
  assert.equal(new Set(ASSETS).size, ASSETS.length, "item repetido em ASSETS");
  for (const a of ASSETS) {
    assert.ok(!a.startsWith("/") && !/^https?:/.test(a), "caminho absoluto quebra em subpasta (GitHub Pages): " + a);
    assert.ok(a === "./" || exists(a), "não existe: " + a);
  }
  const usados = [
    ...[...INDEX.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1]),
    ...[...INDEX.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)].map((m) => m[1]),
    ...[...INDEX.matchAll(/<link rel="(?:icon|apple-touch-icon|manifest)"[^>]*href="([^"]+)"/g)].map((m) => m[1]),
    ...MANIFEST.icons.map((i) => i.src),
    "index.html", "manifest.webmanifest"
  ];
  for (const u of usados) assert.ok(ASSETS.includes(u), "falta no cache offline: " + u);
  assert.ok(ASSETS.includes("./"), "a raiz ('./') precisa estar no cache para o ícone abrir offline");
});

test("pwa: todo arquivo de js/ e css/ (exceto os de teste) está na lista de cache", () => {
  const walk = (dir) => fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(dir + "/" + e.name) : [dir + "/" + e.name]);
  const arquivos = [...walk("js"), ...walk("css")];
  assert.ok(arquivos.length >= 12);
  for (const f of arquivos) assert.ok(ASSETS.includes(f), "arquivo do app fora do cache: " + f);
});

test("pwa: VERSION do sw.js corresponde ao conteúdo dos arquivos (senão: node tools/atualizar-sw.js)", () => {
  const esperado = tool.calcularVersao(SW);
  assert.equal(tool.versaoAtual(SW), esperado,
    "o app mudou e o sw.js não: o celular continuaria com os arquivos antigos. Rode:  node tools/atualizar-sw.js");
  assert.match(esperado, /^treino-[0-9a-f]{12}$/);
});

test("pwa: a versão muda quando um arquivo muda (e só nesse caso)", () => {
  const lista = ASSETS.filter((a) => a !== "./");
  assert.equal(tool.calcularVersao(SW), tool.calcularVersao(SW), "estável");
  const orig = fs.readFileSync(path.join(ROOT, "css/styles.css"));
  try {
    fs.writeFileSync(path.join(ROOT, "css/styles.css"), Buffer.concat([orig, Buffer.from("\n/* x */")]));
    assert.notEqual(tool.calcularVersao(SW), tool.versaoAtual(SW));
  } finally {
    fs.writeFileSync(path.join(ROOT, "css/styles.css"), orig);
  }
  assert.equal(tool.calcularVersao(SW), tool.versaoAtual(SW));
  assert.ok(lista.length > 10);
});

// ---------- sw.js num ambiente simulado ----------
const BASE = "https://exemplo.github.io/APP-Treino/sw.js";
const abs = (u) => new URL(typeof u === "string" ? u : u.url, BASE).href;
function criarSW() {
  const eventos = {};
  const abertos = new Map(); // nome -> { itens: Map(url->resposta), addAllArgs }
  const log = { deleted: [], skipWaiting: 0, claim: 0, fetched: [] };
  const self = {
    location: { origin: "https://exemplo.github.io" },
    addEventListener: (t, fn) => { eventos[t] = fn; },
    skipWaiting: () => { log.skipWaiting++; return Promise.resolve(); },
    clients: { claim: () => { log.claim++; return Promise.resolve(); } }
  };
  const abrir = (nome) => {
    if (!abertos.has(nome)) abertos.set(nome, { itens: new Map(), requests: [] });
    const c = abertos.get(nome);
    return {
      addAll: async (reqs) => { c.requests = reqs; reqs.forEach((r) => c.itens.set(r.url, "cache:" + r.url)); },
      match: async (req, opts) => {
        let url = abs(req);
        if (opts && opts.ignoreSearch) url = url.split("?")[0];
        return c.itens.has(url) ? c.itens.get(url) : undefined;
      }
    };
  };
  const caches = {
    open: async (n) => abrir(n),
    keys: async () => [...abertos.keys()],
    delete: async (n) => { log.deleted.push(n); abertos.delete(n); return true; }
  };
  class Request { constructor(url, init) { this.url = abs(url); this.cache = init && init.cache; } }
  const sandbox = { self, caches, Request, URL, fetch: async (r) => { log.fetched.push(r.url || r); return "rede:" + (r.url || r); }, Promise };
  vm.createContext(sandbox);
  vm.runInContext(SW, sandbox, { filename: "sw.js" });
  const VERSION = vm.runInContext("VERSION", sandbox);
  const disparar = async (tipo, ev) => { eventos[tipo](ev); return ev; };
  return { eventos, abertos, caches, log, VERSION, disparar, abrir, vm: sandbox };
}

test("sw: instalar guarda todos os arquivos (ignorando o cache HTTP) e ativa a nova versão", async () => {
  const s = criarSW();
  const ev = await s.disparar("install", { waitUntil(p) { this.p = p; } });
  await ev.p;
  const c = s.abertos.get(s.VERSION);
  assert.ok(c, "cache com a versão atual");
  assert.equal(JSON.stringify(c.requests.map((r) => r.url)), JSON.stringify(ASSETS.map(abs))); // (JSON: objetos vêm de outro contexto do vm)
  assert.ok(c.requests.every((r) => r.cache === "reload"), "cache: reload");
  assert.equal(s.log.skipWaiting, 1);
});

test("sw: ativar apaga só caches antigos do app (treino-*) e assume as páginas abertas", async () => {
  const s = criarSW();
  s.abrir("treino-antiga111"); s.abrir("treino-antiga222"); s.abrir("de-outro-site"); s.abrir(s.VERSION);
  const ev = await s.disparar("activate", { waitUntil(p) { this.p = p; } });
  await ev.p;
  assert.equal(JSON.stringify(s.log.deleted.sort()), JSON.stringify(["treino-antiga111", "treino-antiga222"]));
  assert.ok(s.abertos.has("de-outro-site") && s.abertos.has(s.VERSION));
  assert.equal(s.log.claim, 1);
});

test("sw: abrir offline — arquivo guardado vem do cache; navegação desconhecida cai no index.html", async () => {
  const s = criarSW();
  await (await s.disparar("install", { waitUntil(p) { this.p = p; } })).p;
  const origem = "https://exemplo.github.io/APP-Treino/";
  const pedido = async (req) => { const ev = await s.disparar("fetch", { request: req, respondWith(p) { this.p = p; } }); return ev.p ? await ev.p : undefined; };

  assert.equal(await pedido({ method: "GET", url: origem + "css/styles.css", mode: "no-cors" }), "cache:" + origem + "css/styles.css");
  assert.equal(await pedido({ method: "GET", url: origem + "js/app.js?v=3", mode: "no-cors" }), "cache:" + origem + "js/app.js", "ignora ?query");
  assert.equal(await pedido({ method: "GET", url: origem + "treino-qualquer", mode: "navigate" }), "cache:" + origem + "index.html");
  assert.equal(s.log.fetched.length, 0, "nada foi buscado na rede");
  // o que não está no cache (e não é navegação) vai para a rede
  assert.equal(await pedido({ method: "GET", url: origem + "algo-novo.json", mode: "no-cors" }), "rede:" + origem + "algo-novo.json");
});

test("sw: não interfere em POST nem em outros sites (deixa o navegador resolver)", async () => {
  const s = criarSW();
  await (await s.disparar("install", { waitUntil(p) { this.p = p; } })).p;
  const ev1 = await s.disparar("fetch", { request: { method: "POST", url: "https://exemplo.github.io/x", mode: "no-cors" }, respondWith(p) { this.p = p; } });
  assert.equal(ev1.p, undefined);
  const ev2 = await s.disparar("fetch", { request: { method: "GET", url: "https://outro.com/lib.js", mode: "no-cors" }, respondWith(p) { this.p = p; } });
  assert.equal(ev2.p, undefined);
});

test("pwa: sw.js e pwa.js nunca tocam nos dados do usuário (localStorage, storage, IndexedDB)", () => {
  const semComentarios = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
  for (const [nome, src] of [["sw.js", SW], ["js/pwa.js", PWA]]) {
    assert.doesNotMatch(semComentarios(src), /localStorage|sessionStorage|indexedDB|window\.storage|treino:/, nome);
  }
});

// ---------- registro (js/pwa.js) ----------
function rodarPwa({ protocolo, host, registrar, semSW }) {
  const ouvintes = {};
  const chamadas = [];
  const nav = semSW ? {} : { serviceWorker: { register: (...a) => { chamadas.push(a); return registrar ? registrar() : Promise.resolve({}); } } };
  const sandbox = { navigator: nav, location: { protocol: protocolo, hostname: host }, window: { addEventListener: (t, fn) => { ouvintes[t] = fn; } } };
  vm.createContext(sandbox);
  vm.runInContext(PWA, sandbox, { filename: "pwa.js" });
  if (ouvintes.load) ouvintes.load();
  return { chamadas, ouvintes };
}

test("pwa.js: registra sw.js em HTTPS e em localhost, mas só depois do load", () => {
  const r = rodarPwa({ protocolo: "https:", host: "exemplo.github.io" });
  assert.ok(r.ouvintes.load, "espera o load da página");
  assert.equal(JSON.stringify(r.chamadas), JSON.stringify([["sw.js"]]));
  assert.equal(rodarPwa({ protocolo: "http:", host: "localhost" }).chamadas.length, 1);
  assert.equal(rodarPwa({ protocolo: "http:", host: "127.0.0.1" }).chamadas.length, 1);
});

test("pwa.js: em arquivo local (file://), HTTP comum ou navegador sem suporte, não registra nem dá erro", () => {
  assert.equal(rodarPwa({ protocolo: "file:", host: "" }).chamadas.length, 0);
  assert.equal(rodarPwa({ protocolo: "http:", host: "192.168.0.10" }).chamadas.length, 0);
  assert.equal(rodarPwa({ protocolo: "https:", host: "x.io", semSW: true }).chamadas.length, 0);
});

test("pwa.js: falha ao registrar (rejeição ou exceção) é ignorada", async () => {
  const r = rodarPwa({ protocolo: "https:", host: "x.io", registrar: () => Promise.reject(new Error("bloqueado")) });
  await new Promise((res) => setTimeout(res, 10));
  assert.equal(r.chamadas.length, 1);
  assert.doesNotThrow(() => rodarPwa({ protocolo: "https:", host: "x.io", registrar: () => { throw new Error("boom"); } }));
});

// ---------- o app continua igual ----------
test("pwa (tela): com as tags novas o app abre normal, sem erro de JS e sem service worker em arquivo local", () =>
  withApp(async (c) => {
    assert.ok(c.$("link[rel=manifest]"));
    assert.ok(c.$(".set-input"));
    assert.equal(c.w.navigator.serviceWorker, undefined);
    await c.typeLoad("seg_ex0_s0", "20");
    assert.equal(c.store.json("treino:seg").seg_ex0_s0[0].weight, 20);
  }));
