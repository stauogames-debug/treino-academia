window.Treino = window.Treino || {};

// ---- Meta por exercício (dupla progressão) — só sugestão de leitura ----
//
// Não grava nada e não mexe em histórico nem em estrutura: recebe o exercício
// efetivo e o histórico do dia e devolve { weight, reps, kind } ou null.
// Tudo é calculado pelos IDs (chave "idExercicio_idSerie"), então reordenar
// ou editar o treino não desloca a meta.

// Degrau de carga por dia (kg). Fácil de ajustar.
Treino.STEP_KG = { seg: 2, ter: 2, qui: 2, qua: 5, sex: 5 };
Treino.DEFAULT_STEP_KG = 2;

// "6 a 8" (também aceita "6-8") -> { lo: 6, hi: 8 }; "15" ou texto -> null.
function parseRange(reps){
  var m = /^\s*(\d+)\s*(?:a|-|–)\s*(\d+)\s*$/i.exec(String(reps == null ? "" : reps));
  if(!m) return null;
  var lo = parseInt(m[1], 10), hi = parseInt(m[2], 10);
  if(hi < 1 || lo > hi) return null;
  return { lo: lo, hi: hi };
}

function validWeight(w){ return typeof w === "number" && isFinite(w) && w > 0; }
function validReps(r){ return r !== undefined && r !== null && /^\d+$/.test(String(r).trim()); }
function round2(x){ return Math.round(x * 100) / 100; }
function sum(list){ return list.reduce(function(a, s){ return a + s.reps; }, 0); }

// Sessão = data em que TODAS as séries de trabalho têm carga numérica e reps
// feitas numéricas. Sessão incompleta é ignorada (melhor nada do que meta ruim).
function buildSessions(ex, hist, dateExcl, ws){
  var dates = {};
  ws.forEach(function(w){
    (hist[ex.id + "_" + w.id] || []).forEach(function(e){
      if(e && typeof e.date === "string" && e.date < dateExcl) dates[e.date] = true;
    });
  });
  var out = [];
  Object.keys(dates).sort().reverse().forEach(function(date){
    var sets = [];
    for(var i = 0; i < ws.length; i++){
      var e = Treino.entryForDate(hist[ex.id + "_" + ws[i].id], date);
      if(!e || !validWeight(e.weight) || !validReps(e.repsDone)) return;
      sets.push({ weight: e.weight, reps: parseInt(String(e.repsDone).trim(), 10), lo: ws[i].lo, hi: ws[i].hi });
    }
    out.push({ date: date, sets: sets });
  });
  return out; // da mais recente para a mais antiga
}

function hitTop(s){ return s.sets.every(function(x){ return x.reps >= x.hi; }); }
function belowFloor(s){ return s.sets.some(function(x){ return x.reps < x.lo; }); }
function sameLoad(a, b){
  return a.sets.every(function(x, i){ return x.weight === b.sets[i].weight; });
}

// exercicio: { id, sets:[{id, reps}] } (dia efetivo)
// hist: histórico do dia { "idEx_idSerie": [{date, weight, repsDone}] }
// dateExcl: só sessões estritamente ANTERIORES a esta data (ISO)
// stepKg: degrau de carga (padrão Treino.DEFAULT_STEP_KG)
Treino.suggestGoal = function(exercicio, hist, dateExcl, stepKg){
  if(!exercicio || !exercicio.sets || !hist) return null;
  var step = (typeof stepKg === "number" && stepKg > 0) ? stepKg : Treino.DEFAULT_STEP_KG;

  var ws = [];
  exercicio.sets.forEach(function(s){
    var r = parseRange(s.reps);
    if(r) ws.push({ id: s.id, lo: r.lo, hi: r.hi });
  });
  if(!ws.length) return null;

  var sessions = buildSessions(exercicio, hist, dateExcl, ws);
  if(sessions.length < 2) return null;

  var s1 = sessions[0], s2 = sessions[1], s3 = sessions[2];
  var last = s1.sets[s1.sets.length - 1];   // série de trabalho mais recente = base
  var same12 = sameLoad(s1, s2);

  // 1) Duas sessões batendo o topo com a mesma carga: sobe UM degrau, volta ao piso.
  if(same12 && hitTop(s1) && hitTop(s2)){
    return { weight: round2(last.weight + step), reps: last.lo, kind: "up" };
  }

  // 2) Reps caíram duas vezes seguidas com a mesma carga: reduz um degrau
  //    (se a redução zerar a carga, cai no "manter" logo abaixo).
  if(s3 && same12 && sameLoad(s2, s3) && sum(s1.sets) < sum(s2.sets) && sum(s2.sets) < sum(s3.sets) && last.weight - step > 0){
    return { weight: round2(last.weight - step), reps: last.lo, kind: "down" };
  }

  // 3) Duas sessões abaixo do piso, ou reps caíram (mesma carga): mantém a carga.
  var dropped = same12 && sum(s1.sets) < sum(s2.sets);
  if((belowFloor(s1) && belowFloor(s2)) || dropped){
    return { weight: last.weight, reps: Math.min(last.hi, Math.max(last.lo, last.reps)), kind: "hold" };
  }

  // 4) Dentro da faixa: mesma carga, +1 rep na série mais longe do topo.
  var weakest = s1.sets[0];
  s1.sets.forEach(function(x){
    if(x.hi - x.reps >= weakest.hi - weakest.reps) weakest = x;
  });
  var reps = Math.max(weakest.lo, Math.min(weakest.hi, weakest.reps + 1));
  return { weight: last.weight, reps: reps, kind: "reps" };
};

Treino.formatGoal = function(g){
  var notes = { up: "subir a carga", reps: "+1 rep", hold: "manter a carga", down: "reduzir um degrau" };
  return { text: "Meta hoje: " + g.weight + " kg × " + g.reps, note: notes[g.kind] || "" };
};
