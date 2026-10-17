// Testes das funções puras (sem tela).
const assert = require("node:assert/strict");
const { test, loadCore } = require("./harness");
const T = loadCore();
// Objetos criados dentro do vm não são "iguais por referência" aos do Node no
// deepEqual estrito; normalizamos via JSON antes de comparar.
const norm = (x) => JSON.parse(JSON.stringify(x === undefined ? null : x));
const eq = (a, b, m) => assert.deepStrictEqual(norm(a), norm(b), m);

// ---------- sortable ----------
test("unit: moveItem move para frente, para trás, e recusa índices inválidos", () => {
  const a = [1, 2, 3, 4];
  assert.equal(T.moveItem(a, 0, 2), true);  eq(a, [2, 3, 1, 4]);
  assert.equal(T.moveItem(a, 3, 0), true);  eq(a, [4, 2, 3, 1]);
  assert.equal(T.moveItem(a, 1, 1), false); eq(a, [4, 2, 3, 1]);
  assert.equal(T.moveItem(a, -1, 2), false);
  assert.equal(T.moveItem(a, 0, 9), false);
  eq(a, [4, 2, 3, 1]);
});

test("unit: dropIndex conta quantos itens ficam acima", () => {
  assert.equal(T.dropIndex([10, 30, 50], 5), 0);
  assert.equal(T.dropIndex([10, 30, 50], 35), 2);
  assert.equal(T.dropIndex([10, 30, 50], 99), 3);
  assert.equal(T.dropIndex([], 10), 0);
});

// ---------- ids ----------
test("unit: ids padrão dos dias são posicionais e estáveis (seg_ex0 / s0)", () => {
  const seg = T.DAYS[0];
  assert.equal(seg.exercises[0].id, "seg_ex0");
  assert.equal(seg.exercises[2].id, "seg_ex2");
  eq(seg.exercises[0].sets.map((s) => s.id), ["s0", "s1", "s2", "s3", "s4"]);
  assert.equal(seg.exercises[0].sets[3].reps, "6 a 8");
});

test("unit: ensureIds normaliza séries em texto e preserva ids existentes", () => {
  const day = { exercises: [{ name: "A", sets: ["10", "8"] }, { id: "meu", name: "B", sets: [{ id: "x", reps: "6" }, { reps: "5" }] }] };
  T.ensureIds(day, "zzz");
  assert.equal(day.exercises[0].id, "zzz_ex0");
  eq(day.exercises[0].sets, [{ id: "s0", reps: "10" }, { id: "s1", reps: "8" }]);
  assert.equal(day.exercises[1].id, "meu");
  eq(day.exercises[1].sets, [{ id: "x", reps: "6" }, { reps: "5", id: "s1" }]);
});

test("unit: makeId gera ids diferentes e válidos para o backup", () => {
  const ids = new Set();
  for (let i = 0; i < 200; i++) ids.add(T.makeId("ex"));
  assert.equal(ids.size, 200);
  assert.match(T.makeId("s"), /^[A-Za-z0-9][A-Za-z0-9_-]{0,119}$/);
});

// ---------- histórico ----------
test("unit: lastEntryBefore é ESTRITAMENTE anterior (ignora a mesma data e as futuras)", () => {
  const arr = [{ date: "2026-01-01", weight: 10 }, { date: "2026-01-10", weight: 20 }, { date: "2026-01-20", weight: 30 }];
  assert.equal(T.lastEntryBefore(arr, "2026-01-10").weight, 10);
  assert.equal(T.lastEntryBefore(arr, "2026-01-15").weight, 20);
  assert.equal(T.lastEntryBefore(arr, "2026-01-01"), null);
  assert.equal(T.lastEntryBefore(undefined, "2026-01-01"), null);
});

test("unit: upsertEntry grava carga e reps de forma independente", () => {
  let arr = [];
  arr = T.upsertEntry(arr, "2026-02-01", { weight: 20 });
  arr = T.upsertEntry(arr, "2026-02-01", { repsDone: "12" });
  eq(arr, [{ date: "2026-02-01", weight: 20, repsDone: "12" }]);
  arr = T.upsertEntry(arr, "2026-02-01", { weight: undefined });
  eq(arr, [{ date: "2026-02-01", weight: undefined, repsDone: "12" }]);
  arr = T.upsertEntry(arr, "2026-02-01", { repsDone: undefined });
  eq(arr, [], "sem carga e sem reps o registro do dia some");
});

