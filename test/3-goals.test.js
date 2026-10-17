// Meta por exercício (dupla progressão) — testes escritos ANTES do goals.js,
// a partir da especificação do Prompt-Treino.md.
const assert = require("node:assert/strict");
const { test, withApp, loadCore } = require("./harness");
const T = loadCore();
const norm = (x) => JSON.parse(JSON.stringify(x));
const eq = (a, b, m) => assert.deepStrictEqual(norm(a), norm(b), m);

const HOJE = "2026-06-30";
const D1 = "2026-06-10", D2 = "2026-06-17", D3 = "2026-06-24"; // D3 = mais recente
// Exercício: 2 aquecimentos numéricos + 2 séries de trabalho (faixas).
const ex = (sets) => ({ id: "e1", name: "X", ref: "", sets: sets || [{ id: "a", reps: "15" }, { id: "b", reps: "10" }, { id: "c", reps: "6 a 8" }, { id: "d", reps: "6 a 8" }] });
// Sessão nas séries de trabalho c e d: [carga, reps] de cada uma.
const sess = (date, c, d) => ({ [date]: { c, d } });
function hist(...sessoes) {
  const h = {};
  sessoes.forEach((s) => Object.keys(s).forEach((date) => {
    Object.keys(s[date]).forEach((id) => {
      const [w, r] = s[date][id];
      (h["e1_" + id] = h["e1_" + id] || []).push({ date, weight: w, repsDone: String(r) });
    });
  }));
  return h;
}
const goal = (h, o = {}) => T.suggestGoal(o.ex || ex(), h, o.hoje || HOJE, o.step === undefined ? 2 : o.step);

test("meta: passos padrão (+2 kg push/pull/upper, +5 kg legs/lower)", () => {
  eq(T.STEP_KG, { seg: 2, ter: 2, qui: 2, qua: 5, sex: 5 });
});

test("meta: sem histórico, sem faixa de reps ou só aquecimento → nenhuma meta", () => {
  assert.equal(goal({}), null);
  assert.equal(goal(undefined), null);
  const soNumericas = ex([{ id: "a", reps: "15" }, { id: "b", reps: "10" }, { id: "c", reps: "8" }]);
  const h = { e1_a: [{ date: D1, weight: 10, repsDone: "15" }, { date: D2, weight: 10, repsDone: "15" }], e1_c: [{ date: D1, weight: 20, repsDone: "8" }, { date: D2, weight: 20, repsDone: "8" }] };
  assert.equal(T.suggestGoal(soNumericas, h, HOJE, 2), null);
  const umaSerie = ex([{ id: "c", reps: "8" }]);
  assert.equal(T.suggestGoal(umaSerie, { e1_c: [{ date: D1, weight: 20, repsDone: "8" }, { date: D2, weight: 20, repsDone: "8" }] }, HOJE, 2), null);
});

test("meta: só 1 sessão completa → nenhuma meta (melhor nada do que meta ruim)", () => {
  assert.equal(goal(hist(sess(D2, [25, 8], [25, 8]))), null);
});

test("meta: sessão incompleta (falta reps, falta carga ou falta uma série de trabalho) não conta", () => {
  const h = hist(sess(D1, [25, 8], [25, 8]), sess(D2, [25, 8], [25, 8]));
  assert.notEqual(goal(h), null, "controle: 2 sessões completas dão meta");
  const semRepsNaD2 = norm(h); semRepsNaD2.e1_d = semRepsNaD2.e1_d.map((e) => (e.date === D2 ? { date: D2, weight: 25 } : e));
  assert.equal(goal(semRepsNaD2), null, "reps feitas ausentes");
  const semCarga = norm(h); semCarga.e1_c = semCarga.e1_c.map((e) => (e.date === D2 ? { date: D2, repsDone: "8" } : e));
  assert.equal(goal(semCarga), null, "carga ausente");
  const semSerie = norm(h); semSerie.e1_d = semSerie.e1_d.filter((e) => e.date !== D2);
  assert.equal(goal(semSerie), null, "só uma das séries de trabalho anotada");
  const repsTexto = norm(h); repsTexto.e1_c = repsTexto.e1_c.map((e) => (e.date === D2 ? { date: D2, weight: 25, repsDone: "falha" } : e));
  assert.equal(goal(repsTexto), null, "reps não numéricas");
});

test("meta: 2 sessões batendo o topo da faixa com a mesma carga → sobe UM degrau e volta ao piso", () => {
  const h = hist(sess(D2, [25, 8], [25, 8]), sess(D3, [25, 8], [25, 8]));
  eq(goal(h), { weight: 27, reps: 6, kind: "up" });
  eq(goal(h, { step: 5 }), { weight: 30, reps: 6, kind: "up" }, "legs/lower: +5 kg");
});

