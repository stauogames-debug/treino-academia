window.Treino = window.Treino || {};

// ---- Edição de treino por dia ----
// Cada dia editado é salvo em "treino:edit:{slug}" como JSON:
// { full: "...", exercises: [{ name, sets:[...], ref }] }
// Se não existir edição salva, usa o treino padrão de workouts.js (fallback).

Treino.editKey = function(slug){ return "treino:edit:" + slug; };

Treino.loadDayEdit = function(slug, cb){
  Treino.storageGet(Treino.editKey(slug)).then(function(res){
    cb(res && res.value ? JSON.parse(res.value) : null);
  }).catch(function(){ cb(null); });
};

Treino.saveDayEdit = function(slug, dayData){
  return Treino.storageSet(Treino.editKey(slug), JSON.stringify(dayData));
};

Treino.clearDayEdit = function(slug){
  try {
    if (window.storage && typeof window.storage.delete === "function") {
      return window.storage.delete(Treino.editKey(slug), false);
    }
  } catch(e){}
  try { localStorage.removeItem(Treino.editKey(slug)); } catch(e){}
  return Promise.resolve(true);
};

// Retorna a versão "efetiva" do dia: editada (se existir) ou padrão.
Treino.effectiveDay = function(originalDay, editData){
  if(!editData) {
    return {
      full: originalDay.full,
      exercises: originalDay.exercises.map(function(ex){
        return { name: ex.name, sets: ex.sets.slice(), ref: ex.ref || "" };
      })
    };
  }
  return {
    full: editData.full || originalDay.full,
    exercises: (editData.exercises || []).map(function(ex){
      return { name: ex.name, sets: (ex.sets || []).slice(), ref: ex.ref || "" };
    })
  };
};

// Cria uma cópia "editável" a partir do estado efetivo atual (para abrir o editor).
Treino.cloneForEdit = function(effDay){
  return {
    full: effDay.full,
    exercises: effDay.exercises.map(function(ex){
      return { name: ex.name, sets: ex.sets.slice(), ref: ex.ref || "" };
    })
  };
};
