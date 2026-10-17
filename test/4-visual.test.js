// Fase A (visual): tema escuro/claro, ícones SVG, cores de carga x reps.
// O jsdom não desenha nada, então aqui testamos o que dá para provar sem olhar:
// os tokens de cor do CSS (contraste WCAG, paridade dos dois temas), os ícones,
// a persistência do tema e o contrato do markup (ids/aria) — o comportamento
// em si continua coberto pelos testes 1–3.
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { test, withApp, makeStore, loadCore, waitFor, ROOT } = require("./harness");

const CSS = fs.readFileSync(path.join(ROOT, "css/styles.css"), "utf8");

// ---------- utilidades de cor ----------
function block(re){ const m = re.exec(CSS); assert.ok(m, "bloco não encontrado: " + re); return m[1]; }
function tokens(text){ const o = {}; text.replace(/--([a-z0-9-]+)\s*:\s*([^;]+);/g, (_, k, v) => { o[k] = v.trim(); return ""; }); return o; }
const DARK = tokens(block(/:root\s*\{([^}]*)\}/));
const LIGHT = tokens(block(/:root\[data-theme="light"\]\s*\{([^}]*)\}/));
const rgb = (hex) => { const h = hex.replace("#", ""); assert.match(h, /^[0-9a-fA-F]{6}$/, "cor hex de 6 dígitos esperada: " + hex); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)); };
const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
const lum = (hex) => { const [r, g, b] = rgb(hex); return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b); };
const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const hue = (hex) => { let [r, g, b] = rgb(hex).map((v) => v / 255); const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; if (!d) return 0; let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return (h * 60 + 360) % 360; };
const hueGap = (a, b) => { const d = Math.abs(hue(a) - hue(b)); return Math.min(d, 360 - d); };

const THEMES = { escuro: DARK, claro: LIGHT };

test("visual: os dois temas definem exatamente os mesmos tokens de cor", () => {
  assert.deepEqual(Object.keys(LIGHT).sort(), Object.keys(DARK).sort());
  assert.ok(Object.keys(DARK).length > 40, "tokens suficientes");
});

test("visual: todo var(--x) usado no CSS existe nos dois temas", () => {
  const usados = new Set();
  CSS.replace(/var\(--([a-z0-9-]+)/g, (_, k) => { usados.add(k); return ""; });
  for (const k of usados) {
    assert.ok(k in DARK, "falta no escuro: --" + k);
    assert.ok(k in LIGHT, "falta no claro: --" + k);
  }
});

test("visual: o CSS não usa cores fixas fora dos blocos de tema (tudo via token)", () => {
  const semTemas = CSS.replace(/:root\s*\{[^}]*\}/, "").replace(/:root\[data-theme="light"\]\s*\{[^}]*\}/, "");
  const fixas = semTemas.match(/#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)/g) || [];
  // exceções: cor do marcador de alteração e da linha de soltar (mesma nos dois temas) e sombras
  const permitidas = fixas.filter((c) => !/^#E0A800$/i.test(c) && !/^rgba\(0,\s*0,\s*0/.test(c));
  assert.deepEqual(permitidas, [], "cores fixas encontradas: " + permitidas.join(", "));
});

// [primeiro plano, fundo, mínimo]. 4.5 = texto normal (WCAG AA); 3 = placeholder/detalhe.
const PARES = [
  ["text", "surface"], ["text", "app-bg"], ["text-muted", "surface"], ["text-muted", "surface-2"], ["text-muted", "app-bg"],
  ["text-faint", "surface"], ["text-faint", "app-bg"], ["hdr-text", "hdr-bg"], ["hdr-sub", "hdr-bg"],
  ["tab-text", "tab-bg"], ["tab-active-text", "tab-active-bg"], ["bar-label", "bar-bg"],
  ["head-text", "head-bg"], ["head-sub", "head-bg"], ["goal", "head-bg"], ["goal-note", "head-bg"],
  ["on-accent", "accent-bg"], ["accent", "app-bg"], ["accent", "surface"], ["accent", "accent-soft"],
  ["load-text", "load-bg"], ["load-unit", "load-bg"], ["reps-text", "reps-bg"],
  ["input-text", "input-bg"], ["danger-text", "danger-bg"], ["info-text", "info-bg"], ["warn-text", "surface"],
  ["load-placeholder", "load-bg", 3], ["reps-placeholder", "reps-bg", 3], ["input-placeholder", "input-bg", 3],
  // temporizador de descanso
  ["timer-text", "timer-bg"], ["timer-muted", "timer-bg"], ["timer-run", "timer-bg"],
  ["timer-chip-text", "timer-chip-bg"], ["timer-done-text", "timer-done-bg"]
];
for (const [nome, T] of Object.entries(THEMES)) {
  test("visual: contraste WCAG dos pares texto/fundo no tema " + nome, () => {
    const falhas = [];
    for (const [fg, bg, min = 4.5] of PARES) {
      const c = contrast(T[fg], T[bg]);
      if (c < min) falhas.push("--" + fg + " (" + T[fg] + ") sobre --" + bg + " (" + T[bg] + ") = " + c.toFixed(2) + " < " + min);
    }
    assert.deepEqual(falhas, []);
  });
}

for (const [nome, T] of Object.entries(THEMES)) {
  test("visual: campo de CARGA e campo de REPS são visualmente distintos no tema " + nome, () => {
    assert.ok(hueGap(T["load-bg"], T["reps-bg"]) >= 60, "matiz do fundo muito parecido");
    assert.ok(hueGap(T["load-border"], T["reps-border"]) >= 60, "matiz da borda muito parecido");
    assert.notEqual(T["load-bg"].toLowerCase(), T["reps-bg"].toLowerCase());
    assert.notEqual(T["load-border"].toLowerCase(), T["reps-border"].toLowerCase());
    // e ambos se distinguem da superfície do cartão onde ficam
    assert.notEqual(T["load-bg"].toLowerCase(), T["surface"].toLowerCase());
    assert.notEqual(T["reps-bg"].toLowerCase(), T["surface"].toLowerCase());
  });
}

test("visual: os inputs de carga e reps usam os tokens próprios (não o input genérico)", () => {
  assert.match(CSS, /\.set-input\s*\{[^}]*var\(--load-bg\)/);
  assert.match(CSS, /\.reps-input\s*\{[^}]*var\(--reps-bg\)/);
  assert.match(CSS, /\.set-unit\s*\{[^}]*var\(--load-unit\)/);
});

test("visual: alvos de toque dos botões de ícone têm pelo menos 40px", () => {
  const m = /\.icon-btn\s*\{([^}]*)\}/.exec(CSS);
  assert.ok(m);
  const w = /width:\s*(\d+)px/.exec(m[1]), h = /height:\s*(\d+)px/.exec(m[1]);
  assert.ok(w && +w[1] >= 40 && h && +h[1] >= 40);
});

