// Testes de fluxo: o app real (index.html + js/*.js) dentro do jsdom.
const assert = require("node:assert/strict");
const { test, withApp, makeStore, openApp, waitFor, todayLocal } = require("./harness");

const PAST = "2020-01-10";
const K00 = "seg_ex0_s0";
const EX0 = "Desenvolvimento com halteres";
const EX1 = "Crucifixo reto na máquina";
const EX2 = "Elevação lateral";

// ================= registrar cargas (modo normal) =================

test("carga: grava com chave idExercicio_idSerie e a data de hoje", () =>
  withApp(async (c) => {
    await c.typeLoad(K00, "20");
    const h = c.store.json("treino:seg");
    assert.deepEqual(h[K00], [{ date: todayLocal(), weight: 20 }]);
  }));

test("carga: aceita vírgula decimal (22,5)", () =>
  withApp(async (c) => {
    await c.typeLoad(K00, "22,5");
    assert.equal(c.store.json("treino:seg")[K00][0].weight, 22.5);
  }));

test("carga: inválida (texto / negativo) não grava e o campo volta ao valor anterior", () =>
  withApp(async (c) => {
    await c.typeLoad(K00, "20");
    for (const ruim of ["abc", "-5"]) {
      await c.typeLoad(K00, ruim);
      assert.equal(c.input(K00, "weight").value, "20", "campo volta para 20 após " + ruim);
      assert.equal(c.$("#toast").textContent, "Carga inválida");
    }
    assert.equal(c.store.json("treino:seg")[K00][0].weight, 20);
  }));

test("carga e reps feitas são independentes; registro some só quando os dois ficam vazios", () =>
  withApp(async (c) => {
    await c.typeLoad(K00, "20");
    await c.typeLoad(K00, "12", "repsDone");
    assert.deepEqual(c.store.json("treino:seg")[K00][0], { date: todayLocal(), weight: 20, repsDone: "12" });
    await c.typeLoad(K00, "", "weight");
    assert.equal(c.store.json("treino:seg")[K00][0].repsDone, "12", "limpar carga não apaga as reps");
    assert.equal(c.store.json("treino:seg")[K00][0].weight, undefined);
    await c.typeLoad(K00, "", "repsDone");
    assert.equal(K00 in c.store.json("treino:seg"), false, "sem nada, a chave some");
  }));

test("última carga: só datas ANTERIORES à exibida (nunca as futuras nem a mesma)", () =>
  withApp({ seed: { "treino:seg": { [K00]: [{ date: "2020-06-01", weight: 20, repsDone: "10" }, { date: "2020-07-01", weight: 99 }] } } }, async (c) => {
    await c.setDate("2020-06-15");
    assert.equal(c.input(K00, "weight").placeholder, "20 kg");
    assert.equal(c.input(K00, "repsDone").placeholder, "10");
    assert.match(c.$(".set-reps small").textContent, /última: 20kg × 10 reps \(06-01\)/);
    await c.setDate("2020-06-01");
    assert.equal(c.input(K00, "weight").value, "20", "na própria data o valor aparece preenchido");
    assert.equal(c.input(K00, "weight").placeholder, "—", "e não há 'última' anterior");
    await c.setDate("2020-05-01");
    assert.equal(c.input(K00, "weight").placeholder, "—", "antes de tudo não mostra nada");
  }));

test("histórico: guarda no máximo 30 por série e editar data antiga não derruba a mais nova", () => {
  const seed = [];
  for (let i = 1; i <= 30; i++) seed.push({ date: "2020-01-" + String(i).padStart(2, "0"), weight: 10 });
  return withApp({ seed: { "treino:seg": { [K00]: seed } } }, async (c) => {
    await c.setDate("2020-03-01");
    await c.typeLoad(K00, "50");
    let arr = c.store.json("treino:seg")[K00];
    assert.equal(arr.length, 30);
    assert.equal(arr[0].date, "2020-01-02");
    assert.equal(arr[29].date, "2020-03-01");
    await c.setDate("2019-12-01");
    await c.typeLoad(K00, "5");
    arr = c.store.json("treino:seg")[K00];
    assert.equal(arr.length, 30);
    assert.equal(arr[29].date, "2020-03-01", "o registro novo continua lá");
    assert.ok(!arr.some((e) => e.date === "2019-12-01"));
  });
});

