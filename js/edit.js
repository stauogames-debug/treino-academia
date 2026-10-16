window.Treino = window.Treino || {};

// ---- Edição de treino por dia ----
// Cada dia editado é salvo em "treino:edit:{slug}" como JSON:
// { full: "...", exercises: [{ id, name, sets:[{id, reps}], ref }] }
// Se não existir edição salva, usa o treino padrão de workouts.js (fallback).

Treino.editKey = function(slug){ return "treino:edit:" + slug; };

// cb(editData, failed): failed = true quando não foi possível LER a edição
// salva (erro de storage ou JSON inválido). Nesse caso editData vem null, mas
// o app não deve deixar o usuário salvar a estrutura por cima.
Treino.loadDayEdit = function(slug, cb){
  Treino.storageGet(Treino.editKey(slug)).then(function(res){
    if(!res || !res.value){ cb(null, false); return; }
    var editData;
    try { editData = JSON.parse(res.value); } catch(e){ cb(null, true); return; }
    if(!editData || typeof editData !== "object"){ cb(null, true); return; }
    if(!editData.exercises){ cb(editData, false); return; }

    // Edições salvas antes de existirem ids estáveis não têm "id" nos
    // exercícios/séries (séries eram só texto). Detecta isso e normaliza
    // (gera ids na posição atual, igual ao workouts.js) antes de usar —
    // e salva de volta uma única vez, silenciosamente, para não precisar
    // migrar de novo nas próximas vezes.
    var needsMigration = editData.exercises.some(function(ex){
      return !ex.id || !ex.sets || ex.sets.some(function(s){
        return typeof s === "string" || !s.id;
      });
    });

    Treino.ensureIds(editData, slug);

    if(needsMigration){
      Treino.saveDayEdit(slug, editData).catch(function(){});
    }

    cb(editData, false);
  }, function(){ cb(null, true); });
};

Treino.saveDayEdit = function(slug, dayData){
  return Treino.storageSet(Treino.editKey(slug), JSON.stringify(dayData));
};

Treino.clearDayEdit = function(slug){
  return Treino.storageDelete(Treino.editKey(slug));
};

// Retorna a versão "efetiva" do dia: editada (se existir) ou padrão.
// Por aqui os exercícios/séries já chegam com "id" (originalDay vem
// normalizado do workouts.js; editData já foi normalizado em loadDayEdit).
Treino.effectiveDay = function(originalDay, editData){
  if(!editData) {
    return {
      full: originalDay.full,
      exercises: originalDay.exercises.map(function(ex){
        return {
          id: ex.id,
          name: ex.name,
          ref: ex.ref || "",
          sets: ex.sets.map(function(s){ return { id: s.id, reps: s.reps }; })
        };
      })
    };
  }
  return {
    full: editData.full || originalDay.full,
    exercises: (editData.exercises || []).map(function(ex){
      return {
        id: ex.id,
        name: ex.name,
        ref: ex.ref || "",
        sets: (ex.sets || []).map(function(s){ return { id: s.id, reps: s.reps }; })
      };
    })
  };
};

// Cria uma cópia "editável" a partir do estado efetivo atual (para abrir o editor).
// Preserva os ids — só exercícios/séries novos (adicionados no editor)
// ganham id novo, via Treino.makeId (ver app.js).
Treino.cloneForEdit = function(effDay){
  return {
    full: effDay.full,
    exercises: effDay.exercises.map(function(ex){
      return {
        id: ex.id,
        name: ex.name,
        ref: ex.ref || "",
        sets: ex.sets.map(function(s){ return { id: s.id, reps: s.reps }; })
      };
    })
  };
};