// ---------- ícones ----------
test("ícones: todos os nomes usados existem, são SVG decorativos e herdam a cor (currentColor)", () => {
  const T = loadCore();
  const nomes = ["edit", "x", "trash", "repeat", "grip", "plus", "download", "upload", "sun", "moon"];
  for (const n of nomes) {
    const s = T.icon(n);
    assert.match(s, /^<svg /, n);
    assert.match(s, /aria-hidden="true"/, n);
    assert.match(s, /currentColor/, n);
    assert.doesNotMatch(s, /#[0-9a-f]{3,6}\b/i, n + ": sem cor fixa");
    assert.match(s, /viewBox="0 0 24 24"/, n);
  }
  assert.equal(T.icon("nao-existe"), "");
});

// ---------- tema ----------
const tema = (c) => c.d.documentElement.getAttribute("data-theme");

test("tema: começa escuro e o botão do cabeçalho oferece o claro (com rótulo acessível)", () =>
  withApp(async (c) => {
    assert.equal(tema(c), "dark");
    const b = c.$("#themeToggle");
    assert.ok(b);
    assert.match(b.getAttribute("aria-label"), /claro/i);
    assert.ok(b.querySelector("svg"));
    assert.equal(c.$('meta[name="theme-color"]').getAttribute("content").toLowerCase(), DARK["app-bg"].toLowerCase());
  }));

test("tema: alternar troca o tema, o ícone, o rótulo, a cor do navegador e grava a preferência", () =>
  withApp(async (c) => {
    const icone = c.$("#themeToggle svg").getAttribute("class");
    c.click(c.$("#themeToggle"));
    await c.idle();
    assert.equal(tema(c), "light");
    assert.equal(c.store.map.get("treino:theme"), "light");
    assert.notEqual(c.$("#themeToggle svg").getAttribute("class"), icone);
    assert.match(c.$("#themeToggle").getAttribute("aria-label"), /escuro/i);
    assert.equal(c.$('meta[name="theme-color"]').getAttribute("content").toLowerCase(), LIGHT["hdr-bg"].toLowerCase());
    c.click(c.$("#themeToggle"));
    await c.idle();
    assert.equal(tema(c), "dark");
    assert.equal(c.store.map.get("treino:theme"), "dark");
  }));

test("tema: a escolha é lembrada ao reabrir o app", async () => {
  const store = makeStore({ "treino:theme": "light" });
  await withApp({ store }, async (c) => {
    await waitFor(() => tema(c) === "light", "tema claro aplicado");
    assert.match(c.$("#themeToggle").getAttribute("aria-label"), /escuro/i);
  });
});

test("tema: valor guardado inválido ou falha de leitura → fica no escuro, sem erro", async () => {
  await withApp({ seed: { "treino:theme": "roxo" } }, async (c) => { await c.idle(80); assert.equal(tema(c), "dark"); });
  const store = makeStore({ "treino:theme": "light" });
  store.failRead.add("treino:theme");
  await withApp({ store }, async (c) => { await c.idle(80); assert.equal(tema(c), "dark"); assert.equal(c.log.alerts.length, 0); });
});

test("tema: se o usuário troca ANTES da leitura lenta terminar, a leitura tardia não desfaz a escolha", () => {
  const store = makeStore({ "treino:theme": "dark" });
  store.delay.set("treino:theme", 250);
  return withApp({ store }, async (c) => {
    c.click(c.$("#themeToggle"));                 // escolhe claro enquanto a leitura ainda está em andamento
    assert.equal(tema(c), "light");
    await c.idle(500);
    assert.equal(tema(c), "light", "a leitura atrasada ('dark') não pode sobrescrever");
    assert.equal(c.store.map.get("treino:theme"), "light");
  });
});

test("tema: falha ao gravar a preferência não impede a troca nem mostra alerta", () => {
  const store = makeStore();
  store.failWrite.add("treino:theme");
  return withApp({ store }, async (c) => {
    c.click(c.$("#themeToggle"));
    await c.idle();
    assert.equal(tema(c), "light");
    assert.equal(c.log.alerts.length, 0);
  });
});

test("tema: sobrevive à troca de aba e não mexe no editor aberto (rascunho e ● preservados)", () =>
  withApp(async (c) => {
    c.click(c.$("#themeToggle")); await c.idle();
    await c.tab(1);
    assert.equal(tema(c), "light");
    assert.match(c.$("#themeToggle").getAttribute("aria-label"), /escuro/i, "botão recriado no tema certo");
    await c.tab(0);
    await c.openEditor();
    c.change(c.$$(".ex-name-input")[0], "Nome mudado");
    c.click(c.$("#themeToggle")); await c.idle();
    assert.equal(tema(c), "dark");
    assert.equal(c.names()[0], "Nome mudado");
    assert.equal(c.dirtyTabs(), 1);
  }));

test("tema: é preferência do aparelho — não entra no backup e a importação não a altera", async () => {
  let texto;
  await withApp({ seed: { "treino:theme": "light", "treino:seg": { seg_ex0_s0: [{ date: "2020-01-10", weight: 20 }] } } }, async (c) => {
    c.click(c.$("#exportBackup"));
    await waitFor(() => c.log.downloads.length, "download");
    texto = c.log.downloads[0].text;
    assert.doesNotMatch(texto, /theme|light|dark/i);
  });
  await withApp({ seed: { "treino:theme": "dark" } }, async (c) => {
    await c.importFile(texto);
    await waitFor(() => c.$("#toast").textContent === "Backup importado", "importado");
    assert.equal(c.store.map.get("treino:theme"), "dark");
    assert.equal(tema(c), "dark");
  });
});

// ---------- contrato do markup ----------
test("markup: botões só de ícone têm rótulo acessível e o SVG não captura o toque", () =>
  withApp(async (c) => {
    await c.openEditor();
    const so = [...c.$$(".icon-btn"), ...c.$$(".drag-handle"), c.$("#themeToggle")];
    assert.ok(so.length > 20);
    for (const el of so) {
      assert.ok(el.getAttribute("aria-label"), "sem aria-label: " + el.className);
      assert.ok(el.querySelector("svg"), "sem ícone: " + el.className);
    }
    assert.match(CSS, /\.drag-handle svg[^{]*\{[^}]*pointer-events:\s*none/, "arrastar pelo ícone não pode perder o toque");
  }));

test("markup: botão de editar mostra lápis e, com o editor aberto, 'fechar'", () =>
  withApp(async (c) => {
    const antes = c.$("#editToggle");
    assert.match(antes.textContent, /Editar treino/);
    assert.match(antes.querySelector("svg").getAttribute("class"), /ic-edit/);
    await c.openEditor();
    assert.match(c.$("#editToggle").textContent, /Fechar edição/);
    assert.match(c.$("#editToggle").querySelector("svg").getAttribute("class"), /ic-x/);
    c.click(c.$("#editToggle"));
    assert.match(c.$("#editToggle").textContent, /Editar treino/);
    assert.match(c.$("#editToggle").querySelector("svg").getAttribute("class"), /ic-edit/);
  }));

test("markup: sem emojis/glifos soltos nos botões e no status do dia (ícones são SVG)", () =>
  withApp(async (c) => {
    const glifo = /[\u{1F300}-\u{1FAFF}\u2600-\u27BF\u2B00-\u2BFF\u2800-\u28FF\u2190-\u21FF]|✏|✖|⬇|⬆|🗑|🔄/u;
    const texto = () => [...c.$$("button, .drag-handle, .daystatus")].map((e) => e.textContent).join("|");
    assert.doesNotMatch(texto(), glifo, "modo normal");
    await c.openEditor();
    assert.doesNotMatch(texto(), glifo, "editor");
  }));

test("markup: status do dia continua informando editado/padrão", () =>
  withApp({ seed: { "treino:edit:seg": { full: "X", exercises: [{ id: "seg_ex0", name: "A", sets: [{ id: "s0", reps: "8" }] }] } } }, async (c) => {
    assert.match(c.$(".daystatus").textContent, /Treino editado/);
    await c.tab(1);
    assert.match(c.$(".daystatus").textContent, /Treino padrão/);
  }));