test("meta: passar do topo (9 reps em '6 a 8') também conta como topo", () => {
  eq(goal(hist(sess(D2, [25, 9], [25, 8]), sess(D3, [25, 8], [25, 10]))), { weight: 27, reps: 6, kind: "up" });
});

test("meta: dentro da faixa mas sem bater o topo em todas → mesma carga, +1 rep na série mais fraca", () => {
  eq(goal(hist(sess(D2, [25, 6], [25, 6]), sess(D3, [25, 7], [25, 6]))), { weight: 25, reps: 7, kind: "reps" });
  // a mais fraca é a que está mais longe do topo; +1 nunca passa do topo
  eq(goal(hist(sess(D2, [25, 7], [25, 7]), sess(D3, [25, 8], [25, 7]))), { weight: 25, reps: 8, kind: "reps" });
});

test("meta: só a 2ª sessão bateu o topo (a mais antiga não) → ainda não sobe", () => {
  const g = goal(hist(sess(D2, [25, 7], [25, 8]), sess(D3, [25, 8], [25, 8])));
  assert.equal(g.kind, "reps");
  assert.equal(g.weight, 25);
});

test("meta: carga mudou entre as sessões → não sobe de novo; reps caírem por causa de carga maior não é 'queda'", () => {
  eq(goal(hist(sess(D2, [23, 8], [23, 8]), sess(D3, [25, 8], [25, 8]))), { weight: 25, reps: 8, kind: "reps" });
  eq(goal(hist(sess(D2, [23, 8], [23, 8]), sess(D3, [25, 6], [25, 6]))), { weight: 25, reps: 7, kind: "reps" });
});

test("meta: reps caíram de uma sessão para a outra (mesma carga) → mantém a carga, sem aumento", () => {
  const g = goal(hist(sess(D2, [25, 8], [25, 8]), sess(D3, [25, 7], [25, 7])));
  eq(g, { weight: 25, reps: 7, kind: "hold" });
});

test("meta: 2 sessões seguidas abaixo do piso → mantém a carga e sugere o piso", () => {
  eq(goal(hist(sess(D2, [25, 5], [25, 5]), sess(D3, [25, 5], [25, 4]))), { weight: 25, reps: 6, kind: "hold" });
});

test("meta: reps caíram duas vezes seguidas (3 sessões, mesma carga) → reduz um degrau", () => {
  eq(goal(hist(sess(D1, [25, 8], [25, 8]), sess(D2, [25, 7], [25, 7]), sess(D3, [25, 6], [25, 6]))), { weight: 23, reps: 6, kind: "down" });
  eq(goal(hist(sess(D1, [40, 8], [40, 8]), sess(D2, [40, 7], [40, 7]), sess(D3, [40, 6], [40, 6])), { step: 5 }), { weight: 35, reps: 6, kind: "down" });
});

test("meta: nunca sugere aumento (nem carga negativa) quando está em queda", () => {
  const g = goal(hist(sess(D1, [2, 8], [2, 8]), sess(D2, [2, 7], [2, 7]), sess(D3, [2, 6], [2, 6])));
  assert.equal(g.kind, "hold", "reduzir 2 kg de 2 kg zeraria a carga: mantém");
  assert.equal(g.weight, 2);
  for (const h of [hist(sess(D2, [25, 8], [25, 8]), sess(D3, [25, 7], [25, 7])), hist(sess(D2, [25, 5], [25, 5]), sess(D3, [25, 5], [25, 5]))]) {
    assert.ok(goal(h).weight <= 25);
  }
});

test("meta: usa a carga da última série de trabalho da sessão mais recente como base", () => {
  const g = goal(hist(sess(D2, [25, 8], [27, 8]), sess(D3, [25, 8], [27, 8])));
  eq(g, { weight: 29, reps: 6, kind: "up" }, "séries com cargas diferentes, mesmas nas duas sessões");
});

test("meta: só usa datas ESTRITAMENTE anteriores à data exibida", () => {
  const h = hist(sess(D2, [25, 8], [25, 8]), sess(D3, [25, 8], [25, 8]), sess(HOJE, [99, 1], [99, 1]), sess("2026-07-05", [99, 1], [99, 1]));
  eq(goal(h), { weight: 27, reps: 6, kind: "up" });
  assert.equal(goal(h, { hoje: D3 }), null, "vendo D3: só resta 1 sessão anterior");
});

test("meta: funciona por id — reordenar o exercício ou as séries não muda o resultado", () => {
  const h = hist(sess(D2, [25, 8], [25, 8]), sess(D3, [25, 8], [25, 8]));
  const reord = ex([{ id: "d", reps: "6 a 8" }, { id: "b", reps: "10" }, { id: "c", reps: "6 a 8" }, { id: "a", reps: "15" }]);
  eq(T.suggestGoal(reord, h, HOJE, 2), { weight: 27, reps: 6, kind: "up" });
  const outroId = Object.assign(ex(), { id: "outro" });
  assert.equal(T.suggestGoal(outroId, h, HOJE, 2), null, "exercício trocado (id novo) começa sem meta");
});

