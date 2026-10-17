// Gráfico de evolução (aba "Evolução"). Escritos ANTES do código.
// Regras: só séries de trabalho (faixa); só cargas numéricas; só datas até hoje;
// até 12 datas mais recentes; por id; e a tela é só leitura (não grava nada).
const assert = require("node:assert/strict");
const { test, withApp, makeStore, loadCore, waitFor, todayLocal } = require("./harness");
const T = loadCore();
const norm = (x) => JSON.parse(JSON.stringify(x));
const eq = (a, b, m) => assert.deepStrictEqual(norm(a), norm(b), m);

const HOJE = "2026-06-30";
const ex = (sets) => ({ id: "e1", name: "X", ref: "", sets: sets || [
  { id: "a", reps: "15" }, { id: "b", reps: "10" }, { id: "c", reps: "6 a 8" }, { id: "d", reps: "6 a 8" }
] });
const hist = () => ({
  e1_c: [{ date: "2026-06-10", weight: 20, repsDone: "8" }, { date: "2026-06-17", weight: 22.5 }],
  e1_d: [{ date: "2026-06-10", weight: 18 }],
  e1_a: [{ date: "2026-06-10", weight: 99 }]   // aquecimento: não entra
});

// ---------- dados (função pura) ----------
test("evolução (unit): só séries de trabalho (faixa) entram; aquecimento numérico fica de fora", () => {
  const d = T.evolucaoDados(ex(), hist(), HOJE);
  eq(d.sets.map((s) => s.id), ["c", "d"]);
  eq(d.sets.map((s) => s.label), ["S3", "S4"]);
});

test("evolução (unit): pontos ordenados por data, só com carga numérica", () => {
  const h = hist();
  h.e1_c.push({ date: "2026-06-24", repsDone: "9" });   // só reps: não vira ponto nem data
  const d = T.evolucaoDados(ex(), h, HOJE);
  eq(d.sets[0].points, [{ date: "2026-06-10", weight: 20 }, { date: "2026-06-17", weight: 22.5 }]);
  eq(d.sets[1].points, [{ date: "2026-06-10", weight: 18 }]);
  eq(d.datas, ["2026-06-10", "2026-06-17"], "a data só de reps não aparece no eixo");
});

test("evolução (unit): datas futuras são ignoradas", () => {
  const h = hist();
  h.e1_c.push({ date: "2026-07-05", weight: 50 });
  const d = T.evolucaoDados(ex(), h, HOJE);
  assert.ok(!d.datas.includes("2026-07-05"));
  assert.ok(!d.sets[0].points.some((p) => p.weight === 50));
});

test("evolução (unit): no máximo as 12 datas mais recentes", () => {
  const h = { e1_c: [] };
  for (let i = 1; i <= 15; i++) h.e1_c.push({ date: "2026-06-" + String(i).padStart(2, "0"), weight: 20 });
  const d = T.evolucaoDados(ex(), h, HOJE);
  assert.equal(d.datas.length, 12);
  assert.equal(d.datas[0], "2026-06-04");
  assert.equal(d.datas[11], "2026-06-15");
});

test("evolução (unit): usa ids — reordenar o exercício não muda o resultado", () => {
  const e = ex([{ id: "d", reps: "6 a 8" }, { id: "c", reps: "6 a 8" }]);
  const d = T.evolucaoDados(e, hist(), HOJE);
  eq(d.sets.map((s) => s.id), ["d", "c"]);
  eq(d.sets[1].points, [{ date: "2026-06-10", weight: 20 }, { date: "2026-06-17", weight: 22.5 }]);
});

test("evolução (unit): sem histórico ou sem exercício não dá erro e devolve vazio", () => {
  eq(T.evolucaoDados(ex(), undefined, HOJE), { sets: [{ id: "c", label: "S3", reps: "6 a 8", points: [] }, { id: "d", label: "S4", reps: "6 a 8", points: [] }], datas: [] });
  eq(T.evolucaoDados(null, hist(), HOJE), { sets: [], datas: [] });
});

// ---------- gráfico (SVG) ----------
test("evolução (unit): sem pontos o SVG é vazio", () => {
  assert.equal(T.svgEvolucao({ sets: [{ id: "c", label: "S3", reps: "6 a 8", points: [] }], datas: [] }), "");
});

