window.Treino = window.Treino || {};

Treino.storageGet = function(key){
  try {
    if (window.storage && typeof window.storage.get === "function") {
      return window.storage.get(key, false);
    }
  } catch(e){}
  var v = null;
  try { v = localStorage.getItem(key); } catch(e){}
  return Promise.resolve(v ? { value: v } : null);
};

Treino.storageSet = function(key, value){
  try {
    if (window.storage && typeof window.storage.set === "function") {
      return window.storage.set(key, value, false);
    }
  } catch(e){}
  try { localStorage.setItem(key, value); } catch(e){}
  return Promise.resolve(true);
};

Treino.loadDayHistory = function(slug, cb){
  Treino.storageGet("treino:" + slug).then(function(res){
    cb(res && res.value ? JSON.parse(res.value) : {});
  }).catch(function(){ cb({}); });
};