test("meta: faixas diferentes por série ('6 a 10') usam o topo de cada série", () => {
  const e = ex([{ id: "c", reps: "10" }, { id: "d", reps: "6 a 10" }]);
  const h = { e1_d: [{ date: D2, weight: 8, repsDone: "10" }, { date: D3, weight: 8, repsDone: "10" }] };
  eq(T.suggestGoal(e, h, HOJE, 2), { weight: 10, reps: 6, kind: "up" });
  const h2 = { e1_d: [{ date: D2, weight: 8, repsDone: "8" }, { date: D3, weight: 8, repsDone: "9" }] };
  eq(T.suggestGoal(e, h2, HOJE, 2), { weight: 8, reps: 10, kind: "reps" });
});

test("meta: não altera o histórico nem o exercício recebidos", () => {
  const h = hist(sess(D2, [25, 8], [25, 8]), sess(D3, [25, 8], [25, 8]));
  const e = ex();
  const antes = JSON.stringify([h, e]);
  goal(h, { ex: e });
  assert.equal(JSON.stringify([h, e]), antes);
});

test("meta: formatGoal monta o texto discreto", () => {
  eq(T.formatGoal({ weight: 27, reps: 6, kind: "up" }), { text: "Meta hoje: 27 kg × 6", note: "subir a carga" });
  eq(T.formatGoal({ weight: 22.5, reps: 7, kind: "reps" }), { text: "Meta hoje: 22.5 kg × 7", note: "+1 rep" });
  eq(T.formatGoal({ weight: 25, reps: 7, kind: "hold" }), { text: "Meta hoje: 25 kg × 7", note: "manter a carga" });
  eq(T.formatGoal({ weight: 23, reps: 6, kind: "down" }), { text: "Meta hoje: 23 kg × 6", note: "reduzir um degrau" });
});

// ---------- na tela ----------

const dois = (id, w, r) => ({ [id + "_s3"]: [{ date: "2020-01-10", weight: w, repsDone: r }, { date: "2020-01-17", weight: w, repsDone: r }], [id + "_s4"]: [{ date: "2020-01-10", weight: w, repsDone: r }, { date: "2020-01-17", weight: w, repsDone: r }] });

test("meta (tela): aparece no exercício certo, no modo normal, e não aparece no editor", () =>
  withApp({ seed: { "treino:seg": dois("seg_ex0", 25, "8") } }, async (c) => {
    const g = c.$(".ex-goal", c.exercise("Desenvolvimento com halteres"));
    assert.ok(g, "linha de meta presente");
    assert.match(g.textContent, /Meta hoje: 27 kg × 6/);
    assert.equal(c.$$(".ex-goal").length, 1, "só esse exercício tem histórico");
    await c.openEditor();
    assert.equal(c.$(".ex-goal"), null);
  }));

test("meta (tela): legs/lower usa +5 kg", () =>
  withApp({ seed: { "treino:qua": dois("qua_ex0", 40, "8") } }, async (c) => {
    await c.tab(2);
    assert.match(c.$(".ex-goal", c.exercise("Cadeira extensora")).textContent, /Meta hoje: 45 kg × 6/);
  }));

test("meta (tela): acompanha o exercício depois de reordenar por arraste; trocar exercício zera a meta", () =>
  withApp({ seed: { "treino:seg": dois("seg_ex0", 25, "8") } }, async (c) => {
    await c.openEditor();
    await c.drag("ex", 0, 1);
    await c.saveEditor();
    assert.match(c.$(".ex-goal", c.exercise("Desenvolvimento com halteres")).textContent, /27 kg × 6/);
    assert.equal(c.$$("#body .ex-head")[1].textContent.indexOf("Desenvolvimento com halteres"), 0);
  }));

test("meta (tela): trocar exercício (id novo) não herda a meta", () =>
  withApp({ prompt: () => "Supino declinado", seed: { "treino:seg": dois("seg_ex0", 25, "8") } }, async (c) => {
    await c.openEditor();
    c.click(c.$$(".swap-ex")[0]);
    await c.saveEditor();
    assert.equal(c.$$(".ex-goal").length, 0);
  }));

test("meta (tela): usa a data exibida — vendo uma data antiga, sem sessões anteriores, não há meta", () =>
  withApp({ seed: { "treino:seg": dois("seg_ex0", 25, "8") } }, async (c) => {
    await c.setDate("2020-01-17");
    assert.equal(c.$$(".ex-goal").length, 0);
    await c.setDate("2020-02-01");
    assert.equal(c.$$(".ex-goal").length, 1);
  }));

test("meta (tela): histórico corrompido não quebra a tela nem mostra meta", () =>
  withApp({ seed: { "treino:seg": "{corrompido" } }, async (c) => {
    assert.equal(c.$$(".ex-goal").length, 0);
    assert.ok(c.$(".daywarn"));
  }));
