// Copiar cargas da última sessão para a data exibida. Escritos ANTES do código.
// Regras: copia só a CARGA (nunca reps feitas), por série, da última carga
// anotada em data estritamente anterior; só preenche o que está vazio.
const assert = require("node:assert/strict");
const { test, withApp, makeStore, loadCore, waitFor } = require("./harness");
const T = loadCore();
const norm = (x) => JSON.parse(JSON.stringify(x));
const eq = (a, b, m) => assert.deepStrictEqual(norm(a), norm(b), m);
const toast = (c) => c.$("#toast").textContent;

const eff = () => T.effectiveDay(T.DAYS[0], null); // seg: seg_ex0 (5 séries s0..s4), ...
const HOJE = "2020-02-01";

// ---------- função pura ----------
test("copiar última (unit): pega a carga mais recente ANTERIOR à data, por série", () => {
  const h = {
    seg_ex0_s0: [{ date: "2020-01-10", weight: 20, repsDone: "10" }, { date: "2020-01-17", weight: 22.5, repsDone: "9" }, { date: HOJE, weight: 99 }, { date: "2020-03-01", weight: 77 }],
    seg_ex0_s1: [{ date: "2020-01-10", weight: 15 }]
  };
  const r = T.copyLastLoads(eff(), { ...h, seg_ex0_s0: h.seg_ex0_s0.filter((e) => e.date !== HOJE) }, HOJE);
  assert.equal(r.copied, 2);
  eq(r.hist.seg_ex0_s0.find((e) => e.date === HOJE), { date: HOJE, weight: 22.5 });
  eq(r.hist.seg_ex0_s1.find((e) => e.date === HOJE), { date: HOJE, weight: 15 });
  assert.ok(!r.hist.seg_ex0_s0.some((e) => e.weight === 77 && e.date === HOJE), "futuras nunca são usadas");
});

test("copiar última (unit): NÃO copia reps feitas", () => {
  const r = T.copyLastLoads(eff(), { seg_ex0_s0: [{ date: "2020-01-10", weight: 20, repsDone: "10" }] }, HOJE);
  eq(r.hist.seg_ex0_s0.find((e) => e.date === HOJE), { date: HOJE, weight: 20 });
});

test("copiar última (unit): ignora registros sem carga e usa a anterior que tem", () => {
  const h = { seg_ex0_s0: [{ date: "2020-01-10", weight: 18 }, { date: "2020-01-20", repsDone: "8" }] };
  const r = T.copyLastLoads(eff(), h, HOJE);
  eq(r.hist.seg_ex0_s0.find((e) => e.date === HOJE), { date: HOJE, weight: 18 });
});

test("copiar última (unit): não sobrescreve carga já anotada hoje; preserva reps de hoje quando só falta a carga", () => {
  const h = {
    seg_ex0_s0: [{ date: "2020-01-10", weight: 20 }, { date: HOJE, weight: 30, repsDone: "6" }],
    seg_ex0_s1: [{ date: "2020-01-10", weight: 15 }, { date: HOJE, repsDone: "8" }]
  };
  const r = T.copyLastLoads(eff(), h, HOJE);
  assert.equal(r.copied, 1);
  eq(r.hist.seg_ex0_s0.find((e) => e.date === HOJE), { date: HOJE, weight: 30, repsDone: "6" });
  eq(r.hist.seg_ex0_s1.find((e) => e.date === HOJE), { date: HOJE, weight: 15, repsDone: "8" });
});

test("copiar última (unit): nada a copiar → copied 0 e histórico igual; não altera o original", () => {
  const h = { seg_ex0_s0: [{ date: "2020-03-01", weight: 20 }] }; // só futura
  const antes = JSON.stringify(h);
  const r = T.copyLastLoads(eff(), h, HOJE);
  assert.equal(r.copied, 0);
  eq(r.hist, h);
  assert.equal(T.copyLastLoads(eff(), {}, HOJE).copied, 0);
  assert.equal(T.copyLastLoads(eff(), undefined, HOJE).copied, 0);
  const h2 = { seg_ex0_s0: [{ date: "2020-01-10", weight: 20 }] };
  const antes2 = JSON.stringify(h2);
  T.copyLastLoads(eff(), h2, HOJE);
  assert.equal(JSON.stringify(h2), antes2, "função pura");
  assert.equal(JSON.stringify(h), antes);
});

test("copiar última (unit): só chaves da estrutura atual (órfãs ficam como estão) e funciona por id após reordenar", () => {
  const e = eff();
  e.exercises.reverse();
  const h = { seg_ex0_s0: [{ date: "2020-01-10", weight: 20 }], "99_9": [{ date: "2020-01-10", weight: 5 }], velho_s0: [{ date: "2020-01-10", weight: 6 }] };
  const r = T.copyLastLoads(e, h, HOJE);
  assert.equal(r.copied, 1);
  eq(r.hist["99_9"], h["99_9"]);
  eq(r.hist.velho_s0, h.velho_s0);
});

test("copiar última (unit): respeita o limite de 30 registros por série", () => {
  const arr = [];
  for (let i = 1; i <= 30; i++) arr.push({ date: "2020-01-" + String(i).padStart(2, "0"), weight: i });
  const r = T.copyLastLoads(eff(), { seg_ex0_s0: arr }, HOJE);
  assert.equal(r.hist.seg_ex0_s0.length, 30);
  assert.equal(r.hist.seg_ex0_s0[29].date, HOJE);
  assert.equal(r.hist.seg_ex0_s0[29].weight, 30);
});

