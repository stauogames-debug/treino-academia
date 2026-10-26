// Modo descanso: testes escritos antes da implementação.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test, loadCore, withApp, makeStore, waitFor, ROOT } = require("./harness");
const T = loadCore();
const slugs = ["seg", "ter", "qua", "qui", "sex"];
const backup = (version, days, descanso) => ({ app: "treino-da-semana", version, exportedAt: "2026-10-14T12:00:00.000Z", days, ...(descanso === undefined ? {} : { descanso }) });
const norm = (x) => JSON.parse(JSON.stringify(x));

test("descanso: funções puras ordenam, deduplicam, são idempotentes e não mutam a origem", () => {
  const sandbox = { Date, Array, Object, JSON };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(ROOT, "js/descanso.js"), "utf8"), sandbox);
  const D = sandbox.window.Treino;
  const original = ["2026-12-25", "2026-10-14", "2026-10-14"];
  const snapshot = [...original];
  assert.equal(D.isDescanso(original, "2026-10-14"), true);
  assert.deepEqual(norm(D.addDescanso(original, "2026-10-14")), ["2026-10-14", "2026-12-25"]);
  assert.deepEqual(norm(D.addDescanso(original, "2026-11-01")), ["2026-10-14", "2026-11-01", "2026-12-25"]);
  assert.deepEqual(norm(D.removeDescanso(original, "2026-10-14")), ["2026-12-25"]);
  assert.deepEqual(original, snapshot);
});

test("descanso: marcar e desmarcar a data exibida alterna o cartão e os exercícios", () =>
  withApp(async (c) => {
    await waitFor(() => c.$("#markRest"), "botão de descanso");
    c.click(c.$("#markRest"));
    await waitFor(() => c.$("#body .rest-day"), "cartão de descanso");
    assert.match(c.$("#body").textContent, /Dia de descanso/);
    assert.equal(c.$("#body .exercise"), null);
    assert.equal(c.$("#copyLast"), null);
    assert.ok(c.$("#backupLast"), "painel de backup permanece visível");
    assert.equal(c.$("#markRest").textContent.trim(), "Remover descanso");
    assert.deepEqual(c.store.json("treino:descanso"), [c.$("#dt").value]);
    c.click(c.$("#markRest"));
    await waitFor(() => c.$("#body .exercise"), "exercícios de volta");
    assert.equal(c.store.json("treino:descanso").length, 0);
  }));

test("descanso: vale para a data ISO independente da aba selecionada", () =>
  withApp(async (c) => {
    const data = c.$("#dt").value;
    c.click(c.$("#markRest"));
    await c.idle();
    c.click(c.$$(".tab[data-day]")[1]);
    await waitFor(() => c.$("#body .rest-day"), "descanso na outra aba");
    assert.equal(c.$("#dt").value, data);
    assert.ok(c.$("#body .rest-day"));
  }));

test("descanso: confirmar remoção da marcação permite gravar carga e reps", () =>
  withApp({ confirm: () => true }, async (c) => {
    const input = c.input("seg_ex0_s0", "weight");
    c.click(c.$("#markRest")); await c.idle();
    const date = c.$("#dt").value;
    const key = "seg_ex0_s0";
    input.value = "20";
    input.dispatchEvent(new c.w.Event("change", { bubbles: true }));
    await c.idle();
    assert.match(c.log.confirms.at(-1), /marcado como descanso/i);
    assert.equal(c.store.json("treino:descanso").includes(date), false);
    assert.equal(c.store.json("treino:seg")[key][0].weight, 20);
    await waitFor(() => c.$("#body .exercise"), "lista após remover descanso");
    assert.equal(c.$("#body .rest-day"), null);
  }));

test("descanso: cancelar confirmação não grava, mantém marcação, restaura campo e não inicia timer", () =>
  withApp({ confirm: () => false }, async (c) => {
    const input = c.input("seg_ex0_s0", "repsDone");
    c.click(c.$("#markRest")); await c.idle();
    const date = c.$("#dt").value;
    const key = "seg_ex0_s0";
    const before = c.store.snapshot();
    input.value = "12";
    input.dispatchEvent(new c.w.Event("change", { bubbles: true }));
    await c.idle();
    assert.equal(c.store.snapshot(), before);
    assert.deepEqual(c.store.json("treino:descanso"), [date]);
    assert.equal(input.value, "");
    assert.equal(c.T.timerState().mode, "idle");
  }));

