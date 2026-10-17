// Backup (extras): lembrete de "último backup" e Copiar / Colar backup.
// Escritos ANTES do código.
const assert = require("node:assert/strict");
const { test, withApp, makeStore, loadCore, waitFor } = require("./harness");
const T = loadCore();
const norm = (x) => JSON.parse(JSON.stringify(x));
const KEY = "treino:lastBackup";
const PAST = "2020-01-10";
const seed = () => ({
  "treino:seg": { seg_ex0_s0: [{ date: PAST, weight: 20, repsDone: "10" }] },
  "treino:edit:seg": { full: "Segunda X", exercises: [{ id: "seg_ex0", name: "Meu supino", ref: "", sets: [{ id: "s0", reps: "10" }] }] }
});
const diasAtras = (n) => new Date(Date.now() - n * 86400000).toISOString();
const clip = (c, impl) => Object.defineProperty(c.w.navigator, "clipboard", { value: { writeText: impl }, configurable: true });
const last = (c) => c.$("#backupLast");
const toast = (c) => c.$("#toast").textContent;

// ---------- função pura ----------
test("lembrete (unit): describeLastBackup — nunca, hoje, ontem, há N dias, data inválida", () => {
  const now = new Date(2026, 8, 30, 15, 0, 0); // 30/09/2026 15:00 (local)
  const d = (y, m, dia, h, mi) => new Date(y, m, dia, h, mi, 0).toISOString();
  const r = (v) => norm(T.describeLastBackup(v, now));
  assert.deepEqual(r(null), { text: "Último backup: nunca feito", stale: true });
  assert.deepEqual(r(undefined), { text: "Último backup: nunca feito", stale: true });
  assert.deepEqual(r("lixo"), { text: "Último backup: nunca feito", stale: true });
  assert.deepEqual(r(d(2026, 8, 30, 9, 5)), { text: "Último backup: hoje às 09:05", stale: false });
  assert.deepEqual(r(d(2026, 8, 29, 23, 59)), { text: "Último backup: ontem", stale: false });
  assert.deepEqual(r(d(2026, 8, 24, 10, 0)), { text: "Último backup: há 6 dias", stale: false });
  assert.deepEqual(r(d(2026, 8, 23, 10, 0)), { text: "Último backup: há 7 dias", stale: true });
  assert.deepEqual(r(d(2026, 7, 1, 10, 0)), { text: "Último backup: há 60 dias", stale: true });
  // relógio do aparelho foi para trás: não quebra, trata como hoje
  assert.equal(T.describeLastBackup(d(2026, 9, 5, 10, 0), now).stale, false);
});

// ---------- lembrete na tela ----------
test("lembrete: sem registro mostra 'nunca feito' em destaque (stale)", () =>
  withApp({ seed: seed() }, async (c) => {
    await waitFor(() => /nunca feito/.test(last(c).textContent), "linha do último backup");
    assert.ok(last(c).classList.contains("stale"));
  }));

test("lembrete: registro antigo aparece como 'há N dias' e em destaque", () =>
  withApp({ seed: { ...seed(), [KEY]: diasAtras(10) } }, async (c) => {
    await waitFor(() => /há 10 dias/.test(last(c).textContent), "há 10 dias");
    assert.ok(last(c).classList.contains("stale"));
  }));

test("lembrete: registro recente não fica em destaque", () =>
  withApp({ seed: { ...seed(), [KEY]: diasAtras(0) } }, async (c) => {
    await waitFor(() => /hoje/.test(last(c).textContent), "hoje");
    assert.ok(!last(c).classList.contains("stale"));
  }));

test("lembrete: exportar grava a data e a linha passa a dizer 'hoje'", () =>
  withApp({ seed: seed() }, async (c) => {
    await waitFor(() => /nunca feito/.test(last(c).textContent), "inicial");
    c.click(c.$("#exportBackup"));
    await waitFor(() => c.log.downloads.length, "download");
    await waitFor(() => /hoje/.test(last(c).textContent), "linha atualizada");
    assert.ok(!last(c).classList.contains("stale"));
    const v = c.store.map.get(KEY);
    assert.ok(!isNaN(new Date(v).getTime()), "ISO válido: " + v);
    assert.ok(Math.abs(Date.now() - new Date(v).getTime()) < 10000);
  }));

