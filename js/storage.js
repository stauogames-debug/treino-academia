window.Treino = window.Treino || {};

// Lê uma chave. Resolve com { value } quando existe, com null quando NÃO existe,
// e REJEITA quando houve erro real de leitura (para o app não confundir
// "falha ao ler" com "vazio" e acabar sobrescrevendo dados).
Treino.storageGet = function(key){
  try {
    if (window.storage && typeof window.storage.get === "function") {
      return Promise.resolve(window.storage.get(key, false)).catch(function(err){
        // Alguns storages rejeitam quando a chave não existe. Confirma pela
        // listagem: se a chave não está lá (ou a listagem não é possível),
        // trata como "não existe".
        if (typeof window.storage.list !== "function") return null;
        return Promise.resolve(window.storage.list(key, false)).then(function(r){
          var keys = (r && r.keys) || [];
          if (keys.indexOf(key) === -1) return null;
          throw err;
        }, function(){ return null; });
      });
    }
  } catch(e){}
  try {
    var v = localStorage.getItem(key);
    return Promise.resolve(v ? { value: v } : null);
  } catch(e){
    return Promise.reject(e);
  }
};

Treino.storageSet = function(key, value){
  try {
    if (window.storage && typeof window.storage.set === "function") {
      return window.storage.set(key, value, false);
    }
  } catch(e){}
  try { localStorage.setItem(key, value); } catch(e){ return Promise.reject(e); }
  return Promise.resolve(true);
};

// Apaga uma chave. Não é erro apagar algo que já não existe.
Treino.storageDelete = function(key){
  try {
    if (window.storage && typeof window.storage.delete === "function") {
      return Promise.resolve(window.storage.delete(key, false)).then(function(){
        return true;
      }, function(err){
        return Treino.storageGet(key).then(function(res){
          if (res && res.value) throw err;
          return true;
        });
      });
    }
  } catch(e){}
  try { localStorage.removeItem(key); } catch(e){ return Promise.reject(e); }
  return Promise.resolve(true);
};

// cb(hist, failed): failed = true quando não foi possível ler/interpretar o
// histórico. Nesse caso hist vem vazio, mas o app NÃO deve gravar por cima.
Treino.loadDayHistory = function(slug, cb){
  Treino.storageGet("treino:" + slug).then(function(res){
    if(!res || !res.value){ cb({}, false); return; }
    var parsed;
    try { parsed = JSON.parse(res.value); } catch(e){ cb({}, true); return; }
    if(!parsed || typeof parsed !== "object" || Array.isArray(parsed)){ cb({}, true); return; }
    cb(parsed, false);
  }, function(){ cb({}, true); });
};
