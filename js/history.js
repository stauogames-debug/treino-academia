window.Treino = window.Treino || {};

Treino.lastEntryBefore = function(arr, dateExcl){
  if(!arr || !arr.length) return null;
  var sorted = arr.slice().sort(function(a,b){ return a.date < b.date ? 1 : -1; });
  for(var i=0;i<sorted.length;i++){
    if(sorted[i].date !== dateExcl) return sorted[i];
  }
  return sorted[0].date === dateExcl ? null : sorted[0];
};

Treino.entryForDate = function(arr, date){
  if(!arr) return null;
  for(var i=0;i<arr.length;i++){ if(arr[i].date === date) return arr[i]; }
  return null;
};

Treino.upsertEntry = function(arr, date, weight){
  arr = arr || [];
  for(var i=0;i<arr.length;i++){
    if(arr[i].date === date){ arr[i].weight = weight; return arr; }
  }
  arr.push({ date: date, weight: weight });
  if(arr.length > 30) arr = arr.slice(arr.length - 30);
  return arr;
};

// Junta duas listas de registros [{date, weight}], mantendo a última
// ocorrência de cada data (usado só no caso raro de duas chaves antigas
// migrarem para a mesma chave nova).
Treino.mergeHistoryArrays = function(a, b){
  var map = {};
  (a || []).forEach(function(e){ map[e.date] = e; });
  (b || []).forEach(function(e){ map[e.date] = e; });
  return Object.keys(map).map(function(d){ return map[d]; });
};

// ---- Migração do histórico: "exIdx_setIdx" (posicional) -> "idExercicio_idSerie" ----
//
// O histórico salvo era indexado pela posição do exercício/série na lista
// efetiva do dia (ex.: "2_1" = 3º exercício, 2ª série). Isso quebrava se o
// usuário reordenasse ou removesse algo no meio da lista: a carga "ficava"
// naquela posição e passava a valer para outro exercício/série.
//
// Esta função recebe o dia efetivo atual (já com ids estáveis, ver
// workouts.js/edit.js) e o histórico bruto salvo, e devolve o histórico com
// as chaves antigas convertidas para "idExercicio_idSerie". A conversão usa
// a posição só desta vez, para mapear a chave antiga ao id que ocupa aquela
// posição hoje — depois disso o id passa a ser a fonte da verdade e a
// posição pode mudar livremente sem afetar mais nada.
//
// É silenciosa e automática: roda toda vez que o histórico é carregado, não
// altera nada se já estiver no formato novo, e nunca descarta dados (se uma
// chave antiga não tiver mais exercício/série correspondente na posição,
// ela é mantida como está em vez de ser apagada).
Treino.migrateHistoryKeys = function(effDay, hist){
  if(!hist) return { hist: hist, changed: false };
  var changed = false;
  var out = {};
  var putKey = function(key, val){
    if(out.hasOwnProperty(key)){
      out[key] = Treino.mergeHistoryArrays(out[key], val);
    } else {
      out[key] = val;
    }
  };

  Object.keys(hist).forEach(function(key){
    var m = /^(\d+)_(\d+)$/.exec(key);
    if(m && effDay && effDay.exercises){
      var exIdx = parseInt(m[1], 10);
      var setIdx = parseInt(m[2], 10);
      var ex = effDay.exercises[exIdx];
      var set = ex && ex.sets && ex.sets[setIdx];
      if(ex && set && ex.id && set.id){
        putKey(ex.id + "_" + set.id, hist[key]);
        changed = true;
        return;
      }
      // Posição não existe mais na estrutura atual (já foi removida antes
      // desta migração existir) — mantém a chave antiga para não perder o
      // registro, mesmo que ele já não apareça associado a nada visível.
      putKey(key, hist[key]);
      return;
    }
    putKey(key, hist[key]);
  });

  return { hist: out, changed: changed };
};