test("data: começa em hoje (fuso local); data passada mostra 'Hoje' e o botão volta", () =>
  withApp(async (c) => {
    assert.equal(c.$("#dt").value, todayLocal());
    assert.equal(c.$("#goToday"), null);
    await c.setDate("2020-01-01");
    assert.ok(c.$("#goToday"));
    c.click(c.$("#goToday"));
    await c.readyNormal();
    assert.equal(c.$("#dt").value, todayLocal());
    assert.equal(c.$("#goToday"), null);
  }));

test("abas: trocar de dia mostra o treino do dia", () =>
  withApp(async (c) => {
    await c.tab(1);
    assert.equal(c.$("#dayTitle").textContent, "Terça - Pull");
    assert.ok(c.exercise("Bíceps no banco scott"));
    await c.tab(3);
    assert.ok(c.exercise("Supino reto"));
    assert.match(c.$(".ex-ref", c.exercise("Supino reto")).textContent, /Referência: 10-15-17kg/);
  }));

// ================= migração =================

test("migração: chaves antigas exIdx_setIdx viram idExercicio_idSerie (e órfãs ficam)", () =>
  withApp({ seed: { "treino:seg": { "0_0": [{ date: PAST, weight: 20 }], "99_0": [{ date: PAST, weight: 1 }] } } }, async (c) => {
    await waitFor(() => c.store.json("treino:seg")[K00], "migração regravada");
    const h = c.store.json("treino:seg");
    assert.ok(!("0_0" in h));
    assert.ok("99_0" in h, "posição que não existe mais não é apagada");
    assert.equal(c.input(K00, "weight").placeholder, "20 kg");
  }));

test("migração: edição antiga sem ids ganha ids e o histórico antigo casa com o exercício certo", () =>
  withApp({ seed: {
    "treino:edit:seg": { full: "Segunda X", exercises: [{ name: "A", sets: ["10", "8"] }, { name: "B", sets: ["6"] }] },
    "treino:seg": { "1_0": [{ date: PAST, weight: 33 }] }
  } }, async (c) => {
    await waitFor(() => { const e = c.store.json("treino:edit:seg"); return e && e.exercises[0].id; }, "edição migrada");
    const e = c.store.json("treino:edit:seg");
    assert.equal(e.exercises[0].id, "seg_ex0");
    assert.deepEqual(e.exercises[0].sets, [{ id: "s0", reps: "10" }, { id: "s1", reps: "8" }]);
    assert.equal(c.firstPlaceholder("B"), "33 kg");
    assert.equal(c.firstPlaceholder("A"), "—");
  }));

// ================= editor: salvar / estado =================

test("editor: renomear pelo campo de nome mantém o id (e o histórico)", () =>
  withApp({ seed: { "treino:seg": { [K00]: [{ date: PAST, weight: 20 }] } } }, async (c) => {
    await c.openEditor();
    c.change(c.$$(".ex-name-input")[0], "Desenvolvimento com halteres (sentado)");
    assert.equal(c.dirtyTabs(), 1);
    await c.saveEditor();
    assert.equal(c.firstPlaceholder("Desenvolvimento com halteres (sentado)"), "20 kg");
    assert.equal(c.store.json("treino:edit:seg").exercises[0].id, "seg_ex0");
  }));

test("editor: edição persiste depois de 'recarregar' o app", async () => {
  const store = makeStore();
  await withApp({ store }, async (c) => {
    await c.openEditor();
    c.change(c.$("#editFull"), "Segunda - Meu Push");
    c.change(c.$$(".ex-name-input")[1], "Crucifixo novo");
    await c.saveEditor();
  });
  await withApp({ store }, async (c) => {
    assert.equal(c.$("#dayTitle").textContent, "Segunda - Meu Push");
    assert.ok(c.exercise("Crucifixo novo"));
    assert.match(c.$(".daystatus").textContent, /editado/);
  });
});