test("lembrete: a linha sobrevive a trocar de aba/data (é lida de novo, não some)", () =>
  withApp({ seed: { ...seed(), [KEY]: diasAtras(3) } }, async (c) => {
    await waitFor(() => /há 3 dias/.test(last(c).textContent), "inicial");
    await c.tab(1);
    await waitFor(() => /há 3 dias/.test(last(c).textContent), "depois da troca de aba");
  }));

test("lembrete: exportação bloqueada (dia ilegível) NÃO conta como backup feito", () => {
  const store = makeStore({ ...seed(), "treino:ter": { ter_ex0_s0: [{ date: PAST, weight: 9 }] } });
  store.failRead.add("treino:ter");
  return withApp({ store }, async (c) => {
    c.click(c.$("#exportBackup"));
    await c.idle(150);
    assert.equal(c.log.downloads.length, 0);
    assert.equal(c.store.map.has(KEY), false);
  });
});

test("lembrete: a data do último backup não entra no arquivo exportado nem é alterada pela importação", async () => {
  let texto;
  await withApp({ seed: { ...seed(), [KEY]: diasAtras(2) } }, async (c) => {
    c.click(c.$("#exportBackup"));
    await waitFor(() => c.log.downloads.length, "download");
    texto = c.log.downloads[0].text;
    assert.doesNotMatch(texto, /lastBackup|ultimo|último/i);
  });
  const antigo = diasAtras(40);
  await withApp({ seed: { [KEY]: antigo } }, async (c) => {
    await c.importFile(texto);
    await waitFor(() => toast(c) === "Backup importado", "importado");
    assert.equal(c.store.map.get(KEY), antigo, "importar não conta como backup e não mexe na data");
  });
});

test("lembrete: falha ao ler ou gravar a data não atrapalha exportar nem mostra alerta", async () => {
  const s1 = makeStore({ ...seed(), [KEY]: diasAtras(1) }); s1.failRead.add(KEY);
  await withApp({ store: s1 }, async (c) => {
    await c.idle(100);
    c.click(c.$("#exportBackup"));
    await waitFor(() => c.log.downloads.length, "download com leitura falha");
    assert.equal(c.log.alerts.length, 0);
  });
  const s2 = makeStore(seed()); s2.failWrite.add(KEY);
  await withApp({ store: s2 }, async (c) => {
    c.click(c.$("#exportBackup"));
    await waitFor(() => c.log.downloads.length, "download com escrita falha");
    await c.idle(100);
    assert.equal(c.log.alerts.length, 0);
  });
});

test("lembrete: valor guardado lixo/vazio é tratado como 'nunca feito'", () =>
  withApp({ seed: { [KEY]: "banana" } }, async (c) => {
    await waitFor(() => /nunca feito/.test(last(c).textContent), "nunca feito");
  }));

// ---------- copiar ----------
test("copiar: envia o backup completo para a área de transferência e conta como backup feito", () =>
  withApp({ seed: seed() }, async (c) => {
    let copiado = null;
    clip(c, async (t) => { copiado = t; });
    c.click(c.$("#copyBackup"));
    await waitFor(() => copiado, "texto copiado");
    const r = T.validateBackup(JSON.parse(copiado), ["seg", "ter", "qua", "qui", "sex"]);
    assert.equal(r.ok, true);
    assert.equal(r.days.seg.edit.exercises[0].name, "Meu supino");
    assert.equal(r.days.seg.history.seg_ex0_s0[0].weight, 20);
    await waitFor(() => toast(c) === "Backup copiado", "toast");
    await waitFor(() => c.store.map.has(KEY), "data gravada");
    assert.equal(c.$("#copyBox").hidden, true);
  }));

