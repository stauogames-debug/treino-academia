// Infra dos testes: carrega o app de verdade (index.html + js/*.js) dentro do
// jsdom, com um storage falso em memória, e oferece helpers para mexer na tela.
const { JSDOM, VirtualConsole } = require("jsdom");
const path = require("path");
const vm = require("vm");
const fs = require("fs");

const ROOT = path.join(__dirname, "..");
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitFor(fn, msg, timeout = 4000) {
  const t0 = Date.now();
  for (;;) {
    let v;
    try { v = fn(); } catch (e) { v = null; }
    if (v) return v;
    if (Date.now() - t0 > timeout) throw new Error("timeout esperando: " + msg);
    await wait(10);
  }
}

// ---------- registro de testes ----------
const registry = [];
function test(name, fn) { registry.push({ name, fn }); }

// ---------- núcleo (sem DOM) para testes unitários ----------
function loadCore() {
  const sandbox = { console, Date, Math, JSON, Object, Array, Promise, setTimeout, clearTimeout };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  ["js/data/workouts.js", "js/storage.js", "js/history.js", "js/goals.js", "js/edit.js", "js/backup.js", "js/sortable.js"].forEach((f) => {
    vm.runInContext(fs.readFileSync(path.join(ROOT, f), "utf8"), sandbox, { filename: f });
  });
  return sandbox.Treino;
}

// ---------- storage falso (imita o window.storage: get rejeita se não existe) ----------
function makeStore(seed) {
  const map = new Map(Object.entries(seed || {}).map(([k, v]) => [k, typeof v === "string" ? v : JSON.stringify(v)]));
  const failRead = new Set();
  const failWrite = new Set();
  const api = {
    get: async (k) => {
      if (failRead.has(k)) throw new Error("falha de leitura " + k);
      if (!map.has(k)) throw new Error("chave não existe");
      return { key: k, value: map.get(k), shared: false };
    },
    set: async (k, v) => {
      if (failWrite.has(k)) throw new Error("falha de escrita " + k);
      map.set(k, v);
      return { key: k, value: v, shared: false };
    },
    delete: async (k) => { map.delete(k); return { key: k, deleted: true, shared: false }; },
    list: async (prefix) => ({ keys: [...map.keys()].filter((k) => !prefix || k.startsWith(prefix)) })
  };
  return {
    map, failRead, failWrite, api,
    json: (k) => (map.has(k) ? JSON.parse(map.get(k)) : undefined),
    snapshot: () => JSON.stringify([...map.entries()].sort())
  };
}

function todayLocal() {
  const d = new Date();
  const p = (n) => (n < 10 ? "0" : "") + n;
  return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
}