test("editor: adicionar exercício e série usa ids novos e as cargas ficam separadas", () =>
  withApp(async (c) => {
    await c.openEditor();
    const antes = c.$$(".edit-exercise").length;
    c.click(c.$("#addExercise"));
    assert.equal(c.$$(".edit-exercise").length, antes + 1);
    c.click(c.$$(".add-set")[0]);
    await c.saveEditor();
    const e = c.store.json("treino:edit:seg");
    const ids = e.exercises.map((x) => x.id);
    assert.equal(new Set(ids).size, ids.length);
    const novo = e.exercises[e.exercises.length - 1];
    assert.match(novo.id, /^ex_/);
    await c.typeLoad(novo.id + "_" + novo.sets[0].id, "40");
    assert.ok(c.store.json("treino:seg")[novo.id + "_" + novo.sets[0].id]);
    assert.equal(c.store.json("treino:seg")[K00], undefined, "não mexeu no exercício 0");
  }));

test("editor: remover exercício no meio NÃO desloca as cargas dos outros (bug clássico de índice)", () =>
  withApp({ seed: { "treino:seg": { seg_ex2_s0: [{ date: PAST, weight: 30 }], seg_ex0_s0: [{ date: PAST, weight: 20 }] } } }, async (c) => {
    await c.openEditor();
    c.click(c.$$(".remove-ex")[0]);
    assert.match(c.log.confirms.pop(), /Desenvolvimento com halteres/);
    await c.saveEditor();
    assert.equal(c.firstPlaceholder(EX2), "30 kg");
    assert.equal(c.firstPlaceholder(EX1), "—");
    assert.ok(!c.exercise(EX0));
    assert.ok("seg_ex0_s0" in c.store.json("treino:seg"), "carga do removido continua guardada (desassociada)");
  }));

test("editor: remover série e reordenar não trocam a carga de série", () =>
  withApp({ seed: { "treino:seg": { seg_ex0_s3: [{ date: PAST, weight: 40 }] } } }, async (c) => {
    await c.openEditor();
    c.click($$first(c, ".remove-set"));            // remove S1 (id s0) do exercício 0
    await c.saveEditor();
    const ph = c.setPlaceholders(EX0);
    assert.equal(ph.length, 4);
    assert.equal(ph[2], "40 kg", "a série s3 agora é a 3ª e ainda tem a carga dela");
  }));
function $$first(c, sel) { return c.$$(sel)[0]; }

test("editor: fechar com alterações pede confirmação; recusar mantém o editor aberto", () =>
  withApp({ confirm: () => false }, async (c) => {
    await c.openEditor();
    c.click(c.$$(".add-set")[0]);
    c.click(c.$("#editToggle"));
    assert.equal(c.log.confirms.length, 1);
    assert.ok(c.$(".edit-exercise"), "continua no editor");
  }));

test("editor: copiar de outro dia gera ids NOVOS e as cargas dos dois dias não se misturam", () =>
  withApp({ seed: { "treino:ter": { ter_ex0_s0: [{ date: PAST, weight: 55 }] } } }, async (c) => {
    await c.openEditor();
    c.$("#dupSrc").value = "ter";
    c.click(c.$("#dupReplace"));
    await c.saveEditor();
    assert.equal(c.firstPlaceholder("Bíceps no banco scott"), "—", "cópia começa sem histórico");
    const e = c.store.json("treino:edit:seg");
    assert.ok(e.exercises.every((x) => /^ex_/.test(x.id)));
    await c.tab(1);
    assert.equal(c.firstPlaceholder("Bíceps no banco scott"), "55 kg", "o dia de origem manteve a carga");
  }));