test("copiar: sem permissão/sem API da área de transferência mostra o texto para copiar à mão e NÃO conta como feito", async () => {
  // jsdom não tem navigator.clipboard: cai no caminho de contingência
  await withApp({ seed: seed() }, async (c) => {
    c.click(c.$("#copyBackup"));
    await waitFor(() => !c.$("#copyBox").hidden, "caixa de texto visível");
    const v = c.$("#copyText").value;
    assert.equal(T.validateBackup(JSON.parse(v), ["seg", "ter", "qua", "qui", "sex"]).ok, true);
    assert.equal(c.$("#copyText").readOnly, true);
    assert.equal(c.store.map.has(KEY), false);
  });
  await withApp({ seed: seed() }, async (c) => {
    clip(c, async () => { throw new Error("negado"); });
    c.click(c.$("#copyBackup"));
    await waitFor(() => !c.$("#copyBox").hidden, "caixa visível após recusa");
    assert.equal(c.store.map.has(KEY), false);
    assert.equal(c.log.alerts.length, 0);
  });
});

test("copiar: dia ilegível bloqueia (nunca copia backup incompleto)", () => {
  const store = makeStore({ ...seed(), "treino:qua": { qua_ex0_s0: [{ date: PAST, weight: 30 }] } });
  store.failRead.add("treino:qua");
  return withApp({ store }, async (c) => {
    let copiado = null;
    clip(c, async (t) => { copiado = t; });
    c.click(c.$("#copyBackup"));
    await waitFor(() => c.log.alerts.length, "alerta");
    assert.match(c.log.alerts[0], /Qua/);
    assert.equal(copiado, null);
    assert.ok(c.$("#copyBox").hidden);
  });
});

test("copiar: não altera nenhum dado salvo (só cria a data do último backup)", () =>
  withApp({ seed: seed() }, async (c) => {
    clip(c, async () => {});
    const antes = new Map(c.store.map);
    c.click(c.$("#copyBackup"));
    await waitFor(() => c.store.map.has(KEY), "data gravada");
    c.store.map.delete(KEY);
    assert.deepEqual([...c.store.map.entries()].sort(), [...antes.entries()].sort());
  }));

// ---------- colar ----------
test("colar: o campo começa escondido; abrir e cancelar não muda nada", () =>
  withApp({ seed: seed() }, async (c) => {
    assert.ok(c.$("#pasteBox").hidden);
    const antes = c.store.snapshot();
    c.click(c.$("#pasteBackup"));
    assert.equal(c.$("#pasteBox").hidden, false);
    c.$("#pasteText").value = "qualquer coisa";
    c.click(c.$("#pasteCancel"));
    assert.ok(c.$("#pasteBox").hidden);
    assert.equal(c.$("#pasteText").value, "");
    assert.equal(c.store.snapshot(), antes);
  }));

test("colar: copiar → apagar tudo → colar restaura treino editado e histórico", async () => {
  let copiado = null;
  await withApp({ seed: seed() }, async (c) => {
    clip(c, async (t) => { copiado = t; });
    c.click(c.$("#copyBackup"));
    await waitFor(() => copiado, "copiado");
  });
  await withApp({}, async (c) => {
    c.click(c.$("#pasteBackup"));
    c.$("#pasteText").value = "\n  " + copiado + "  \n";
    c.click(c.$("#pasteImport"));
    await waitFor(() => toast(c) === "Backup importado", "importado");
    assert.deepEqual(c.store.json("treino:seg"), seed()["treino:seg"]);
    assert.deepEqual(c.store.json("treino:edit:seg"), seed()["treino:edit:seg"]);
    assert.ok(c.$("#pasteBox").hidden, "caixa some depois de importar");
    assert.equal(c.$("#pasteText").value, "");
  });
});

test("colar: passa pela mesma confirmação e baixa o backup automático do estado atual", async () => {
  let copiado = null;
  await withApp({ seed: seed() }, async (c) => {
    clip(c, async (t) => { copiado = t; });
    c.click(c.$("#copyBackup"));
    await waitFor(() => copiado, "copiado");
  });
  await withApp({ seed: { "treino:ter": { ter_ex0_s0: [{ date: PAST, weight: 9 }] } } }, async (c) => {
    c.click(c.$("#pasteBackup"));
    c.$("#pasteText").value = copiado;
    c.click(c.$("#pasteImport"));
    await waitFor(() => toast(c) === "Backup importado", "importado");
    assert.equal(c.log.confirms.length, 1);
    assert.match(c.log.downloads[0].name, /^treino-backup-antes-da-importacao-/);
  });
});