// ---------- abre o app ----------
async function openApp(opts = {}) {
  const store = opts.store || makeStore(opts.seed);
  const log = { alerts: [], confirms: [], prompts: [], downloads: [], errors: [] };
  const answers = {
    confirm: opts.confirm || (() => true),
    prompt: opts.prompt || (() => null)
  };
  const vc = new VirtualConsole();
  vc.on("jsdomError", (e) => { if (!/Not implemented/.test(e.message)) log.errors.push(String(e.message)); });

  const dom = await JSDOM.fromFile(path.join(ROOT, "index.html"), {
    runScripts: "dangerously",
    resources: "usable",
    pretendToBeVisual: true,
    virtualConsole: vc,
    beforeParse(win) {
      win.storage = store.api;
      win.alert = (m) => { log.alerts.push(String(m)); };
      win.confirm = (m) => { log.confirms.push(String(m)); return answers.confirm(String(m), log.confirms.length); };
      win.prompt = (m) => { log.prompts.push(String(m)); return answers.prompt(String(m), log.prompts.length); };
      win.Blob = class { constructor(parts) { this.text = parts.join(""); } };
      win.URL.createObjectURL = (b) => { log.downloads.push({ text: b.text, name: null }); return "blob:teste"; };
      win.URL.revokeObjectURL = () => {};
      win.HTMLAnchorElement.prototype.click = function () {
        const last = log.downloads[log.downloads.length - 1];
        if (last && !last.name) last.name = this.download;
      };
    }
  });
  const w = dom.window;
  const d = w.document;
  await new Promise((r) => (d.readyState === "complete" ? r() : w.addEventListener("load", r)));

  const $ = (s, root) => (root || d).querySelector(s);
  const $$ = (s, root) => Array.from((root || d).querySelectorAll(s));

  const ctx = {
    w, d, $, $$, store, log, answers, wait, waitFor,
    T: w.Treino,
    idle: (ms = 40) => wait(ms),
    readyNormal: () => waitFor(() => $("#body .exercise:not(.edit-exercise)"), "modo normal renderizado"),
    readyEdit: () => waitFor(() => $(".edit-exercise"), "editor renderizado"),

    change(el, value) {
      el.value = value;
      el.dispatchEvent(new w.Event("change", { bubbles: true }));
    },
    click(el) { el.dispatchEvent(new w.Event("click", { bubbles: true, cancelable: true })); },

    input(key, field) {
      return $((field === "repsDone" ? ".reps-input" : ".set-input") + '[data-key="' + key + '"]');
    },
    async typeLoad(key, value, field = "weight") {
      ctx.change(ctx.input(key, field), value);
      await ctx.idle();
    },
    exercise(name) {
      return $$("#body .exercise").find((e) => {
        const head = $(".ex-head", e);
        return head && head.childNodes[0] && head.childNodes[0].textContent.trim() === name;
      });
    },
    firstPlaceholder(name) { return $(".set-input", ctx.exercise(name)).placeholder; },
    setPlaceholders(name) { return $$(".set-input", ctx.exercise(name)).map((i) => i.placeholder); },

    async setDate(v) { ctx.change($("#dt"), v); await ctx.readyNormal(); },
    async tab(i) { ctx.click($$(".tab")[i]); await ctx.readyNormal(); },

    async openEditor() { ctx.click($("#editToggle")); await ctx.readyEdit(); },
    async saveEditor() { ctx.click($("#saveEdit")); await ctx.readyNormal(); },
    names: () => $$(".ex-name-input").map((i) => i.value),
    setReps: (exIdx) => $$(".edit-exercise")[exIdx] ? $$(".set-edit-input", $$(".edit-exercise")[exIdx]).map((i) => i.value) : [],
    dirtyTabs: () => $$(".tab.dirty").length,

    // Backup
    async importFile(text) {
      const file = new w.File([text], "backup.json", { type: "application/json" });
      const input = $("#importFile");
      Object.defineProperty(input, "files", { value: [file], configurable: true });
      input.dispatchEvent(new w.Event("change", { bubbles: true }));
      await ctx.idle(150);
    },

    // ----- arraste (jsdom não tem layout: simulamos as posições) -----
    stubLayout() {
      $$(".edit-exercise").forEach((el, i) => {
        el.getBoundingClientRect = () => ({ top: i * 110, height: 100, bottom: i * 110 + 100, left: 0, right: 400, width: 400 });
      });
      $$(".edit-set-row").forEach((el) => {
        const rows = $$(".edit-set-row", el.closest(".edit-exercise"));
        const j = rows.indexOf(el);
        el.getBoundingClientRect = () => ({ top: j * 40, height: 40, bottom: j * 40 + 40, left: 0, right: 400, width: 400 });
      });
    },
    pointer(type, y, target) {
      const e = new w.Event(type, { bubbles: true, cancelable: true });
      Object.assign(e, { clientY: y, pointerId: 1, pointerType: "touch", button: 0 });
      target.dispatchEvent(e);
    },
    // kind: "ex" | "set". Arrasta o item "from" até cair na posição "to".
    async drag(kind, from, to, o = {}) {
      ctx.stubLayout();
      const card = kind === "set" ? $$(".edit-exercise")[o.ex || 0] : null;
      const handles = kind === "ex" ? $$(".drag-ex") : $$(".drag-set", card);
      const step = kind === "ex" ? 110 : 40;
      const h = kind === "ex" ? 100 : 40;
      const center = (i) => i * step + h / 2;
      const others = handles.map((_, i) => i).filter((i) => i !== from).map(center); // centros dos outros
      let y;
      if (to <= 0) y = others[0] - 5;
      else if (to >= others.length) y = others[others.length - 1] + 5;
      else y = (others[to - 1] + others[to]) / 2;
      const hd = handles[from];
      ctx.pointer("pointerdown", center(from), hd);
      ctx.pointer("pointermove", y, hd);
      await ctx.idle(60);
      ctx.pointer(o.cancel ? "pointercancel" : "pointerup", y, hd);
      await ctx.idle(10);
    },

    close() { try { w.close(); } catch (e) {} }
  };

  await ctx.readyNormal();
  return ctx;
}

// Abre o app, roda o teste e garante que a página não lançou erros de JS.
async function withApp(opts, fn) {
  if (typeof opts === "function") { fn = opts; opts = {}; }
  const ctx = await openApp(opts);
  try {
    await fn(ctx);
    if (ctx.log.errors.length) throw new Error("erros de JS na página: " + ctx.log.errors.join(" | "));
  } finally {
    ctx.close();
  }
}

module.exports = { test, registry, loadCore, makeStore, openApp, withApp, wait, waitFor, todayLocal, ROOT };