// ---------- na tela ----------
const seed = () => ({
  "treino:seg": {
    seg_ex0_s0: [{ date: "2020-01-10", weight: 20, repsDone: "10" }, { date: "2020-01-17", weight: 22.5, repsDone: "9" }],
    seg_ex0_s1: [{ date: "2020-01-17", weight: 15, repsDone: "8" }],
    seg_ex1_s0: [{ date: "2020-01-17", weight: 40, repsDone: "12" }]
  }
});

test("copiar última (tela): preenche só os campos de carga, deixa reps vazias e grava", () =>
  withApp({ seed: seed() }, async (c) => {
    await c.setDate(HOJE);
    c.click(c.$("#copyLast"));
    await waitFor(() => toast(c) === "3 cargas copiadas", "toast");
    assert.equal(c.input("seg_ex0_s0", "weight").value, "22.5");
    assert.equal(c.input("seg_ex0_s1", "weight").value, "15");
    assert.equal(c.input("seg_ex1_s0", "weight").value, "40");
    assert.equal(c.input("seg_ex0_s0", "repsDone").value, "");
    const salvo = c.store.json("treino:seg");
    eq(salvo.seg_ex0_s0.find((e) => e.date === HOJE), { date: HOJE, weight: 22.5 });
    // o histórico antigo continua intacto
    assert.equal(salvo.seg_ex0_s0.length, 3);
    assert.equal(salvo.seg_ex0_s0[1].repsDone, "9");
  }));

test("copiar última (tela): não sobrescreve o que o usuário já digitou hoje", () =>
  withApp({ seed: seed() }, async (c) => {
    await c.setDate(HOJE);
    await c.typeLoad("seg_ex0_s0", "30");
    c.click(c.$("#copyLast"));
    await waitFor(() => toast(c) === "2 cargas copiadas", "toast");
    assert.equal(c.input("seg_ex0_s0", "weight").value, "30");
    assert.equal(c.input("seg_ex0_s1", "weight").value, "15");
  }));

test("copiar última (tela): depois de copiar dá para editar carga e reps normalmente; segundo clique não tem nada novo", () =>
  withApp({ seed: seed() }, async (c) => {
    await c.setDate(HOJE);
    c.click(c.$("#copyLast"));
    await waitFor(() => toast(c) === "3 cargas copiadas", "toast");
    await c.typeLoad("seg_ex0_s0", "9", "repsDone");
    await c.typeLoad("seg_ex0_s0", "24");
    eq(c.store.json("treino:seg").seg_ex0_s0.find((e) => e.date === HOJE), { date: HOJE, weight: 24, repsDone: "9" });
    c.click(c.$("#copyLast"));
    await waitFor(() => toast(c) === "Nada para copiar", "nada novo");
  }));

test("copiar última (tela): sem histórico anterior → 'Nada para copiar' e nada é gravado", () =>
  withApp(async (c) => {
    const antes = c.store.snapshot();
    c.click(c.$("#copyLast"));
    await waitFor(() => toast(c) === "Nada para copiar", "toast");
    assert.equal(c.store.snapshot(), antes);
  }));

test("copiar última (tela): usa a data exibida — só enxerga datas anteriores a ela", () =>
  withApp({ seed: seed() }, async (c) => {
    await c.setDate("2020-01-12");
    c.click(c.$("#copyLast"));
    await waitFor(() => toast(c) === "1 carga copiada", "toast singular");
    assert.equal(c.input("seg_ex0_s0", "weight").value, "20", "pega a de 10/01 e ignora a de 17/01 (futura)");
  }));

test("copiar última (tela): histórico ilegível → sem botão e nada é gravado", () => {
  const store = makeStore(seed());
  store.failRead.add("treino:seg");
  return withApp({ store }, async (c) => {
    assert.ok(c.$(".daywarn"));
    assert.equal(c.$("#copyLast"), null);
  });
});

test("copiar última (tela): falha ao gravar → 'Erro ao salvar' e os campos não ficam como se estivessem salvos", () => {
  const store = makeStore(seed());
  return withApp({ store }, async (c) => {
    await c.setDate(HOJE);
    store.failWrite.add("treino:seg");
    c.click(c.$("#copyLast"));
    await waitFor(() => toast(c) === "Erro ao salvar", "toast de erro");
    assert.equal(c.input("seg_ex0_s0", "weight").value, "");
    assert.equal(c.store.json("treino:seg").seg_ex0_s0.length, 2);
  });
});

test("copiar última (tela): botão com ícone SVG, só no modo normal; copiar não mexe em outros dias", () =>
  withApp({ seed: { ...seed(), "treino:ter": { ter_ex0_s0: [{ date: "2020-01-10", weight: 9 }] } } }, async (c) => {
    assert.ok(c.$("#copyLast").querySelector("svg"));
    assert.doesNotMatch(c.$("#copyLast").textContent, /[\u{1F300}-\u{1FAFF}\u2600-\u27BF]/u);
    const ter = c.store.map.get("treino:ter");
    await c.setDate(HOJE);
    c.click(c.$("#copyLast"));
    await waitFor(() => toast(c) === "3 cargas copiadas", "toast");
    assert.equal(c.store.map.get("treino:ter"), ter);
    await c.openEditor();
    assert.equal(c.$("#copyLast"), null);
  }));

test("copiar última (tela): a meta e a 'última' continuam usando só sessões anteriores (carga copiada não vira sessão)", () =>
  withApp({ seed: seed() }, async (c) => {
    await c.setDate(HOJE);
    c.click(c.$("#copyLast"));
    await waitFor(() => toast(c) === "3 cargas copiadas", "toast");
    assert.match(c.$(".set-reps small").textContent, /última: 22.5kg × 9 reps \(01-17\)/);
    assert.equal(c.$$(".ex-goal").length, 0);
  }));