test("editor: resetar o dia apaga só a edição de estrutura (cargas ficam) e não dá erro sem edição", () =>
  withApp({ seed: { "treino:seg": { [K00]: [{ date: PAST, weight: 20 }] } } }, async (c) => {
    await c.openEditor();
    c.click(c.$("#resetDay"));                     // sem edição salva: não pode dar erro
    await waitFor(() => c.$("#toast").textContent === "Dia resetado", "toast reset");
    assert.equal(c.log.alerts.length, 0);
    c.change(c.$("#editFull"), "Outro nome");
    await c.saveEditor();
    assert.ok(c.store.json("treino:edit:seg"));
    await c.openEditor();
    c.click(c.$("#resetDay"));
    assert.match(c.log.confirms.pop(), /Desenvolvimento com halteres \(5 séries\)/);
    await waitFor(() => c.store.json("treino:edit:seg") === undefined, "edição apagada");
    assert.equal(c.store.json("treino:seg")[K00][0].weight, 20);
  }));

test("editor: dia com todos os exercícios removidos não deixa salvar; mínimo de 1 exercício/série", () =>
  withApp(async (c) => {
    await c.tab(2);
    await c.openEditor();
    for (let i = 0; i < 10 && c.$$(".remove-ex").length > 1; i++) c.click(c.$$(".remove-ex")[0]);
    c.click(c.$$(".remove-ex")[0]);
    assert.match(c.log.alerts.pop(), /ao menos 1 exercício/);
    for (let i = 0; i < 10 && c.$$(".remove-set", c.$(".edit-exercise")).length > 1; i++) c.click(c.$(".remove-set"));
    c.click(c.$(".remove-set"));
    assert.match(c.log.alerts.pop(), /ao menos 1 série/);
  }));

// ================= trocar exercício =================

test("trocar: gera ids novos, mantém posição/reps, limpa ref e o novo começa sem histórico", () =>
  withApp({ prompt: () => "Supino declinado", seed: { "treino:seg": { [K00]: [{ date: PAST, weight: 20 }] } } }, async (c) => {
    await c.openEditor();
    c.click(c.$$(".swap-ex")[0]);
    assert.equal(c.names()[0], "Supino declinado");
    assert.equal(c.dirtyTabs(), 1);
    await c.saveEditor();
    const e = c.store.json("treino:edit:seg");
    const novo = e.exercises[0];
    assert.notEqual(novo.id, "seg_ex0");
    assert.match(novo.id, /^ex_/);
    assert.deepEqual(novo.sets.map((s) => s.reps), ["15", "10", "8", "6 a 8", "6 a 8"]);
    assert.ok(novo.sets.every((s) => !/^s[0-4]$/.test(s.id)), "séries também ganham ids novos");
    assert.equal(novo.ref, "");
    assert.equal(e.exercises.length, 7);
    assert.equal(c.firstPlaceholder("Supino declinado"), "—");
    assert.ok("seg_ex0_s0" in c.store.json("treino:seg"), "histórico do antigo continua guardado");
    await c.typeLoad(novo.id + "_" + novo.sets[0].id, "15");
    assert.ok(c.store.json("treino:seg")[novo.id + "_" + novo.sets[0].id]);
  }));

test("trocar: cancelar, nome vazio e nome igual não mudam nada", async () => {
  for (const resp of [null, "   ", "desenvolvimento COM halteres"]) {
    await withApp({ prompt: () => resp }, async (c) => {
      await c.openEditor();
      c.click(c.$$(".swap-ex")[0]);
      assert.equal(c.dirtyTabs(), 0, "resposta " + JSON.stringify(resp));
      assert.equal(c.names()[0], EX0);
      if (resp && resp.trim()) assert.match(c.log.alerts.pop(), /mesmo nome/);
    });
  }
});

// ================= reordenar por arraste =================

test("arraste: exercício mantém a carga no exercício certo depois de reordenar e salvar", () =>
  withApp({ seed: { "treino:seg": { [K00]: [{ date: PAST, weight: 20 }] } } }, async (c) => {
    await c.openEditor();
    await c.drag("ex", 0, 1);
    assert.deepEqual(c.names().slice(0, 3), [EX1, EX0, EX2]);
    assert.equal(c.dirtyTabs(), 1);
    assert.equal(c.$("#saveEdit").textContent, "Salvar treino (1 dia alterado)");
    await c.saveEditor();
    assert.equal(c.firstPlaceholder(EX0), "20 kg", "a carga foi junto com o exercício");
    assert.equal(c.firstPlaceholder(EX1), "—");
    assert.equal(c.$$("#body .ex-head")[1].textContent.indexOf(EX0), 0, "e ele está na 2ª posição");
  }));