test("colar: cancelar a confirmação não grava nada e mantém o texto para tentar de novo", async () => {
  let copiado = null;
  await withApp({ seed: seed() }, async (c) => {
    clip(c, async (t) => { copiado = t; });
    c.click(c.$("#copyBackup"));
    await waitFor(() => copiado, "copiado");
  });
  await withApp({ seed: { "treino:ter": { ter_ex0_s0: [{ date: PAST, weight: 9 }] } }, confirm: () => false }, async (c) => {
    const antes = c.store.snapshot();
    c.click(c.$("#pasteBackup"));
    c.$("#pasteText").value = copiado;
    c.click(c.$("#pasteImport"));
    await c.idle(150);
    assert.equal(c.store.snapshot(), antes);
    assert.equal(c.log.downloads.length, 0);
    assert.equal(c.$("#pasteText").value, copiado);
  });
});

test("colar: texto vazio, JSON inválido, outro app e id malicioso são recusados sem gravar nada", async () => {
  const casos = {
    "vazio": ["   ", /Cole/],
    "json ruim": ["{isso não é json", /JSON válido/],
    "outro app": [JSON.stringify({ app: "outro", version: 1, days: {} }), /não é um backup/],
    "id malicioso": [JSON.stringify({ app: "treino-da-semana", version: 1, days: { seg: { edit: { full: "X", exercises: [{ id: "__proto__", name: "A", sets: [{ id: "s0", reps: "8" }] }] }, history: {} } } }), /id inválido/]
  };
  for (const [nome, [texto, re]] of Object.entries(casos)) {
    await withApp({ seed: seed() }, async (c) => {
      const antes = c.store.snapshot();
      c.click(c.$("#pasteBackup"));
      c.$("#pasteText").value = texto;
      c.click(c.$("#pasteImport"));
      await waitFor(() => c.log.alerts.length, "alerta: " + nome);
      assert.match(c.log.alerts[0], re, nome);
      assert.equal(c.store.snapshot(), antes, nome);
      assert.equal(c.log.confirms.length, 0, nome + ": nem chega a pedir confirmação");
    });
  }
});

test("colar: texto maior que o limite de 5 MB é recusado", () =>
  withApp({ seed: seed() }, async (c) => {
    const antes = c.store.snapshot();
    c.click(c.$("#pasteBackup"));
    c.$("#pasteText").value = "x".repeat(5 * 1024 * 1024 + 10);
    c.click(c.$("#pasteImport"));
    await waitFor(() => c.log.alerts.length, "alerta");
    assert.match(c.log.alerts[0], /grande demais/);
    assert.equal(c.store.snapshot(), antes);
  }));

test("colar: importar por texto NÃO conta como backup feito", async () => {
  let copiado = null;
  await withApp({ seed: seed() }, async (c) => {
    clip(c, async (t) => { copiado = t; });
    c.click(c.$("#copyBackup"));
    await waitFor(() => copiado, "copiado");
  });
  await withApp({}, async (c) => {
    c.click(c.$("#pasteBackup"));
    c.$("#pasteText").value = copiado;
    c.click(c.$("#pasteImport"));
    await waitFor(() => toast(c) === "Backup importado", "importado");
    assert.equal(c.store.map.has(KEY), false);
  });
});

test("backup extra: os novos botões têm ícone SVG e o painel continua fora do editor", () =>
  withApp(async (c) => {
    for (const id of ["#copyBackup", "#pasteBackup"]) {
      assert.ok(c.$(id).querySelector("svg"), id);
      assert.doesNotMatch(c.$(id).textContent, /[\u{1F300}-\u{1FAFF}\u2600-\u27BF]/u);
    }
    await c.openEditor();
    for (const id of ["#copyBackup", "#pasteBackup", "#pasteBox", "#copyBox", "#backupLast"]) assert.equal(c.$(id), null, id);
  }));

test("backup extra: ícones copy e clipboard existem e herdam a cor", () => {
  for (const n of ["copy", "clipboard"]) {
    const s = T.icon(n);
    assert.match(s, /^<svg /);
    assert.match(s, /currentColor/);
    assert.match(s, /aria-hidden="true"/);
  }
});
