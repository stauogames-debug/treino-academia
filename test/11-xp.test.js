// XP e níveis: contrato escrito antes da implementação.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test, loadCore, withApp, makeStore, waitFor, ROOT } = require("./harness");
const T = loadCore();
const norm = (x) => JSON.parse(JSON.stringify(x));
const xpFile = () => fs.readFileSync(path.join(ROOT, "js/xp.js"), "utf8");
const setupXp = (extra = {}) => { const s = { console, Date, Math, JSON, Object, Array, Promise, setTimeout, clearTimeout, ...extra }; s.window = s; vm.createContext(s); ["js/data/workouts.js", "js/storage.js", "js/history.js", "js/goals.js", "js/descanso.js", "js/xp.js"].forEach(f => vm.runInContext(fs.readFileSync(path.join(ROOT,f),"utf8"),s)); return s.Treino; };

test("xp: séries usam reps numéricas, tipo de alvo, e ignoram carga", () => {
  const X = setupXp();
  assert.equal(X.xpDaSerie({ reps: "6 a 8" }, { repsDone: "7", weight: 1 }), 10);
  assert.equal(X.xpDaSerie({ reps: "15" }, { repsDone: "15", weight: 500 }), 5);
  assert.equal(X.xpDaSerie({ reps: "6 a 8" }, { weight: 90 }), 0);
  assert.equal(X.xpDaSerie({ reps: "6 a 8" }, { repsDone: "sete" }), 0);
  assert.equal(X.xpDaSerie({ reps: "6 a 8" }, { repsDone: "7", weight: 200 }), X.xpDaSerie({ reps: "6 a 8" }, { repsDone: "7", weight: 1 }));
});

test("xp: exercício completo e meta pagam bônus apenas quando critérios são satisfeitos", () => {
  const X = setupXp(), ex = { id:"e", sets:[{id:"a",reps:"6 a 8"},{id:"b",reps:"15"}] };
  const h = { e_a:[{date:"2026-10-01",weight:30,repsDone:"8"}], e_b:[{date:"2026-10-01",weight:10,repsDone:"15"}] };
  assert.equal(X.xpDoExercicio(ex,h,"2026-10-01"), 20);
  assert.equal(X.xpDoExercicio(ex,{...h,e_b:[{date:"2026-10-01",weight:10}]},"2026-10-01"), 0);
  assert.equal(X.xpMetaBatida(ex,h,"2026-10-01",()=>({weight:30,reps:8})),30);
  assert.equal(X.xpMetaBatida(ex,h,"2026-10-01",()=>null),0);
  assert.equal(X.xpMetaBatida(ex,{...h,e_a:[{date:"2026-10-01",weight:20,repsDone:"8"}]},"2026-10-01",()=>({weight:30,reps:8})),0);
});

test("xp: bônus semanal ocorre no quarto dia treinado e ignora descanso", () => {
  const X=setupXp();
  const dates=["2026-10-19","2026-10-20","2026-10-21","2026-10-22","2026-10-23"];
  const trained=dates.slice(0,4);
  assert.equal(X.xpSemanaBonus(dates[2],trained,[]),0);
  assert.equal(X.xpSemanaBonus(dates[3],trained,[]),50);
  assert.equal(X.xpSemanaBonus(dates[4],dates,[]),0);
  assert.equal(X.xpSemanaBonus(dates[3],dates,[dates[1]]),0);
});

test("xp: níveis, custo e progresso", () => {
  const X=setupXp();
  assert.equal(X.custoNivel(2),100); assert.equal(X.custoNivel(3),125); assert.equal(X.custoNivel(4),155);
  assert.equal(X.nivelDoXp(0).level,1); assert.equal(X.nivelDoXp(100).level,2);
  const p=X.progressoNivel(150); assert.equal(p.level,2); assert.equal(p.current,50); assert.equal(p.next,125); assert.equal(p.fraction,0.4);
});

test("xp: livro mantém pontos após corte de histórico e recalcula só a data editada", async () => {
  const X=setupXp(), hist={e_s:Array.from({length:31},(_,i)=>({date:`2026-09-${String(i+1).padStart(2,"0")}`,repsDone:"8"}))};
  const book={"2026-09-01":10,"2026-10-01":20};
  const result=X.xpRecalcDate("2026-10-01",book,[hist],[{slug:"seg",exercises:[{id:"e",sets:[{id:"s",reps:"6 a 8"}]}]}],[],[]);
  assert.equal(result["2026-09-01"],10); assert.equal(result["2026-10-01"],undefined);
});

test("xp: leitura falha ou JSON inválido bloqueia gravação do livro", async () => {
  const X=setupXp(), store=makeStore({"treino:xp":"{{bad"});
  assert.equal(await X.xpLoadBook(store.api),null);
  assert.equal(store.map.get("treino:xp"),"{{bad");
  const failed=makeStore({"treino:xp":{"2026-10-01":5}});failed.failRead.add("treino:xp");
  const w=setupXp({storage:failed.api}); assert.equal(await w.xpLoadBook(),null); assert.equal(failed.map.get("treino:xp"),'{"2026-10-01":5}');
});