test("arraste: série mantém a carga na série certa depois de reordenar e salvar", () =>
  withApp({ seed: { "treino:seg": { seg_ex0_s0: [{ date: PAST, weight: 20 }] } } }, async (c) => {
    await c.openEditor();
    await c.drag("set", 0, 4, { ex: 0 });
    assert.deepEqual(c.setReps(0), ["10", "8", "6 a 8", "6 a 8", "15"]);
    await c.saveEditor();
    assert.deepEqual(c.setPlaceholders(EX0), ["—", "—", "—", "—", "20 kg"]);
  }));

test("arraste: mover e voltar ao lugar original limpa o marcador de alteração", () =>
  withApp(async (c) => {
    await c.openEditor();
    await c.drag("ex", 0, 1);
    assert.equal(c.dirtyTabs(), 1);
    await c.drag("ex", 1, 0);
    assert.equal(c.dirtyTabs(), 0);
    assert.equal(c.$("#saveEdit").textContent, "Salvar treino");
    assert.equal(c.names()[0], EX0);
  }));

test("arraste: cancelar (pointercancel) não muda nada; soltar no topo e no fim funciona", () =>
  withApp(async (c) => {
    await c.openEditor();
    const antes = c.names().join("|");
    await c.drag("ex", 2, 5, { cancel: true });
    assert.equal(c.names().join("|"), antes);
    assert.equal(c.dirtyTabs(), 0);
    await c.drag("ex", 3, 0);
    assert.equal(c.names()[0], "Supino inclinado");
    await c.drag("ex", 0, 6);
    assert.equal(c.names()[6], "Supino inclinado");
    assert.equal(c.names().length, 7);
    assert.equal(new Set(c.names()).size, 7);
  }));

test("arraste: não deixa classes penduradas (dragging / marcador / modo compacto) depois de soltar", () =>
  withApp(async (c) => {
    await c.openEditor();
    await c.drag("ex", 0, 3);
    assert.equal(c.$$(".dragging, .drop-before, .drop-after").length, 0);
    assert.ok(!c.$("#body").classList.contains("sorting-ex"));
    await c.drag("set", 1, 0, { ex: 1 });
    assert.equal(c.$$(".dragging, .drop-before, .drop-after").length, 0);
  }));

test("arraste: ids seguem com o item (a ordem salva tem os ids originais reordenados)", () =>
  withApp(async (c) => {
    await c.openEditor();
    await c.drag("ex", 0, 6);
    await c.saveEditor();
    const ids = c.store.json("treino:edit:seg").exercises.map((e) => e.id);
    assert.deepEqual(ids, ["seg_ex1", "seg_ex2", "seg_ex3", "seg_ex4", "seg_ex5", "seg_ex6", "seg_ex0"]);
  }));

// ================= salvar vários dias =================

test("editor: 'Salvar treino' grava só os dias alterados e conta quantos", () =>
  withApp(async (c) => {
    await c.openEditor();
    c.change(c.$("#editFull"), "Segunda editada");
    c.click(c.$$(".tab")[2]);                       // em modo de edição a aba troca o dia sem perder o rascunho
    await waitFor(() => c.$("#editFull").value === "Quarta - Legs", "aba Qua no editor");
    c.change(c.$("#editFull"), "Quarta editada");
    assert.equal(c.dirtyTabs(), 2);
    assert.equal(c.$("#saveEdit").textContent, "Salvar treino (2 dias alterados)");
    await c.saveEditor();
    assert.equal(c.store.json("treino:edit:seg").full, "Segunda editada");
    assert.equal(c.store.json("treino:edit:qua").full, "Quarta editada");
    assert.equal(c.store.json("treino:edit:ter"), undefined, "dia não alterado não é gravado");
    assert.equal(c.$("#toast").textContent, "2 dias salvos");
  }));

// ================= segurança de dados =================