test("unit: upsertEntry mantém os 30 mais recentes POR DATA", () => {
  let arr = [];
  for (let i = 1; i <= 30; i++) arr = T.upsertEntry(arr, "2026-03-" + String(i).padStart(2, "0"), { weight: i });
  assert.equal(arr.length, 30);
  arr = T.upsertEntry(arr, "2026-04-01", { weight: 99 });
  assert.equal(arr.length, 30);
  assert.equal(arr[0].date, "2026-03-02");
  assert.equal(arr[29].date, "2026-04-01");
  // registro mais antigo que todos: NÃO derruba um mais novo
  arr = T.upsertEntry(arr, "2025-01-01", { weight: 5 });
  assert.equal(arr.length, 30);
  assert.equal(arr[29].date, "2026-04-01");
  assert.ok(!arr.some((e) => e.date === "2025-01-01"));
});

test("unit: migrateHistoryKeys converte chaves antigas, mantém as órfãs e é idempotente", () => {
  const eff = T.effectiveDay(T.DAYS[0], null);
  const hist = { "0_0": [{ date: "2026-01-01", weight: 10 }], "2_1": [{ date: "2026-01-01", weight: 5 }], "99_0": [{ date: "2026-01-01", weight: 1 }], "seg_ex1_s0": [{ date: "2026-01-02", weight: 7 }] };
  const r = T.migrateHistoryKeys(eff, hist);
  assert.equal(r.changed, true);
  eq(Object.keys(r.hist).sort(), ["99_0", "seg_ex0_s0", "seg_ex1_s0", "seg_ex2_s1"]);
  const r2 = T.migrateHistoryKeys(eff, r.hist);
  assert.equal(r2.changed, false);
  eq(r2.hist, r.hist);
});

test("unit: migrateHistoryKeys junta duas chaves que caem no mesmo destino", () => {
  const eff = T.effectiveDay(T.DAYS[0], null);
  const hist = { "0_0": [{ date: "2026-01-01", weight: 10 }], "seg_ex0_s0": [{ date: "2026-01-05", weight: 12 }] };
  const r = T.migrateHistoryKeys(eff, hist);
  eq(r.hist["seg_ex0_s0"].map((e) => e.date).sort(), ["2026-01-01", "2026-01-05"]);
});

// ---------- backup ----------
const SLUGS = ["seg", "ter", "qua", "qui", "sex"];
const editOk = () => ({ full: "Segunda", exercises: [{ id: "seg_ex0", name: "A", ref: "", sets: [{ id: "s0", reps: "10" }] }] });
const backup = (days) => ({ app: "treino-da-semana", version: 1, exportedAt: "2026-09-28T23:10:00.000Z", days });

test("unit: validateBackup aceita um backup válido e copia campo a campo", () => {
  const r = T.validateBackup(backup({ seg: { edit: editOk(), history: { seg_ex0_s0: [{ date: "2026-01-01", weight: 20, repsDone: "10", extra: "lixo" }] } }, ter: { edit: null, history: {} } }), SLUGS);
  assert.equal(r.ok, true);
  assert.equal(r.stats.days, 2);
  assert.equal(r.stats.edits, 1);
  assert.equal(r.stats.records, 1);
  eq(r.days.seg.history.seg_ex0_s0[0], { date: "2026-01-01", weight: 20, repsDone: "10" });
});

test("unit: validateBackup recusa arquivo de outro app, versão errada e sem dias", () => {
  assert.equal(T.validateBackup({ app: "outro", version: 1, days: {} }, SLUGS).ok, false);
  assert.equal(T.validateBackup({ app: "treino-da-semana", version: 2, days: { seg: {} } }, SLUGS).ok, false);
  assert.equal(T.validateBackup({ app: "treino-da-semana", version: 1 }, SLUGS).ok, false);
  assert.equal(T.validateBackup(backup({}), SLUGS).ok, false);
  assert.equal(T.validateBackup(backup({ xyz: { edit: null, history: {} } }), SLUGS).ok, false);
  assert.equal(T.validateBackup(null, SLUGS).ok, false);
  assert.equal(T.validateBackup([], SLUGS).ok, false);
});

