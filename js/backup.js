window.Treino = window.Treino || {};

(function(){

// ---- Backup: exportar / importar treino + histórico (JSON) ----
//
// Formato do arquivo:
// {
//   "app": "treino-da-semana",
//   "version": 1,
//   "exportedAt": "2026-09-28T23:10:00.000Z",
//   "days": {
//     "seg": { "edit": null | { full, exercises:[{id,name,ref,sets:[{id,reps}]}] },
//              "history": { "idExercicio_idSerie": [{date, weight?, repsDone?}] } },
//     ...
//   }
// }
// "edit: null" significa "este dia usa o treino padrão de workouts.js".
//
// Tudo que entra por importação é tratado como entrada NÃO confiável:
// validado e copiado campo a campo (nada do arquivo vai direto para o
// storage ou para o HTML sem passar por aqui).

Treino.BACKUP_APP = "treino-da-semana";
Treino.BACKUP_VERSION = 1;
Treino.BACKUP_MAX_BYTES = 5 * 1024 * 1024;

// Data do último backup MANUAL (exportar ou copiar). É preferência do
// aparelho, como o tema: não entra no arquivo de backup e a importação não a
// altera.
Treino.LASTBACKUP_KEY = "treino:lastBackup";
Treino.BACKUP_STALE_DAYS = 7;

// Texto do lembrete. iso = data ISO guardada (ou vazio/inválido = nunca feito).
// Devolve { text, stale }: stale = true quando nunca foi feito ou faz 7+ dias.
Treino.describeLastBackup = function(iso, now){
  var never = { text: "Último backup: nunca feito", stale: true };
  if(typeof iso !== "string" || !iso) return never;
  var t = new Date(iso);
  if(isNaN(t.getTime())) return never;
  now = now || new Date();
  var a = new Date(t.getFullYear(), t.getMonth(), t.getDate());
  var b = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  var days = Math.round((b.getTime() - a.getTime()) / 86400000);
  if(days <= 0){
    var p = function(n){ return (n < 10 ? "0" : "") + n; };
    return { text: "Último backup: hoje às " + p(t.getHours()) + ":" + p(t.getMinutes()), stale: false };
  }
  if(days === 1) return { text: "Último backup: ontem", stale: false };
  return { text: "Último backup: há " + days + " dias", stale: days >= Treino.BACKUP_STALE_DAYS };
};

Treino.buildBackup = function(slugs, editBySlug, historyBySlug){
  var days = {};
  slugs.forEach(function(slug){
    if(!has(editBySlug, slug) && !has(historyBySlug, slug)) return;
    days[slug] = {
      edit: editBySlug[slug] || null,
      history: historyBySlug[slug] || {}
    };
  });
  return {
    app: Treino.BACKUP_APP,
    version: Treino.BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    days: days
  };
};

var ID_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,119}$/;
var DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
var BLOCKED = ["constructor", "prototype", "hasOwnProperty", "toString", "valueOf", "__proto__"];
var has = function(o, k){ return Object.prototype.hasOwnProperty.call(o, k); };

function isPlainObject(o){
  return o !== null && typeof o === "object" && !Array.isArray(o);
}
function safeId(v){
  return typeof v === "string" && ID_RE.test(v) && BLOCKED.indexOf(v) === -1;
}
function validDate(s){
  if(typeof s !== "string" || !DATE_RE.test(s)) return false;
  var p = s.split("-");
  var d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
  return d.getUTCFullYear() === +p[0] && d.getUTCMonth() === +p[1] - 1 && d.getUTCDate() === +p[2];
}

// Devolve { edit } com a edição limpa, ou { error } com o motivo.
function cleanEdit(e, label){
  if(!isPlainObject(e)) return { error: label + ": edição em formato inválido" };
  if(typeof e.full !== "string" || !e.full.trim() || e.full.length > 120){
    return { error: label + ": nome do dia inválido" };
  }
  if(!Array.isArray(e.exercises) || e.exercises.length === 0 || e.exercises.length > 60){
    return { error: label + ": lista de exercícios inválida" };
  }
  var exIds = {};
  var exercises = [];
  for(var i = 0; i < e.exercises.length; i++){
    var ex = e.exercises[i];
    if(!isPlainObject(ex) || !safeId(ex.id) || has(exIds, ex.id)){
      return { error: label + ": exercício " + (i + 1) + " com id inválido ou repetido" };
    }
    exIds[ex.id] = true;
    if(typeof ex.name !== "string" || !ex.name.trim() || ex.name.length > 120){
      return { error: label + ": exercício " + (i + 1) + " com nome inválido" };
    }
    var ref = ex.ref == null ? "" : ex.ref;
    if(typeof ref !== "string" || ref.length > 200){
      return { error: label + ": exercício " + (i + 1) + " com referência inválida" };
    }
    if(!Array.isArray(ex.sets) || ex.sets.length === 0 || ex.sets.length > 30){
      return { error: label + ": exercício " + (i + 1) + " com séries inválidas" };
    }
    var setIds = {};
    var sets = [];
    for(var j = 0; j < ex.sets.length; j++){
      var st = ex.sets[j];
      if(!isPlainObject(st) || !safeId(st.id) || has(setIds, st.id)){
        return { error: label + ": série " + (j + 1) + " do exercício " + (i + 1) + " com id inválido ou repetido" };
      }
      setIds[st.id] = true;
      var reps = (typeof st.reps === "number") ? String(st.reps) : st.reps;
      if(typeof reps !== "string" || !reps.trim() || reps.length > 30){
        return { error: label + ": série " + (j + 1) + " do exercício " + (i + 1) + " com reps inválidas" };
      }
      sets.push({ id: st.id, reps: reps.trim() });
    }
    exercises.push({ id: ex.id, name: ex.name.trim(), ref: ref.trim(), sets: sets });
  }
  return { edit: { full: e.full.trim(), exercises: exercises } };
}

// Limpa o histórico de um dia. Registros/chaves inválidos são descartados
// (e contados em "dropped"); não derruba o arquivo inteiro por causa deles.
function cleanHistory(h){
  var out = {};
  var records = 0, dropped = 0;
  if(!isPlainObject(h)) return { history: out, records: 0, dropped: 1 };
  Object.keys(h).forEach(function(key){
    var arr = h[key];
    // Aceita chaves novas ("idExercicio_idSerie") e antigas ("2_1"); ambas
    // batem com esta regra. Nomes perigosos de objeto são recusados.
    if(!ID_RE.test(key) || BLOCKED.indexOf(key) !== -1 || !Array.isArray(arr)){ dropped++; return; }
    var byDate = {};
    arr.forEach(function(en){
      if(!isPlainObject(en) || !validDate(en.date)){ dropped++; return; }
      var item = { date: en.date };
      if(en.weight !== undefined && en.weight !== null){
        if(typeof en.weight !== "number" || !isFinite(en.weight) || en.weight < 0 || en.weight > 1000){ dropped++; return; }
        if(en.weight) item.weight = en.weight;
      }
      if(en.repsDone !== undefined && en.repsDone !== null){
        var r = (typeof en.repsDone === "number") ? String(en.repsDone) : en.repsDone;
        if(typeof r !== "string" || r.length > 20){ dropped++; return; }
        r = r.trim();
        if(r) item.repsDone = r;
      }
      if(!item.weight && !item.repsDone){ dropped++; return; }
      byDate[item.date] = item; // mesma data repetida: vale a última
    });
    var list = Object.keys(byDate).sort().map(function(d){ return byDate[d]; });
    if(list.length > 30) list = list.slice(list.length - 30);
    if(list.length){
      out[key] = list;
      records += list.length;
    }
  });
  return { history: out, records: records, dropped: dropped };
}

// Valida e limpa um backup já convertido de JSON.
// Devolve { ok:true, days:{slug:{edit,history}}, exportedAt, stats:{days,edits,records,dropped} }
// ou { ok:false, error }.
Treino.validateBackup = function(obj, slugs){
  if(!isPlainObject(obj) || obj.app !== Treino.BACKUP_APP){
    return { ok: false, error: "Este arquivo não é um backup do Treino da Semana." };
  }
  if(typeof obj.version !== "number" || obj.version > Treino.BACKUP_VERSION || obj.version < 1){
    return { ok: false, error: "Versão de backup não suportada (" + obj.version + "). Atualize o app." };
  }
  if(!isPlainObject(obj.days)){
    return { ok: false, error: "Backup sem a lista de dias." };
  }
  var days = {};
  var stats = { days: 0, edits: 0, records: 0, dropped: 0 };
  for(var k = 0; k < slugs.length; k++){
    var slug = slugs[k];
    if(!has(obj.days, slug)) continue;
    var d = obj.days[slug];
    if(!isPlainObject(d)){ return { ok: false, error: "Dia \"" + slug + "\" em formato inválido." }; }
    var edit = null;
    if(d.edit !== null && d.edit !== undefined){
      var ce = cleanEdit(d.edit, "Dia \"" + slug + "\"");
      if(ce.error) return { ok: false, error: ce.error };
      edit = ce.edit;
      stats.edits++;
    }
    var ch = cleanHistory(d.history === undefined ? {} : d.history);
    stats.records += ch.records;
    stats.dropped += ch.dropped;
    stats.days++;
    days[slug] = { edit: edit, history: ch.history };
  }
  if(stats.days === 0){
    return { ok: false, error: "O backup não contém nenhum dia conhecido (seg, ter, qua, qui, sex)." };
  }
  return { ok: true, days: days, exportedAt: typeof obj.exportedAt === "string" ? obj.exportedAt : "", stats: stats };
};
})();