test("xp: migração inicial só cria livro uma vez; histórico já cortado não é recuperável", async () => {
  // Registros anteriores ao limite de 30 por série já cortados ficam fora da migração; esse é o limite aceito.
  const X=setupXp(), h={seg:{e_s:Array.from({length:30},(_,i)=>({date:i<29?`2026-09-${String(i+2).padStart(2,"0")}`:"2026-10-01",repsDone:"8"}))}};
  const days=[{slug:"seg",exercises:[{id:"e",sets:[{id:"s",reps:"6 a 8"}]}]}];
  const b=await X.xpMigrate(null,h,days,[]); assert.equal(b["2026-09-01"],undefined); assert.equal(Object.keys(b).length,30);
  assert.equal((await X.xpMigrate({"2026-10-01":7},h,days,[]))["2026-10-01"],7);
});

test("xp: versão 3 exporta e valida livro; legado conserva livro local", () => {
  const b=T.buildBackup(["seg"],{}, {seg:{}}, [], {"2026-10-01":45});
  assert.equal(b.version,3); assert.equal(b.xp["2026-10-01"],45);
  const r=T.validateBackup(b,["seg"]); assert.equal(r.xp["2026-10-01"],45);
  const old={...b,version:2}; delete old.xp;
  assert.equal(T.validateBackup(old,["seg"]).xpMode,"legacy-merge");
});

test("xp backup: v3 substitui livro, legado mantém máximo local e o automático inclui XP", async () => {
  await withApp({seed:{"treino:xp":{"2026-10-01":88}}},async c=>{
    const v3={app:"treino-da-semana",version:3,days:{seg:{edit:null,history:{}}},xp:{"2026-10-02":42}};
    await c.importFile(JSON.stringify(v3)); await waitFor(()=>c.$("#toast").textContent==="Backup importado","backup v3");
    assert.deepEqual(c.store.json("treino:xp"),{"2026-10-02":42});
    assert.deepEqual(JSON.parse(c.log.downloads[0].text).xp,{"2026-10-01":88});
  });
  await withApp({seed:{"treino:xp":{"2026-10-02":100}}},async c=>{
    const v2={app:"treino-da-semana",version:2,days:{seg:{edit:null,history:{seg_ex0_s0:[{date:"2026-10-02",repsDone:"8"}]}}}};
    await c.importFile(JSON.stringify(v2)); await waitFor(()=>c.$("#toast").textContent==="Backup importado","backup v2");
    assert.equal(c.store.json("treino:xp")["2026-10-02"],100);
  });
});

test("xp backup: datas e valores inválidos de v3 são descartados e contados", () => {
  const b={app:"treino-da-semana",version:3,days:{seg:{edit:null,history:{}}},xp:{"2026-02-30":4,"2026-10-01":-1,"2026-10-02":1000001,"2026-10-03":8}};
  const r=T.validateBackup(b,["seg"]); assert.deepEqual(norm(r.xp),{"2026-10-03":8}); assert.ok(r.stats.dropped>=3);
});

test("xp: falha de leitura do livro não bloqueia salvar carga", () => {
  const store=makeStore({"treino:xp":{"2026-10-01":9}});store.failRead.add("treino:xp");
  return withApp({store},async c=>{await c.typeLoad("seg_ex0_s0","20");assert.equal(c.store.json("treino:seg").seg_ex0_s0[0].weight,20);assert.equal(store.map.get("treino:xp"),'{"2026-10-01":9}');});
});

test("xp: salvar reps atualiza data sem apagar pontos de outras datas", () => withApp(async c => {
  await waitFor(()=>c.input("seg_ex0_s0","repsDone"),"campo de reps");
  c.store.map.set("treino:xp",JSON.stringify({"2026-01-01":99}));
  c.change(c.input("seg_ex0_s0","repsDone"),"8"); await c.idle(100);
  assert.ok(c.store.json("treino:xp")["2026-01-01"]===99);
}));

test("xp (tela): cabeçalho, aba Evolução e editor", () => withApp({seed:{"treino:xp":{"2026-10-01":100}}},async c => {
  await waitFor(()=>c.$("#xpHead")&&c.$("#xpHead").textContent.includes("Nível 2"),"nível no cabeçalho");
  assert.ok(c.$("#xpHead .xp-track"));
  c.click(c.$("#tabEvo")); await waitFor(()=>c.$(".xp-evolution"),"bloco de evolução");
  assert.match(c.$(".xp-evolution").textContent,/Nível e XP/);
  c.click(c.$$(".tab[data-day]")[0]); await waitFor(()=>c.$(".exercise"),"treino"); c.click(c.$("#editToggle"));
  await waitFor(()=>c.$(".edit-exercise"),"editor"); assert.equal(c.$("#xpHead"),null);
}));