test("segurança: histórico corrompido → aviso, salvamento bloqueado e NADA é sobrescrito", () =>
  withApp({ seed: { "treino:seg": "{corrompido" } }, async (c) => {
    assert.ok(c.$(".daywarn"));
    await c.typeLoad(K00, "20");
    assert.equal(c.store.map.get("treino:seg"), "{corrompido");
    assert.equal(c.input(K00, "weight").value, "");
  }));

test("segurança: falha real de leitura do storage (chave existe mas get rejeita) também bloqueia", () => {
  const store = makeStore({ "treino:seg": {} });
  store.failRead.add("treino:seg");
  return withApp({ store }, async (c) => {
    assert.ok(c.$(".daywarn"));
    await c.typeLoad(K00, "20");
    assert.equal(c.store.map.get("treino:seg"), "{}");
  });
});

test("segurança: edição corrompida → o editor não abre e nada é regravado", () =>
  withApp({ seed: { "treino:edit:qua": "isto não é json" } }, async (c) => {
    c.click(c.$("#editToggle"));
    await waitFor(() => c.log.alerts.length, "alerta do editor");
    assert.match(c.log.alerts[0], /Qua/);
    assert.equal(c.$(".edit-exercise"), null);
    assert.equal(c.store.map.get("treino:edit:qua"), "isto não é json");
  }));

test("segurança: nomes com HTML não viram HTML (XSS) no modo normal nem no editor", () => {
  const nome = '<img id="pwn" src=x onerror="window.__pwn=1"><b id="negrito">x</b>';
  return withApp({ seed: { "treino:edit:seg": { full: nome, exercises: [{ id: "seg_ex0", name: nome, ref: nome, sets: [{ id: "s0", reps: nome }] }] } } }, async (c) => {
    assert.equal(c.$("#pwn"), null);
    assert.equal(c.$("#negrito"), null);
    assert.equal(c.w.__pwn, undefined);
    await c.openEditor();
    assert.equal(c.$("#pwn"), null);
    assert.equal(c.$$(".ex-name-input")[0].value, nome, "o texto aparece literal no campo");
  });
});

// ================= backup =================

const seedBackup = () => ({
  "treino:seg": { [K00]: [{ date: PAST, weight: 20, repsDone: "10" }] },
  "treino:edit:seg": { full: "Segunda - Minha", exercises: [{ id: "seg_ex0", name: "A", ref: "r", sets: [{ id: "s0", reps: "10" }] }] }
});

test("backup: exportar → apagar tudo → importar restaura treino editado e histórico", async () => {
  let texto;
  await withApp({ seed: seedBackup() }, async (c) => {
    c.click(c.$("#exportBackup"));
    await waitFor(() => c.log.downloads.length, "download");
    assert.match(c.log.downloads[0].name, /^treino-backup-\d{4}-\d{2}-\d{2}-\d{4}\.json$/);
    texto = c.log.downloads[0].text;
    const b = JSON.parse(texto);
    assert.equal(b.app, "treino-da-semana");
    assert.equal(b.days.seg.edit.full, "Segunda - Minha");
    assert.ok(b.days.seg.history[K00]);
  });
  await withApp({}, async (c) => {
    await c.importFile(texto);
    await waitFor(() => c.$("#toast").textContent === "Backup importado", "importado");
    assert.deepEqual(c.store.json("treino:seg"), seedBackup()["treino:seg"]);
    assert.deepEqual(c.store.json("treino:edit:seg"), seedBackup()["treino:edit:seg"]);
    assert.equal(c.log.downloads.length, 0, "nada a guardar: não baixa backup automático");
    assert.equal(c.$("#dayTitle").textContent, "Segunda - Minha");
  });
});