test("evolução (unit): uma polilinha por série com 2+ pontos; uma bolinha por ponto; cores por classe, sem hex", () => {
  const d = T.evolucaoDados(ex(), hist(), HOJE);
  const svg = T.svgEvolucao(d);
  assert.match(svg, /^<svg /);
  assert.equal((svg.match(/<polyline /g) || []).length, 1, "só a série c tem 2 pontos");
  assert.equal((svg.match(/<circle /g) || []).length, 3, "2 bolinhas em c + 1 em d");
  assert.match(svg, /evo-s0/);
  assert.match(svg, /evo-s1/);
  assert.doesNotMatch(svg, /#[0-9a-fA-F]{3,6}\b/, "cor fixa no SVG: use as classes/tokens");
  assert.doesNotMatch(svg, /NaN|undefined/);
});

test("evolução (unit): uma só data e carga igual não geram NaN nem quebram", () => {
  const d = T.evolucaoDados(ex([{ id: "c", reps: "6 a 8" }]), { e1_c: [{ date: "2026-06-10", weight: 20 }] }, HOJE);
  const svg = T.svgEvolucao(d);
  assert.match(svg, /<circle /);
  assert.doesNotMatch(svg, /NaN|Infinity/);
});

// ---------- tela ----------
const SEED = () => ({
  "treino:seg": {
    seg_ex0_s3: [{ date: "2020-01-10", weight: 20, repsDone: "8" }, { date: "2020-01-17", weight: 22.5 }],
    seg_ex0_s4: [{ date: "2020-01-10", weight: 18 }, { date: "2020-01-17", weight: 18 }]
  }
});
const abrirEvolucao = async (c) => {
  c.click(c.$("#tabEvo"));
  await waitFor(() => c.$(".evo-ex"), "lista da evolução");
};

test("evolução (tela): a aba fica depois de Sex e a lista traz os exercícios de todos os dias", () =>
  withApp(async (c) => {
    await abrirEvolucao(c);
    assert.equal(c.$$(".tab")[5].id, "tabEvo");
    assert.equal(c.$$(".evo-ex").length, 32, "7+6+6+7+6 exercícios");
    assert.equal(c.$(".set-input"), null, "sem campos de carga na tela de evolução");
    assert.equal(c.$("#dt"), null, "sem barra de data");
  }));

test("evolução (tela): abrir um exercício mostra gráfico com legenda das séries de trabalho", () =>
  withApp({ seed: SEED() }, async (c) => {
    await abrirEvolucao(c);
    c.click(c.$$(".evo-ex")[0]);
    await waitFor(() => c.$(".evo-detail svg"), "gráfico");
    const det = c.$(".evo-detail");
    assert.equal((det.querySelectorAll("polyline")).length, 2);
    assert.match(det.querySelector(".evo-legend").textContent, /S4/);
    assert.match(det.querySelector(".evo-legend").textContent, /S5/);
  }));

test("evolução (tela): sem cargas anotadas mostra a mensagem, sem gráfico", () =>
  withApp(async (c) => {
    await abrirEvolucao(c);
    c.click(c.$$(".evo-ex")[0]);
    await waitFor(() => c.$(".evo-detail .hint"), "mensagem");
    assert.match(c.$(".evo-detail").textContent, /Ainda não há cargas/);
    assert.equal(c.$(".evo-detail svg"), null);
  }));

test("evolução (tela): datas futuras não aparecem no gráfico", () =>
  withApp({ seed: { "treino:seg": { seg_ex0_s3: [{ date: "2099-01-01", weight: 99 }] } } }, async (c) => {
    await abrirEvolucao(c);
    c.click(c.$$(".evo-ex")[0]);
    await waitFor(() => c.$(".evo-detail .hint"), "mensagem");
    assert.equal(c.$(".evo-detail svg"), null);
  }));

test("evolução (tela): histórico ilegível de um dia só afeta esse dia", () =>
  withApp({ seed: { ...SEED(), "treino:ter": "{corrompido" } }, async (c) => {
    await abrirEvolucao(c);
    assert.equal(c.$$(".evo-warn").length, 1);
    assert.equal(c.$$(".evo-ex").length, 26, "os exercícios de Ter (6) somem; os outros continuam");
  }));

test("evolução (tela): só leitura — abrir a aba e os gráficos não grava nada", () =>
  withApp({ seed: SEED() }, async (c) => {
    const antes = c.store.snapshot();
    await abrirEvolucao(c);
    c.click(c.$$(".evo-ex")[0]);
    await waitFor(() => c.$(".evo-detail svg"), "gráfico");
    await c.idle(50);
    assert.equal(c.store.snapshot(), antes);
  }));

test("evolução (tela): voltar a um dia restaura o modo normal e não inicia o descanso", () =>
  withApp({ seed: SEED() }, async (c) => {
    await abrirEvolucao(c);
    c.click(c.$$(".tab")[0]);
    await c.readyNormal();
    assert.equal(c.$("#dayTitle").textContent, "Segunda - Push");
    assert.ok(c.$(".set-input"));
    assert.equal(c.w.Treino.timerState().mode, "idle");
  }));

test("evolução (tela): a aba não aparece durante a edição do treino", () =>
  withApp(async (c) => {
    await c.openEditor();
    assert.equal(c.$("#tabEvo"), null);
  }));