test("descanso: exportar e copiar incluem datas de descanso no backup v2", async () => {
  await withApp(async (c) => {
    c.click(c.$("#markRest")); await c.idle();
    c.click(c.$("#exportBackup"));
    await waitFor(() => c.log.downloads.length, "backup exportado");
    const out = JSON.parse(c.log.downloads[0].text);
    assert.equal(out.version, 2);
    assert.deepEqual(out.descanso, c.store.json("treino:descanso"));
    let copiedText = "";
    Object.defineProperty(c.w.navigator, "clipboard", { value: { writeText: async (text) => { copiedText = text; } }, configurable: true });
    c.click(c.$("#copyBackup"));
    await waitFor(() => copiedText, "backup copiado");
    assert.deepEqual(JSON.parse(copiedText).descanso, c.store.json("treino:descanso"));
  });
});

test("descanso: importar backup v2 restaura a chave e inclui o estado anterior; v1 restaura lista vazia", async () => {
  await withApp({ seed: { "treino:descanso": ["2026-10-13"] } }, async (c) => {
    const date = "2026-10-14";
    const v2 = backup(2, { seg: { edit: null, history: {} } }, [date]);
    await c.importFile(JSON.stringify(v2));
    await waitFor(() => c.$("#toast").textContent === "Backup importado", "v2 importado");
    assert.deepEqual(c.store.json("treino:descanso"), [date]);
    assert.deepEqual(JSON.parse(c.log.downloads[0].text).descanso, ["2026-10-13"]);
  });
  await withApp(async (c) => {
    const v1 = backup(1, { seg: { edit: null, history: {} } });
    await c.importFile(JSON.stringify(v1));
    await waitFor(() => c.$("#toast").textContent === "Backup importado", "v1 importado");
    assert.deepEqual(c.store.json("treino:descanso"), []);
  });
});

test("descanso: valida datas reais e descarta itens inválidos sem rejeitar backup", () => {
  const r = T.validateBackup(backup(2, { seg: { edit: null, history: {} } }, ["2026-10-14", "2026-02-30", "amanhã"]), slugs);
  assert.equal(r.ok, true);
  assert.deepEqual(norm(r.descanso), ["2026-10-14"]);
  assert.ok(r.stats.dropped >= 2);
});

test("descanso: falhas/corrupção de leitura não derrubam tela nem sobrescrevem dados", async () => {
  const corrupt = makeStore({ "treino:descanso": "{{ lixo" });
  await withApp({ store: corrupt }, async (c) => {
    await c.idle();
    assert.ok(c.$("#body .exercise"));
    assert.equal(c.log.alerts.length, 0);
    assert.equal(corrupt.map.get("treino:descanso"), "{{ lixo");
  });
  const fail = makeStore({ "treino:descanso": ["2026-10-14"] });
  fail.failRead.add("treino:descanso");
  await withApp({ store: fail }, async (c) => {
    assert.ok(c.$("#body .exercise"));
    assert.equal(c.log.alerts.length, 0);
    assert.equal(fail.map.get("treino:descanso"), '["2026-10-14"]');
  });
  const invalid = makeStore({ "treino:descanso": ["2026-02-30"] });
  await withApp({ store: invalid }, async (c) => {
    assert.equal(c.$("#markRest").disabled, true);
    assert.equal(invalid.map.get("treino:descanso"), '["2026-02-30"]');
    assert.equal(c.log.alerts.length, 0);
  });
  const writeFail = makeStore();
  writeFail.failWrite.add("treino:descanso");
  await withApp({ store: writeFail }, async (c) => {
    c.click(c.$("#markRest")); await c.idle();
    assert.equal(c.log.alerts.length, 0);
    assert.equal(writeFail.map.has("treino:descanso"), false);
    assert.ok(c.$("#body .exercise"));
  });
});