test("backup: importar por cima de dados existentes baixa antes um backup automático do estado atual", async () => {
  let texto;
  await withApp({ seed: seedBackup() }, async (c) => {
    c.click(c.$("#exportBackup"));
    await waitFor(() => c.log.downloads.length, "download");
    texto = c.log.downloads[0].text;
  });
  await withApp({ seed: { "treino:seg": { [K00]: [{ date: "2019-05-05", weight: 77 }] } } }, async (c) => {
    await c.importFile(texto);
    await waitFor(() => c.$("#toast").textContent === "Backup importado", "importado");
    assert.equal(c.log.downloads.length, 1);
    assert.match(c.log.downloads[0].name, /^treino-backup-antes-da-importacao-/);
    assert.equal(JSON.parse(c.log.downloads[0].text).days.seg.history[K00][0].weight, 77);
    assert.equal(c.store.json("treino:seg")[K00][0].weight, 20, "estado importado substituiu o antigo");
  });
});

test("backup: cancelar a confirmação não muda nada", async () => {
  let texto;
  await withApp({ seed: seedBackup() }, async (c) => {
    c.click(c.$("#exportBackup"));
    await waitFor(() => c.log.downloads.length, "download");
    texto = c.log.downloads[0].text;
  });
  await withApp({ confirm: () => false, seed: { "treino:seg": { [K00]: [{ date: "2019-05-05", weight: 77 }] } } }, async (c) => {
    const antes = c.store.snapshot();
    await c.importFile(texto);
    assert.equal(c.log.confirms.length, 1);
    assert.equal(c.store.snapshot(), antes);
    assert.equal(c.log.downloads.length, 0);
  });
});

test("backup: arquivos inválidos são recusados sem gravar nada (JSON ruim, outro app, id malicioso, versão)", async () => {
  const maus = {
    "JSON inválido": ["{ isto não é json", /JSON válido/],
    "outro app": [JSON.stringify({ app: "outro", version: 1, days: {} }), /não é um backup/],
    "id malicioso": [JSON.stringify({ app: "treino-da-semana", version: 1, days: { seg: { edit: { full: "x", exercises: [{ id: "__proto__", name: "A", sets: [{ id: "s0", reps: "8" }] }] }, history: {} } } }), /id inválido/],
    "versão futura": [JSON.stringify({ app: "treino-da-semana", version: 99, days: { seg: {} } }), /Versão/]
  };
  for (const [nome, [texto, re]] of Object.entries(maus)) {
    await withApp({ seed: seedBackup() }, async (c) => {
      const antes = c.store.snapshot();
      await c.importFile(texto);
      assert.equal(c.log.alerts.length, 1, nome);
      assert.match(c.log.alerts[0], re, nome);
      assert.equal(c.log.confirms.length, 0, nome);
      assert.equal(c.store.snapshot(), antes, nome);
    });
  }
});

test("backup: importação de dia com edit:null apaga a edição local e volta ao padrão; dias ausentes não são tocados", async () => {
  const arquivo = JSON.stringify({ app: "treino-da-semana", version: 1, days: { seg: { edit: null, history: {} } } });
  await withApp({ seed: { ...seedBackup(), "treino:ter": { ter_ex0_s0: [{ date: PAST, weight: 9 }] } } }, async (c) => {
    await c.importFile(arquivo);
    await waitFor(() => c.$("#toast").textContent === "Backup importado", "importado");
    assert.equal(c.store.json("treino:edit:seg"), undefined);
    assert.deepEqual(c.store.json("treino:seg"), {});
    assert.equal(c.store.json("treino:ter").ter_ex0_s0[0].weight, 9, "ter intacto");
    assert.equal(c.$("#dayTitle").textContent, "Segunda - Push");
  });
});

test("backup: exportar é bloqueado se algum dia não puder ser lido (nunca sai dia 'vazio')", () => {
  const store = makeStore(seedBackup());
  store.map.set("treino:ter", "{corrompido");
  return withApp({ store }, async (c) => {
    c.click(c.$("#exportBackup"));
    await waitFor(() => c.log.alerts.length, "alerta");
    assert.match(c.log.alerts[0], /Ter/);
    assert.equal(c.log.downloads.length, 0);
  });
});

test("backup: o painel de backup não aparece com o editor aberto", () =>
  withApp(async (c) => {
    // o painel de backup só existe no modo normal; com o editor aberto ele some
    await c.openEditor();
    assert.equal(c.$("#exportBackup"), null);
    assert.equal(c.$("#importFile"), null);
  }));