test("unit: validateBackup recusa ids perigosos, repetidos ou malformados na edição", () => {
  const com = (mut) => { const e = editOk(); mut(e); return T.validateBackup(backup({ seg: { edit: e, history: {} } }), SLUGS); };
  for (const bad of ["__proto__", "constructor", "prototype", "toString", "hasOwnProperty", "valueOf", "_comeca", "tem espaço", "a/b", "", "x".repeat(121)]) {
    assert.equal(com((e) => { e.exercises[0].id = bad; }).ok, false, "id de exercício: " + JSON.stringify(bad));
    assert.equal(com((e) => { e.exercises[0].sets[0].id = bad; }).ok, false, "id de série: " + JSON.stringify(bad));
  }
  assert.equal(com((e) => { e.exercises.push({ id: "seg_ex0", name: "B", sets: [{ id: "s0", reps: "8" }] }); }).ok, false, "exercício repetido");
  assert.equal(com((e) => { e.exercises[0].sets.push({ id: "s0", reps: "8" }); }).ok, false, "série repetida");
  assert.equal(com((e) => { e.exercises[0].name = "  "; }).ok, false);
  assert.equal(com((e) => { e.exercises[0].sets[0].reps = ""; }).ok, false);
  assert.equal(com((e) => { e.exercises = []; }).ok, false);
  assert.equal(com((e) => { e.full = ""; }).ok, false);
});

test("unit: validateBackup descarta registros inválidos do histórico (e conta) sem derrubar o arquivo", () => {
  const hist = {
    ok_s0: [{ date: "2026-01-01", weight: 20 }, { date: "2026-13-40", weight: 5 }, { date: "2026-01-02", weight: -3 }, { date: "2026-01-03", weight: 5000 }, { date: "2026-01-04" }, { date: "2026-01-05", weight: "20" }, "lixo"],
    __proto__x: "não é lista",
    "chave inválida": [{ date: "2026-01-01", weight: 1 }],
    dup_s0: [{ date: "2026-01-01", weight: 1 }, { date: "2026-01-01", weight: 2 }]
  };
  const r = T.validateBackup(backup({ seg: { edit: null, history: hist } }), SLUGS);
  assert.equal(r.ok, true);
  eq(r.days.seg.history.ok_s0, [{ date: "2026-01-01", weight: 20 }]);
  assert.equal(r.days.seg.history.dup_s0.length, 1);
  assert.equal(r.days.seg.history.dup_s0[0].weight, 2, "data repetida vale a última");
  assert.ok(!("chave inválida" in r.days.seg.history));
  assert.ok(r.stats.dropped >= 7, "dropped=" + r.stats.dropped);
});

test("unit: validateBackup limita a 30 registros por série (os mais recentes)", () => {
  const arr = [];
  for (let i = 1; i <= 40; i++) arr.push({ date: "2026-02-" + String(i).padStart(2, "0").replace(/^(3\d|4\d)$/, "28"), weight: i });
  const seq = [];
  for (let m = 1; m <= 4; m++) for (let dia = 1; dia <= 10; dia++) seq.push({ date: "2026-0" + m + "-" + String(dia).padStart(2, "0"), weight: m * 100 + dia });
  const r = T.validateBackup(backup({ seg: { edit: null, history: { k_s0: seq } } }), SLUGS);
  const out = r.days.seg.history.k_s0;
  assert.equal(out.length, 30);
  assert.equal(out[0].date, "2026-02-01");
  assert.equal(out[29].date, "2026-04-10");
});

test("unit: buildBackup só inclui dias que têm dados", () => {
  const b = T.buildBackup(SLUGS, { seg: null }, { seg: { a_s0: [{ date: "2026-01-01", weight: 1 }] } });
  eq(Object.keys(b.days), ["seg"]);
  assert.equal(b.app, "treino-da-semana");
  assert.equal(b.version, 1);
  assert.equal(b.days.seg.edit, null);
});
